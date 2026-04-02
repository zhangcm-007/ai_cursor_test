"""HTTP(S) 接口回归执行：变量替换、请求、断言、extract（jsonpath-ng）。"""

from __future__ import annotations

import base64
import json
import logging
import random
import re
import time
import uuid
from typing import Any

import httpx
from jsonpath_ng import parse as jsonpath_parse
from sqlalchemy.orm import Session

from app.db_types import utc_naive_now
from app.models_api import ApiCollection, ApiEnvironment, ApiRun, ApiRunStep
from app.util import new_id

logger = logging.getLogger(__name__)

MAX_STEPS = 200
MAX_BODY_STORE = 65536
DEFAULT_STEP_TIMEOUT_S = 30.0
DEFAULT_RUN_TIMEOUT_S = 600.0


def _truncate(s: str | None, limit: int = MAX_BODY_STORE) -> str:
    if s is None:
        return ""
    if len(s) <= limit:
        return s
    return s[: limit - 20] + "\n...[truncated]..."


def mask_sensitive(text: str | None) -> str:
    if not text:
        return ""
    t = re.sub(r"(?i)(Authorization:\s*)(Bearer\s+)(\S+)", r"\1\2***", text)
    t = re.sub(r'(?i)("password"\s*:\s*")([^"]*)(")', r"\1***\3", t)
    t = re.sub(r"(?i)(password=)([^&\s]+)", r"\1***", t)
    return _truncate(t)


def build_url(base_url: str, path: str) -> str:
    b = (base_url or "").rstrip("/")
    p = path or ""
    if not p.startswith("/"):
        p = "/" + p
    return b + p if b else p


def _obfuscate_password(plaintext: str) -> str:
    """AiWealth password obfuscation: salt + password + suffix → UTF-8 → Base64 → reverse."""
    combined = "&Yz@" + plaintext + "9*v"
    b64 = base64.b64encode(combined.encode("utf-8")).decode("utf-8")
    return b64[::-1]


def _builtin_placeholder_value(inner: str) -> str | None:
    """
    内置占位符，必须以 $ 开头，与「运行变量 / 环境变量」名不冲突。
    - {{$uuid}}
    - {{$timestampMs}} / {{$timestamp}}（秒）
    - {{$randInt}} 或 {{$randInt|min|max}}
    - {{$randEmail}}                    → test123456@example.com
    - {{$randEmail|前缀|}}              → manji123456@example.com
    - {{$randEmail||域名}}              → test123456@qq.com
    - {{$randEmail|前缀|域名}}          → manji123456@qq.com
    - {{$encPwd|明文密码}}（AiWealth 密码混淆：salt+base64+reverse）

    另外：变量名以 Pwd 结尾（如 rawPwd）的环境变量，引用时在 substitute_vars 中自动加密。
    """
    k = inner.strip()
    if not k.startswith("$"):
        return None
    if k == "$uuid":
        return str(uuid.uuid4())
    if k == "$timestampMs":
        return str(int(time.time() * 1000))
    if k == "$timestamp":
        return str(int(time.time()))
    if k == "$randInt":
        return str(random.randint(0, 999_999))
    if k.startswith("$randInt"):
        parts = [p.strip() for p in k.split("|")]
        if len(parts) == 3 and parts[0] == "$randInt":
            try:
                lo, hi = int(parts[1]), int(parts[2])
                if lo <= hi:
                    return str(random.randint(lo, hi))
            except ValueError:
                return None
        return None
    if k == "$randEmail":
        return f"test{random.randint(100_000, 999_999)}@example.com"
    if k.startswith("$randEmail"):
        parts = k.split("|")
        if len(parts) >= 2 and parts[0].strip() == "$randEmail":
            prefix = parts[1].strip() if len(parts) > 1 and parts[1].strip() else "test"
            domain = parts[2].strip() if len(parts) > 2 and parts[2].strip() else "example.com"
            return f"{prefix}{random.randint(100_000, 999_999)}@{domain}"
        return None
    if k.startswith("$encPwd"):
        parts = [p.strip() for p in k.split("|", 1)]
        if len(parts) == 2 and parts[0] == "$encPwd" and parts[1]:
            return _obfuscate_password(parts[1])
        return None
    return None


