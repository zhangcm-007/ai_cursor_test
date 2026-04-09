from __future__ import annotations

import json
import logging
import threading
import time
import uuid
from typing import Any, Optional, TypedDict

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.config import API_REGRESSION_TRIGGER_KEY
from app.database import SessionLocal, get_db
from app.db_types import utc_naive_now
from app.models_api import (
    ApiCollection,
    ApiEndpoint,
    ApiEnvironment,
    ApiRegressionSchedule,
    ApiRun,
    ApiRunStep,
)
from app.services.api_case_runner import (
    DEFAULT_STEP_TIMEOUT_S,
    build_endpoint_headers_route_map,
    build_endpoint_template_route_map,
    debug_definition_steps,
    debug_http_request,
    debug_http_request_chain,
    execute_run,
    merged_environment_variables_dict,
    validate_definition,
)
from app.services.api_testcase_generator import (
    generate_single_api_tests,
)
from app.services.api_explore_agent import explore_api_tests
from app.util import new_id

router = APIRouter(prefix="/api-regression", tags=["api-regression"])


def _serialize_run(r: ApiRun, db: Session) -> dict[str, Any]:
    steps = (
        db.query(ApiRunStep)
        .filter(ApiRunStep.runId == r.id)
        .order_by(ApiRunStep.orderIndex.asc())
        .all()
    )
    return {
        "id": r.id,
        "status": r.status,
        "triggeredBy": r.triggeredBy,
        "regressionMode": r.regressionMode,
        "correlationId": r.correlationId,
        "requirementId": r.requirementId,
        "environmentId": r.environmentId,
        "environmentName": r.environmentName,
        "baseUrlSnapshot": r.baseUrlSnapshot,
        "collectionId": r.collectionId,
        "startedAt": r.startedAt,
        "finishedAt": r.finishedAt,
        "errorMessage": r.errorMessage or "",
        "steps": [
            {
                "id": s.id,
                "orderIndex": s.orderIndex,
                "name": s.name,
                "requestMethod": s.requestMethod,
                "requestUrl": s.requestUrl,
                "statusCode": s.statusCode,
                "passed": s.passed,
                "error": s.error or "",
                "requestBodyMasked": s.requestBodyMasked or "",
                "responseBodyMasked": s.responseBodyMasked or "",
                "assertionResults": json.loads(s.assertionResults or "[]"),
                "durationMs": s.durationMs,
            }
            for s in steps
        ],
    }


# --- Environments ---


def _env_json_field(body: dict, key: str, default_obj: dict | None = None) -> str:
    default_obj = default_obj if default_obj is not None else {}
    v = body.get(key)
    if v is None:
        return json.dumps(default_obj, ensure_ascii=False)
    if isinstance(v, str):
        return v
    return json.dumps(v, ensure_ascii=False)


def _merge_dict_into_env_json_field(existing: str | None, patch: dict[str, str]) -> str:
    """将 patch 合并进环境 JSON 字符串字段（非法 JSON 则视为空对象）。"""
    try:
        cur = json.loads(existing or "{}")
    except json.JSONDecodeError:
        cur = {}
    if not isinstance(cur, dict):
        cur = {}
    cur.update(patch)
    return json.dumps(cur, ensure_ascii=False)


def _persist_debug_extracted_to_auto_env(db: Session, env: ApiEnvironment, result: dict[str, Any]) -> None:
    """集合调试完成后，把各步 extract 得到的键值写入环境 autoExtractedVariables（与前端绿钮行为一致）。"""
    steps = result.get("steps") or []
    patch: dict[str, str] = {}
    for s in steps:
        if not isinstance(s, dict):
            continue
        ex = s.get("extracted")
        if not isinstance(ex, dict):
            continue
        for k, v in ex.items():
            patch[str(k)] = str(v) if v is not None else ""
    if not patch:
        return
    merged = _merge_dict_into_env_json_field(getattr(env, "autoExtractedVariables", None), patch)
    env.autoExtractedVariables = merged
    env.updatedAt = utc_naive_now()
    db.commit()
    db.refresh(env)


def _serialize_environment(e: ApiEnvironment) -> dict[str, Any]:
    return {
        "id": e.id,
        "name": e.name,
        "baseUrl": e.baseUrl,
        "variables": e.variables,
        "autoExtractedVariables": getattr(e, "autoExtractedVariables", None) or "{}",
        "createdAt": e.createdAt,
        "updatedAt": e.updatedAt,
    }


@router.get("/environments")
def list_environments(db: Session = Depends(get_db)):
    rows = db.query(ApiEnvironment).order_by(ApiEnvironment.updatedAt.desc()).all()
    return [_serialize_environment(e) for e in rows]


