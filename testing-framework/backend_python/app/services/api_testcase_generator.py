"""基于 LLM 自动生成接口测试用例（单接口 & 依赖链路）"""

from __future__ import annotations

import json
import logging
import re
import threading
from typing import Any

from sqlalchemy.orm import Session

from app.models import Requirement, TestCase
from app.models_api import ApiCollection, ApiEndpoint, ApiEnvironment
from app.services import llm_client
from app.services.api_case_runner import merged_environment_variables_dict
from app.util import new_id

logger = logging.getLogger(__name__)

CHAT_TIMEOUT_SEC = 300


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
- description: 一句话描述
- request: {{method, path, headers: {{}}, json: {{...}}}}
- assert: [{{type: "status", equals: 数字}}, ...]

断言类型支持: status / jsonpath_exists / jsonpath_equals / jsonpath_not_equals / body_contains / status_in
每个场景至少一个 status 断言。

只输出合法 JSON 数组，无注释无尾逗号，紧凑格式。"""

SINGLE_API_CATEGORIES = [
    ("正常流程", "正常流程（Happy Path，使用合法参数验证成功响应）", 2),
    ("参数校验", "参数校验（必填为空、类型错误、格式不合法）", 4),
    ("异常场景", "异常场景（未授权/Token过期/重复提交）和业务规则异常", 3),
    ("边界值", "边界值测试（空串、超长字符串、数值极值）", 3),
]

DEPENDENCY_ANALYSIS_SYSTEM_PROMPT = """\
你是一名资深 API 测试工程师。你的任务是分析一组 HTTP 接口之间的依赖关系。

依赖关系指：某个接口的请求参数需要使用另一个接口响应中的字段。
例如：注册接口的「验证码」参数需要先调用「发送验证码」接口获取。

请分析输入的所有接口，识别出可能的依赖链路（业务流程），并返回推荐的测试链路。

每条链路包含：
- name: 链路名称（简洁描述业务流程，如「用户注册流程」）
- description: 链路说明
- steps: 步骤数组，每个步骤包含：
  - endpointId: 接口 ID
  - name: 步骤名称
  - extract: 需要从响应中提取的字段（对象，key 为变量名，value 为 jsonpath 表达式）
  - dependsOnVars: 此步骤依赖的变量名数组（来自前面步骤的 extract）

注意：
- 一个接口可以出现在多条链路中
- 步骤顺序应反映实际调用顺序
- extract 中的 jsonpath 应基于响应体结构合理推断
- 如果无法确定依赖关系，也要尝试根据接口名称和参数语义进行推断

重要：只输出一个合法的 JSON 数组，不要添加注释、不要有尾逗号、不要有其他文字说明。确保 JSON 格式严格正确。"""

CHAIN_TEST_SYSTEM_PROMPT = """\
你是一名资深 API 测试工程师。你的任务是为给定的接口依赖链路生成全面的测试用例。

每条链路代表一个业务流程，其中的步骤按顺序执行，前一步骤的响应通过变量提取传递给后续步骤。

你需要为每条链路生成多个测试场景：
1. **Happy Path**: 全流程正常，所有步骤均成功
2. **中间节点失败**: 某个前置步骤返回错误数据，验证后续步骤的错误处理
3. **参数篡改**: 修改中间提取的变量值，验证下游接口的校验能力
4. **缺失依赖**: 跳过前置步骤，直接调用后续步骤，验证依赖校验

每个测试场景是一个完整的集合定义，包含：
- name: 场景名称
- description: 场景说明
- category: 分类（Happy Path / 中间节点失败 / 参数篡改 / 缺失依赖）
- priority: P0/P1/P2
- steps: 步骤数组，每个步骤包含：
  - name: 步骤名
  - protocol: "http"
  - request: { method, path, headers, json }
  - assert: 断言数组
  - extract: 变量提取（key 为变量名，value 为 jsonpath）

注意：
- 使用 {{变量名}} 引用前面步骤提取的变量
- Happy Path 的 steps 应包含完整的 extract 规则
- 失败场景中，故意出错的步骤不需要 extract
- 断言应具体到状态码和关键响应字段

