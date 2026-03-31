from __future__ import annotations

import io
import re

from app.services import llm_client

IMAGE_PROMPT = "请识别图片中的全部文字，按阅读顺序输出纯文本。若图中无文字，请回复「图中无文字」。"
IMAGE_EXT = re.compile(r"\.(png|jpe?g|gif|webp|bmp)$", re.I)


def parse_attachment(data: bytes, mime_type: str, filename: str) -> str | None:
    t = (mime_type or "").lower()
    is_image = t.startswith("image/") or bool(IMAGE_EXT.search(filename))
    if is_image:
        effective = t if t.startswith("image/") else "image/png"
        use_company = llm_client.is_company_image_api_configured()
        use_dify = llm_client.is_dify_image_agent_configured()
        if not use_company and not use_dify:
            print(f'[附件解析] 图片 "{filename}" 未解析：未配置 COMPANY_IMAGE_API_BASE 或 DIFY_IMAGE_AGENT_API_KEY')
            return None
        try:
            text = (
                llm_client.chat_with_image_via_company_api(IMAGE_PROMPT, data, effective)
                if use_company
                else llm_client.chat_with_image_via_dify(IMAGE_PROMPT, data, effective)
            )
            print(f'[附件解析] 图片 "{filename}" 识别成功, 长度={len(text or "")}')
            return text
        except Exception as e:
            print(f'[附件解析] 图片 "{filename}" 识别失败: {e}')
            return None
    if t == "application/pdf":
        try:
            from pypdf import PdfReader

            reader = PdfReader(io.BytesIO(data))
            parts = []
            for page in reader.pages:
                parts.append(page.extract_text() or "")
            out = "\n".join(parts).strip()
            return out or None
        except Exception:
            return None
    if t in (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
    ):
        try:
            from docx import Document

            doc = Document(io.BytesIO(data))
            out = "\n".join(p.text for p in doc.paragraphs).strip()
            return out or None
        except Exception:
            return None
    if t in ("text/plain", "text/markdown", "text/csv"):
        try:
            return data.decode("utf-8", errors="replace").replace("\r\n", "\n").strip() or None
        except Exception:
            return None
    return None
