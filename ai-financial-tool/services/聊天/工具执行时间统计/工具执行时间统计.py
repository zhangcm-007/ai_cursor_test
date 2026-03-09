import json
from datetime import datetime, timedelta, timezone

# 北京时间 UTC+8
BEIJING_TZ = timezone(timedelta(hours=8))

from openpyxl import Workbook
from core.mongodb_client import mongo_client

db = mongo_client['llm-conversation']
collection = db['chat_message_log']


def date_to_timestamp_ms(year, month, day):
    dt = datetime(year, month, day, tzinfo=BEIJING_TZ)
    return int(dt.timestamp() * 1000)


def query_page(start, end, last_time=None, last_id=None, page_size=5):
    query = {"create_time": {"$gte": start, "$lt": end}}
    if last_time is not None and last_id is not None:
        query["$or"] = [
            {"create_time": {"$lt": last_time}},
            {"create_time": last_time, "_id": {"$lt": last_id}}
        ]

    cursor = (
        collection.find(query)
        .sort([("create_time", -1), ("_id", -1)])
        .limit(page_size)
    )
    return list(cursor)


def extract_tool_call_list(messages):
    """
    从调用模型的 messages 中解析出工具调用列表。
    返回: list of dict, 每项包含 tool_call_id, tool_name, start_time, end_time
    """
    if not messages:
        return []
    # 先收集 assistant 消息里的 tool_calls: id -> function name
    call_id_to_name = {}
    for msg in messages:
        if msg.get('role') == 'assistant' and msg.get('tool_calls'):
            for tc in msg['tool_calls']:
                cid = tc.get('id')
                name = (tc.get('function') or {}).get('name') or ''
                if cid:
                    call_id_to_name[cid] = name
    # 再遍历 role=tool 的消息，从 content 里取 startTime, endTime, tool_call_id
    result = []
    for msg in messages:
        if msg.get('role') != 'tool':
            continue
        content = msg.get('content')
        if not content:
            continue
        tool_call_id = msg.get('tool_call_id')
        start_time = msg.get('startTime')
        end_time = msg.get('endTime')
        if tool_call_id is None and start_time is None and end_time is None:
            continue
        tool_name = call_id_to_name.get(tool_call_id, '')
        result.append({
            'tool_call_id': tool_call_id,
            'tool_name': tool_name,
            'start_time': start_time,
            'end_time': end_time,
        })
    return result


def process_step(step):
    if not step:
        return []
    request = step.get('request')
    messages = json.loads(request)
    # 若 request 是整包（含 messages 键），则取 messages 字段
    if isinstance(messages, dict) and 'messages' in messages:
        messages = messages['messages']
    if not isinstance(messages, list):
        return []
    return extract_tool_call_list(messages)


def append_tool_calls(excel_rows, step, mid):
    for row in process_step(step):
        start_time = row['start_time']
        end_time = row['end_time']
        duration = (end_time - start_time) if (start_time is not None and end_time is not None) else None
        excel_rows.append((mid, row['tool_call_id'], row['tool_name'], duration))


def process_element(element, excel_rows):
    """处理单条消息，将工具调用结果追加到 excel_rows。"""
    pre_prompt_id = None
    pre_step = None
    message_id = element.get('message_id')
    for step in element.get('execution_steps') or []:
        if not step.get('prompt_id'):
            continue
        from_agent_id = step.get('from_agent_id')
        try:
            agent_id = int(from_agent_id)
            if agent_id == 0:
                continue
        except Exception:
            continue
        prompt_id = step.get('prompt_id')
        if not pre_prompt_id:
            pre_prompt_id = prompt_id
            pre_step = step
        if pre_prompt_id == prompt_id:
            pre_prompt_id = prompt_id
            pre_step = step
            continue
        append_tool_calls(excel_rows, step, message_id)
    if pre_step:
        append_tool_calls(excel_rows, pre_step, message_id)


if __name__ == '__main__':
    excel_rows = []  # [(message_id, tool_call_id, tool_name, duration), ...]
    start_ts = date_to_timestamp_ms(2026, 2, 26)
    end_ts = date_to_timestamp_ms(2026, 2, 27)
    page_size = 5
    last_time = None
    last_id = None
    total_count = 0
    while True:
        page = query_page(start_ts, end_ts, last_time=last_time, last_id=last_id, page_size=page_size)
        if not page:
            break
        for element in page:
            process_element(element, excel_rows)
            total_count += 1
        print(f"已处理本页 {len(page)} 条，累计 {total_count} 条")
        if len(page) < page_size:
            break
        last = page[-1]
        last_time = last.get("create_time")
        last_id = last.get("_id")
        if last_time is None or last_id is None:
            break
    print(f"共处理 {total_count} 条消息记录")

    # 写入 Excel
    wb = Workbook()
    ws = wb.active
    ws.title = '工具执行时间'
    ws.append(['message_id', 'tool_call_id', 'tool_name', 'duration(ms)'])
    for r in excel_rows:
        msg_id, call_id, tool_name, duration = r
        ws.append([msg_id, call_id, tool_name, duration if duration is not None else 'N/A'])
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = f'工具执行时间统计_{timestamp}.xlsx'
    wb.save(out_path)
    print(f"已导出 {len(excel_rows)} 条记录到 {out_path}")