def substitute_vars(text: str, ctx: dict[str, str]) -> str:
    """
    支持多轮展开：例如运行变量 email =「{{$randEmail|qq.com}}」、Body 为「{{email}}」时，
    第一轮得到内置语法字符串，第二轮再解析为随机邮箱。

    命名约定：变量名以 Pwd 结尾（如 rawPwd）的环境变量，引用时自动进行 AiWealth 密码加密。
    """

    def repl(m: re.Match[str]) -> str:
        inner = m.group(1).strip()
        if len(inner) > 96:
            return m.group(0)
        b = _builtin_placeholder_value(inner)
        if b is not None:
            return b
        if re.fullmatch(r"\w+", inner) and inner in ctx:
            if inner.endswith("Pwd"):
                return _obfuscate_password(str(ctx[inner]))
            return str(ctx[inner])
        # 不再回退 os.environ：避免本机进程环境里的同名变量（如 email）在 ctx 未注入时「顶替」环境配置，集合链式调试与单接口调试表现不一致。
        return m.group(0)

    pattern = re.compile(r"\{\{([^{}]+)\}\}")
    out = text
    for _ in range(16):
        nxt = pattern.sub(repl, out)
        if nxt == out:
            break
        out = nxt
    return out


def substitute_obj(obj: Any, ctx: dict[str, str]) -> Any:
    if isinstance(obj, str):
        return substitute_vars(obj, ctx)
    if isinstance(obj, dict):
        return {k: substitute_obj(v, ctx) for k, v in obj.items()}
    if isinstance(obj, list):
        return [substitute_obj(x, ctx) for x in obj]
    return obj


def _jsonpath_find(path: str, data: Any) -> list[Any]:
    try:
        expr = jsonpath_parse(path)
        return [m.value for m in expr.find(data)]
    except Exception:
        return []


def _parse_env_variables(raw: str) -> dict[str, str]:
    try:
        d = json.loads(raw or "{}")
        if not isinstance(d, dict):
            return {}
        return {str(k): str(v) if v is not None else "" for k, v in d.items()}
    except json.JSONDecodeError:
        return {}


def filter_steps_for_mode(steps: list[dict[str, Any]], mode: str) -> list[dict[str, Any]]:
    if mode != "subset":
        return steps
    out: list[dict[str, Any]] = []
    for s in steps:
        pri = str(s.get("priority") or "P1")
        inc = s.get("includeInSubset")
        if pri == "P1" or inc is True:
            out.append(s)
    return out


def validate_definition(definition: dict[str, Any]) -> None:
    if not isinstance(definition, dict):
        raise ValueError("definition 必须是 JSON 对象")
    steps = definition.get("steps")
    if steps is None:
        raise ValueError("definition 缺少 steps 数组")
    if not isinstance(steps, list):
        raise ValueError("steps 必须是数组")
    if len(steps) > MAX_STEPS:
        raise ValueError(f"步骤数超过上限 {MAX_STEPS}")