@router.post("/environments")
def create_environment(body: dict, db: Session = Depends(get_db)):
    name = body.get("name")
    base_url = body.get("baseUrl")
    if not name or not base_url:
        raise HTTPException(400, detail="name 与 baseUrl 必填")
    e = ApiEnvironment(
        id=new_id(),
        name=name,
        baseUrl=base_url,
        variables=_env_json_field(body, "variables", {}),
        autoExtractedVariables=_env_json_field(body, "autoExtractedVariables", {}),
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    return {k: v for k, v in _serialize_environment(e).items() if k not in ("createdAt", "updatedAt")}


@router.get("/environments/{eid}")
def get_environment(eid: str, db: Session = Depends(get_db)):
    e = db.query(ApiEnvironment).filter(ApiEnvironment.id == eid).first()
    if not e:
        raise HTTPException(404, detail="Not found")
    return _serialize_environment(e)


@router.put("/environments/{eid}")
def update_environment(eid: str, body: dict, db: Session = Depends(get_db)):
    e = db.query(ApiEnvironment).filter(ApiEnvironment.id == eid).first()
    if not e:
        raise HTTPException(404, detail="Not found")
    if "name" in body:
        e.name = body["name"]
    if "baseUrl" in body:
        e.baseUrl = body["baseUrl"]
    if "variables" in body:
        e.variables = _env_json_field(body, "variables", {})
    if "autoExtractedVariables" in body:
        e.autoExtractedVariables = _env_json_field(body, "autoExtractedVariables", {})
    e.updatedAt = utc_naive_now()
    db.commit()
    db.refresh(e)
    return {k: v for k, v in _serialize_environment(e).items() if k not in ("createdAt", "updatedAt")}


@router.delete("/environments/{eid}")
def delete_environment(eid: str, db: Session = Depends(get_db)):
    e = db.query(ApiEnvironment).filter(ApiEnvironment.id == eid).first()
    if not e:
        raise HTTPException(404, detail="Not found")
    db.delete(e)
    db.commit()
    return {"ok": True}


# --- Collections ---


@router.get("/collections")
def list_collections(db: Session = Depends(get_db)):
    rows = db.query(ApiCollection).order_by(ApiCollection.createdAt.desc()).all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "description": c.description,
            "createdAt": c.createdAt,
            "updatedAt": c.updatedAt,
        }
        for c in rows
    ]


