#!/usr/bin/env python3
"""Trace Analyzer - Query logs by traceId, generate Mermaid diagrams, output .md reports."""

import argparse
import json
import os
import re
import sys
from collections import OrderedDict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

import requests
import yaml

import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

CONFIG_PATH = Path(__file__).parent.parent / "config.yaml"
EXAMPLE_CONFIG_PATH = Path(__file__).parent.parent / "config.example.yaml"


def load_config() -> dict:
    if not CONFIG_PATH.exists():
        print(f"ERROR: Config not found at {CONFIG_PATH}", file=sys.stderr)
        print(f"  cp {EXAMPLE_CONFIG_PATH} {CONFIG_PATH}", file=sys.stderr)
        sys.exit(1)
    with open(CONFIG_PATH, encoding="utf-8") as f:
        return yaml.safe_load(f)


def get_output_dir(config: dict) -> Path:
    output_cfg = config.get("output", {})
    directory = output_cfg.get("directory", "~/trace-reports")
    return Path(os.path.expanduser(directory))


def get_elk_env(config: dict, env: str) -> dict:
    elk = config.get("elk", {})
    envs = elk.get("environments", {})
    if env not in envs:
        print(f"ERROR: Environment '{env}' not found. Available: {list(envs.keys())}", file=sys.stderr)
        sys.exit(1)
    return envs[env]


def build_auth(env_config: dict) -> dict:
    auth_cfg = env_config.get("auth", {})
    auth_type = auth_cfg.get("type", "none")
    kwargs: dict[str, Any] = {}
    if auth_type == "basic":
        kwargs["auth"] = (auth_cfg["username"], auth_cfg["password"])
    elif auth_type == "token":
        kwargs["headers"] = {"Authorization": f"Bearer {auth_cfg['token']}"}
    return kwargs


def es_query_msearch(env_config: dict, index: str, query_body: dict, size: int = 500) -> dict:
    kibana_url = env_config["kibana_url"].rstrip("/")
    api_path = env_config.get("api_path", "/elasticsearch/_msearch")
    kbn_version = env_config.get("kbn_version", "7.3.2")
    url = f"{kibana_url}{api_path}"

    auth_kwargs = build_auth(env_config)
    headers = {
        "Content-Type": "application/x-ndjson",
        "kbn-version": kbn_version,
    }
    if "headers" in auth_kwargs:
        headers.update(auth_kwargs.pop("headers"))

    query_body["size"] = size

    header_line = json.dumps({
        "index": index,
        "ignore_unavailable": True,
        "preference": int(datetime.now().timestamp() * 1000),
    }, ensure_ascii=False)
    body_line = json.dumps(query_body, ensure_ascii=False)
    ndjson_body = f"{header_line}\n{body_line}\n"

    resp = requests.post(url, data=ndjson_body, headers=headers, timeout=30, verify=False, **auth_kwargs)
    if resp.status_code != 200:
        print(f"ERROR: Kibana returned {resp.status_code}", file=sys.stderr)
        print(resp.text[:2000], file=sys.stderr)
        sys.exit(1)

    result = resp.json()
    responses = result.get("responses", [])
    if not responses:
        print("ERROR: Empty responses from _msearch", file=sys.stderr)
        sys.exit(1)

    first = responses[0]
    if "error" in first:
        print(f"ERROR: ES query failed: {json.dumps(first['error'], ensure_ascii=False)}", file=sys.stderr)
        sys.exit(1)
    return first


def es_query_search(env_config: dict, index: str, query_body: dict, size: int = 500) -> dict:
    auth_kwargs = build_auth(env_config)
    es_url = env_config.get("es_url", "").rstrip("/")
    if not es_url:
        es_url = env_config["kibana_url"].rstrip("/")

    url = f"{es_url}/{index}/_search"
    headers = {"Content-Type": "application/json"}
    if "headers" in auth_kwargs:
        headers.update(auth_kwargs.pop("headers"))

    query_body["size"] = size
    resp = requests.post(url, json=query_body, headers=headers, timeout=30, verify=False, **auth_kwargs)
    if resp.status_code != 200:
        print(f"ERROR: ES returned {resp.status_code}", file=sys.stderr)
        print(resp.text[:2000], file=sys.stderr)
        sys.exit(1)
    return resp.json()


