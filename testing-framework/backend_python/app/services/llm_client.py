"""大模型客户端：Dify > OpenAI 兼容 > Claude（与 Node 版逻辑一致）"""

from __future__ import annotations

import json
import os
import re
from typing import Any, TypedDict

import httpx

ANTHROPIC_BASE = "https://api.anthropic.com/v1"
ANTHROPIC_VERSION = "2023-06-01"
DEFAULT_MODEL = "claude-opus-4-6"

DIFY_BASE = (
    os.getenv("DIFY_API_BASE") or os.getenv("DIFY_BASE_URL") or os.getenv("DIFY_BASE") or ""
).strip()
DIFY_API_KEY = (os.getenv("DIFY_API_KEY") or os.getenv("DIFY_KEY") or "").strip()
DIFY_IMAGE_AGENT_BASE = (
    os.getenv("DIFY_IMAGE_AGENT_BASE")
    or os.getenv("DIFY_API_BASE")
    or os.getenv("DIFY_BASE_URL")
    or os.getenv("DIFY_BASE")
    or ""
).strip()
DIFY_IMAGE_AGENT_API_KEY = (os.getenv("DIFY_IMAGE_AGENT_API_KEY") or "").strip()
COMPANY_IMAGE_API_BASE = (os.getenv("COMPANY_IMAGE_API_BASE") or "").strip()
COMPANY_IMAGE_API_KEY = (os.getenv("COMPANY_IMAGE_API_KEY") or "").strip()
OPENAI_BASE = (os.getenv("LLM_BASE_URL") or os.getenv("LLM_BASE_BASE") or "").strip()
OPENAI_API_KEY = (os.getenv("LLM_API_KEY") or "").strip()
ANTHROPIC_API_KEY = (os.getenv("ANTHROPIC_API_KEY") or "").strip()
MODEL = (os.getenv("LLM_MODEL") or DEFAULT_MODEL).strip()


class ChatMessage(TypedDict):
    role: str
    content: str


def is_dify_configured() -> bool:
    return bool(DIFY_BASE and DIFY_API_KEY)


def is_dify_image_agent_configured() -> bool:
    return bool(DIFY_IMAGE_AGENT_BASE and DIFY_IMAGE_AGENT_API_KEY)


def is_company_image_api_configured() -> bool:
    return bool(COMPANY_IMAGE_API_BASE)


def is_openai_configured() -> bool:
    return bool(OPENAI_BASE and OPENAI_API_KEY)


def is_claude_configured() -> bool:
    return bool(ANTHROPIC_API_KEY)


def is_configured() -> bool:
    return is_dify_configured() or is_openai_configured() or is_claude_configured()


def _chat_via_dify(messages: list[ChatMessage], **kw: Any) -> str:
    system_parts: list[str] = []
    user_parts: list[str] = []
    for m in messages:
        if m["role"] == "system":
            system_parts.append(m["content"])
        elif m["role"] == "user":
            user_parts.append(m["content"])
    query = (
        f"【系统指令】\n{chr(10).join(system_parts)}\n\n【用户请求】\n{chr(10).join(user_parts)}"
        if system_parts
        else "\n\n".join(user_parts)
    )
    url = f"{DIFY_BASE.rstrip('/')}/chat-messages"
    body: dict[str, Any] = {
        "query": query,
        "user": "testing-platform",
        "response_mode": "blocking",
        "inputs": {},
    }
    max_tokens = kw.get("maxTokens")
    if max_tokens:
        body["max_tokens"] = int(max_tokens)
    try:
        with httpx.Client(timeout=300.0) as client:
            r = client.post(
                url,
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {DIFY_API_KEY}"},
                json=body,
            )
    except httpx.RequestError as e:
        raise RuntimeError(
            f"Dify 请求网络异常（无法连接 {url}）: {e}。请检查 DIFY_API_BASE 是否正确、Dify 服务是否可访问。"
        ) from e
    if not r.is_success:
        raise RuntimeError(f"Dify API 请求失败: {r.status_code} {r.text}")
    data = r.json()
    answer = data.get("answer")
    if answer is None:
        raise RuntimeError("Dify 响应缺少 answer")
    return answer