def run_assertions(
    assert_list: list[dict[str, Any]],
    status_code: int,
    response_headers: httpx.Headers,
    body_text: str,
    body_json: Any,
) -> tuple[bool, list[dict[str, Any]]]:
    results: list[dict[str, Any]] = []
    all_ok = True
    for i, a in enumerate(assert_list or []):
        at = a.get("type")
        ok = True
        msg = ""
        try:
            if at == "status":
                exp = a.get("equals")
                if int(status_code) != int(exp):
                    ok = False
                    msg = f"期望状态码 {exp}，实际 {status_code}"
            elif at == "jsonpath_exists":
                path = a.get("path") or a.get("jsonpath")
                if not path:
                    ok = False
                    msg = "缺少 path"
                elif body_json is None:
                    ok = False
                    msg = "响应体不是 JSON，无法断言 jsonpath"
                elif not _jsonpath_find(str(path), body_json):
                    ok = False
                    msg = f"jsonpath 无匹配: {path}"
            elif at == "jsonpath_equals":
                path = a.get("path") or a.get("jsonpath")
                exp = a.get("equals")
                if body_json is None:
                    ok = False
                    msg = "响应体不是 JSON"
                else:
                    found = _jsonpath_find(str(path), body_json)
                    if not found:
                        ok = False
                        msg = f"jsonpath 无匹配: {path}"
                    elif found[0] != exp and str(found[0]) != str(exp):
                        ok = False
                        msg = f"jsonpath 值不等: 期望 {exp!r} 实际 {found[0]!r}"
            elif at == "header_contains":
                name = (a.get("name") or "").lower()
                needle = str(a.get("contains") or "")
                hv = response_headers.get(name, "") or ""
                if needle not in hv:
                    ok = False
                    msg = f"头 {name} 不包含 {needle!r}"
            elif at == "body_contains":
                needle = str(a.get("contains") or "")
                if needle not in body_text:
                    ok = False
                    msg = "响应体不包含期望子串"
            elif at == "jsonpath_not_equals":
                path = a.get("path") or a.get("jsonpath")
                exp = a.get("equals")
                if body_json is None:
                    ok = False
                    msg = "响应体不是 JSON"
                else:
                    found = _jsonpath_find(str(path), body_json)
                    if not found:
                        pass
                    elif found[0] == exp or str(found[0]) == str(exp):
                        ok = False
                        msg = f"jsonpath 值不应等于 {exp!r}，但实际相等"
            elif at == "jsonpath_type":
                path = a.get("path") or a.get("jsonpath")
                expected_type = str(a.get("expected") or "").lower()
                type_map = {"string": str, "number": (int, float), "array": list, "object": dict, "boolean": bool, "null": type(None)}
                if body_json is None:
                    ok = False
                    msg = "响应体不是 JSON"
                elif expected_type not in type_map:
                    ok = False
                    msg = f"不支持的类型: {expected_type}（支持: string/number/array/object/boolean/null）"
                else:
                    found = _jsonpath_find(str(path), body_json)
                    if not found:
                        ok = False
                        msg = f"jsonpath 无匹配: {path}"
                    elif not isinstance(found[0], type_map[expected_type]):
                        ok = False
                        msg = f"期望类型 {expected_type}，实际类型 {type(found[0]).__name__}"
            elif at == "status_in":
                codes = a.get("values") or a.get("codes") or []
                if not isinstance(codes, list):
                    codes = [codes]
                int_codes = [int(c) for c in codes if c is not None]
                if int(status_code) not in int_codes:
                    ok = False
                    msg = f"期望状态码在 {int_codes} 中，实际 {status_code}"
            elif at == "body_not_contains":
                needle = str(a.get("contains") or "")
                if needle in body_text:
                    ok = False
                    msg = f"响应体不应包含 {needle!r}"
            else:
                ok = False
                msg = f"未知断言类型: {at}"
        except Exception as e:
            ok = False
            msg = str(e)
        if not ok:
            all_ok = False
        results.append({"index": i, "type": at, "passed": ok, "message": msg if not ok else ""})
    return all_ok, results


