"""TAPD 缺陷日报：从 TAPD 拉取 Bug 统计并发送到企业微信。"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

import httpx

from app.config import TAPD_API_USER, TAPD_API_PASSWORD, TAPD_ACCESS_TOKEN, TAPD_WORKSPACE_ID

TAPD_V1_BASE = "https://api.tapd.cn"

# 默认模板指标定义
DEFAULT_METRICS: list[dict[str, Any]] = [
    {
        "label": "剩余 Bug",
        "color": "warning",
        "countParams": {"status": "new|open|reopened"},
        "timeField": None,
    },
    {
        "label": "今日新增",
        "color": "warning",
        "countParams": {},
        "timeField": "created",
    },
    {
        "label": "今日关闭",
        "color": "info",
        "countParams": {},
        "timeField": "closed",
    },
]


def _has_credentials() -> bool:
    if TAPD_ACCESS_TOKEN:
        return True
    if TAPD_API_USER and TAPD_API_PASSWORD:
        return True
    return False


def _tapd_get(path: str, params: dict[str, str]) -> dict | None:
    """统一调用 TAPD API。"""
    if not _has_credentials():
        print(f"[tapd] no credentials configured, skipping {path}")
        return None
    try:
        url = f"{TAPD_V1_BASE}{path}"
        if TAPD_ACCESS_TOKEN:
            r = httpx.get(url, params=params,
                          headers={"Authorization": f"Bearer {TAPD_ACCESS_TOKEN}"}, timeout=15)
        else:
            r = httpx.get(url, params=params,
                          auth=(TAPD_API_USER, TAPD_API_PASSWORD), timeout=15)
        if r.status_code == 200:
            return r.json()
        print(f"[tapd] {path} response: status={r.status_code} body={r.text[:300]}")
    except Exception as e:
        print(f"[tapd] {path} error: {e}")
    return None


def _tapd_bug_count(extra_params: dict[str, str] | None = None) -> int | None:
    if not TAPD_WORKSPACE_ID:
        return None
    params: dict[str, str] = {"workspace_id": TAPD_WORKSPACE_ID}
    if extra_params:
        params.update(extra_params)
    data = _tapd_get("/bugs/count", params)
    if data and data.get("status") == 1:
        return int(data["data"]["count"])
    return None


def _build_base_params(filters: dict[str, str] | None) -> dict[str, str]:
    """把 filters dict 转成 TAPD API 查询参数（不含 status，因为 status 由 metric 控制）。"""
    base: dict[str, str] = {}
    if not filters:
        return base
    for key in ("title", "creator", "current_owner", "priority", "severity"):
        val = filters.get(key, "").strip()
        if val:
            base[key] = val
    return base


def build_report_by_metrics(
    metrics: list[dict[str, Any]],
    filters: dict[str, str] | None = None,
) -> list[dict[str, Any]] | None:
    """按 metrics 定义逐条查询 TAPD，返回 [{ label, value, color }]。"""
    if not _has_credentials() or not TAPD_WORKSPACE_ID:
        return None

    today = datetime.now().strftime("%Y-%m-%d")
    base = _build_base_params(filters)
    results = []

    for m in metrics:
        label = m.get("label", "未命名")
        color = m.get("color", "warning")
        count_params = dict(m.get("countParams") or {})
        time_field = m.get("timeField")

        query = {**base, **count_params}
        if time_field:
            query[time_field] = f"{today} 00:00:00~{today} 23:59:59"

        value = _tapd_bug_count(query)
        results.append({"label": label, "value": value, "color": color})

    return results


def build_daily_bug_report(filters: dict[str, str] | None = None) -> dict[str, int | None] | None:
    """向后兼容：用默认 metrics 生成三项统计。"""
    results = build_report_by_metrics(DEFAULT_METRICS, filters)
    if results is None:
        return None
    return {
        "remaining": results[0]["value"] if len(results) > 0 else None,
        "new_today": results[1]["value"] if len(results) > 1 else None,
        "closed_today": results[2]["value"] if len(results) > 2 else None,
    }


def _format_filters_desc(filters: dict[str, str] | None) -> str:
    if not filters:
        return ""
    labels = {"title": "标题", "creator": "创建人", "current_owner": "处理人",
              "status": "状态", "priority": "优先级", "severity": "严重程度"}
    parts = [f"{label}={filters[key]}" for key, label in labels.items()
             if filters.get(key, "").strip()]
    return "、".join(parts)


def send_bug_report_to_wecom(
    webhook_url: str,
    filters: dict[str, str] | None = None,
    metrics: list[dict[str, Any]] | None = None,
) -> bool:
    """拉取 TAPD 缺陷统计并发送到企业微信。"""
    use_metrics = metrics or DEFAULT_METRICS
    results = build_report_by_metrics(use_metrics, filters)
    if results is None:
        print("[tapd] skipped: TAPD credentials not configured")
        return False

    today = datetime.now().strftime("%Y-%m-%d")
    lines = [f"**缺陷日报** ({today})"]
    desc = _format_filters_desc(filters)
    if desc:
        lines.append(f"> 筛选: {desc}")
    for item in results:
        val = item["value"] if item["value"] is not None else "N/A"
        color = item.get("color", "warning")
        lines.append(f'> {item["label"]}: <font color="{color}">{val}</font>')
    lines.append("> ")
    lines.append("> 来源: TAPD")

    content = "\n".join(lines)
    try:
        r = httpx.post(webhook_url,
                       json={"msgtype": "markdown", "markdown": {"content": content}}, timeout=10)
        print(f"[tapd] bug report sent: status={r.status_code}")
        return r.status_code == 200
    except Exception as e:
        print(f"[tapd] bug report send failed: {e}")
        return False
