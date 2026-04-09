"""基于 LLM 自动生成接口测试用例（单接口 & 依赖链路）"""

from __future__ import annotations

import json
import logging
import re
import threading
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

from sqlalchemy.orm import Session

from app.models import Requirement, TestCase
from app.models_api import ApiCollection, ApiEndpoint, ApiEnvironment
from app.services import llm_client
from app.services.api_case_runner import merged_environment_variables_dict
from app.util import new_id

logger = logging.getLogger(__name__)

CHAT_TIMEOUT_SEC = 300


def _normalize_step_request_path(req: dict[str, Any]) -> None:
    """If path contains query params, extract them into request.json and clean the path.

    Also handles cases where LLM puts the full URL (with host) in the path field.
    """
    raw_path = str(req.get("path") or "/")
    if "?" not in raw_path and "://" not in raw_path:
        return

    try:
        parsed = urlparse(raw_path) if "://" in raw_path else urlparse("http://placeholder" + raw_path)
    except Exception:
        return

    clean_path = unquote(parsed.path) if parsed.path else "/"
    if "://" in raw_path and clean_path == "/":
        clean_path = raw_path.split("?")[0]

    qs = parse_qs(parsed.query, keep_blank_values=True)
    if not qs:
        if "://" in raw_path:
            req["path"] = clean_path
        return

    params: dict[str, str] = {}
    for k, v_list in qs.items():
        params[unquote(k)] = unquote(v_list[0]) if v_list else ""

    existing_json = req.get("json")
    if isinstance(existing_json, dict):
        merged = {**params, **existing_json}
        req["json"] = merged
    elif existing_json is None:
        req["json"] = params

    req["path"] = clean_path


def _repair_json(text: str) -> str:
    """Fix common LLM JSON issues: trailing commas, single quotes, comments."""
    t = re.sub(r"//[^\n]*", "", text)
    t = re.sub(r",\s*([}\]])", r"\1", t)
    return t


def _parse_llm_json(text: str) -> Any:
    """Extract and parse JSON array from LLM output, with repair attempts."""
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    raw = m.group(1).strip() if m else text.strip()
    if not raw.startswith("["):
        m2 = re.search(r"\[[\s\S]*\]", raw)
        if m2:
            raw = m2.group(0)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    repaired = _repair_json(raw)
    try:
        return json.loads(repaired)
    except json.JSONDecodeError:
        pass
    m3 = re.search(r"\[[\s\S]*\]", text)
    if m3:
        try:
            return json.loads(_repair_json(m3.group(0)))
        except json.JSONDecodeError:
            pass
    raise ValueError(f"无法解析 LLM 返回的 JSON（前 500 字符）: {text[:500]}")

# ---------------------------------------------------------------------------
# Prompt templates
# ---------------------------------------------------------------------------