def execute_run(
    db: Session,
    run: ApiRun,
    collection: ApiCollection,
    env: ApiEnvironment,
    run_variables: dict[str, str] | None,
) -> None:
    run_variables = run_variables or {}
    raw_def = collection.definition or "{}"
    try:
        definition = json.loads(raw_def)
    except json.JSONDecodeError as e:
        run.status = "FAILED"
        run.errorMessage = f"集合 definition JSON 无效: {e}"
        run.finishedAt = utc_naive_now()
        db.commit()
        return

    try:
        validate_definition(definition)
    except ValueError as e:
        run.status = "FAILED"
        run.errorMessage = str(e)
        run.finishedAt = utc_naive_now()
        db.commit()
        return

    steps_raw = definition.get("steps") or []
    steps = [s for s in steps_raw if isinstance(s, dict)]
    steps = filter_steps_for_mode(steps, run.regressionMode or "full")
    if not steps:
        run.status = "FAILED"
        run.errorMessage = "没有可执行的步骤（检查 regressionMode 与步骤过滤条件）"
        run.finishedAt = utc_naive_now()
        db.commit()
        return

    continue_on_failure = bool(definition.get("continueOnFailure", False))

    ctx: dict[str, str] = {}
    ctx.update(_parse_env_variables(env.variables))
    ctx.update({k: str(v) for k, v in run_variables.items()})

    run_started = time.monotonic()
    overall_ok = True
    failed_steps: list[str] = []

    with httpx.Client(follow_redirects=True) as client:
        for idx, step in enumerate(steps):
            if time.monotonic() - run_started > DEFAULT_RUN_TIMEOUT_S:
                run.status = "FAILED"
                run.errorMessage = f"整次运行超过 {DEFAULT_RUN_TIMEOUT_S}s 上限"
                run.finishedAt = utc_naive_now()
                db.commit()
                return

            proto = (step.get("protocol") or "http").lower()
            step_name = step.get("name") or f"step_{idx}"
            if proto not in ("http", "https"):
                rs = ApiRunStep(
                    id=new_id(),
                    runId=run.id,
                    orderIndex=idx,
                    name=step_name,
                    passed=False,
                    error=f"协议 {proto!r} 一期未支持（二期：SSE/WebRTC）",
                    assertionResults=json.dumps(
                        [{"type": "protocol", "passed": False, "message": "不支持的协议"}],
                        ensure_ascii=False,
                    ),
                )
                db.add(rs)
                if continue_on_failure:
                    overall_ok = False
                    failed_steps.append(step_name)
                    continue
                run.status = "FAILED"
                run.errorMessage = f"步骤「{step_name}」: 不支持的协议"
                run.finishedAt = utc_naive_now()
                db.commit()
                return

            req = step.get("request") or {}
            method = str(substitute_vars(str(req.get("method") or "GET"), ctx)).upper()
            path = substitute_vars(str(req.get("path") or "/"), ctx)
            url = build_url(env.baseUrl, path)
            if req.get("url"):
                url = substitute_vars(str(req["url"]), ctx)

            headers = substitute_obj(req.get("headers") or {}, ctx)
            timeout = float(step.get("timeout") or DEFAULT_STEP_TIMEOUT_S)

            req_body_str = ""
            json_body = None
            content = None
            if "json" in req and req["json"] is not None:
                json_body = substitute_obj(req["json"], ctx)
                try:
                    req_body_str = json.dumps(json_body, ensure_ascii=False)
                except TypeError:
                    req_body_str = str(json_body)
            elif req.get("body") is not None:
                body_val = substitute_obj(req["body"], ctx)
                if isinstance(body_val, str):
                    content = body_val.encode("utf-8")
                    req_body_str = body_val
                else:
                    req_body_str = str(body_val)
                    content = req_body_str.encode("utf-8")

            t0 = time.monotonic()
            status_code: int | None = None
            body_text = ""
            body_json: Any = None
            resp_headers: httpx.Headers = httpx.Headers()
            step_err: str | None = None

            try:
                r = client.request(
                    method,
                    url,
                    headers=headers,
                    json=json_body if json_body is not None else None,
                    content=content,
                    timeout=timeout,
                )
                status_code = r.status_code
                body_text = r.text
                resp_headers = r.headers
                try:
                    body_json = r.json()
                except Exception:
                    body_json = None
            except Exception as e:
                step_err = f"请求异常: {e}"

            duration_ms = int((time.monotonic() - t0) * 1000)

            assertion_results: list[dict[str, Any]] = []
            passed = False

            if step_err:
                passed = False
                assertion_results = [{"type": "request", "passed": False, "message": step_err}]
            else:
                assert_list = step.get("assert") or []
                ok_ass, assertion_results = run_assertions(
                    assert_list, int(status_code or 0), resp_headers, body_text, body_json
                )
                passed = ok_ass

            rs = ApiRunStep(
                id=new_id(),
                runId=run.id,
                orderIndex=idx,
                name=step_name,
                requestMethod=method,
                requestUrl=url,
                statusCode=status_code,
                passed=passed,
                error=step_err or ("" if passed else "断言失败"),
                requestBodyMasked=mask_sensitive(req_body_str),
                responseBodyMasked=mask_sensitive(body_text),
                assertionResults=json.dumps(assertion_results, ensure_ascii=False),
                durationMs=duration_ms,
            )
            db.add(rs)
            db.flush()

            if passed:
                ext = step.get("extract") or {}
                if isinstance(ext, dict):
                    for var_name, jpath in ext.items():
                        if body_json is None:
                            break
                        vals = _jsonpath_find(str(jpath), body_json)
                        if vals:
                            v0 = vals[0]
                            ctx[str(var_name)] = (
                                json.dumps(v0, ensure_ascii=False)
                                if isinstance(v0, (dict, list))
                                else str(v0)
                            )
            else:
                overall_ok = False
                fail_msg = step_err or rs.error or "断言失败"
                for ar in assertion_results:
                    if not ar.get("passed") and ar.get("message"):
                        fail_msg = f"{fail_msg}; {ar['message']}"
                rs.error = fail_msg[:2000]
                failed_steps.append(step_name)

                if not continue_on_failure:
                    run.errorMessage = f"步骤「{step_name}」失败: {fail_msg}"
                    run.finishedAt = utc_naive_now()
                    run.status = "FAILED"
                    db.commit()
                    return

    run.finishedAt = utc_naive_now()
    run.status = "PASSED" if overall_ok else "FAILED"
    if not overall_ok:
        run.errorMessage = f"失败步骤: {', '.join(failed_steps)}"
    db.commit()