@router.post("/collections")
def create_collection(body: dict, db: Session = Depends(get_db)):
    name = body.get("name")
    if not name:
        raise HTTPException(400, detail="name 必填")
    definition = body.get("definition")
    if definition is not None and not isinstance(definition, str):
        definition = json.dumps(definition, ensure_ascii=False)
    raw = definition if definition is not None else '{"steps":[]}'
    try:
        validate_definition(json.loads(raw))
    except json.JSONDecodeError:
        raise HTTPException(400, detail="definition 不是合法 JSON")
    except ValueError as e:
        raise HTTPException(400, detail=str(e))
    c = ApiCollection(
        id=new_id(),
        name=name,
        description=body.get("description") or "",
        definition=raw,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return {"id": c.id, "name": c.name, "description": c.description, "definition": c.definition}


@router.get("/collections/{cid}")
def get_collection(cid: str, db: Session = Depends(get_db)):
    c = db.query(ApiCollection).filter(ApiCollection.id == cid).first()
    if not c:
        raise HTTPException(404, detail="Not found")
    return {
        "id": c.id,
        "name": c.name,
        "description": c.description,
        "definition": c.definition,
        "lastDebugResult": c.lastDebugResult,
        "createdAt": c.createdAt,
        "updatedAt": c.updatedAt,
    }


@router.put("/collections/{cid}")
def update_collection(cid: str, body: dict, db: Session = Depends(get_db)):
    c = db.query(ApiCollection).filter(ApiCollection.id == cid).first()
    if not c:
        raise HTTPException(404, detail="Not found")
    if "name" in body:
        c.name = body["name"]
    if "description" in body:
        c.description = body["description"] or ""
    if "definition" in body:
        d = body["definition"]
        raw = d if isinstance(d, str) else json.dumps(d, ensure_ascii=False)
        try:
            validate_definition(json.loads(raw))
        except json.JSONDecodeError:
            raise HTTPException(400, detail="definition 不是合法 JSON")
        except ValueError as e:
            raise HTTPException(400, detail=str(e))
        c.definition = raw
    c.updatedAt = utc_naive_now()
    db.commit()
    db.refresh(c)
    return {"id": c.id, "name": c.name, "description": c.description, "definition": c.definition}


@router.delete("/collections/{cid}")
def delete_collection(cid: str, db: Session = Depends(get_db)):
    c = db.query(ApiCollection).filter(ApiCollection.id == cid).first()
    if not c:
        raise HTTPException(404, detail="Not found")
    db.delete(c)
    db.commit()
    return {"ok": True}


# --- Endpoints (interface catalog) ---


@router.get("/endpoints")
def list_endpoints(db: Session = Depends(get_db)):
    rows = db.query(ApiEndpoint).order_by(ApiEndpoint.createdAt.desc()).all()
    return [
        {
            "id": e.id,
            "method": e.method,
            "path": e.path,
            "name": e.name,
            "description": e.description,
            "protocol": e.protocol,
            "sampleRequest": e.sampleRequest,
            "sampleHeaders": e.sampleHeaders,
            "debugDraft": e.debugDraft or "{}",
            "apiDoc": e.apiDoc or "",
            "createdAt": e.createdAt,
            "updatedAt": e.updatedAt,
        }
        for e in rows
    ]


@router.post("/endpoints")
def create_endpoint(body: dict, db: Session = Depends(get_db)):
    method = (body.get("method") or "GET").upper()
    path = body.get("path")
    if not path:
        raise HTTPException(400, detail="path 必填")
    e = ApiEndpoint(
        id=new_id(),
        method=method,
        path=path,
        name=body.get("name") or "",
        description=body.get("description") or "",
        protocol=body.get("protocol") or "http",
        sampleRequest=body.get("sampleRequest") if isinstance(body.get("sampleRequest"), str) else json.dumps(body.get("sampleRequest") or "", ensure_ascii=False),
        sampleHeaders=str(body.get("sampleHeaders") or ""),
        debugDraft=(str(body.get("debugDraft")) if isinstance(body.get("debugDraft"), str) else "{}") or "{}",
        apiDoc=str(body.get("apiDoc") or ""),
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    return {"id": e.id}


@router.put("/endpoints/{eid}")
def update_endpoint(eid: str, body: dict, db: Session = Depends(get_db)):
    e = db.query(ApiEndpoint).filter(ApiEndpoint.id == eid).first()
    if not e:
        raise HTTPException(404, detail="Not found")
    if "method" in body:
        e.method = str(body.get("method") or "GET").upper()
    if "path" in body:
        p = body.get("path")
        if not p:
            raise HTTPException(400, detail="path 不能为空")
        e.path = str(p)
    if "name" in body:
        e.name = str(body.get("name") or "")
    if "description" in body:
        e.description = str(body.get("description") or "")
    if "protocol" in body:
        e.protocol = str(body.get("protocol") or "http")
    if "sampleRequest" in body:
        sr = body.get("sampleRequest")
        e.sampleRequest = sr if isinstance(sr, str) else json.dumps(sr or "", ensure_ascii=False)
    if "sampleHeaders" in body:
        e.sampleHeaders = str(body.get("sampleHeaders") or "")
    if "debugDraft" in body:
        dd = body.get("debugDraft")
        e.debugDraft = dd if isinstance(dd, str) else json.dumps(dd or {}, ensure_ascii=False)
    if "apiDoc" in body:
        e.apiDoc = str(body.get("apiDoc") or "")
    e.updatedAt = utc_naive_now()
    db.commit()
    db.refresh(e)
    return {"id": e.id, "ok": True}


@router.post("/endpoints/import-json")
def import_endpoints_json(body: dict, db: Session = Depends(get_db)):
    """批量导入：[{method, path, name?, description?, protocol? }, ...]"""
    items = body.get("endpoints") or body.get("items")
    if not isinstance(items, list):
        raise HTTPException(400, detail="endpoints 应为数组")
    created = []
    for it in items:
        if not isinstance(it, dict) or not it.get("path"):
            continue
        e = ApiEndpoint(
            id=new_id(),
            method=str(it.get("method") or "GET").upper(),
            path=str(it["path"]),
            name=str(it.get("name") or ""),
            description=str(it.get("description") or ""),
            protocol=str(it.get("protocol") or "http"),
            sampleRequest=str(it.get("sampleRequest") or ""),
            sampleHeaders=str(it.get("sampleHeaders") or ""),
            debugDraft="{}",
        )
        db.add(e)
        created.append(e.id)
    db.commit()
    return {"created": len(created), "ids": created}


@router.post("/debug/request")
def api_debug_request(body: dict, db: Session = Depends(get_db)):
    """单次 HTTP 调试：选择环境（或仅填 baseUrl）后发起请求，不落库。"""
    env_id = body.get("environmentId")
    base_url = (body.get("baseUrl") or "").strip()
    ctx: dict[str, str] = {}

    if env_id:
        env = db.query(ApiEnvironment).filter(ApiEnvironment.id == env_id).first()
        if not env:
            raise HTTPException(404, detail="环境不存在")
        base_url = (env.baseUrl or "").strip()
        ctx.update(merged_environment_variables_dict(env))
    if not base_url:
        raise HTTPException(400, detail="请选择环境或填写 baseUrl")

    run_vars = body.get("runVariables")
    if isinstance(run_vars, dict):
        ctx.update({str(k): str(v) if v is not None else "" for k, v in run_vars.items()})

    method = body.get("method") or "GET"
    path = body.get("path") or "/"
    fu = body.get("url")
    full_url = str(fu).strip() if isinstance(fu, str) and fu.strip() else None

    headers_raw = body.get("headers")
    headers: dict[str, Any] = headers_raw if isinstance(headers_raw, dict) else {}

    try:
        to = float(body.get("timeout"))
        to = max(1.0, min(to, 120.0))
    except (TypeError, ValueError):
        to = DEFAULT_STEP_TIMEOUT_S

    json_body = body.get("json")
    raw_body = body.get("body")
    if isinstance(raw_body, str):
        pass
    elif raw_body is not None:
        raw_body = str(raw_body)
    else:
        raw_body = None

    if json_body is not None and raw_body:
        raise HTTPException(400, detail="json 与 body 请二选一")

    raw_assert = body.get("assert")
    assert_list: list[dict[str, Any]] | None = None
    if raw_assert is not None:
        if not isinstance(raw_assert, list):
            raise HTTPException(400, detail="assert 须为数组，元素格式与集合步骤 assert 相同")
        assert_list = [a for a in raw_assert if isinstance(a, dict)]

    return debug_http_request(
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


@router.post("/debug/definition")
def api_debug_definition(body: dict, db: Session = Depends(get_db)):
    """按集合 definition.steps 格式从上到下调试（不落库）。前端集合页调用。"""
    env_id = body.get("environmentId")
    if not env_id:
        raise HTTPException(400, detail="请选择环境")
    env = db.query(ApiEnvironment).filter(ApiEnvironment.id == env_id).first()
    if not env:
        raise HTTPException(404, detail="环境不存在")
    base_url = (env.baseUrl or "").strip()
    if not base_url:
        raise HTTPException(400, detail="环境 baseUrl 为空")

    logger.info("[debug/definition] env_id=%s env_name=%s base_url=%s", env_id, env.name, base_url)
    logger.info("[debug/definition] env.variables(manual, first 1200 chars)=%s", (env.variables or "")[:1200])
    logger.info(
        "[debug/definition] env.autoExtractedVariables(first 1200 chars)=%s",
        (getattr(env, "autoExtractedVariables", None) or "")[:1200],
    )

    ctx: dict[str, str] = {}
    env_vars = merged_environment_variables_dict(env)
    ctx.update(env_vars)
    logger.info("[debug/definition] merged env ctx keys=%s", sorted(env_vars.keys()))
    logger.info("[debug/definition] merged env ctx=%s", {k: (v[:80] + "..." if len(v) > 80 else v) for k, v in env_vars.items()})

    run_vars = body.get("runVariables")
    if isinstance(run_vars, dict):
        ctx.update({str(k): str(v) if v is not None else "" for k, v in run_vars.items()})
        logger.info("[debug/definition] runVariables keys=%s", sorted(run_vars.keys()))
    else:
        logger.info("[debug/definition] no runVariables in request body")

    logger.info("[debug/definition] final ctx keys=%s", sorted(ctx.keys()))

    definition_raw = body.get("definition")
    if not definition_raw:
        raise HTTPException(400, detail="definition 不能为空")
    if isinstance(definition_raw, str):
        try:
            definition = json.loads(definition_raw)
        except json.JSONDecodeError:
            raise HTTPException(400, detail="definition JSON 无效")
    elif isinstance(definition_raw, dict):
        definition = definition_raw
    else:
        raise HTTPException(400, detail="definition 须为 JSON 字符串或对象")

    steps = definition.get("steps")
    if not isinstance(steps, list) or len(steps) == 0:
        raise HTTPException(400, detail="definition.steps 为空或无效")

    for i, st in enumerate(steps):
        if isinstance(st, dict):
            req = st.get("request") or {}
            step_body = req.get("json") or req.get("body") or "(empty)"
            body_str = json.dumps(step_body, ensure_ascii=False) if not isinstance(step_body, str) else step_body
            logger.info(
                "[debug/definition] step[%d] name=%s method=%s path=%s body(first 500)=%s",
                i,
                st.get("name", "?"),
                (req.get("method") or "GET"),
                (req.get("path") or "/"),
                body_str[:500],
            )

    try:
        default_to = float(body.get("timeout"))
        default_to = max(1.0, min(default_to, 120.0))
    except (TypeError, ValueError):
        default_to = DEFAULT_STEP_TIMEOUT_S

    cof = bool(body.get("continueOnFailure", definition.get("continueOnFailure", False)))

    all_eps = db.query(ApiEndpoint).all()
    route_map = build_endpoint_template_route_map(all_eps)
    headers_map = build_endpoint_headers_route_map(all_eps)
    result = debug_definition_steps(
        base_url=base_url,
        initial_ctx=ctx,
        definition_steps=steps,
        default_timeout=default_to,
        continue_on_failure=cof,
        endpoint_template_by_route=route_map,
        endpoint_headers_by_route=headers_map,
    )
    # 调试结束后把本趟各步 extract 结果同步到环境「自动提取」区
    if body.get("persistExtractToEnv", True) is not False:
        all_extracted = {}
        for s in (result.get("steps") or []):
            if isinstance(s, dict):
                all_extracted.update(s.get("extracted") or {})
        logger.info("[debug/definition] extracted to persist: %s", all_extracted)
        if all_extracted:
            try:
                _persist_debug_extracted_to_auto_env(db, env, result)
                logger.info("[debug/definition] persisted extracted to env.autoExtractedVariables OK")
            except Exception:
                logger.exception("persistExtractToEnv: failed to merge extracted into env.autoExtractedVariables")
        else:
            logger.info("[debug/definition] no extracted vars to persist (check step extract rules)")

    # 持久化最近一次调试结果到集合
    collection_id = body.get("collectionId")
    if collection_id:
        try:
            col = db.query(ApiCollection).filter(ApiCollection.id == collection_id).first()
            if col:
                col.lastDebugResult = json.dumps(result, ensure_ascii=False, default=str)
                col.updatedAt = utc_naive_now()
                db.commit()
                logger.info("[debug/definition] persisted lastDebugResult to collection %s", collection_id)
        except Exception:
            logger.exception("Failed to persist lastDebugResult to collection %s", collection_id)

    return result


@router.post("/debug/request-chain")
def api_debug_request_chain(body: dict, db: Session = Depends(get_db)):
    """多步链式调试：按顺序请求，每步可从响应 JSON 用 jsonpath 提取变量写入上下文，供后续步骤 {{var}} 使用。"""
    env_id = body.get("environmentId")
    base_url = (body.get("baseUrl") or "").strip()
    ctx: dict[str, str] = {}
    env: ApiEnvironment | None = None

    if env_id:
        env = db.query(ApiEnvironment).filter(ApiEnvironment.id == env_id).first()
        if not env:
            raise HTTPException(404, detail="环境不存在")
        base_url = (env.baseUrl or "").strip()
        ctx.update(merged_environment_variables_dict(env))
    if not base_url:
        raise HTTPException(400, detail="请选择环境或填写 baseUrl")

    run_vars = body.get("runVariables")
    if isinstance(run_vars, dict):
        ctx.update({str(k): str(v) if v is not None else "" for k, v in run_vars.items()})

    steps = body.get("steps")
    if not isinstance(steps, list) or len(steps) == 0:
        raise HTTPException(400, detail="steps 须为非空数组")

    try:
        default_to = float(body.get("timeout"))
        default_to = max(1.0, min(default_to, 120.0))
    except (TypeError, ValueError):
        default_to = DEFAULT_STEP_TIMEOUT_S

    result = debug_http_request_chain(
        base_url=base_url,
        initial_ctx=ctx,
        chain_steps=steps,
        default_timeout=default_to,
    )
    if env is not None and body.get("persistExtractToEnv", True) is not False:
        try:
            _persist_debug_extracted_to_auto_env(db, env, result)
        except Exception:
            logger.exception("request-chain persistExtractToEnv: failed")
    return result


@router.delete("/endpoints/{eid}")
def delete_endpoint(eid: str, db: Session = Depends(get_db)):
    e = db.query(ApiEndpoint).filter(ApiEndpoint.id == eid).first()
    if not e:
        raise HTTPException(404, detail="Not found")
    db.delete(e)
    db.commit()
    return {"ok": True}


@router.post("/collections/{cid}/generate-from-endpoints")
def generate_from_endpoints(cid: str, body: dict, db: Session = Depends(get_db)):
    c = db.query(ApiCollection).filter(ApiCollection.id == cid).first()
    if not c:
        raise HTTPException(404, detail="集合不存在")
    ids = body.get("endpointIds") or []
    if not ids:
        raise HTTPException(400, detail="endpointIds 必填")
    endpoints = db.query(ApiEndpoint).filter(ApiEndpoint.id.in_(ids)).all()
    try:
        definition = json.loads(c.definition or "{}")
    except json.JSONDecodeError:
        definition = {}
    steps = list(definition.get("steps") or [])
    for ep in endpoints:
        if (ep.protocol or "http").lower() not in ("http", "https"):
            continue
        step: dict[str, Any] = {
            # 与「同步接口调试配置」一致：用接口主键关联草稿，避免同 path 多接口时互相覆盖
            "endpointId": ep.id,
            "name": ep.name or f"{ep.method} {ep.path}",
            "protocol": "http",
            "priority": "P1",
            "includeInSubset": True,
            "request": {
                "method": ep.method,
                "path": ep.path,
                "headers": {},
            },
            "assert": [{"type": "status", "equals": 200}],
        }

        draft: dict[str, Any] = {}
        if ep.debugDraft:
            try:
                draft = json.loads(ep.debugDraft)
                if not isinstance(draft, dict):
                    draft = {}
            except json.JSONDecodeError:
                draft = {}

        draft_body = (draft.get("body") or "").strip() if draft else ""
        draft_headers = (draft.get("headers") or "").strip() if draft else ""

        if draft_body:
            try:
                bj = json.loads(draft_body)
                if isinstance(bj, dict):
                    step["request"]["json"] = bj
                elif isinstance(bj, list):
                    step["request"]["json"] = bj
                else:
                    step["request"]["body"] = draft_body
            except json.JSONDecodeError:
                step["request"]["body"] = draft_body
        elif ep.sampleRequest:
            try:
                sj = json.loads(ep.sampleRequest)
                if isinstance(sj, dict):
                    step["request"]["json"] = sj
            except json.JSONDecodeError:
                pass

        if draft_headers and draft_headers != "{}":
            try:
                hj = json.loads(draft_headers)
                if isinstance(hj, dict) and hj:
                    step["request"]["headers"] = hj
            except json.JSONDecodeError:
                pass

        if draft.get("path"):
            step["request"]["path"] = draft["path"]
        if draft.get("method"):
            step["request"]["method"] = str(draft["method"]).upper()

        extract_rules = draft.get("extractToEnv")
        if isinstance(extract_rules, list) and extract_rules:
            ext: dict[str, str] = {}
            for rule in extract_rules:
                if isinstance(rule, dict):
                    vn = str(rule.get("varName") or "").strip()
                    jp = str(rule.get("path") or "").strip()
                    if vn and jp:
                        ext[vn] = jp
            if ext:
                step["extract"] = ext

        steps.append(step)
    definition["steps"] = steps
    c.definition = json.dumps(definition, ensure_ascii=False)
    c.updatedAt = utc_naive_now()
    db.commit()
    return {"definition": c.definition, "stepCount": len(steps)}


@router.post("/collections/{cid}/sync-steps-from-drafts")
def sync_steps_from_drafts(cid: str, db: Session = Depends(get_db)):
    """将集合中每个步骤的 request body/headers/extract 从对应接口的 debugDraft 同步更新。

    匹配规则：
    1. 优先按步骤上的 endpointId（接口清单主键）查找草稿；
    2. 若无 endpointId，回退到 method+path 精确匹配（唯一命中时使用，并自动补写 endpointId 方便下次直接按 id 匹配）。
    """
    c = db.query(ApiCollection).filter(ApiCollection.id == cid).first()
    if not c:
        raise HTTPException(404, detail="集合不存在")
    try:
        definition = json.loads(c.definition or "{}")
    except json.JSONDecodeError:
        raise HTTPException(400, detail="集合 definition JSON 无效")
    steps = list(definition.get("steps") or [])
    if not steps:
        return {"definition": c.definition, "updated": 0, "total": 0}

    all_endpoints = db.query(ApiEndpoint).all()
    ep_by_id: dict[str, ApiEndpoint] = {ep.id: ep for ep in all_endpoints}

    # method+path → endpoints 映射（仅 http/https），用于 endpointId 缺失时回退匹配
    from collections import defaultdict
    ep_by_route: dict[str, list[ApiEndpoint]] = defaultdict(list)
    for ep in all_endpoints:
        proto = (ep.protocol or "http").lower()
        if proto in ("http", "https"):
            key = f"{ep.method.upper()}:{ep.path}"
            ep_by_route[key].append(ep)

    updated_count = 0
    for step in steps:
        if not isinstance(step, dict):
            continue
        req = step.get("request")
        if not isinstance(req, dict):
            continue

        # 确定关联的接口
        raw_eid = step.get("endpointId")
        eid = str(raw_eid).strip() if raw_eid is not None else ""
        ep: ApiEndpoint | None = ep_by_id.get(eid) if eid else None

        # 回退：按 method+path 精确匹配，唯一命中则采用并补写 endpointId
        if ep is None:
            method_raw = str(req.get("method") or "GET").upper()
            path_raw = str(req.get("path") or "")
            candidates = ep_by_route.get(f"{method_raw}:{path_raw}") or []
            if len(candidates) == 1:
                ep = candidates[0]
                step["endpointId"] = ep.id

        if not ep or not ep.debugDraft:
            continue

        method = str(req.get("method") or "GET").upper()
        path = str(req.get("path") or "")

        try:
            draft = json.loads(ep.debugDraft)
            if not isinstance(draft, dict):
                continue
        except json.JSONDecodeError:
            continue

        changed = False
        draft_body = (draft.get("body") or "").strip()
        if draft_body:
            try:
                bj = json.loads(draft_body)
                if isinstance(bj, (dict, list)):
                    req["json"] = bj
                    req.pop("body", None)
                else:
                    req["body"] = draft_body
                    req.pop("json", None)
                changed = True
            except json.JSONDecodeError:
                req["body"] = draft_body
                req.pop("json", None)
                changed = True

        draft_headers = (draft.get("headers") or "").strip()
        if draft_headers and draft_headers != "{}":
            try:
                hj = json.loads(draft_headers)
                if isinstance(hj, dict) and hj:
                    req["headers"] = hj
                    changed = True
            except json.JSONDecodeError:
                pass

        draft_path = (draft.get("path") or "").strip()
        if draft_path and draft_path != path:
            req["path"] = draft_path
            changed = True

        draft_method = (draft.get("method") or "").strip().upper()
        if draft_method and draft_method != method:
            req["method"] = draft_method
            changed = True

        extract_rules = draft.get("extractToEnv")
        if isinstance(extract_rules, list) and extract_rules:
            ext: dict[str, str] = {}
            for rule in extract_rules:
                if isinstance(rule, dict):
                    vn = str(rule.get("varName") or "").strip()
                    jp = str(rule.get("path") or "").strip()
                    if vn and jp:
                        ext[vn] = jp
            if ext:
                step["extract"] = ext
                changed = True

        if changed:
            updated_count += 1

    definition["steps"] = steps
    c.definition = json.dumps(definition, ensure_ascii=False)
    c.updatedAt = utc_naive_now()
    db.commit()
    return {"definition": c.definition, "updated": updated_count, "total": len(steps)}


# --- Runs ---


@router.post("/runs")
def create_run(body: dict, db: Session = Depends(get_db)):
    env_id = body.get("environmentId")
    col_id = body.get("collectionId")
    if not env_id or not col_id:
        raise HTTPException(400, detail="environmentId 与 collectionId 必填")
    env = db.query(ApiEnvironment).filter(ApiEnvironment.id == env_id).first()
    col = db.query(ApiCollection).filter(ApiCollection.id == col_id).first()
    if not env or not col:
        raise HTTPException(404, detail="环境或集合不存在")
    mode = body.get("regressionMode") or "full"
    if mode not in ("full", "subset"):
        raise HTTPException(400, detail="regressionMode 须为 full 或 subset")
    run_vars = body.get("runVariables")
    if run_vars is not None and not isinstance(run_vars, dict):
        raise HTTPException(400, detail="runVariables 须为对象")
    run_vars_s = {str(k): str(v) for k, v in (run_vars or {}).items()}

    run = ApiRun(
        id=new_id(),
        status="RUNNING",
        triggeredBy=str(body.get("triggeredBy") or "manual"),
        regressionMode=mode,
        correlationId=body.get("correlationId"),
        requirementId=body.get("requirementId"),
        environmentId=env.id,
        environmentName=env.name,
        baseUrlSnapshot=env.baseUrl,
        collectionId=col.id,
        startedAt=utc_naive_now(),
        finishedAt=None,
        errorMessage=None,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    execute_run(db, run, col, env, run_vars_s)

    db.refresh(run)
    return _serialize_run(run, db)


@router.get("/runs")
def list_runs(db: Session = Depends(get_db), limit: int = 50):
    rows = (
        db.query(ApiRun)
        .order_by(ApiRun.startedAt.desc())
        .limit(min(limit, 200))
        .all()
    )
    out = []
    for r in rows:
        out.append(
            {
                "id": r.id,
                "status": r.status,
                "triggeredBy": r.triggeredBy,
                "regressionMode": r.regressionMode,
                "environmentName": r.environmentName,
                "baseUrlSnapshot": r.baseUrlSnapshot,
                "collectionId": r.collectionId,
                "startedAt": r.startedAt,
                "finishedAt": r.finishedAt,
                "errorMessage": r.errorMessage or "",
            }
        )
    return out


@router.get("/runs/{rid}")
def get_run(rid: str, db: Session = Depends(get_db)):
    r = db.query(ApiRun).filter(ApiRun.id == rid).first()
    if not r:
        raise HTTPException(404, detail="Not found")
    return _serialize_run(r, db)


def _report_markdown(r: ApiRun, db: Session) -> str:
    data = _serialize_run(r, db)
    lines = [
        f"# 接口回归报告",
        f"",
        f"- **Run ID**: {data['id']}",
        f"- **状态**: {data['status']}",
        f"- **回归模式**: {data['regressionMode']}",
        f"- **环境**: {data['environmentName']} (`{data['baseUrlSnapshot']}`)",
        f"- **集合**: {data['collectionId']}",
        f"- **开始**: {data['startedAt']}",
        f"- **结束**: {data['finishedAt']}",
        f"- **摘要错误**: {data['errorMessage'] or '无'}",
        f"",
        f"## 步骤",
        f"",
    ]
    for s in data["steps"]:
        st = "通过" if s["passed"] else "失败"
        lines.append(f"### {s['orderIndex']}. {s['name']} — {st}")
        lines.append(f"- 请求: `{s['requestMethod']}` {s['requestUrl']}")
        lines.append(f"- 状态码: {s['statusCode']}")
        lines.append(f"- 耗时: {s['durationMs']} ms")
        if s["error"]:
            lines.append(f"- **错误**: {s['error']}")
        lines.append("")
        lines.append("```")
        lines.append(s.get("responseBodyMasked") or "")
        lines.append("```")
        lines.append("")
    return "\n".join(lines)


@router.get("/runs/{rid}/report")
def get_run_report(rid: str, format: str = "md", db: Session = Depends(get_db)):
    r = db.query(ApiRun).filter(ApiRun.id == rid).first()
    if not r:
        raise HTTPException(404, detail="Not found")
    if format == "md":
        from fastapi.responses import PlainTextResponse

        return PlainTextResponse(_report_markdown(r, db), media_type="text/markdown; charset=utf-8")
    raise HTTPException(400, detail="format 仅支持 md")


# --- Webhook ---


@router.post("/trigger/webhook")
def trigger_webhook(
    body: dict,
    x_api_key: Optional[str] = Header(None, alias="X-Api-Key"),
    db: Session = Depends(get_db),
):
    if not API_REGRESSION_TRIGGER_KEY:
        raise HTTPException(503, detail="未配置 API_REGRESSION_TRIGGER_KEY")
    if x_api_key != API_REGRESSION_TRIGGER_KEY:
        raise HTTPException(401, detail="Invalid API Key")
    fake = {"triggeredBy": "webhook", **body}
    return create_run(fake, db)


# --- Schedules ---


@router.get("/schedules")
def list_schedules(db: Session = Depends(get_db)):
    rows = db.query(ApiRegressionSchedule).order_by(ApiRegressionSchedule.updatedAt.desc()).all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "cronExpression": s.cronExpression,
            "regressionMode": s.regressionMode,
            "environmentId": s.environmentId,
            "collectionId": s.collectionId,
            "enabled": s.enabled,
        }
        for s in rows
    ]


@router.post("/schedules")
def create_schedule(body: dict, db: Session = Depends(get_db)):
    name = body.get("name")
    cron = body.get("cronExpression")
    env_id = body.get("environmentId")
    col_id = body.get("collectionId")
    if not name or not cron or not env_id or not col_id:
        raise HTTPException(400, detail="name、cronExpression、environmentId、collectionId 必填")
    mode = body.get("regressionMode") or "full"
    if mode not in ("full", "subset"):
        raise HTTPException(400, detail="regressionMode 须为 full 或 subset")
    s = ApiRegressionSchedule(
        id=new_id(),
        name=name,
        cronExpression=cron,
        regressionMode=mode,
        environmentId=env_id,
        collectionId=col_id,
        enabled=bool(body.get("enabled", True)),
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return {"id": s.id}


@router.delete("/schedules/{sid}")
def delete_schedule(sid: str, db: Session = Depends(get_db)):
    s = db.query(ApiRegressionSchedule).filter(ApiRegressionSchedule.id == sid).first()
    if not s:
        raise HTTPException(404, detail="Not found")
    db.delete(s)
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# API test case generation (LLM-powered)
# ---------------------------------------------------------------------------

class _GenJobState(TypedDict, total=False):
    status: str
    result: dict[str, Any]
    error: str
    createdAt: float
    progress: dict[str, Any]

_gen_jobs: dict[str, _GenJobState] = {}
_gen_jobs_lock = threading.Lock()


def _run_gen_job(job_id: str, mode: str, kwargs: dict[str, Any]) -> None:
    print(f"[_run_gen_job] START job_id={job_id} mode={mode} kwargs_keys={list(kwargs.keys())}", flush=True)
    db = SessionLocal()
    try:
        with _gen_jobs_lock:
            j = _gen_jobs.get(job_id)
            if j:
                j["status"] = "running"

        if mode == "single":
            print(f"[_run_gen_job] calling generate_single_api_tests with endpoint_ids={kwargs.get('endpoint_ids')}", flush=True)
            result = generate_single_api_tests(db, **kwargs)
        elif mode == "explore":
            def _update_progress(prog: dict[str, Any]) -> None:
                with _gen_jobs_lock:
                    j2 = _gen_jobs.get(job_id)
                    if j2:
                        j2["progress"] = prog
            print(f"[_run_gen_job] calling explore_api_tests endpoint_id={kwargs.get('endpoint_id')}", flush=True)
            result = explore_api_tests(db, on_progress=_update_progress, **kwargs)
        else:
            raise ValueError(f"未知生成模式: {mode}")

        with _gen_jobs_lock:
            j = _gen_jobs.get(job_id)
            if j:
                j["status"] = "completed"
                j["result"] = result
    except Exception as e:
        with _gen_jobs_lock:
            j = _gen_jobs.get(job_id)
            if j:
                j["status"] = "failed"
                j["error"] = str(e)
        logger.exception("[generate] job %s failed", job_id)
    finally:
        db.close()


@router.post("/generate-api-tests")
def start_generate_api_tests(body: dict, background_tasks: BackgroundTasks):
    """为选中的接口生成单接口测试用例（异步）"""
    print(f"[generate-api-tests] RECEIVED request body keys={list(body.keys())}", flush=True)
    endpoint_ids = body.get("endpointIds")
    if not endpoint_ids or not isinstance(endpoint_ids, list):
        raise HTTPException(400, detail="endpointIds 必填且为数组")

    job_id = str(uuid.uuid4())
    print(f"[generate-api-tests] job_id={job_id} endpoint_ids={endpoint_ids}", flush=True)
    with _gen_jobs_lock:
        _gen_jobs[job_id] = {"status": "pending", "createdAt": time.time() * 1000}

    background_tasks.add_task(
        _run_gen_job,
        job_id,
        "single",
        {"endpoint_ids": endpoint_ids, "environment_id": body.get("environmentId"), "global_prompt": body.get("globalPrompt") or ""},
    )
    return {"jobId": job_id}



@router.get("/generate-api-tests/status/{job_id}")
def gen_api_tests_status(job_id: str):
    """查询测试用例生成进度"""
    with _gen_jobs_lock:
        job = _gen_jobs.get(job_id)
    if not job:
        raise HTTPException(404, detail="Job not found")
    payload: dict[str, Any] = {"status": job["status"]}
    if job["status"] == "completed" and job.get("result") is not None:
        payload["result"] = job["result"]
    if job["status"] == "failed" and job.get("error"):
        payload["error"] = job["error"]
    return payload


@router.post("/explore-api-tests")
def start_explore_api_tests(body: dict, background_tasks: BackgroundTasks):
    """AI 探索式接口测试（异步）"""
    endpoint_id = body.get("endpointId")
    environment_id = body.get("environmentId")
    if not endpoint_id or not isinstance(endpoint_id, str):
        raise HTTPException(400, detail="endpointId 必填")
    if not environment_id or not isinstance(environment_id, str):
        raise HTTPException(400, detail="environmentId 必填")

    job_id = str(uuid.uuid4())
    with _gen_jobs_lock:
        _gen_jobs[job_id] = {"status": "pending", "createdAt": time.time() * 1000}

    background_tasks.add_task(
        _run_gen_job,
        job_id,
        "explore",
        {
            "endpoint_id": endpoint_id,
            "environment_id": environment_id,
            "user_prompt": body.get("userPrompt") or "",
            "max_rounds": min(int(body.get("maxRounds") or 12), 20),
        },
    )
    return {"jobId": job_id}


@router.get("/explore-api-tests/progress/{job_id}")
def explore_api_tests_progress(job_id: str):
    """查询 AI 探索测试进度（含每一轮的详细结果）"""
    with _gen_jobs_lock:
        job = _gen_jobs.get(job_id)
    if not job:
        raise HTTPException(404, detail="Job not found")
    payload: dict[str, Any] = {"status": job["status"]}
    if job.get("progress"):
        payload["progress"] = job["progress"]
    if job["status"] == "completed" and job.get("result") is not None:
        payload["result"] = job["result"]
    if job["status"] == "failed" and job.get("error"):
        payload["error"] = job["error"]
    return payload


def register_scheduled_jobs(scheduler: Any) -> None:
    """由 main 在启动时调用，传入 BackgroundScheduler。"""
    from apscheduler.triggers.cron import CronTrigger

    db = SessionLocal()
    try:
        rows = db.query(ApiRegressionSchedule).filter(ApiRegressionSchedule.enabled.is_(True)).all()
        for s in rows:
            try:
                expr = s.cronExpression.strip()
                parts = expr.split()
                if len(parts) != 5:
                    continue
                trigger = CronTrigger.from_crontab(expr)
                eid, cid, mode = s.environmentId, s.collectionId, s.regressionMode

                def make_job(
                    environment_id: str = eid,
                    collection_id: str = cid,
                    regression_mode: str = mode,
                ):
                    def job() -> None:
                        sdb = SessionLocal()
                        try:
                            env = sdb.query(ApiEnvironment).filter(ApiEnvironment.id == environment_id).first()
                            col = sdb.query(ApiCollection).filter(ApiCollection.id == collection_id).first()
                            if not env or not col:
                                return
                            run = ApiRun(
                                id=new_id(),
                                status="RUNNING",
                                triggeredBy="schedule",
                                regressionMode=regression_mode,
                                environmentId=env.id,
                                environmentName=env.name,
                                baseUrlSnapshot=env.baseUrl,
                                collectionId=col.id,
                                startedAt=utc_naive_now(),
                            )
                            sdb.add(run)
                            sdb.commit()
                            sdb.refresh(run)
                            execute_run(sdb, run, col, env, {})
                        finally:
                            sdb.close()

                    return job

                scheduler.add_job(
                    make_job(),
                    trigger,
                    id=f"api-regression-{s.id}",
                    replace_existing=True,
                )
            except Exception:
                continue
    finally:
        db.close()
