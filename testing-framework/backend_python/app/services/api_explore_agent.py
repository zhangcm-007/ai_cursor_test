"""AI 探索式接口测试 Agent：逐步调用真实接口，基于响应自适应生成用例和断言。"""

from __future__ import annotations

import json
import logging
import re
import threading
from typing import Any, Callable

from sqlalchemy.orm import Session

from app.models import Requirement, TestCase
from app.models_api import ApiCollection, ApiEndpoint, ApiEnvironment
from app.services import llm_client
from app.services.api_case_runner import (
    debug_http_request_core,
    merged_environment_variables_dict,
)
from app.services.api_testcase_generator import (
    _endpoint_info_for_prompt,
    _normalize_assertion,
    _normalize_step_request_path,
    _repair_json,
)
from app.util import new_id

logger = logging.getLogger(__name__)

CHAT_TIMEOUT_SEC = 300
MAX_DUPLICATE_ROUNDS = 2

# ---------------------------------------------------------------------------
# Prompt templates
# ---------------------------------------------------------------------------

EXPLORE_SYSTEM_PROMPT = """\
你是一个 API 测试 Agent。你通过逐步调用真实接口来探索其行为并生成测试用例。

## 你的决策依据（按优先级）
1. **用户需求**：用户明确要求测试的场景必须优先覆盖
2. **接口文档**：文档中描述的错误码、参数约束、业务规则
3. **历史调用**：已经测过的场景不要重复，根据已有响应调整策略

## 你需要覆盖的场景类型
- 正常流程：使用合法参数验证成功响应
- 参数校验：必填为空、类型错误、格式不合法
- 异常场景：未授权、业务规则异常
- 边界值：空串、超长字符串、数值极值

## 输出格式
只输出一个 JSON 对象，无注释无额外文字：
- action: "test"（继续测试）或 "done"（已覆盖充分，停止探索）
- name: 场景名称，格式为「分类-具体场景」
- category: 场景分类（正常流程/参数校验/异常场景/边界值）
- request: {method, path, headers: {}, json: {...}}
- reason: 一句话说明为什么要测这个场景

当 action 为 "done" 时，其他字段可省略。

## 关键规则
- request.json 中的字段名必须与接口定义中的字段名完全一致，不要自行改名
- 每个场景的 request.json 必须真正体现测试意图（删字段、改类型、改值等）
- 不要重复已经测过的场景
- 如果已覆盖了主要场景类型，输出 action: "done"
"""

