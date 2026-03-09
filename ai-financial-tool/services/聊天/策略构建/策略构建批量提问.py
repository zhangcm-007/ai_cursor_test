import csv
import re

from openpyxl import Workbook

from core.api_client import APIClient
from core.mongodb_client import mongo_client

db = mongo_client['llm-conversation']
collection = db['chat_message_log']

file_path = '/Users/baidb/Develop/Workspace/ai-financial/script/ai-financial-tool/services/聊天/策略构建/策略构建测试问题集合组合.csv'
MAX_EXCEL_LEN = 32767


def safe_cell(value: str) -> str:
    if value is None:
        return ""
    value = re.sub(r"[\x00-\x08\x0B-\x0C\x0E-\x1F]", "", value)
    if value and len(value) > MAX_EXCEL_LEN:
        return ""
    return value


if __name__ == "__main__":
    wb = Workbook()
    ws = wb.active
    ws.append(["question", "investment_asset_and_type", "conversation_id", "message_id", "trace_id", "description",
               'strategy_construction_stock_pool_filtering_prompt 请求',
               'strategy_construction_stock_pool_filtering_prompt 响应',
               'strategy_construction_stock_selection_conditions_prompt 请求',
               'strategy_construction_stock_selection_conditions_prompt 响应',
               'strategy_construction_timing_conditions_prompt 请求',
               'strategy_construction_timing_conditions_prompt 响应'])
    with open(file_path, newline='', encoding='utf-8') as csvfile:
        api_client = APIClient()
        reader = csv.reader(csvfile)
        # 跳过表头
        next(reader)
        for num, row in enumerate(reader, start=1):
            try:
                # if num == 5:
                #     break
                col1, col2 = row
                print(f'{num}: {col1}')
                question = col1
                investment_asset_and_type = col2
                conversation_id = '688c8aeda2f2b0140ae988b7'
                message_id = None
                trace_id = None
                description = None
                last_content = None
                prompt_request1 = None
                prompt_response1 = None
                prompt_request2 = None
                prompt_response2 = None
                prompt_request3 = None
                prompt_response3 = None
                results = api_client.post_sse('/api/app/ai-agent/chat/message/stream/chat', json={
                    'conversationId': conversation_id,
                    'message': question,
                    "historySize": 0,
                })
                index = 0
                intention = None
                for result in results:
                    event, trace_id = result
                    data = event.get("data")
                    if not message_id:
                        message_id = data.get("id")
                    if not intention:
                        intention = data.get("intention")
                    content = data.get("content")
                    if content:
                        parts = content.get("parts")
                        if len(parts) == 1:
                            part = parts[0]
                            index_pre = index
                            index = part.get("index")
                            content_str = part.get("content")
                            if content_str and "策略构建回测结果错误" in content_str:
                                description = content_str.replace("策略构建回测结果错误", "")
                            elif content_str and "意图识别结果" in content_str:
                                index = index_pre
                if not description:
                    if intention != 'STRATEGY_CONSTRUCTION':
                        description = "意图不对"
                    else:
                        if index == 7:
                            description = "正常输出"
                        elif index == 1:
                            results = api_client.post_sse('/api/app/aiAgent/chat/message/stream/chat', json={
                                'conversationId': conversation_id,
                                'message': investment_asset_and_type,
                                "historySize": 2,
                            })
                            message_id = None
                            intention = None
                            for result in results:
                                event, trace_id = result
                                data = event.get("data")
                                if not message_id:
                                    message_id = data.get("id")
                                if not intention:
                                    intention = data.get("intention")
                                content = data.get("content")
                                if content:
                                    parts = content.get("parts")
                                    if len(parts) == 1:
                                        part = parts[0]
                                        index_pre = index
                                        index = part.get("index")
                                        content_str = part.get("content")
                                        if content_str and "策略构建结果错误" in content_str:
                                            description = "追问后 -" + content_str.replace("策略构建结果错误", "")
                                        elif content_str and "意图识别结果" in content_str:
                                            index = index_pre
                            if intention != 'STRATEGY_CONSTRUCTION':
                                description = "追问后 - 意图不对"
                            else:
                                if index == 7:
                                    description = "追问后 - 正常输出"
                if not description:
                    description = "未知异常"
                description = description.strip()
                print(f'{trace_id} {description}')
                message_log = collection.find_one({'message_id': message_id})
                if message_log:
                    execution_steps = message_log.get('execution_steps')
                    if execution_steps and len(execution_steps) > 0:
                        for execution_step in execution_steps:
                            prompt_id = execution_step.get('prompt_id')
                            if prompt_id == 'strategy_construction_stock_pool_filtering_prompt':
                                prompt_request1 = execution_step.get('request')
                                prompt_response1 = execution_step.get('response')
                            elif prompt_id == 'strategy_construction_stock_selection_conditions_prompt':
                                prompt_request2 = execution_step.get('request')
                                prompt_response2 = execution_step.get('response')
                            elif prompt_id == 'strategy_construction_timing_conditions_prompt':
                                prompt_request3 = execution_step.get('request')
                                prompt_response3 = execution_step.get('response')

                ws.append([
                    question,
                    investment_asset_and_type,
                    conversation_id,
                    message_id,
                    trace_id,
                    description,
                    safe_cell(prompt_request1),
                    safe_cell(prompt_response1),
                    safe_cell(prompt_request2),
                    safe_cell(prompt_response2),
                    safe_cell(prompt_request3),
                    safe_cell(prompt_response3),
                ])
            except Exception as e:
                print(f"发生异常: {e}")
    wb.save("策略构建批量结果.xlsx")