def _response_body_text(r: httpx.Response) -> str:
    """稳定取出响应文本：兼容编码声明缺失、非 UTF-8、二进制误标为文本等情况。"""
    raw = r.content or b""
    if not raw:
        return ""
    try:
        t = r.text
        if t is not None and t != "":
            return t
    except Exception:
        pass
    enc = r.encoding or "utf-8"
    try:
        return raw.decode(enc, errors="replace")
    except (LookupError, TypeError, ValueError):
        return raw.decode("utf-8", errors="replace")


MAX_DEBUG_CHAIN_STEPS = 30


def debug_http_request_core(
    *,
    base_url: str,
    method: str,
    path: str,
    full_url: str | None,
    headers: dict[str, Any],
    json_body: Any | None,
    raw_body: str | None,
    ctx: dict[str, str],
    timeout: float = DEFAULT_STEP_TIMEOUT_S,
    assert_list: list[dict[str, Any]] | None = None,
) -> tuple[dict[str, Any], Any | None, bool]:
    """
    执行单次调试请求。
    返回 (与 debug_http_request 相同结构的字典, 解析后的响应 JSON 或 None, 是否可继续链式：无传输错误且断言未明确失败)。
    """
    logger.info(
        "[debug_http_request_core] BEFORE substitute: method=%s path=%s json_body=%s ctx_keys=%s",
        method, path,
        json.dumps(json_body, ensure_ascii=False)[:500] if json_body is not None else "(None)",
        sorted(ctx.keys()),
    )

    method_u = str(substitute_vars(str(method or "GET"), ctx)).upper()
    path_s = substitute_vars(str(path or "/"), ctx)
    if full_url and str(full_url).strip():
        url = substitute_vars(str(full_url).strip(), ctx)
    else:
        url = build_url(base_url, path_s)

    hdrs: dict[str, Any] = substitute_obj(headers if isinstance(headers, dict) else {}, ctx)

    req_body_str = ""
    jb = None
    content: bytes | None = None
    if json_body is not None:
        jb = substitute_obj(json_body, ctx)
        try:
            req_body_str = json.dumps(jb, ensure_ascii=False)
        except TypeError:
            req_body_str = str(jb)
        logger.info(
            "[debug_http_request_core] AFTER substitute: json_body=%s",
            req_body_str[:500],
        )
    elif raw_body is not None and str(raw_body) != "":
        body_val = substitute_obj(str(raw_body), ctx)
        content = body_val.encode("utf-8")
        req_body_str = body_val

    try:
        hdr_for_log = mask_sensitive(json.dumps(hdrs, ensure_ascii=False, default=str)) if hdrs else ""
    except Exception:
        hdr_for_log = mask_sensitive(str(hdrs))
    body_for_log = mask_sensitive(req_body_str) if req_body_str else ""
    logger.info(
        "[debug_http_request] resolved: method=%s url=%s timeout_s=%s | headers=%s | body(len=%s)=%s",
        method_u,
        url,
        timeout,
        hdr_for_log[:8000],
        len(body_for_log),
        body_for_log[:16000],
    )

    status_code: int | None = None
    body_text = ""
    resp_headers: httpx.Headers = httpx.Headers()
    step_err: str | None = None
    content_length = 0
    t0 = time.monotonic()

    try:
        with httpx.Client(follow_redirects=True) as client:
            r = client.request(
                method_u,
                url,
                headers=hdrs,
                json=jb if jb is not None else None,
                content=content,
                timeout=float(timeout),
            )
            status_code = r.status_code
            content_length = len(r.content or b"")
            body_text = _response_body_text(r)
            resp_headers = r.headers
    except Exception as e:
        step_err = str(e)

    duration_ms = int((time.monotonic() - t0) * 1000)

    body_json: Any = None
    if not step_err and body_text:
        try:
            body_json = json.loads(body_text)
        except Exception:
            body_json = None

    assertion_results: list[dict[str, Any]] = []
    assertions_passed: bool | None = None
    asserts = assert_list if isinstance(assert_list, list) else []
    asserts = [a for a in asserts if isinstance(a, dict)]
    if asserts:
        if step_err:
            assertions_passed = False
            assertion_results = [{"index": 0, "type": "request", "passed": False, "message": step_err}]
        else:
            ok_ass, assertion_results = run_assertions(
                asserts,
                int(status_code or 0),
                resp_headers,
                body_text,
                body_json,
            )
            assertions_passed = ok_ass

    truncated = len(body_text) > MAX_BODY_STORE
    body_out = _truncate(body_text) if truncated else body_text

    rh: dict[str, str] = {}
    for k, v in resp_headers.multi_items():
        if k.lower() in rh:
            rh[k] = f"{rh[k]}, {v}"
        else:
            rh[k] = v

    step_ok = step_err is None and assertions_passed is not False

    out = {
        "requestMethod": method_u,
        "requestUrl": url,
        "requestHeadersMasked": mask_sensitive(
            "\n".join(f"{k}: {v}" for k, v in hdrs.items()) if hdrs else ""
        ),
        "requestBodyMasked": mask_sensitive(req_body_str),
        "statusCode": status_code,
        "durationMs": duration_ms,
        "responseHeaders": rh,
        "responseBody": mask_sensitive(body_out),
        "responseBodyTruncated": truncated,
        "responseByteLength": content_length,
        "error": step_err or "",
        "assertionsPassed": assertions_passed,
        "assertionResults": assertion_results,
    }
    return out, body_json, step_ok


