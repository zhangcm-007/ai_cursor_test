"""TAPD 缺陷管理：模板 CRUD、日报配置 CRUD、手动触发、定时注册。"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import TAPD_API_USER, TAPD_ACCESS_TOKEN, TAPD_WORKSPACE_ID
from app.database import SessionLocal, get_db
from app.db_types import utc_naive_now
from app.models_api import TapdReportTemplate, TapdBugReportConfig
from app.services.tapd_bug_report import (
    send_bug_report_to_wecom, build_report_by_metrics, DEFAULT_METRICS,
)
from app.util import new_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tapd-bug", tags=["tapd-bug"])

_active_scheduler: Any = None


def _parse_filters(raw: Any) -> dict[str, str]:
    if isinstance(raw, dict):
        return {k: str(v).strip() for k, v in raw.items() if str(v).strip()}
    if isinstance(raw, str):
        try:
            d = json.loads(raw)
            if isinstance(d, dict):
                return {k: str(v).strip() for k, v in d.items() if str(v).strip()}
        except (json.JSONDecodeError, TypeError):
            pass
    return {}


def _parse_metrics(raw: Any) -> list[dict[str, Any]]:
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str):
        try:
            d = json.loads(raw)
            if isinstance(d, list):
                return d
        except (json.JSONDecodeError, TypeError):
            pass
    return []


# ══════════════════════════════════════════════════
#  报表模板 CRUD
# ══════════════════════════════════════════════════

def _serialize_template(t: TapdReportTemplate) -> dict[str, Any]:
    return {
        "id": t.id,
        "name": t.name,
        "description": t.description,
        "builtIn": t.builtIn,
        "metrics": _parse_metrics(t.metrics),
        "createdAt": t.createdAt,
        "updatedAt": t.updatedAt,
    }


@router.get("/templates")
def list_templates(db: Session = Depends(get_db)):
    rows = db.query(TapdReportTemplate).order_by(TapdReportTemplate.createdAt.asc()).all()
    return [_serialize_template(r) for r in rows]


@router.post("/templates")
def create_template(body: dict, db: Session = Depends(get_db)):
    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(400, detail="模板名称必填")
    metrics = body.get("metrics", [])
    if not metrics or not isinstance(metrics, list):
        raise HTTPException(400, detail="至少需要一个指标")

    t = TapdReportTemplate(
        id=new_id(),
        name=name,
        description=str(body.get("description") or "").strip(),
        builtIn=False,
        metrics=json.dumps(metrics, ensure_ascii=False),
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return _serialize_template(t)


@router.put("/templates/{tid}")
def update_template(tid: str, body: dict, db: Session = Depends(get_db)):
    t = db.query(TapdReportTemplate).filter(TapdReportTemplate.id == tid).first()
    if not t:
        raise HTTPException(404, detail="Not found")
    if "name" in body:
        t.name = str(body["name"]).strip()
    if "description" in body:
        t.description = str(body["description"]).strip()
    if "metrics" in body:
        t.metrics = json.dumps(body["metrics"], ensure_ascii=False)
    t.updatedAt = utc_naive_now()
    db.commit()
    db.refresh(t)
    return _serialize_template(t)


@router.delete("/templates/{tid}")
def delete_template(tid: str, db: Session = Depends(get_db)):
    t = db.query(TapdReportTemplate).filter(TapdReportTemplate.id == tid).first()
    if not t:
        raise HTTPException(404, detail="Not found")
    if t.builtIn:
        raise HTTPException(400, detail="内置模板不可删除")
    db.delete(t)
    db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════════
#  日报配置 CRUD
# ══════════════════════════════════════════════════

def _resolve_metrics(config: TapdBugReportConfig, db: Session) -> list[dict[str, Any]]:
    """从 config 关联的 template 解析出 metrics；没有 template 用默认。"""
    tid = getattr(config, "templateId", None)
    if tid:
        t = db.query(TapdReportTemplate).filter(TapdReportTemplate.id == tid).first()
        if t:
            return _parse_metrics(t.metrics)
    return DEFAULT_METRICS


def _serialize_config(c: TapdBugReportConfig) -> dict[str, Any]:
    return {
        "id": c.id,
        "name": c.name,
        "webhookUrl": c.webhookUrl,
        "templateId": getattr(c, "templateId", None) or None,
        "filters": _parse_filters(getattr(c, "filters", None) or "{}"),
        "cronExpression": c.cronExpression,
        "enabled": c.enabled,
        "createdAt": c.createdAt,
        "updatedAt": c.updatedAt,
    }


@router.get("/configs")
def list_configs(db: Session = Depends(get_db)):
    rows = db.query(TapdBugReportConfig).order_by(TapdBugReportConfig.createdAt.desc()).all()
    return [_serialize_config(r) for r in rows]


@router.post("/configs")
def create_config(body: dict, db: Session = Depends(get_db)):
    name = body.get("name", "").strip()
    webhook_url = body.get("webhookUrl", "").strip()
    if not name:
        raise HTTPException(400, detail="名称必填")
    if not webhook_url:
        raise HTTPException(400, detail="企业微信 Webhook URL 必填")

    filters = _parse_filters(body.get("filters"))
    c = TapdBugReportConfig(
        id=new_id(),
        name=name,
        webhookUrl=webhook_url,
        templateId=body.get("templateId") or None,
        filters=json.dumps(filters, ensure_ascii=False),
        cronExpression=str(body.get("cronExpression") or "0 18 * * 1-5").strip(),
        enabled=bool(body.get("enabled", True)),
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    if c.enabled and _active_scheduler:
        _add_job_to_scheduler(c, _active_scheduler)
    return _serialize_config(c)


@router.put("/configs/{cid}")
def update_config(cid: str, body: dict, db: Session = Depends(get_db)):
    c = db.query(TapdBugReportConfig).filter(TapdBugReportConfig.id == cid).first()
    if not c:
        raise HTTPException(404, detail="Not found")
    if "name" in body:
        c.name = str(body["name"]).strip()
    if "webhookUrl" in body:
        c.webhookUrl = str(body["webhookUrl"]).strip()
    if "templateId" in body:
        c.templateId = body["templateId"] or None
    if "filters" in body:
        c.filters = json.dumps(_parse_filters(body["filters"]), ensure_ascii=False)
    if "cronExpression" in body:
        c.cronExpression = str(body["cronExpression"]).strip()
    if "enabled" in body:
        c.enabled = bool(body["enabled"])
    c.updatedAt = utc_naive_now()
    db.commit()
    db.refresh(c)
    if _active_scheduler:
        _remove_job_from_scheduler(c.id)
        if c.enabled:
            _add_job_to_scheduler(c, _active_scheduler)
    return _serialize_config(c)


@router.delete("/configs/{cid}")
def delete_config(cid: str, db: Session = Depends(get_db)):
    c = db.query(TapdBugReportConfig).filter(TapdBugReportConfig.id == cid).first()
    if not c:
        raise HTTPException(404, detail="Not found")
    if _active_scheduler:
        _remove_job_from_scheduler(c.id)
    db.delete(c)
    db.commit()
    return {"ok": True}


# ── 手动触发 / 预览 ─────────────────────────────

@router.post("/configs/{cid}/send")
def manual_send(cid: str, db: Session = Depends(get_db)):
    c = db.query(TapdBugReportConfig).filter(TapdBugReportConfig.id == cid).first()
    if not c:
        raise HTTPException(404, detail="Not found")
    if not c.webhookUrl.strip():
        raise HTTPException(400, detail="未配置企业微信 Webhook URL")
    filters = _parse_filters(c.filters)
    metrics = _resolve_metrics(c, db)
    ok = send_bug_report_to_wecom(c.webhookUrl.strip(), filters, metrics)
    return {"success": ok}


@router.post("/preview")
def preview_report(body: dict = {}, db: Session = Depends(get_db)):
    if not (TAPD_ACCESS_TOKEN or TAPD_API_USER) or not TAPD_WORKSPACE_ID:
        return {"configured": False, "message": "TAPD 凭证未配置"}
    filters = _parse_filters(body.get("filters"))
    template_id = body.get("templateId")
    if template_id:
        t = db.query(TapdReportTemplate).filter(TapdReportTemplate.id == template_id).first()
        metrics = _parse_metrics(t.metrics) if t else DEFAULT_METRICS
    else:
        metrics = body.get("metrics") or DEFAULT_METRICS
    results = build_report_by_metrics(metrics, filters)
    return {"configured": True, "results": results, "filters": filters}


# ── 定时任务调度 ─────────────────────────────────

def _make_job_func(config_id: str):
    def job():
        db = SessionLocal()
        try:
            c = db.query(TapdBugReportConfig).filter(TapdBugReportConfig.id == config_id).first()
            if not c or not c.enabled:
                return
            wh = c.webhookUrl.strip()
            if not wh:
                return
            filters = _parse_filters(c.filters)
            metrics = _resolve_metrics(c, db)
            print(f"[tapd-bug] sending report for config={c.name!r}")
            send_bug_report_to_wecom(wh, filters, metrics)
        except Exception as e:
            print(f"[tapd-bug] job error for config_id={config_id}: {e}")
        finally:
            db.close()
    return job


def _job_id(config_id: str) -> str:
    return f"tapd-bug-{config_id}"


def _add_job_to_scheduler(c: TapdBugReportConfig, scheduler: Any) -> bool:
    cron = c.cronExpression.strip()
    parts = cron.split()
    if len(parts) != 5:
        return False
    try:
        from apscheduler.triggers.cron import CronTrigger
        trigger = CronTrigger(minute=parts[0], hour=parts[1], day=parts[2],
                              month=parts[3], day_of_week=parts[4])
        scheduler.add_job(_make_job_func(c.id), trigger,
                          id=_job_id(c.id), replace_existing=True)
        print(f"[tapd-bug] registered job {c.name!r} cron={cron}")
        return True
    except Exception as e:
        print(f"[tapd-bug] failed to register job {c.id}: {e}")
        return False


def _remove_job_from_scheduler(config_id: str) -> None:
    if not _active_scheduler:
        return
    try:
        _active_scheduler.remove_job(_job_id(config_id))
    except Exception:
        pass


# ── 自动建表 + 种子 + 启动注册 ──────────────────

def _auto_create_tables(db: Session) -> None:
    try:
        db.execute(text("""CREATE TABLE IF NOT EXISTS TapdReportTemplate (
            id TEXT PRIMARY KEY, name TEXT DEFAULT '', description TEXT DEFAULT '',
            builtIn BOOLEAN DEFAULT 0, metrics TEXT DEFAULT '[]',
            createdAt BIGINT NOT NULL, updatedAt BIGINT NOT NULL
        )"""))
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[tapd-bug] create TapdReportTemplate table error: {e}")

    try:
        db.execute(text("""CREATE TABLE IF NOT EXISTS TapdBugReportConfig (
            id TEXT PRIMARY KEY, name TEXT DEFAULT '', webhookUrl TEXT DEFAULT '',
            templateId TEXT, filters TEXT DEFAULT '{}',
            cronExpression TEXT DEFAULT '0 18 * * 1-5', enabled BOOLEAN DEFAULT 1,
            createdAt BIGINT NOT NULL, updatedAt BIGINT NOT NULL
        )"""))
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[tapd-bug] create TapdBugReportConfig table error: {e}")

    # 迁移：旧表可能没有 templateId / filters 列
    for col, ddl in [
        ("templateId", "ALTER TABLE TapdBugReportConfig ADD COLUMN templateId TEXT"),
        ("filters", "ALTER TABLE TapdBugReportConfig ADD COLUMN filters TEXT DEFAULT '{}'"),
    ]:
        try:
            db.execute(text(ddl))
            db.commit()
        except Exception:
            db.rollback()


def _seed_default_template(db: Session) -> None:
    """确保存在一个内置默认模板。"""
    existing = db.query(TapdReportTemplate).filter(TapdReportTemplate.builtIn.is_(True)).first()
    if existing:
        return
    t = TapdReportTemplate(
        id=new_id(),
        name="默认日报模板",
        description="剩余 Bug + 今日新增 + 今日关闭",
        builtIn=True,
        metrics=json.dumps(DEFAULT_METRICS, ensure_ascii=False),
    )
    db.add(t)
    db.commit()
    print("[tapd-bug] seeded default report template")


def register_tapd_bug_jobs(scheduler: Any) -> None:
    global _active_scheduler
    _active_scheduler = scheduler

    db = SessionLocal()
    try:
        _auto_create_tables(db)
        _seed_default_template(db)
        rows = db.query(TapdBugReportConfig).filter(TapdBugReportConfig.enabled.is_(True)).all()
        registered = 0
        for c in rows:
            if _add_job_to_scheduler(c, scheduler):
                registered += 1
        print(f"[tapd-bug] registered {registered}/{len(rows)} bug report job(s)")
    except Exception as e:
        print(f"[tapd-bug] register error: {e}")
    finally:
        db.close()