ASSERT_SYSTEM_PROMPT = """\
你是 API 测试断言专家。基于真实的请求和响应，生成准确的断言。

## 断言类型
- status: HTTP 状态码断言，如 {"type": "status", "equals": 200}
- jsonpath_equals: JSON 路径值相等，如 {"type": "jsonpath_equals", "path": "$.code", "equals": 0}
- jsonpath_exists: JSON 路径存在，如 {"type": "jsonpath_exists", "path": "$.data"}
- body_contains: 响应体包含文本，如 {"type": "body_contains", "contains": "success"}

## 断言规则（按优先级）
1. 如果接口文档说明了错误码，必须严格按文档断言业务错误码
2. 如果响应体中有 error_code/code 等字段，用 jsonpath_equals 断言
3. 很多业务接口在参数错误时 HTTP 仍返回 200，通过业务错误码区分——不要用 HTTP 4xx 断言这类情况
4. 正常场景至少断言状态码 + 一个关键响应字段

只输出 JSON 数组，无注释无额外文字。每个场景 2-4 条断言。
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _run_llm_chat(system_prompt: str, user_prompt: str) -> str:
    result_holder: dict[str, Any] = {}
    err_holder: dict[str, BaseException] = {}

    def _call():
        try:
            result_holder["text"] = llm_client.chat(
                [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                maxTokens=4096,
            )
        except BaseException as e:
            err_holder["e"] = e

    th = threading.Thread(target=_call)
    th.start()
    th.join(timeout=CHAT_TIMEOUT_SEC)
    if th.is_alive():
        raise RuntimeError("LLM 响应超时")
    if "e" in err_holder:
        raise err_holder["e"]
    return result_holder.get("text", "")


def _parse_json_object(text: str) -> dict[str, Any]:
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    raw = m.group(1).strip() if m else text.strip()
    if not raw.startswith("{"):
        m2 = re.search(r"\{[\s\S]*\}", raw)
        if m2:
            raw = m2.group(0)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        repaired = _repair_json(raw)
        return json.loads(repaired)


def _parse_json_array(text: str) -> list[Any]:
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    raw = m.group(1).strip() if m else text.strip()
    if not raw.startswith("["):
        m2 = re.search(r"\[[\s\S]*\]", raw)
        if m2:
            raw = m2.group(0)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        repaired = _repair_json(raw)
        return json.loads(repaired)


def _truncate(s: str, max_len: int = 2000) -> str:
    return s[:max_len] + "…" if len(s) > max_len else s


# ---------------------------------------------------------------------------
# Core explore loop
# ---------------------------------------------------------------------------

def explore_api_tests(
    db: Session,
    endpoint_id: str,
    environment_id: str,
    user_prompt: str = "",
    max_rounds: int = 12,
    on_progress: Callable[[dict[str, Any]], None] | None = None,
) -> dict[str, Any]:
    """
    AI Agent 逐步探索接口，每轮：LLM 规划 → 真实请求 → LLM 断言 → 写入步骤。
    on_progress 回调在每轮结束后调用，用于更新前端可见的进度。
    """
    if not llm_client.is_configured():
        raise RuntimeError("LLM 未配置")

    ep = db.query(ApiEndpoint).filter(ApiEndpoint.id == endpoint_id).first()
    if not ep:
        raise ValueError("未找到指定的接口")

    env = db.query(ApiEnvironment).filter(ApiEnvironment.id == environment_id).first()
    if not env:
        raise ValueError("未找到指定的环境")

    base_url = env.baseUrl or ""
    ctx = merged_environment_variables_dict(env)
    ep_info = _endpoint_info_for_prompt(ep)
    ep_json_str = json.dumps(ep_info, ensure_ascii=False, indent=2)

    api_doc_section = ""
    if ep.apiDoc and ep.apiDoc.strip():
        api_doc_section = f"\n\n## 接口文档\n{ep.apiDoc.strip()}"

    user_req_section = ""
    if user_prompt.strip():
        user_req_section = f"\n\n## 用户测试需求\n{user_prompt.strip()}"

    history: list[dict[str, Any]] = []
    steps: list[dict[str, Any]] = []
    covered_names: list[str] = []
    duplicate_count = 0

    print(f"[explore] START endpoint={ep.method} {ep.path}, max_rounds={max_rounds}", flush=True)

    for round_idx in range(max_rounds):
        round_num = round_idx + 1
        print(f"[explore] === Round {round_num}/{max_rounds} ===", flush=True)

        # --- Step 1: LLM decides what to test next ---
        history_text = ""
        if history:
            history_text = "\n\n## 已测试的场景和结果\n"
            for h in history:
                history_text += (
                    f"\n### 第 {h['round']} 轮: {h['name']} ({h['category']})\n"
                    f"- 请求: {h['method']} {h['path']}\n"
                    f"- 请求参数: {_truncate(json.dumps(h.get('requestJson') or {}, ensure_ascii=False), 500)}\n"
                    f"- 响应状态码: {h['statusCode']}\n"
                    f"- 响应体: {_truncate(h.get('responseBody', ''), 800)}\n"
                    f"- 断言: {json.dumps(h.get('assertions', []), ensure_ascii=False)}\n"
                )

        plan_user_prompt = (
            f"## 接口定义\n```json\n{ep_json_str}\n```"
            f"{api_doc_section}{user_req_section}{history_text}\n\n"
            f"当前是第 {round_num} 轮（共 {max_rounds} 轮上限）。"
            f"已覆盖 {len(history)} 个场景。"
            f"\n请决定下一步测试什么，或者输出 action: \"done\" 结束探索。"
        )

        print(f"[explore] Calling LLM for plan (round {round_num})...", flush=True)
        try:
            plan_raw = _run_llm_chat(EXPLORE_SYSTEM_PROMPT, plan_user_prompt)
            plan_obj = _parse_json_object(plan_raw)
        except Exception as e:
            print(f"[explore] LLM plan failed: {e}", flush=True)
            break

        action = str(plan_obj.get("action", "test")).lower()
        if action == "done":
            print(f"[explore] LLM decided to stop: explored enough.", flush=True)
            break

        scenario_name = str(plan_obj.get("name") or f"场景-{round_num}")
        category = str(plan_obj.get("category") or "")
        reason = str(plan_obj.get("reason") or "")
        req_obj = plan_obj.get("request") or {}
        req_method = str(req_obj.get("method") or ep.method).upper()
        req_path = str(req_obj.get("path") or ep.path)
        req_headers = req_obj.get("headers") if isinstance(req_obj.get("headers"), dict) else {}
        req_json = req_obj.get("json")

        if scenario_name in covered_names:
            duplicate_count += 1
            if duplicate_count >= MAX_DUPLICATE_ROUNDS:
                print(f"[explore] Duplicate scenario detected {duplicate_count} times, stopping.", flush=True)
                break
        else:
            duplicate_count = 0
        covered_names.append(scenario_name)

        print(f"[explore] Plan: {scenario_name} | {category} | {reason}", flush=True)

        # --- Step 2: Send real request ---
        print(f"[explore] Sending real request: {req_method} {req_path}", flush=True)
        try:
            result, body_json, _ = debug_http_request_core(
                base_url=base_url,
                method=req_method,
                path=req_path,
                full_url=None,
                headers=req_headers,
                json_body=req_json,
                raw_body=None,
                ctx=ctx,
                timeout=30.0,
                assert_list=None,
                reveal_request_body_plain=True,
            )
        except Exception as e:
            print(f"[explore] HTTP request failed: {e}", flush=True)
            result = {"statusCode": None, "responseBody": str(e), "error": str(e)}
            body_json = None

        status_code = result.get("statusCode")
        response_body = result.get("responseBody") or ""
        duration_ms = result.get("durationMs", 0)
        request_url = result.get("requestUrl", "")

        print(f"[explore] Response: status={status_code}, body_len={len(response_body)}, duration={duration_ms}ms", flush=True)

        # --- Step 3: LLM generates assertions based on real response ---
        assert_user_prompt = (
            f"## 接口定义\n- Method: {req_method}\n- Path: {req_path}\n"
            f"- 请求参数: ```json\n{json.dumps(req_json or {}, ensure_ascii=False, indent=2)}\n```\n\n"
            f"## 真实响应\n- HTTP 状态码: {status_code}\n"
            f"- 响应体:\n```json\n{_truncate(response_body, 3000)}\n```\n"
            f"{api_doc_section}\n\n"
            f"## 测试场景\n- 名称: {scenario_name}\n- 分类: {category}\n- 意图: {reason}\n\n"
            f"请基于以上真实响应生成 2-4 条断言。"
        )

        assertions: list[dict[str, Any]] = []
        print(f"[explore] Calling LLM for assertions...", flush=True)
        try:
            assert_raw = _run_llm_chat(ASSERT_SYSTEM_PROMPT, assert_user_prompt)
            assert_list = _parse_json_array(assert_raw)
            if isinstance(assert_list, list):
                assertions = [_normalize_assertion(a) for a in assert_list if isinstance(a, dict)]
        except Exception as e:
            print(f"[explore] LLM assertion generation failed: {e}", flush=True)
            assertions = [{"type": "status", "equals": status_code or 200}]

        print(f"[explore] Generated {len(assertions)} assertions", flush=True)

        # --- Step 4: Build step and record history ---
        step: dict[str, Any] = {
            "name": scenario_name,
            "endpointId": ep.id,
            "protocol": "http",
            "category": category,
            "request": {
                "method": req_method,
                "path": ep.path,
                "headers": req_headers,
            },
            "assert": assertions,
        }
        if req_json is not None:
            step["request"]["json"] = req_json

        _normalize_step_request_path(step.get("request") or {})
        steps.append(step)

        history.append({
            "round": round_num,
            "name": scenario_name,
            "category": category,
            "method": req_method,
            "path": req_path,
            "requestJson": req_json,
            "statusCode": status_code,
            "responseBody": _truncate(response_body, 1500),
            "assertions": assertions,
            "durationMs": duration_ms,
            "requestUrl": request_url,
        })

        if on_progress:
            on_progress({
                "currentRound": round_num,
                "maxRounds": max_rounds,
                "steps": [
                    {
                        "name": h["name"],
                        "category": h["category"],
                        "method": h["method"],
                        "path": h["path"],
                        "statusCode": h["statusCode"],
                        "durationMs": h["durationMs"],
                        "assertionCount": len(h["assertions"]),
                        "reason": reason if h["round"] == round_num else "",
                        "requestUrl": h.get("requestUrl", ""),
                        "requestJson": h.get("requestJson"),
                        "responseBodyPreview": _truncate(h.get("responseBody", ""), 500),
                        "assertions": h["assertions"],
                    }
                    for h in history
                ],
            })

    if not steps:
        raise RuntimeError(f"LLM 未能为接口 {ep.method} {ep.path} 生成任何测试场景")

    # --- Persist collection ---
    col_name = f"AI探索测试 - {ep.name or f'{ep.method} {ep.path}'}"
    definition = json.dumps({
        "continueOnFailure": True,
        "steps": steps,
    }, ensure_ascii=False)

    col = ApiCollection(
        id=new_id(),
        name=col_name,
        description=f"AI 探索式生成：{len(steps)} 个测试场景",
        definition=definition,
    )
    db.add(col)

    req_id = new_id()
    req = Requirement(
        id=req_id,
        title=f"[AI探索] {ep.name or f'{ep.method} {ep.path}'}",
        content="由 AI 探索式测试自动生成",
    )
    db.add(req)

    next_n = 1
    for sc in history:
        case_id = f"TC-{str(next_n).zfill(3)}"
        next_n += 1
        asserts_desc = "\n".join(
            f"- {a.get('type', '?')}: {json.dumps({k: v for k, v in a.items() if k != 'type'}, ensure_ascii=False)}"
            for a in sc.get("assertions", []) if isinstance(a, dict)
        )
        req_desc = json.dumps(sc.get("requestJson") or {}, ensure_ascii=False, default=str)

        tc = TestCase(
            id=new_id(),
            requirementId=req_id,
            caseId=case_id,
            featurePointL1=ep.name or f"{ep.method} {ep.path}",
            featurePoint=str(sc.get("category") or "")[:200],
            title=str(sc.get("name") or "")[:500],
            priority="P1",
            preconditions=f"接口: {ep.method} {ep.path}",
            steps=f"请求体:\n{req_desc[:1800]}",
            expected=f"HTTP {sc.get('statusCode', '?')}",
            validationPoints=asserts_desc[:2000],
        )
        db.add(tc)

    db.commit()

    print(f"[explore] DONE: {len(steps)} steps, collection={col.id}", flush=True)
    return {
        "collections": [{"id": col.id, "name": col_name, "stepCount": len(steps)}],
        "testCaseCount": len(history),
        "requirementId": req_id,
        "totalRounds": len(history),
    }