def debug_http_request(
    *,
    base_url: str,
    method: str,
    path: str,
    full_url: str | None,
    headers: dict[str, Any],
    json_body: Any | None,
    raw_body: str | None,
    ctx: dict[str, str],
    timeout: float = DEFAULT_STEP_TIMEOUT_S,
    assert_list: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """单次 HTTP 调试（不落库）。返回响应正文（截断后脱敏）、可选断言结果（基于未脱敏正文）。"""
    out, _, _ = debug_http_request_core(
        base_url=base_url,
        method=method,
        path=path,
        full_url=full_url,
        headers=headers,
        json_body=json_body,
        raw_body=raw_body,
        ctx=ctx,
        timeout=timeout,
        assert_list=assert_list,
    )
    return out


def _pre_resolve_ctx(ctx: dict[str, str]) -> None:
    """
    Pre-resolve environment variables that contain {{...}} placeholders (e.g. {{$randEmail|qq.com}}).
    This ensures builtins like $randEmail are evaluated once and reused across all chain steps.
    """
    pattern = re.compile(r"\{\{[^}]+\}\}")
    for k in list(ctx.keys()):
        v = ctx[k]
        if pattern.search(v):
            resolved = substitute_vars(v, ctx)
            ctx[k] = resolved
            logger.info("[_pre_resolve_ctx] %s: %r -> %r", k, v, resolved)


def debug_definition_steps(
    *,
    base_url: str,
    initial_ctx: dict[str, str],
    definition_steps: list[dict[str, Any]],
    default_timeout: float = DEFAULT_STEP_TIMEOUT_S,
    continue_on_failure: bool = False,
) -> dict[str, Any]:
    """
    按集合 definition.steps 格式（request.method / request.path / request.json …）从上到下执行调试。
    与 execute_run 逻辑一致但不落库、不创建 ApiRun / ApiRunStep。
    当 continue_on_failure=True 时，步骤失败后继续执行后续步骤（但不执行 extract）。
    """
    ctx = dict(initial_ctx)
    _pre_resolve_ctx(ctx)
    initial_ctx_keys = sorted(ctx.keys())
    steps_out: list[dict[str, Any]] = []

    if len(definition_steps) > MAX_DEBUG_CHAIN_STEPS:
        return {
            "ok": False,
            "error": f"步骤数超过上限 {MAX_DEBUG_CHAIN_STEPS}",
            "stoppedAt": None,
            "steps": [],
            "ctxKeys": list(ctx.keys()),
            "initialCtxKeys": initial_ctx_keys,
        }

    for i, step in enumerate(definition_steps):
        if not isinstance(step, dict):
            return {
                "ok": False,
                "error": f"步骤 {i + 1} 格式无效",
                "stoppedAt": i,
                "steps": steps_out,
                "ctxKeys": list(ctx.keys()),
                "initialCtxKeys": initial_ctx_keys,
            }

        proto = (step.get("protocol") or "http").lower()
        step_name = step.get("name") or f"step_{i + 1}"
        if proto not in ("http", "https"):
            steps_out.append({
                "name": step_name,
                "error": f"协议 {proto!r} 暂不支持",
                "statusCode": None,
                "durationMs": 0,
                "assertionsPassed": False,
                "extracted": {},
                "requestMethod": "",
                "requestUrl": "",
                "requestHeadersMasked": "",
                "requestBodyMasked": "",
                "responseHeaders": {},
                "responseBody": "",
                "responseBodyTruncated": False,
                "responseByteLength": 0,
                "assertionResults": [{"type": "protocol", "passed": False, "message": "不支持的协议"}],
            })
            return {
                "ok": False,
                "stoppedAt": i,
                "steps": steps_out,
                "ctxKeys": list(ctx.keys()),
                "initialCtxKeys": initial_ctx_keys,
            }

        req = step.get("request") or {}
        method = str(req.get("method") or "GET").upper()
        path = str(req.get("path") or "/")
        full_url_raw = req.get("url")
        full_url = str(full_url_raw).strip() if isinstance(full_url_raw, str) and full_url_raw.strip() else None

        headers_raw = req.get("headers")
        headers = headers_raw if isinstance(headers_raw, dict) else {}

        json_body = req.get("json")
        raw_body = req.get("body")
        if isinstance(raw_body, str):
            pass
        elif raw_body is not None:
            raw_body = str(raw_body)
        else:
            raw_body = None

        try:
            to = float(step.get("timeout")) if step.get("timeout") is not None else default_timeout
            to = max(1.0, min(to, 120.0))
        except (TypeError, ValueError):
            to = default_timeout

        raw_assert = step.get("assert")
        assert_list: list[dict[str, Any]] | None = None
        if raw_assert is not None and isinstance(raw_assert, list):
            assert_list = [a for a in raw_assert if isinstance(a, dict)]

        out, body_json, step_ok = debug_http_request_core(
            base_url=base_url,
            method=method,
            path=path,
            full_url=full_url,
            headers=headers,
            json_body=json_body,
            raw_body=raw_body,
            ctx=ctx,
            timeout=to,
            assert_list=assert_list,
        )

        extracted: dict[str, str] = {}
        if step_ok:
            ext = step.get("extract") or {}
            if isinstance(ext, dict):
                for var_name, jpath in ext.items():
                    nk = str(var_name).strip()
                    jp = str(jpath).strip()
                    if not nk or not jp or body_json is None:
                        continue
                    vals = _jsonpath_find(jp, body_json)
                    if vals:
                        v0 = vals[0]
                        ctx[nk] = (
                            json.dumps(v0, ensure_ascii=False)
                            if isinstance(v0, (dict, list))
                            else str(v0)
                        )
                        ev = ctx[nk]
                        extracted[nk] = ev if len(ev) <= 500 else ev[:497] + "..."

        row = {**out, "name": step_name, "extracted": extracted}
        steps_out.append(row)

        if not step_ok and not continue_on_failure:
            return {
                "ok": False,
                "stoppedAt": i,
                "steps": steps_out,
                "ctxKeys": list(ctx.keys()),
                "initialCtxKeys": initial_ctx_keys,
            }

    any_failed = any(
        s.get("assertionsPassed") is False or s.get("error")
        for s in steps_out
    )
    return {
        "ok": not any_failed,
        "stoppedAt": None,
        "steps": steps_out,
        "ctxKeys": list(ctx.keys()),
        "initialCtxKeys": initial_ctx_keys,
    }


def debug_http_request_chain(
    *,
    base_url: str,
    initial_ctx: dict[str, str],
    chain_steps: list[dict[str, Any]],
    default_timeout: float = DEFAULT_STEP_TIMEOUT_S,
) -> dict[str, Any]:
    """
    按顺序执行多步 HTTP 调试，上下文 ctx 在步骤间传递；与集合步骤一致，支持 extract（jsonpath -> 变量名）。
    后续步骤的 path / headers / body 中可使用 {{varName}} 引用前面步骤提取的变量。
    """
    ctx = dict(initial_ctx)
    _pre_resolve_ctx(ctx)
    initial_ctx_keys = sorted(ctx.keys())
    steps_out: list[dict[str, Any]] = []
    n = len(chain_steps)
    if n > MAX_DEBUG_CHAIN_STEPS:
        return {
            "ok": False,
            "error": f"步骤数超过上限 {MAX_DEBUG_CHAIN_STEPS}",
            "stoppedAt": None,
            "steps": [],
            "ctxKeys": list(ctx.keys()),
            "initialCtxKeys": initial_ctx_keys,
        }

    for i, st in enumerate(chain_steps):
        if not isinstance(st, dict):
            return {
                "ok": False,
                "error": f"步骤 {i + 1} 格式无效",
                "stoppedAt": i,
                "steps": steps_out,
                "ctxKeys": list(ctx.keys()),
                "initialCtxKeys": initial_ctx_keys,
            }

        method = st.get("method") or "GET"
        path = st.get("path") or "/"
        fu = st.get("url")
        full_url = str(fu).strip() if isinstance(fu, str) and fu.strip() else None

        headers_raw = st.get("headers")
        headers = headers_raw if isinstance(headers_raw, dict) else {}

        json_body = st.get("json")
        raw_body = st.get("body")
        if isinstance(raw_body, str):
            pass
        elif raw_body is not None:
            raw_body = str(raw_body)
        else:
            raw_body = None

        if json_body is not None and raw_body:
            return {
                "ok": False,
                "error": f"步骤 {i + 1}: json 与 body 请二选一",
                "stoppedAt": i,
                "steps": steps_out,
                "ctxKeys": list(ctx.keys()),
                "initialCtxKeys": initial_ctx_keys,
            }

        try:
            to = float(st.get("timeout")) if st.get("timeout") is not None else default_timeout
            to = max(1.0, min(to, 120.0))
        except (TypeError, ValueError):
            to = default_timeout

        raw_assert = st.get("assert")
        assert_list: list[dict[str, Any]] | None = None
        if raw_assert is not None:
            if not isinstance(raw_assert, list):
                return {
                    "ok": False,
                    "error": f"步骤 {i + 1}: assert 须为数组",
                    "stoppedAt": i,
                    "steps": steps_out,
                    "ctxKeys": list(ctx.keys()),
                    "initialCtxKeys": initial_ctx_keys,
                }
            assert_list = [a for a in raw_assert if isinstance(a, dict)]

        out, body_json, step_ok = debug_http_request_core(
            base_url=base_url,
            method=method,
            path=path,
            full_url=full_url,
            headers=headers,
            json_body=json_body,
            raw_body=raw_body,
            ctx=ctx,
            timeout=to,
            assert_list=assert_list,
        )

        extracted: dict[str, str] = {}
        if step_ok:
            ext = st.get("extract") or {}
            if isinstance(ext, dict):
                for var_name, jpath in ext.items():
                    nk = str(var_name).strip()
                    jp = str(jpath).strip()
                    if not nk or not jp:
                        continue
                    if body_json is None:
                        continue
                    vals = _jsonpath_find(jp, body_json)
                    if vals:
                        v0 = vals[0]
                        ctx[nk] = (
                            json.dumps(v0, ensure_ascii=False)
                            if isinstance(v0, (dict, list))
                            else str(v0)
                        )
                        ev = ctx[nk]
                        extracted[nk] = ev if len(ev) <= 500 else ev[:497] + "..."

        row = {**out, "extracted": extracted}
        steps_out.append(row)

        if not step_ok:
            return {
                "ok": False,
                "stoppedAt": i,
                "steps": steps_out,
                "ctxKeys": list(ctx.keys()),
                "initialCtxKeys": initial_ctx_keys,
            }

    return {
        "ok": True,
        "stoppedAt": None,
        "steps": steps_out,
        "ctxKeys": list(ctx.keys()),
        "initialCtxKeys": initial_ctx_keys,
    }