def es_query(env_config: dict, index: str, query_body: dict, size: int = 500) -> dict:
    query_type = env_config.get("query_type", "msearch")
    if query_type == "msearch":
        return es_query_msearch(env_config, index, query_body, size)
    return es_query_search(env_config, index, query_body, size)


def parse_time_range(time_from: str = None, time_to: str = None, time_range: int = None) -> tuple[str, str]:
    """Parse time range arguments into ISO timestamps.

    Supports:
      --time-range 180         → 最近 180 分钟
      --time-from / --time-to  → 精确区间 (ISO 或 yyyy-MM-dd HH:mm:ss)
    """
    now = datetime.now(timezone.utc)

    if time_from and time_to:
        return _normalize_ts(time_from), _normalize_ts(time_to)
    if time_from:
        return _normalize_ts(time_from), now.isoformat()
    if time_to:
        minutes = time_range or 180
        t_to = _parse_user_ts(time_to) or now
        t_from = t_to - timedelta(minutes=minutes)
        return t_from.isoformat(), t_to.isoformat()

    minutes = time_range or 180
    t_from = now - timedelta(minutes=minutes)
    return t_from.isoformat(), now.isoformat()


def _normalize_ts(ts_str: str) -> str:
    dt = _parse_user_ts(ts_str)
    return dt.isoformat() if dt else ts_str