SINGLE_API_SYSTEM_PROMPT_TMPL = """\
你是一名资深 API 测试工程师。为给定的 HTTP 接口生成 {category_desc} 的测试场景。

只生成 {count} 个属于「{category}」分类的测试场景，不要其他分类。

每个场景输出为 JSON 对象：
- name: 「{category}-具体场景」
- category: "{category}"
- priority: P0/P1/P2
- description: 一句话描述预期行为
- request: {{method, path, headers: {{}}, json: {{...}}}}
- assert: [{{type: "status", equals: 数字}}, ...]

## 关键要求 1：request.json 必须针对每个场景做出实际修改

request.json 中的**字段名必须与样例请求 requestBody 中的字段名完全一致**，不要自行改名（如样例用 uid 就用 uid，不要改成 user_id）。只修改字段的值，不要修改字段名。

每个测试场景的 request.json 必须真正体现该场景的测试意图，不能所有场景都用相同的请求参数。示例：
- 「参数校验-必填字段为空」→ 把必填字段设为 "" 或 null，或直接删掉该字段
- 「参数校验-类型错误」→ 把数字字段改为字符串 "abc"，把字符串字段改为数字
- 「边界值-超长字符串」→ 把字符串字段改为 500+ 字符的长串
- 「边界值-空串」→ 把字符串字段改为 ""
- 「异常场景-未授权」→ 请求头去掉 Authorization 或使用无效 Token
- 「正常流程」→ 使用合理的合法参数（可以和原样例不同的合法值）

如果接口是 GET 且参数在 query string / json 中，同样需要修改参数值来制造不同场景。

## 关键要求 2：断言必须优先参考接口文档

很多业务接口在参数错误/异常时，HTTP 状态码仍然返回 200，而通过响应体中的业务错误码（如 error_code、code、errno 等字段）区分成功与失败。

断言生成规则（按优先级）：
1. **如果接口文档（apiDoc）中明确说明了错误码/状态码**，必须严格按文档断言。
   例如文档说"缺少参数返回 error_code=10001"，则断言应为：
   [{{"type":"status","equals":200}},{{"type":"jsonpath_equals","path":"$.error_code","equals":10001}}]
2. **如果接口文档未提供具体错误码，但样例响应中可以看到 error_code/code 等字段**，
   则根据场景合理推测业务错误码，并用 jsonpath_equals 断言。
3. **只有在完全没有接口文档、也看不出业务错误码模式时**，才使用通用 HTTP 4xx 断言。

断言类型支持: status / jsonpath_exists / jsonpath_equals / jsonpath_not_equals / body_contains / status_in
每个场景至少一个断言。正常流程场景断言成功状态码 + 关键响应字段。

只输出合法 JSON 数组，无注释无尾逗号，紧凑格式。"""