重要：只输出一个合法的 JSON 数组，不要添加注释、不要有尾逗号、不要有其他文字说明。确保 JSON 格式严格正确。"""


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
            user_prompt = f"## 接口定义\n```json\n{ep_json_str}\n```{env_info}\n\n请生成 {cat_count} 个「{cat_name}」分类的测试场景。"

            logger.info("[generate_single_api_tests] endpoint=%s %s, category=%s",
                         ep.method, ep.path, cat_name)
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

        steps: list[dict[str, Any]] = []
        for sc in scenarios:
            if not isinstance(sc, dict):
                continue
            step: dict[str, Any] = {
                "name": str(sc.get("name") or "unnamed"),
                "protocol": "http",
                "priority": str(sc.get("priority") or "P1"),
                "category": str(sc.get("category") or ""),
            }
            req_obj = sc.get("request")
            if isinstance(req_obj, dict):
                step["request"] = {
                    "method": str(req_obj.get("method") or ep.method).upper(),
                    "path": str(req_obj.get("path") or ep.path),
                    "headers": req_obj.get("headers") if isinstance(req_obj.get("headers"), dict) else {},
                }
                if "json" in req_obj and req_obj["json"] is not None:
                    step["request"]["json"] = req_obj["json"]
                elif req_obj.get("body") is not None:
                    step["request"]["body"] = str(req_obj["body"])
            else:
                step["request"] = {"method": ep.method, "path": ep.path, "headers": {}}

            assert_list = sc.get("assert") or sc.get("asserts") or sc.get("assertions")
            if isinstance(assert_list, list):
                step["assert"] = [a for a in assert_list if isinstance(a, dict)]
            else:
                step["assert"] = [{"type": "status", "equals": 200}]

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


# ---------------------------------------------------------------------------
# Dependency analysis
# ---------------------------------------------------------------------------

def analyze_dependencies(
    db: Session,
    endpoint_ids: list[str],
) -> list[dict[str, Any]]:
    """
    Use LLM to analyze dependencies among selected endpoints.
    Returns recommended chains (synchronous, typically fast).
    """
    if not llm_client.is_configured():
        raise RuntimeError("LLM 未配置")

    endpoints = db.query(ApiEndpoint).filter(ApiEndpoint.id.in_(endpoint_ids)).all()
    if len(endpoints) < 2:
        raise ValueError("至少需要选择 2 个接口进行依赖分析")

    eps_info = [_endpoint_info_for_prompt(ep) for ep in endpoints]
    user_prompt = f"## 接口列表\n```json\n{json.dumps(eps_info, ensure_ascii=False, indent=2)}\n```\n\n请分析这些接口之间的依赖关系，返回推荐的测试链路。"

    logger.info("[analyze_dependencies] %d endpoints, prompt_len=%d", len(endpoints), len(user_prompt))

    raw = _run_llm_chat(DEPENDENCY_ANALYSIS_SYSTEM_PROMPT, user_prompt)
    chains = _parse_llm_json(raw)
    if not isinstance(chains, list):
        raise RuntimeError("LLM 输出格式错误：期望数组")

    for chain in chains:
        if not isinstance(chain, dict):
            continue
        for step in chain.get("steps") or []:
            if isinstance(step, dict):
                eid = step.get("endpointId")
                matched = next((ep for ep in endpoints if ep.id == eid), None)
                if matched:
                    step["endpointName"] = matched.name or f"{matched.method} {matched.path}"
                    step["method"] = matched.method
                    step["path"] = matched.path

    logger.info("[analyze_dependencies] got %d chains", len(chains))
    return chains


# ---------------------------------------------------------------------------
# Chain test generation
# ---------------------------------------------------------------------------

def generate_chain_tests(
    db: Session,
    chains: list[dict[str, Any]],
    endpoint_ids: list[str],
    environment_id: str | None = None,
) -> dict[str, Any]:
    """
    For confirmed dependency chains, generate test collections.
    Returns: { collections: [...], testCaseCount: int, requirementId: str }
    """
    if not llm_client.is_configured():
        raise RuntimeError("LLM 未配置")

    endpoints = db.query(ApiEndpoint).filter(ApiEndpoint.id.in_(endpoint_ids)).all()
    ep_map = {ep.id: ep for ep in endpoints}

    env_info = ""
    if environment_id:
        env = db.query(ApiEnvironment).filter(ApiEnvironment.id == environment_id).first()
        if env:
            vars_dict = merged_environment_variables_dict(env)
            if vars_dict:
                env_info = f"\n\n## 环境变量\n{json.dumps(vars_dict, ensure_ascii=False, indent=2)}"

    chain_names = [c.get("name", "未命名链路") for c in chains[:5]]
    req_id = new_id()
    req_record = Requirement(
        id=req_id,
        title=f"[链路测试] {', '.join(chain_names)}",
        content="由接口依赖链路测试自动生成",
    )
    db.add(req_record)

    enriched_chains: list[dict[str, Any]] = []
    for chain in chains:
        enriched: dict[str, Any] = {
            "name": chain.get("name", ""),
            "description": chain.get("description", ""),
            "steps": [],
        }
        for step in chain.get("steps") or []:
            if not isinstance(step, dict):
                continue
            eid = step.get("endpointId")
            ep = ep_map.get(eid) if eid else None
            ep_info = _endpoint_info_for_prompt(ep) if ep else {"method": "GET", "path": "/"}
            enriched["steps"].append({
                **step,
                "endpointInfo": ep_info,
            })
        enriched_chains.append(enriched)

    user_prompt = f"## 依赖链路\n```json\n{json.dumps(enriched_chains, ensure_ascii=False, indent=2)}\n```{env_info}\n\n请为每条链路生成全面的测试场景。"

    logger.info("[generate_chain_tests] %d chains, prompt_len=%d", len(chains), len(user_prompt))

    raw = _run_llm_chat(CHAIN_TEST_SYSTEM_PROMPT, user_prompt)
    scenarios = _parse_llm_json(raw)
    if not isinstance(scenarios, list):
        raise RuntimeError("LLM 输出格式错误：期望数组")

    collections_created: list[dict[str, Any]] = []
    total_test_cases = 0
    next_tc = 1

    for sc in scenarios:
        if not isinstance(sc, dict):
            continue
        sc_name = str(sc.get("name") or "未命名场景")
        sc_steps = sc.get("steps") or []
        if not isinstance(sc_steps, list) or not sc_steps:
            continue

        col_steps: list[dict[str, Any]] = []
        for s in sc_steps:
            if not isinstance(s, dict):
                continue
            step: dict[str, Any] = {
                "name": str(s.get("name") or "step"),
                "protocol": "http",
            }
            req_obj = s.get("request")
            if isinstance(req_obj, dict):
                step["request"] = {
                    "method": str(req_obj.get("method") or "GET").upper(),
                    "path": str(req_obj.get("path") or "/"),
                    "headers": req_obj.get("headers") if isinstance(req_obj.get("headers"), dict) else {},
                }
                if "json" in req_obj and req_obj["json"] is not None:
                    step["request"]["json"] = req_obj["json"]
                elif req_obj.get("body") is not None:
                    step["request"]["body"] = str(req_obj["body"])
            else:
                step["request"] = {"method": "GET", "path": "/", "headers": {}}

            assert_list = s.get("assert")
            if isinstance(assert_list, list):
                step["assert"] = [a for a in assert_list if isinstance(a, dict)]
            else:
                step["assert"] = [{"type": "status", "equals": 200}]

            _normalize_step_asserts(step)

            ext = s.get("extract")
            if isinstance(ext, dict) and ext:
                step["extract"] = ext

            col_steps.append(step)

        definition = json.dumps({
            "continueOnFailure": False,
            "steps": col_steps,
        }, ensure_ascii=False)

        col = ApiCollection(
            id=new_id(),
            name=f"链路测试 - {sc_name}",
            description=str(sc.get("description") or sc.get("category") or ""),
            definition=definition,
        )
        db.add(col)
        collections_created.append({"id": col.id, "name": col.name, "stepCount": len(col_steps)})

        case_id = f"TC-{str(next_tc).zfill(3)}"
        next_tc += 1
        steps_desc = "\n".join(f"{i+1}. {s.get('name', 'step')}" for i, s in enumerate(col_steps))
        tc = TestCase(
            id=new_id(),
            requirementId=req_id,
            caseId=case_id,
            featurePointL1="链路测试",
            featurePoint=str(sc.get("category") or "Happy Path")[:200],
            title=sc_name[:500],
            priority=str(sc.get("priority") or "P1") if str(sc.get("priority") or "P1") in ("P0", "P1", "P2") else "P1",
            preconditions=f"链路: {sc_name}",
            steps=steps_desc[:2000],
            expected=str(sc.get("description") or "")[:2000],
            validationPoints="",
        )
        db.add(tc)
        total_test_cases += 1

    db.commit()
    logger.info("[generate_chain_tests] done: %d collections, %d test cases",
                len(collections_created), total_test_cases)
    return {
        "collections": collections_created,
        "testCaseCount": total_test_cases,
        "requirementId": req_id,
    }