def _read_dify_stream_answer(response: httpx.Response) -> str:
    chunks: list[str] = []
    saw_end = False
    for line in response.iter_lines():
        if not line:
            continue
        if isinstance(line, bytes):
            line = line.decode("utf-8", errors="replace")
        if not line.startswith("data: "):
            continue
        data = line[6:].strip()
        if data in ("[DONE]", ""):
            continue
        try:
            obj = json.loads(data)
        except json.JSONDecodeError:
            continue
        ev = obj.get("event")
        if ev == "agent_message" and obj.get("answer") is not None:
            chunks.append(str(obj["answer"]))
        if ev == "message" and obj.get("answer") is not None:
            chunks.append(str(obj["answer"]))
        if ev == "message_end":
            saw_end = True
            break
        if ev == "error":
            raise RuntimeError(f"Dify 流式返回错误: {obj.get('message', data)}")
    return "".join(chunks)


def chat_with_image_via_dify(user_prompt: str, image_bytes: bytes, mime_type: str) -> str:
    if not DIFY_IMAGE_AGENT_BASE or not DIFY_IMAGE_AGENT_API_KEY:
        raise RuntimeError("未配置 DIFY_IMAGE_AGENT_API_KEY")
    base = DIFY_IMAGE_AGENT_BASE.rstrip("/")
    ext = (
        "png"
        if mime_type == "image/png"
        else "jpg"
        if mime_type in ("image/jpeg", "image/jpg")
        else "webp"
        if mime_type == "image/webp"
        else "gif"
        if mime_type == "image/gif"
        else "png"
    )
    filename = f"image.{ext}"
    with httpx.Client(timeout=300.0) as client:
        upload = client.post(
            f"{base}/files/upload",
            headers={"Authorization": f"Bearer {DIFY_IMAGE_AGENT_API_KEY}"},
            files={"file": (filename, image_bytes, mime_type or "image/png")},
            data={"user": "testing-platform"},
        )
        if not upload.is_success:
            raise RuntimeError(f"Dify 图片上传失败: {upload.status_code} {upload.text}")
        upload_data = upload.json()
        file_id = upload_data.get("id")
        if not file_id:
            raise RuntimeError("Dify 文件上传响应缺少 id")
        with client.stream(
            "POST",
            f"{base}/chat-messages",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {DIFY_IMAGE_AGENT_API_KEY}",
            },
            json={
                "query": user_prompt,
                "user": "testing-platform",
                "response_mode": "streaming",
                "inputs": {},
                "files": [{"type": "image", "transfer_method": "local_file", "upload_file_id": file_id}],
            },
        ) as chat:
            if not chat.is_success:
                raise RuntimeError(f"Dify 图片识别请求失败: {chat.status_code} {chat.read().decode()}")
            ct = chat.headers.get("content-type", "")
            if "text/event-stream" in (ct or ""):
                answer = _read_dify_stream_answer(chat)
            else:
                body = chat.read().decode()
                answer = str(json.loads(body).get("answer") or "")
        if not answer:
            raise RuntimeError("Dify 图片识别响应无内容")
        return answer


