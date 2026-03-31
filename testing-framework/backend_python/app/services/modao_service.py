from __future__ import annotations

import base64
import logging
import os
from dataclasses import dataclass, field
from typing import List

from playwright.sync_api import sync_playwright, Page, Browser

logger = logging.getLogger(__name__)

PAGE_LOAD_TIMEOUT = int(os.getenv("MODAO_PAGE_LOAD_TIMEOUT", "15000"))
PAGE_SWITCH_DELAY = 1500

SIDEBAR_SELECTORS = [
    '[class*="page-list"] [class*="page-item"]',
    '[class*="page-tree"] [class*="tree-node"]',
    '[class*="sidebar"] [class*="page"]',
    '[class*="screen-list"] [class*="screen-item"]',
    '[class*="nav"] [class*="page"]',
    '[class*="panel"] [class*="page-name"]',
]

CONTENT_SELECTORS = [
    '[class*="canvas"]',
    '[class*="artboard"]',
    '[class*="prototype-view"]',
    '[class*="screen-content"]',
    '[class*="preview"]',
    "main",
    "#app",
]

ANNOTATION_SELECTORS = [
    '[class*="annotation"]',
    '[class*="comment"]',
    '[class*="note"]',
    '[class*="remark"]',
    '[class*="memo"]',
]


@dataclass
class ModaoPage:
    name: str
    textContent: str
    annotations: str
    screenshotBase64: str


@dataclass
class ModaoExtractResult:
    prototypeName: str
    pages: List[ModaoPage] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "prototypeName": self.prototypeName,
            "pages": [
                {
                    "name": p.name,
                    "textContent": p.textContent,
                    "annotations": p.annotations,
                    "screenshotBase64": p.screenshotBase64,
                }
                for p in self.pages
            ],
        }


def extract_modao_prototype(url: str, password: str) -> ModaoExtractResult:
    with sync_playwright() as pw:
        browser: Browser = pw.chromium.launch(headless=True)
        try:
            context = browser.new_context(
                viewport={"width": 1440, "height": 900},
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
            )
            page = context.new_page()

            logger.info("[modao] 正在访问: %s", url)
            page.goto(url, wait_until="networkidle", timeout=PAGE_LOAD_TIMEOUT * 2)

            _handle_password(page, password)
            page.wait_for_timeout(2000)

            prototype_name = _get_prototype_name(page)
            logger.info("[modao] 原型名称: %s", prototype_name)

            page_names = _get_page_list(page)
            logger.info("[modao] 共发现 %d 个页面", len(page_names))

            pages: List[ModaoPage] = []

            if not page_names:
                result = _extract_current_page(page, "主页面")
                pages.append(result)
            else:
                for i, pname in enumerate(page_names):
                    logger.info("[modao] 正在提取第 %d/%d 页: %s", i + 1, len(page_names), pname)
                    try:
                        _switch_to_page(page, i)
                        page.wait_for_timeout(PAGE_SWITCH_DELAY)
                        result = _extract_current_page(page, pname)
                        pages.append(result)
                    except Exception as exc:
                        logger.error("[modao] 页面 '%s' 提取失败: %s", pname, exc)
                        pages.append(ModaoPage(name=pname, textContent="(提取失败)", annotations="", screenshotBase64=""))

            return ModaoExtractResult(prototypeName=prototype_name, pages=pages)
        finally:
            browser.close()


def _handle_password(page: Page, password: str) -> None:
    pwd_input = page.locator(
        'input[type="password"], input[placeholder*="密码"], input[placeholder*="password"]'
    )
    try:
        pwd_input.first.wait_for(state="visible", timeout=5000)
    except Exception:
        logger.info("[modao] 未检测到密码页面，跳过密码输入")
        return

    logger.info("[modao] 检测到密码页面，正在输入密码")
    pwd_input.first.fill(password)

    submit_btn = page.locator(
        'button[type="submit"], '
        'button:has-text("确认"), '
        'button:has-text("确定"), '
        'button:has-text("进入"), '
        'button:has-text("查看")'
    )
    try:
        submit_btn.first.click(timeout=3000)
    except Exception:
        page.keyboard.press("Enter")

    page.wait_for_load_state("networkidle", timeout=PAGE_LOAD_TIMEOUT)