def _parse_user_ts(ts_str: str) -> Optional[datetime]:
    for fmt in (
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%S.%f%z",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
    ):
        try:
            dt = datetime.strptime(ts_str, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue
    return None


def trace_logs(config: dict, env: str, trace_id: str, size: int,
               time_from_iso: str = None, time_to_iso: str = None) -> list[dict]:
    elk = config.get("elk", {})
    env_config = get_elk_env(config, env)
    fields = elk.get("fields", {})
    index = env_config.get("index_pattern", "app-logs-*")
    tid_field = fields.get("trace_id", "traceId")
    ts_field = fields.get("timestamp", "@timestamp")

    filters = [{"match_phrase": {tid_field: trace_id}}]
    if time_from_iso and time_to_iso:
        filters.append({"range": {ts_field: {"gte": time_from_iso, "lte": time_to_iso}}})

    query = {
        "query": {"bool": {"must": filters}},
        "sort": [{ts_field: {"order": "asc"}}],
    }

    all_fields = [
        tid_field, ts_field,
        fields.get("service", "project_name"),
        fields.get("level", "level"),
        fields.get("message", "message"),
        fields.get("logger", "loggerName"),
        fields.get("thread", "thread"),
        fields.get("hostname", "hostname"),
        fields.get("source_class", "source.class"),
        fields.get("source_method", "source.method"),
        fields.get("source_file", "source.file"),
        fields.get("source_line", "source.line"),
    ]
    for ef in fields.get("extra_fields", []):
        if ef not in all_fields:
            all_fields.append(ef)
    query["_source"] = all_fields

    result = es_query(env_config, index, query, size)
    hits = result.get("hits", {}).get("hits", [])
    return [h["_source"] for h in hits]


def search_logs(config: dict, env: str, keyword: str, time_range: int, size: int) -> list[dict]:
    elk = config.get("elk", {})
    env_config = get_elk_env(config, env)
    fields = elk.get("fields", {})
    index = env_config.get("index_pattern", "app-logs-*")
    ts_field = fields.get("timestamp", "@timestamp")

    now = datetime.now(timezone.utc)
    time_from = now - timedelta(minutes=time_range)

    query = {
        "query": {
            "bool": {
                "must": [{"query_string": {"query": keyword}}],
                "filter": [{"range": {ts_field: {"gte": time_from.isoformat(), "lte": now.isoformat()}}}],
            }
        },
        "sort": [{ts_field: {"order": "desc"}}],
    }
    all_fields = [
        fields.get("trace_id", "traceId"), ts_field,
        fields.get("service", "project_name"),
        fields.get("level", "level"),
        fields.get("message", "message"),
        fields.get("logger", "loggerName"),
        fields.get("thread", "thread"),
    ]
    query["_source"] = all_fields

    result = es_query(env_config, index, query, size)
    hits = result.get("hits", {}).get("hits", [])
    return [h["_source"] for h in hits]


def parse_timestamp(ts_str: str) -> Optional[datetime]:
    if not ts_str:
        return None
    for fmt in (
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%S.%f%z",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
    ):
        try:
            return datetime.strptime(ts_str, fmt)
        except ValueError:
            continue
    return None


def analyze_chain(logs: list[dict], config: dict) -> dict:
    elk = config.get("elk", {})
    fields = elk.get("fields", {})
    ts_field = fields.get("timestamp", "@timestamp")
    svc_field = fields.get("service", "project_name")
    level_field = fields.get("level", "level")
    msg_field = fields.get("message", "message")
    logger_field = fields.get("logger", "loggerName")
    src_class_field = fields.get("source_class", "source.class")
    src_method_field = fields.get("source_method", "source.method")

    chain = []
    errors = []
    services_seen = OrderedDict()

    for i, log in enumerate(logs):
        ts = log.get(ts_field, "")
        service = log.get(svc_field, "unknown")
        level = str(log.get(level_field, "INFO")).upper()
        message = str(log.get(msg_field, ""))
        logger = log.get(logger_field, "")
        src_class = log.get(src_class_field, "")
        src_method = log.get(src_method_field, "")

        entry = {
            "index": i + 1, "timestamp": ts, "service": service,
            "level": level, "logger": logger,
            "source_class": src_class, "source_method": src_method,
            "message": message[:800],
        }
        for ef in fields.get("extra_fields", []):
            val = log.get(ef)
            if val is not None:
                entry[ef] = val

        chain.append(entry)
        services_seen[service] = True
        if level in ("ERROR", "FATAL"):
            errors.append(entry)

    for i in range(1, len(chain)):
        t1 = parse_timestamp(chain[i - 1]["timestamp"])
        t2 = parse_timestamp(chain[i]["timestamp"])
        if t1 and t2:
            chain[i]["gap_ms"] = int((t2 - t1).total_seconds() * 1000)

    total_duration_ms = None
    if len(chain) >= 2:
        t_start = parse_timestamp(chain[0]["timestamp"])
        t_end = parse_timestamp(chain[-1]["timestamp"])
        if t_start and t_end:
            total_duration_ms = int((t_end - t_start).total_seconds() * 1000)

    return {
        "total_logs": len(chain),
        "services": list(services_seen.keys()),
        "total_duration_ms": total_duration_ms,
        "errors": errors,
        "chain": chain,
    }


def detect_call_info(message: str, config: dict) -> dict:
    elk = config.get("elk", {})
    patterns = elk.get("call_patterns", [])
    info = {}
    for pat_def in patterns:
        pattern = pat_def.get("pattern", "")
        ptype = pat_def.get("type", "")
        if not pattern:
            continue
        match = re.search(pattern, message, re.IGNORECASE)
        if match:
            info[ptype] = match.group(1) if match.lastindex else match.group(0)
    return info


def generate_mermaid(analysis: dict, config: dict) -> str:
    chain = analysis["chain"]
    services = analysis["services"]

    if not chain or len(services) < 1:
        return ""

    lines = ["sequenceDiagram"]

    sanitized = {}
    for svc in services:
        safe = re.sub(r'[^a-zA-Z0-9_]', '_', svc)
        sanitized[svc] = safe
        lines.append(f"    participant {safe} as {svc}")

    call_stack: list[str] = []
    prev_svc = None
    transitions: list[dict] = []

    for entry in chain:
        cur_svc = entry["service"]
        if cur_svc == prev_svc:
            prev_svc = cur_svc
            continue

        if prev_svc is not None:
            call_info = detect_call_info(entry["message"], config)
            label = ""
            if "http_call" in call_info:
                label = call_info["http_call"]
            if not label:
                src_class = entry.get("source_class", "")
                src_method = entry.get("source_method", "")
                if src_class and src_method:
                    short_class = src_class.rsplit(".", 1)[-1] if "." in src_class else src_class
                    label = f"{short_class}.{src_method}()"
                elif entry.get("logger"):
                    label = entry["logger"].rsplit(".", 1)[-1]
                else:
                    label = entry["message"][:60].replace('"', "'")

            if call_stack and call_stack[-1] == cur_svc:
                call_stack.pop()
                transitions.append({"from": prev_svc, "to": cur_svc, "type": "response", "label": label, "level": entry["level"]})
            else:
                call_stack.append(prev_svc)
                transitions.append({"from": prev_svc, "to": cur_svc, "type": "call", "label": label, "level": entry["level"]})

        prev_svc = cur_svc

    while len(call_stack) > 1:
        caller = call_stack.pop()
        callee = prev_svc
        if caller != callee:
            transitions.append({"from": callee, "to": caller, "type": "response", "label": "return", "level": "INFO"})
        prev_svc = caller

    for t in transitions:
        from_svc = sanitized.get(t["from"], t["from"])
        to_svc = sanitized.get(t["to"], t["to"])
        label = t["label"].replace('"', "'")[:80]
        is_error = t["level"] in ("ERROR", "FATAL")
        if t["type"] == "call":
            if is_error:
                lines.append(f"    Note over {from_svc},{to_svc}: ⚠️ ERROR")
            lines.append(f'    {from_svc}->>{to_svc}: {label}')
        else:
            if is_error:
                lines.append(f"    Note over {to_svc},{from_svc}: ⚠️ ERROR")
            lines.append(f'    {from_svc}-->>{to_svc}: {label}')

    if not transitions:
        svc = sanitized.get(services[0], services[0])
        lines.append(f"    Note over {svc}: 单服务链路 - {analysis['total_logs']} 条日志")
        for entry in chain[:8]:
            src_class = entry.get("source_class", "")
            src_method = entry.get("source_method", "")
            if src_class and src_method:
                short_class = src_class.rsplit(".", 1)[-1] if "." in src_class else src_class
                msg = f"{short_class}.{src_method}()"
            else:
                msg = entry["message"][:50].replace('"', "'")
            lines.append(f"    {svc}->{svc}: {msg}")

    return "\n".join(lines)


def _short_class(full_class: str) -> str:
    return full_class.rsplit(".", 1)[-1] if "." in full_class else full_class


def _format_ts_short(ts_str: str) -> str:
    """'2026-03-17T09:21:16.750Z' → '09:21:16'"""
    dt = parse_timestamp(ts_str)
    if dt:
        return dt.strftime("%H:%M:%S")
    return ts_str


def generate_timeline_summary(analysis: dict, config: dict) -> str:
    """Extract key milestones from the call chain into a readable timeline."""
    chain = analysis["chain"]
    if not chain:
        return ""

    RE_DUBBO = re.compile(r'>> dubbo invoke \[([^\]]+)\].*?cost=(\d+)ms', re.DOTALL)
    RE_TOOL_START = re.compile(r'工具\s+\S+\s+(\S+)\s+模型输出的\s+toolInput')
    RE_TOOL_RESULT = re.compile(r'工具\s+\S+\s+(\S+)\s+返回结果')
    RE_TOOL_ERROR = re.compile(r'工具\s+\S+\s+(\S+)\s+执行出错')
    RE_AGENT_START = re.compile(r'agent\s+(\S+)\s+执行开始')
    RE_AGENT_END = re.compile(r'agent\s+(\S+)\s+执行完成')
    RE_HTTP_ENTRY = re.compile(r'\S+\s+(POST|GET|PUT|DELETE)\s+(/\S+)')
    RE_COST_LOG = re.compile(r'(POST|GET|PUT|DELETE)\s+(/\S+).*?_RC\{"start":\d+,"end":\d+,"cost":(\d+)\}')

    events: list[dict] = []

    for entry in chain:
        ts = entry["timestamp"]
        svc = entry["service"]
        msg = entry["message"]
        level = entry["level"]
        src_class = entry.get("source_class", "")

        m = RE_AGENT_START.search(msg)
        if m:
            events.append({"ts": ts, "svc": svc, "icon": "🚀", "desc": f"Agent `{m.group(1)}` 执行开始"})
            continue

        m = RE_AGENT_END.search(msg)
        if m:
            events.append({"ts": ts, "svc": svc, "icon": "✅", "desc": f"Agent `{m.group(1)}` 执行完成"})
            continue

        m = RE_TOOL_ERROR.search(msg)
        if m:
            events.append({"ts": ts, "svc": svc, "icon": "❌", "desc": f"工具 `{m.group(1)}` 执行出错"})
            continue

        m = RE_TOOL_START.search(msg)
        if m:
            events.append({"ts": ts, "svc": svc, "icon": "🔧", "desc": f"调用工具 `{m.group(1)}`"})
            continue

        m = RE_TOOL_RESULT.search(msg)
        if m:
            result_preview = msg[msg.find("返回结果:") + 5:][:120] if "返回结果:" in msg else ""
            events.append({"ts": ts, "svc": svc, "icon": "📦", "desc": f"工具 `{m.group(1)}` 返回结果", "detail": result_preview})
            continue

        m = RE_DUBBO.search(msg)
        if m:
            iface = m.group(1).rsplit(".", 1)[-1] if "." in m.group(1) else m.group(1)
            cost = m.group(2)
            events.append({"ts": ts, "svc": svc, "icon": "📡", "desc": f"Dubbo `{iface}` ({cost}ms)"})
            continue

        m = RE_COST_LOG.search(msg)
        if m:
            events.append({"ts": ts, "svc": svc, "icon": "⏱️",
                           "desc": f"请求完成 `{m.group(1)} {m.group(2)}` 总耗时 {m.group(3)}ms"})
            continue

        m = RE_HTTP_ENTRY.search(msg)
        if m and _short_class(src_class) in ("LogFilter", "request"):
            events.append({"ts": ts, "svc": svc, "icon": "🌐", "desc": f"HTTP 入口 `{m.group(1)} {m.group(2)}`"})
            continue

        if level in ("ERROR", "FATAL"):
            short = _short_class(src_class) if src_class else entry.get("logger", "").rsplit(".", 1)[-1]
            err_msg = msg[:120].replace("\n", " ")
            events.append({"ts": ts, "svc": svc, "icon": "⚠️", "desc": f"ERROR `{short}`: {err_msg}"})

    if not events:
        return ""

    lines = ["## 调用链路概述", ""]
    lines.append("| 时间 | 服务 | 事件 |")
    lines.append("|------|------|------|")
    for ev in events:
        ts_short = _format_ts_short(ev["ts"])
        lines.append(f"| {ts_short} | `{ev['svc']}` | {ev['icon']} {ev['desc']} |")
    lines.append("")
    return "\n".join(lines)


def generate_error_analysis(analysis: dict, config: dict) -> str:
    """Group errors by type, detect retries, and provide root-cause hints."""
    errors = analysis.get("errors", [])
    if not errors:
        return ""

    RE_XML_CONTENT = re.compile(r'<\w+>.*?</\w+>', re.DOTALL)

    def _normalize_msg(msg: str) -> str:
        """Collapse XML/HTML content and variable parts to group similar errors."""
        if RE_XML_CONTENT.search(msg):
            return "[模型返回了非JSON格式内容]"
        normalized = re.sub(r'[0-9a-f]{24,}', '<ID>', msg)
        normalized = re.sub(r'\b\d{4,}\b', '<NUM>', normalized)
        return normalized[:150].strip()

    groups: dict[str, list[dict]] = {}
    for err in errors:
        src_class = err.get("source_class", "")
        short = _short_class(src_class) if src_class else err.get("logger", "").rsplit(".", 1)[-1]
        svc = err["service"]
        msg_norm = _normalize_msg(err["message"])
        key = f"{svc}||{short}||{msg_norm}"
        groups.setdefault(key, []).append(err)

    lines = ["## 错误分析", ""]
    lines.append(f"共 **{len(errors)} 个错误**，归为 **{len(groups)} 类**：")
    lines.append("")

    for idx, (key, err_list) in enumerate(groups.items(), 1):
        parts = key.split("||", 2)
        svc = parts[0]
        short_class = parts[1] if len(parts) > 1 else "Unknown"
        msg_core = parts[2] if len(parts) > 2 else ""
        count = len(err_list)
        first = err_list[0]
        last = err_list[-1]

        ts_range = _format_ts_short(first["timestamp"])
        if count > 1:
            ts_range += f" ~ {_format_ts_short(last['timestamp'])}"

        retry_hint = ""
        if count > 1:
            retry_hint = f"（出现 {count} 次，可能存在重试机制）"

        lines.append(f"### 错误类型 {idx}: `{short_class}` {retry_hint}")
        lines.append("")
        lines.append(f"- **服务**: `{svc}`")
        lines.append(f"- **出现次数**: {count}")
        lines.append(f"- **时间范围**: {ts_range}")
        lines.append(f"- **类全路径**: `{first.get('source_class', '') or first.get('logger', '')}`")
        raw_msg = first["message"][:300].strip()
        lines.append(f"- **错误消息**:")
        lines.append(f"  > {raw_msg}")
        if count > 1:
            other_msgs = set()
            for e in err_list[1:]:
                m = e["message"][:200].strip()
                if m != raw_msg[:200]:
                    other_msgs.add(m[:150])
            if other_msgs:
                lines.append(f"  > *(另有 {len(other_msgs)} 条不同消息内容)*")
        lines.append("")

        is_missing_field = re.search(r'[Mm]issing\s+required\s+field', raw_msg)
        is_json_parse = re.search(r'<\w+>.*</\w+>', raw_msg, re.DOTALL)
        is_retry_error = "action.call() error" in raw_msg.lower()
        is_npe = "NullPointerException" in raw_msg
        is_timeout = re.search(r'[Tt]imeout|timed?\s*out', raw_msg)
        is_connection = re.search(r'[Cc]onnect(ion)?\s+(refused|reset|failed)', raw_msg)

        hints = []
        if is_missing_field:
            field_match = re.search(r'field[:\s]+(\w+)', msg_core, re.IGNORECASE)
            field_name = field_match.group(1) if field_match else "未知"
            hints.append(f"上游调用方未传递必要字段 `{field_name}`，检查调用参数是否完整")
            hints.append("检查工具定义中的参数映射逻辑是否正确")
        if is_json_parse:
            hints.append("模型返回了 XML/HTML 格式而非期望的 JSON，可能需要调整 prompt 或增加格式校验")
        if is_retry_error:
            hints.append("多次重试后仍然失败，检查被调用方法的根因错误")
            hints.append("确认重试策略配置是否合理（次数、间隔）")
        if is_npe:
            hints.append("空指针异常，检查上游返回数据是否有空值未处理")
        if is_timeout:
            hints.append("请求超时，检查下游服务响应时间或调整超时配置")
        if is_connection:
            hints.append("连接异常，检查下游服务是否正常运行，网络是否可达")
        if not hints:
            hints.append("建议通过 GitLab 搜索该类源码，定位异常抛出点")

        lines.append("  **可能原因及建议**:")
        for hint in hints:
            lines.append(f"  - {hint}")
        lines.append("")

    return "\n".join(lines)


def _generate_header(trace_id: str, env: str, analysis: dict, now_str: str) -> list[str]:
    duration = analysis.get("total_duration_ms")
    duration_str = f"{duration}ms" if duration is not None else "N/A"
    lines = [
        "# 全链路追踪报告", "",
        "| 项目 | 值 |",
        "|------|-----|",
        f"| **TraceId** | `{trace_id}` |",
        f"| **环境** | {env} |",
        f"| **生成时间** | {now_str} |",
        f"| **日志总数** | {analysis['total_logs']} |",
        f"| **涉及服务** | {', '.join(analysis['services'])} |",
        f"| **总耗时** | {duration_str} |",
        f"| **错误数** | {len(analysis['errors'])} |",
        "",
    ]
    return lines


def _generate_mermaid_section(mermaid: str) -> list[str]:
    return ["## 时序图", "", "```mermaid", mermaid, "```", ""]


def _generate_ordered_logs(analysis: dict) -> list[str]:
    lines = ["## 有序日志", ""]
    prev_service = None
    for entry in analysis["chain"]:
        svc = entry["service"]
        level = entry["level"]
        gap = entry.get("gap_ms")

        if prev_service and prev_service != svc:
            lines.append("---")
            lines.append("")

        gap_str = f" (+{gap}ms)" if gap is not None else ""
        level_marker = " ⚠️" if level in ("ERROR", "FATAL") else ""

        src_class = entry.get("source_class", "")
        src_method = entry.get("source_method", "")
        if src_class:
            short_class = _short_class(src_class)
            loc = f"{short_class}.{src_method}()" if src_method else short_class
        elif entry.get("logger"):
            loc = entry["logger"].rsplit(".", 1)[-1]
        else:
            loc = ""

        lines.append(f"**[{entry['timestamp']}]** `{svc}` | {loc} ({level}){level_marker}{gap_str}")

        hostname = entry.get("hostname", "")
        if hostname:
            lines.append(f"> host: {hostname}")

        msg = entry["message"][:500].replace("|", "\\|")
        lines.append(f"> {msg}")
        lines.append("")
        prev_service = svc
    return lines


def _generate_error_details(analysis: dict) -> list[str]:
    if not analysis["errors"]:
        return []
    lines = ["## 错误详情", ""]
    for err in analysis["errors"]:
        src = err.get("source_class", "")
        method = err.get("source_method", "")
        loc = f"`{src}.{method}()`" if src and method else f"`{err.get('logger', '')}`"
        lines.append(f"### ⚠️ {err['service']} | {loc}")
        lines.append("")
        lines.append(f"- **时间**: {err['timestamp']}")
        lines.append(f"- **消息**: {err['message'][:500]}")
        lines.append("")
    return lines


def generate_summary(trace_id: str, env: str, analysis: dict, mermaid: str, config: dict) -> str:
    """Generate a compact summary for stdout (概览 + 时序图 + 链路概述 + 错误分析)."""
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines = _generate_header(trace_id, env, analysis, now_str)
    lines.extend(_generate_mermaid_section(mermaid))

    timeline = generate_timeline_summary(analysis, config)
    if timeline:
        lines.append(timeline)

    error_analysis = generate_error_analysis(analysis, config)
    if error_analysis:
        lines.append(error_analysis)

    return "\n".join(lines)


def generate_full_report(trace_id: str, env: str, analysis: dict, mermaid: str, config: dict) -> str:
    """Generate the complete Markdown report for file output (includes ordered logs + error details)."""
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines = _generate_header(trace_id, env, analysis, now_str)
    lines.extend(_generate_mermaid_section(mermaid))

    timeline = generate_timeline_summary(analysis, config)
    if timeline:
        lines.append(timeline)

    error_analysis = generate_error_analysis(analysis, config)
    if error_analysis:
        lines.append(error_analysis)

    lines.extend(_generate_ordered_logs(analysis))
    lines.extend(_generate_error_details(analysis))

    return "\n".join(lines)


def write_md_report(trace_id: str, env: str, md_content: str, config: dict) -> str:
    """Write .md report to configured output directory. Returns the file path."""
    output_dir = get_output_dir(config)
    output_dir.mkdir(parents=True, exist_ok=True)

    now_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    short_id = trace_id[:12]
    filename = f"trace_{env}_{short_id}_{now_str}.md"
    filepath = output_dir / filename

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(md_content)

    return str(filepath)


def main():
    parser = argparse.ArgumentParser(description="Trace Analyzer")
    subparsers = parser.add_subparsers(dest="command", required=True)

    sp_trace = subparsers.add_parser("trace", help="按 traceId 查询全链路")
    sp_trace.add_argument("--env", required=True, help="环境 (dev/test/prod)")
    sp_trace.add_argument("--trace-id", required=True, help="traceId")
    sp_trace.add_argument("--time-range", type=int, default=None,
                          help="时间范围(分钟)，默认 180 (近3小时)")
    sp_trace.add_argument("--time-from", default=None,
                          help="起始时间, 如 '2026-03-17 14:00:00' 或 '2026-03-17T14:00:00Z'")
    sp_trace.add_argument("--time-to", default=None,
                          help="结束时间, 如 '2026-03-17 15:00:00' (默认当前时间)")
    sp_trace.add_argument("--size", type=int, default=None, help="最大日志条数")
    sp_trace.add_argument("--json", action="store_true", help="输出 JSON 到 stdout")
    sp_trace.add_argument("--mermaid-only", action="store_true", help="仅输出 Mermaid 代码")
    sp_trace.add_argument("--full", action="store_true",
                          help="stdout 输出完整报告（含全量有序日志），默认只输出精简摘要")
    sp_trace.add_argument("--no-file", action="store_true", help="不生成 .md 文件，仅输出到 stdout")
    sp_trace.add_argument("--output-dir", default=None, help="覆盖配置的输出目录")

    sp_search = subparsers.add_parser("search", help="按关键字搜索日志")
    sp_search.add_argument("--env", required=True, help="环境")
    sp_search.add_argument("--keyword", required=True, help="搜索关键字")
    sp_search.add_argument("--time-range", type=int, default=None,
                           help="时间范围(分钟)，默认 180 (近3小时)")
    sp_search.add_argument("--time-from", default=None, help="起始时间")
    sp_search.add_argument("--time-to", default=None, help="结束时间")
    sp_search.add_argument("--size", type=int, default=None, help="最大条数")
    sp_search.add_argument("--json", action="store_true")

    args = parser.parse_args()
    config = load_config()
    elk = config.get("elk", {})
    defaults = elk.get("defaults", {})
    size = getattr(args, "size", None) or defaults.get("max_results", 500)

    if args.command == "trace":
        if args.output_dir:
            config.setdefault("output", {})["directory"] = args.output_dir

        default_minutes = defaults.get("time_range_minutes", 180)
        t_from, t_to = parse_time_range(
            getattr(args, "time_from", None),
            getattr(args, "time_to", None),
            args.time_range or default_minutes,
        )
        print(f"查询时间范围: {t_from} ~ {t_to}", file=sys.stderr)

        logs = trace_logs(config, args.env, args.trace_id, size, t_from, t_to)
        if not logs:
            print(f"未找到 traceId={args.trace_id} 的日志（在指定时间范围内）", file=sys.stderr)
            print(f"提示: 可尝试 --time-range 1440 (24h) 或 --time-from/--time-to 指定精确区间", file=sys.stderr)
            sys.exit(0)

        analysis = analyze_chain(logs, config)
        mermaid = generate_mermaid(analysis, config)

        if args.mermaid_only:
            print(mermaid)
            sys.exit(0)

        if args.json:
            output = {
                "trace_id": args.trace_id,
                "summary": {
                    "total_logs": analysis["total_logs"],
                    "services": analysis["services"],
                    "total_duration_ms": analysis["total_duration_ms"],
                    "error_count": len(analysis["errors"]),
                },
                "mermaid": mermaid,
                "errors": analysis["errors"],
                "logs": analysis["chain"],
            }
            print(json.dumps(output, ensure_ascii=False, indent=2))
            sys.exit(0)

        full_report = generate_full_report(args.trace_id, args.env, analysis, mermaid, config)

        if args.no_file:
            print(full_report)
        else:
            filepath = write_md_report(args.trace_id, args.env, full_report, config)
            if args.full:
                print(full_report)
            else:
                summary = generate_summary(args.trace_id, args.env, analysis, mermaid, config)
                print(summary)
            print(f"\n---\n📄 完整报告（含全量日志）已保存至: {filepath}", file=sys.stderr)

    elif args.command == "search":
        default_minutes = defaults.get("time_range_minutes", 180)
        time_range = args.time_range or default_minutes
        logs = search_logs(config, args.env, args.keyword, time_range, size)
        if not logs:
            print("未找到匹配的日志", file=sys.stderr)
            sys.exit(0)

        fields = elk.get("fields", {})
        tid_field = fields.get("trace_id", "traceId")
        trace_ids = sorted({
            str(log[tid_field]) for log in logs
            if log.get(tid_field) and str(log[tid_field]).strip()
        })

        if args.json:
            print(json.dumps({"count": len(logs), "trace_ids": trace_ids, "logs": logs}, ensure_ascii=False, indent=2))
        else:
            ts_field = fields.get("timestamp", "@timestamp")
            svc_field = fields.get("service", "project_name")
            msg_field = fields.get("message", "message")
            print(f"找到 {len(logs)} 条日志:\n")
            for i, log in enumerate(logs[:30], 1):
                ts = log.get(ts_field, "?")
                svc = log.get(svc_field, "?")
                level = log.get(fields.get("level", "level"), "?")
                tid = log.get(tid_field, "")
                msg = str(log.get(msg_field, ""))[:200]
                print(f"[{i}] {ts} | {svc} | {level} | traceId={tid}")
                print(f"    {msg}\n")
            if trace_ids:
                print(f"\n提取到的 traceId ({len(trace_ids)}):")
                for tid in trace_ids[:20]:
                    print(f"  - {tid}")


if __name__ == "__main__":
    main()