SINGLE_API_CATEGORIES = [
    ("正常流程", "正常流程（Happy Path，使用合法参数验证成功响应）", 2),
    ("参数校验", "参数校验（必填为空、类型错误、格式不合法）", 4),
    ("异常场景", "异常场景（未授权/Token过期/重复提交）和业务规则异常", 3),
    ("边界值", "边界值测试（空串、超长字符串、数值极值）", 3),
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _endpoint_info_for_prompt(ep: ApiEndpoint) -> dict[str, Any]:
    """Build a concise endpoint descriptor for the LLM prompt."""
    info: dict[str, Any] = {
        "id": ep.id,
        "method": ep.method,
        "path": ep.path,
        "name": ep.name or "",
        "description": ep.description or "",
    }
    draft: dict[str, Any] = {}
    if ep.debugDraft:
        try:
            draft = json.loads(ep.debugDraft)
            if not isinstance(draft, dict):
                draft = {}
        except json.JSONDecodeError:
            draft = {}

    body_str = (draft.get("body") or "").strip()
    if not body_str and ep.sampleRequest:
        body_str = ep.sampleRequest.strip()

    if body_str:
        try:
            info["requestBody"] = json.loads(body_str)
        except json.JSONDecodeError:
            info["requestBody"] = body_str

    headers_str = (draft.get("headers") or "").strip()
    if headers_str and headers_str != "{}":
        try:
            h = json.loads(headers_str)
            if isinstance(h, dict) and h:
                info["headers"] = h
        except json.JSONDecodeError:
            pass

    if ep.apiDoc and ep.apiDoc.strip():
        info["apiDoc"] = ep.apiDoc.strip()

    last_result = draft.get("lastDebugResult")
    if isinstance(last_result, dict):
        resp_body = last_result.get("responseBody") or last_result.get("body") or ""
        if isinstance(resp_body, str) and resp_body.strip():
            try:
                info["sampleResponse"] = json.loads(resp_body)
            except json.JSONDecodeError:
                pass

    return info


def _run_llm_chat(system_prompt: str, user_prompt: str) -> str:
    """Run LLM chat on a background thread with timeout."""
    result_holder: dict[str, Any] = {}
    err_holder: dict[str, BaseException] = {}

    def _call():
        try:
            result_holder["text"] = llm_client.chat(
                [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                maxTokens=16384,
            )
        except BaseException as e:
            err_holder["e"] = e

    th = threading.Thread(target=_call)
    th.start()
    th.join(timeout=CHAT_TIMEOUT_SEC)
    if th.is_alive():
        raise RuntimeError("LLM 响应超时，请稍后重试")
    if "e" in err_holder:
        raise err_holder["e"]
    return result_holder.get("text", "")


def _normalize_assertion(a: dict[str, Any]) -> dict[str, Any]:
    """
    Normalize LLM-generated assertion to the format expected by run_assertions.
    Handles common LLM variations like {status_code: 200} → {type: "status", equals: 200}.
    """
    if not isinstance(a, dict):
        return a

    if "type" in a:
        return a

    if "status_code" in a:
        return {"type": "status", "equals": a["status_code"]}
    if "status" in a and "type" not in a:
        return {"type": "status", "equals": a["status"]}

    jp = a.get("jsonpath") or a.get("path") or a.get("json_path")
    op = str(a.get("operator") or "").strip().lower()

    if jp and op in ("not_empty", "exists", "not_null", "notempty"):
        return {"type": "jsonpath_exists", "path": jp}
    if jp and op in ("==", "equals", "eq", "equal"):
        return {"type": "jsonpath_equals", "path": jp, "equals": a.get("expect", a.get("expected", a.get("value")))}
    if jp and op in ("!=", "not_equals", "ne", "not_equal"):
        return {"type": "jsonpath_not_equals", "path": jp, "equals": a.get("expect", a.get("expected", a.get("value")))}
    if jp and op in ("contains",):
        return {"type": "body_contains", "contains": a.get("expect", a.get("expected", a.get("value", "")))}
    if jp and op in ("type", "typeof"):
        return {"type": "jsonpath_type", "path": jp, "expected": a.get("expect", a.get("expected", a.get("value")))}
    if jp:
        return {"type": "jsonpath_exists", "path": jp}

    if "contains" in a:
        return {"type": "body_contains", "contains": a["contains"]}

    return a


def _normalize_step_asserts(step: dict[str, Any]) -> None:
    """Normalize all assertions in a step in-place."""
    assert_list = step.get("assert")
    if isinstance(assert_list, list):
        step["assert"] = [_normalize_assertion(a) for a in assert_list if isinstance(a, dict)]


# ---------------------------------------------------------------------------
# Single API test generation
# ---------------------------------------------------------------------------

def generate_single_api_tests(
    db: Session,
    endpoint_ids: list[str],
    environment_id: str | None = None,
    global_prompt: str = "",
) -> dict[str, Any]:
    """
    For each endpoint, call LLM to generate test scenarios.
    Returns: { collections: [...], testCases: int, requirementId: str }
    """
    if not llm_client.is_configured():
        raise RuntimeError("LLM 未配置")

    endpoints = db.query(ApiEndpoint).filter(ApiEndpoint.id.in_(endpoint_ids)).all()
    if not endpoints:
        raise ValueError("未找到指定的接口")

    env_info = ""
    if environment_id:
        env = db.query(ApiEnvironment).filter(ApiEnvironment.id == environment_id).first()
        if env:
            vars_dict = merged_environment_variables_dict(env)
            if vars_dict:
                env_info = f"\n\n## 环境变量（可用 {{{{变量名}}}} 引用）\n{json.dumps(vars_dict, ensure_ascii=False, indent=2)}"

    req_id = new_id()
    req = Requirement(
        id=req_id,
        title=f"[接口测试] {', '.join(ep.name or f'{ep.method} {ep.path}' for ep in endpoints[:3])}{'...' if len(endpoints) > 3 else ''}",
        content="由接口测试用例自动生成功能创建",
    )
    db.add(req)

    collections_created: list[dict[str, Any]] = []
    total_test_cases = 0

    for ep in endpoints:
        ep_info = _endpoint_info_for_prompt(ep)
        ep_json_str = json.dumps(ep_info, ensure_ascii=False, indent=2)

        scenarios: list[dict[str, Any]] = []
        for cat_name, cat_desc, cat_count in SINGLE_API_CATEGORIES:
            sys_prompt = SINGLE_API_SYSTEM_PROMPT_TMPL.format(
                category=cat_name, category_desc=cat_desc, count=cat_count,
            )
            api_doc_section = ""
            if ep.apiDoc and ep.apiDoc.strip():
                api_doc_section = f"\n\n## 接口文档\n{ep.apiDoc.strip()}"

            global_prompt_section = ""
            if global_prompt.strip():
                global_prompt_section = f"\n\n## 补充说明\n{global_prompt.strip()}"

            sample_resp_hint = ""
            if "sampleResponse" in ep_info:
                sample_resp_hint = (
                    "\n\n上面 sampleResponse 是该接口正常调用的**实际响应样例**。"
                    "请注意响应体中的错误码字段（如 error_code、code 等）和消息字段，"
                    "异常场景的断言应基于这些业务字段而非 HTTP 状态码。"
                )

            user_prompt = (
                f"## 接口定义\n```json\n{ep_json_str}\n```\n\n"
                f"上面 requestBody 是该接口的一个**样例请求参数**。"
                f"你必须基于这些字段，针对每个测试场景**实际修改参数值**（修改、删除、置空、改类型等），"
                f"而不是每个场景都用相同的请求参数。"
                f"**注意：字段名必须与 requestBody 中的完全一致，禁止自行改名。**"
                f"{sample_resp_hint}"
                f"{api_doc_section}{env_info}{global_prompt_section}\n\n"
                f"请生成 {cat_count} 个「{cat_name}」分类的测试场景，确保每个场景的 request.json 都有针对性的修改，"
                f"断言必须优先参考接口文档和样例响应中的业务错误码。"
            )

            print("=" * 80, flush=True)
            print(f"[LLM REQ] endpoint={ep.method} {ep.path}, category={cat_name}", flush=True)
            print(f"[LLM REQ] ep_info JSON:\n{ep_json_str}", flush=True)
            print(f"[LLM REQ] apiDoc ({len(ep.apiDoc.strip()) if ep.apiDoc else 0} chars): "
                  f"{repr(ep.apiDoc.strip()[:500]) if ep.apiDoc else '(empty)'}", flush=True)
            print(f"[LLM REQ] sampleResponse present: {'sampleResponse' in ep_info}", flush=True)
            print(f"[LLM REQ] globalPrompt: {repr(global_prompt[:300]) if global_prompt else '(empty)'}", flush=True)
            print("-" * 40, flush=True)
            print(f"[LLM REQ] SYSTEM PROMPT:\n{sys_prompt}", flush=True)
            print("-" * 40, flush=True)
            print(f"[LLM REQ] USER PROMPT:\n{user_prompt}", flush=True)
            print("=" * 80, flush=True)
            try:
                raw = _run_llm_chat(sys_prompt, user_prompt)
                batch = _parse_llm_json(raw)
                if isinstance(batch, list):
                    scenarios.extend(batch)
                    logger.info("[generate_single_api_tests] got %d scenarios for category %s",
                                 len(batch), cat_name)
            except Exception as e:
                logger.warning("[generate_single_api_tests] category %s failed: %s", cat_name, e)

        if not scenarios:
            raise RuntimeError(f"LLM 未能为接口 {ep.method} {ep.path} 生成任何测试场景")

        logger.info("[generate_single_api_tests] total %d scenarios for %s %s",
                     len(scenarios), ep.method, ep.path)

        ep_headers: dict[str, Any] = {}
        if ep.debugDraft:
            try:
                dd = json.loads(ep.debugDraft)
                if isinstance(dd, dict):
                    hs = (dd.get("headers") or "").strip()
                    if hs and hs != "{}":
                        parsed_h = json.loads(hs)
                        if isinstance(parsed_h, dict):
                            ep_headers = parsed_h
            except (json.JSONDecodeError, TypeError):
                pass

        steps: list[dict[str, Any]] = []
        for sc in scenarios:
            if not isinstance(sc, dict):
                continue
            step: dict[str, Any] = {
                "name": str(sc.get("name") or "unnamed"),
                "endpointId": ep.id,
                "protocol": "http",
                "priority": str(sc.get("priority") or "P1"),
                "category": str(sc.get("category") or ""),
            }
            req_obj = sc.get("request")
            llm_headers = {}
            if isinstance(req_obj, dict):
                if isinstance(req_obj.get("headers"), dict):
                    llm_headers = req_obj["headers"]
                merged_headers = {**ep_headers, **llm_headers}
                step["request"] = {
                    "method": ep.method.upper(),
                    "path": ep.path,
                    "headers": merged_headers,
                }
                if "json" in req_obj and req_obj["json"] is not None:
                    step["request"]["json"] = req_obj["json"]
                elif req_obj.get("body") is not None:
                    step["request"]["body"] = str(req_obj["body"])
            else:
                step["request"] = {"method": ep.method, "path": ep.path, "headers": dict(ep_headers)}

            assert_list = sc.get("assert") or sc.get("asserts") or sc.get("assertions")
            if isinstance(assert_list, list):
                step["assert"] = [a for a in assert_list if isinstance(a, dict)]
            else:
                step["assert"] = [{"type": "status", "equals": 200}]

            _normalize_step_request_path(step.get("request") or {})
            _normalize_step_asserts(step)
            steps.append(step)

        col_name = f"接口测试 - {ep.name or f'{ep.method} {ep.path}'}"
        definition = json.dumps({
            "continueOnFailure": True,
            "steps": steps,
        }, ensure_ascii=False)

        col = ApiCollection(id=new_id(), name=col_name, description=f"自动生成：{len(steps)} 个测试场景", definition=definition)
        db.add(col)
        collections_created.append({"id": col.id, "name": col_name, "stepCount": len(steps)})

        existing = db.query(TestCase.caseId).filter(TestCase.requirementId == req_id).all()
        max_n = 0
        for (cid,) in existing:
            m = re.match(r"^TC-?(\d+)", cid, re.I)
            if m:
                max_n = max(max_n, int(m.group(1)))
        next_n = max_n + 1

        for sc in scenarios:
            if not isinstance(sc, dict):
                continue
            case_id = f"TC-{str(next_n).zfill(3)}"
            next_n += 1
            asserts_desc = ""
            assert_list = sc.get("assert")
            if isinstance(assert_list, list):
                asserts_desc = "\n".join(
                    f"- {a.get('type', '?')}: {json.dumps({k: v for k, v in a.items() if k != 'type'}, ensure_ascii=False)}"
                    for a in assert_list if isinstance(a, dict)
                )
            req_obj = sc.get("request") or {}
            req_desc = json.dumps(req_obj.get("json") or req_obj.get("body") or {}, ensure_ascii=False, default=str)

            tc = TestCase(
                id=new_id(),
                requirementId=req_id,
                caseId=case_id,
                featurePointL1=ep.name or f"{ep.method} {ep.path}",
                featurePoint=str(sc.get("category") or "")[:200],
                title=str(sc.get("name") or "")[:500],
                priority=str(sc.get("priority") or "P1") if str(sc.get("priority") or "P1") in ("P0", "P1", "P2") else "P1",
                preconditions=f"接口: {ep.method} {ep.path}",
                steps=f"请求体:\n{req_desc[:1800]}",
                expected=str(sc.get("description") or "")[:2000],
                validationPoints=asserts_desc[:2000],
            )
            db.add(tc)
            total_test_cases += 1

    db.commit()
    logger.info("[generate_single_api_tests] done: %d collections, %d test cases",
                len(collections_created), total_test_cases)
    return {
        "collections": collections_created,
        "testCaseCount": total_test_cases,
        "requirementId": req_id,
    }