def _get_prototype_name(page: Page) -> str:
    title = page.title()
    if title:
        if "-" in title:
            part = title.split("-")[0].strip()
            if part:
                return part
        stripped = title.strip()
        if stripped and "墨刀" not in stripped:
            return stripped

    for sel in ['[class*="project-name"]', '[class*="prototype-name"]', '[class*="proto-name"]', "h1"]:
        try:
            el = page.locator(sel).first
            text = el.text_content(timeout=1000)
            if text and 0 < len(text.strip()) < 100:
                return text.strip()
        except Exception:
            continue

    return "墨刀原型"


def _get_page_list(page: Page) -> List[str]:
    for sel in SIDEBAR_SELECTORS:
        try:
            items = page.locator(sel)
            count = items.count()
            if count > 0:
                names = []
                for i in range(count):
                    text = items.nth(i).text_content(timeout=2000)
                    names.append(text.strip() if text else f"页面{i + 1}")
                logger.info('[modao] 通过选择器 "%s" 找到 %d 个页面', sel, len(names))
                return names
        except Exception:
            continue

    logger.info("[modao] 未能通过预设选择器找到页面列表，尝试通用方案")
    try:
        names = page.evaluate("""() => {
            const candidates = document.querySelectorAll(
                '[class*="page"], [class*="screen"], [class*="slide"]'
            );
            const result = [];
            candidates.forEach(el => {
                const text = el.textContent?.trim();
                if (text && text.length < 50 && text.length > 0) result.push(text);
            });
            return [...new Set(result)];
        }""")
        if isinstance(names, list) and len(names) > 1:
            return names
    except Exception:
        pass

    return []


def _switch_to_page(page: Page, index: int) -> None:
    for sel in SIDEBAR_SELECTORS:
        try:
            items = page.locator(sel)
            if items.count() > index:
                items.nth(index).click(timeout=3000)
                page.wait_for_timeout(800)
                return
        except Exception:
            continue


def _extract_current_page(page: Page, page_name: str) -> ModaoPage:
    text_content = _extract_text(page)
    annotations = _extract_annotations(page)
    screenshot_b64 = _take_screenshot(page)
    return ModaoPage(name=page_name, textContent=text_content, annotations=annotations, screenshotBase64=screenshot_b64)


def _extract_text(page: Page) -> str:
    try:
        for sel in CONTENT_SELECTORS:
            try:
                el = page.locator(sel).first
                if el.is_visible(timeout=1000):
                    text = el.inner_text(timeout=5000)
                    if text and text.strip():
                        return _clean_text(text)
            except Exception:
                continue

        body_text = page.inner_text("body", timeout=5000)
        return _clean_text(body_text)
    except Exception as exc:
        logger.warning("[modao] 文字提取失败: %s", exc)
        return ""


def _extract_annotations(page: Page) -> str:
    texts: List[str] = []
    for sel in ANNOTATION_SELECTORS:
        try:
            items = page.locator(sel)
            for i in range(items.count()):
                text = items.nth(i).text_content(timeout=2000)
                if text and text.strip():
                    texts.append(text.strip())
        except Exception:
            continue
    return "\n".join(texts)


def _take_screenshot(page: Page) -> str:
    try:
        buf: bytes = page.screenshot(full_page=False, type="png")
        return base64.b64encode(buf).decode("ascii")
    except Exception as exc:
        logger.warning("[modao] 截图失败: %s", exc)
        return ""


def _clean_text(raw: str) -> str:
    lines = [line.strip() for line in raw.split("\n")]
    return "\n".join(line for line in lines if line)