def chat_with_image_via_company_api(user_prompt: str, image_bytes: bytes, mime_type: str) -> str:
    if not COMPANY_IMAGE_API_BASE:
        raise RuntimeError("未配置 COMPANY_IMAGE_API_BASE")
    import base64

    base = COMPANY_IMAGE_API_BASE.rstrip("/")
    b64 = base64.b64encode(image_bytes).decode("ascii")
    data_url = f"data:{mime_type or 'image/png'};base64,{b64}"
    headers = {"Content-Type": "application/json", "accept": "application/json"}
    if COMPANY_IMAGE_API_KEY:
        headers["Authorization"] = f"Bearer {COMPANY_IMAGE_API_KEY}"
    with httpx.Client(timeout=300.0) as client:
        r = client.post(
            f"{base}/v1/chat/completions",
            headers=headers,
            json={
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {"url": data_url}},
                            {"type": "text", "text": user_prompt},
                        ],
                    }
                ],
                "temperature": 0,
                "max_tokens": 120000,
            },
        )
    if not r.is_success:
        raise RuntimeError(f"公司图片解析接口请求失败: {r.status_code} {r.text}")
    data = r.json()
    content = (data.get("choices") or [{}])[0].get("message", {}).get("content")
    if content is None:
        raise RuntimeError("公司图片解析接口响应无 content")
    return str(content)


def _chat_via_openai(messages: list[ChatMessage], **options: Any) -> str:
    url = f"{OPENAI_BASE.rstrip('/')}/chat/completions"
    body = {
        "model": options.get("model") or os.getenv("LLM_MODEL") or "gpt-3.5-turbo",
        "messages": [{"role": m["role"], "content": m["content"]} for m in messages],
        "max_tokens": options.get("maxTokens") or 4096,
    }
    with httpx.Client(timeout=300.0) as client:
        r = client.post(
            url,
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {OPENAI_API_KEY}"},
            json=body,
        )
    if not r.is_success:
        if r.status_code == 404:
            raise RuntimeError(
                f"请求 {url} 返回 404。若使用 Dify，请配置 DIFY_API_BASE 与 DIFY_API_KEY，不要用 LLM_BASE_URL 指向 Dify。"
            )
        raise RuntimeError(f"公司大模型/OpenAI 兼容 API 请求失败: {r.status_code} {r.text}")
    data = r.json()
    content = (data.get("choices") or [{}])[0].get("message", {}).get("content")
    if content is None:
        raise RuntimeError("响应缺少 content")
    return str(content)


def _chat_via_claude(messages: list[ChatMessage], **options: Any) -> str:
    model = options.get("model") or MODEL
    max_tokens = options.get("maxTokens") or 4096
    system_parts: list[str] = []
    api_messages: list[dict[str, str]] = []
    for m in messages:
        if m["role"] == "system":
            system_parts.append(m["content"])
        else:
            api_messages.append({"role": m["role"], "content": m["content"]})
    body: dict[str, Any] = {"model": model, "max_tokens": max_tokens, "messages": api_messages}
    if system_parts:
        body["system"] = "\n\n".join(system_parts)
    with httpx.Client(timeout=300.0) as client:
        r = client.post(
            f"{ANTHROPIC_BASE}/messages",
            headers={
                "Content-Type": "application/json",
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": ANTHROPIC_VERSION,
            },
            json=body,
        )
    if not r.is_success:
        err = r.text
        if r.status_code == 401:
            raise RuntimeError("Claude API 认证失败，请检查 ANTHROPIC_API_KEY")
        if r.status_code == 400 and "credit balance is too low" in err:
            raise RuntimeError("Claude 账户余额不足")
        raise RuntimeError(f"Claude API failed: {r.status_code} {err}")
    data = r.json()
    blocks = data.get("content") or []
    text = blocks[0].get("text") if blocks and blocks[0].get("type") == "text" else None
    if text is None:
        raise RuntimeError("Claude 响应缺少 content")
    return str(text)


def chat(messages: list[ChatMessage], **options: Any) -> str:
    if is_dify_configured():
        return _chat_via_dify(messages, **options)
    if is_openai_configured():
        return _chat_via_openai(messages, **options)
    if is_claude_configured():
        return _chat_via_claude(messages, **options)
    raise RuntimeError(
        "未配置大模型。请配置 Dify、LLM_BASE_URL+LLM_API_KEY 或 ANTHROPIC_API_KEY。参见 .env.example。"
    )
