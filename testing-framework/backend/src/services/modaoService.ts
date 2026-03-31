import { chromium, type Browser, type Page } from "playwright-chromium";

export interface ModaoPage {
  name: string;
  textContent: string;
  annotations: string;
  screenshotBase64: string;
}

export interface ModaoExtractResult {
  prototypeName: string;
  pages: ModaoPage[];
}

const PAGE_LOAD_TIMEOUT = Number(process.env.MODAO_PAGE_LOAD_TIMEOUT) || 15000;
const PAGE_SWITCH_DELAY = 1500;

export async function extractModaoPrototype(
  url: string,
  password: string
): Promise<ModaoExtractResult> {
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    console.log(`[modao] 正在访问: ${url}`);
    await page.goto(url, { waitUntil: "networkidle", timeout: PAGE_LOAD_TIMEOUT * 2 });

    await handlePassword(page, password);
    await page.waitForTimeout(2000);

    const prototypeName = await getPrototypeName(page);
    console.log(`[modao] 原型名称: ${prototypeName}`);

    const pageNames = await getPageList(page);
    console.log(`[modao] 共发现 ${pageNames.length} 个页面`);

    const pages: ModaoPage[] = [];

    if (pageNames.length === 0) {
      const result = await extractCurrentPage(page, "主页面");
      pages.push(result);
    } else {
      for (let i = 0; i < pageNames.length; i++) {
        const pageName = pageNames[i];
        console.log(`[modao] 正在提取第 ${i + 1}/${pageNames.length} 页: ${pageName}`);
        try {
          await switchToPage(page, i);
          await page.waitForTimeout(PAGE_SWITCH_DELAY);
          const result = await extractCurrentPage(page, pageName);
          pages.push(result);
        } catch (err) {
          console.error(`[modao] 页面 "${pageName}" 提取失败:`, err instanceof Error ? err.message : err);
          pages.push({ name: pageName, textContent: "(提取失败)", annotations: "", screenshotBase64: "" });
        }
      }
    }

    await browser.close();
    browser = null;

    return { prototypeName, pages };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

async function handlePassword(page: Page, password: string): Promise<void> {
  const passwordInput = page.locator(
    'input[type="password"], input[placeholder*="密码"], input[placeholder*="password"]'
  );
  try {
    await passwordInput.first().waitFor({ state: "visible", timeout: 5000 });
  } catch {
    console.log("[modao] 未检测到密码页面，跳过密码输入");
    return;
  }

  console.log("[modao] 检测到密码页面，正在输入密码");
  await passwordInput.first().fill(password);

  const submitBtn = page.locator(
    'button[type="submit"], button:has-text("确认"), button:has-text("确定"), button:has-text("进入"), button:has-text("查看")'
  );
  try {
    await submitBtn.first().click({ timeout: 3000 });
  } catch {
    await page.keyboard.press("Enter");
  }

  await page.waitForLoadState("networkidle", { timeout: PAGE_LOAD_TIMEOUT });
}

async function getPrototypeName(page: Page): Promise<string> {
  const selectors = [
    'title',
    '[class*="project-name"]',
    '[class*="prototype-name"]',
    '[class*="proto-name"]',
    'h1',
  ];
  for (const sel of selectors) {
    try {
      if (sel === "title") {
        const title = await page.title();
        if (title && !title.includes("墨刀") && title.trim().length > 0) {
          return title.trim();
        }
        if (title && title.includes("-")) {
          const parts = title.split("-");
          return parts[0].trim();
        }
        continue;
      }
      const el = page.locator(sel).first();
      const text = await el.textContent({ timeout: 1000 });
      if (text && text.trim().length > 0 && text.trim().length < 100) {
        return text.trim();
      }
    } catch {
      continue;
    }
  }
  return "墨刀原型";
}

async function getPageList(page: Page): Promise<string[]> {
  const sidebarSelectors = [
    '[class*="page-list"] [class*="page-item"]',
    '[class*="page-tree"] [class*="tree-node"]',
    '[class*="sidebar"] [class*="page"]',
    '[class*="screen-list"] [class*="screen-item"]',
    '[class*="nav"] [class*="page"]',
    '[class*="panel"] [class*="page-name"]',
  ];

  for (const sel of sidebarSelectors) {
    try {
      const items = page.locator(sel);
      const count = await items.count();
      if (count > 0) {
        const names: string[] = [];
        for (let i = 0; i < count; i++) {
          const text = await items.nth(i).textContent({ timeout: 2000 });
          names.push(text?.trim() || `页面${i + 1}`);
        }
        console.log(`[modao] 通过选择器 "${sel}" 找到 ${names.length} 个页面`);
        return names;
      }
    } catch {
      continue;
    }
  }

  console.log("[modao] 未能通过预设选择器找到页面列表，尝试通用方案");
  try {
    const names = await page.evaluate(() => {
      const candidates = document.querySelectorAll(
        '[class*="page"], [class*="screen"], [class*="slide"]'
      );
      const result: string[] = [];
      candidates.forEach((el) => {
        const text = el.textContent?.trim();
        if (text && text.length < 50 && text.length > 0) {
          result.push(text);
        }
      });
      return [...new Set(result)];
    });
    if (names.length > 1) return names;
  } catch {}

  return [];
}

async function switchToPage(page: Page, index: number): Promise<void> {
  const sidebarSelectors = [
    '[class*="page-list"] [class*="page-item"]',
    '[class*="page-tree"] [class*="tree-node"]',
    '[class*="sidebar"] [class*="page"]',
    '[class*="screen-list"] [class*="screen-item"]',
    '[class*="nav"] [class*="page"]',
    '[class*="panel"] [class*="page-name"]',
  ];

  for (const sel of sidebarSelectors) {
    try {
      const items = page.locator(sel);
      const count = await items.count();
      if (count > index) {
        await items.nth(index).click({ timeout: 3000 });
        await page.waitForTimeout(800);
        return;
      }
    } catch {
      continue;
    }
  }
}

async function extractCurrentPage(page: Page, pageName: string): Promise<ModaoPage> {
  const textContent = await extractText(page);
  const annotations = await extractAnnotations(page);
  const screenshotBase64 = await takeScreenshot(page);

  return { name: pageName, textContent, annotations, screenshotBase64 };
}

async function extractText(page: Page): Promise<string> {
  try {
    const contentSelectors = [
      '[class*="canvas"]',
      '[class*="artboard"]',
      '[class*="prototype-view"]',
      '[class*="screen-content"]',
      '[class*="preview"]',
      'main',
      '#app',
    ];

    for (const sel of contentSelectors) {
      try {
        const el = page.locator(sel).first();
        const visible = await el.isVisible({ timeout: 1000 });
        if (visible) {
          const text = await el.innerText({ timeout: 5000 });
          if (text && text.trim().length > 0) {
            return cleanText(text);
          }
        }
      } catch {
        continue;
      }
    }

    const bodyText = await page.innerText("body", { timeout: 5000 });
    return cleanText(bodyText);
  } catch (err) {
    console.warn("[modao] 文字提取失败:", err instanceof Error ? err.message : err);
    return "";
  }
}

async function extractAnnotations(page: Page): Promise<string> {
  const annotationSelectors = [
    '[class*="annotation"]',
    '[class*="comment"]',
    '[class*="note"]',
    '[class*="remark"]',
    '[class*="memo"]',
  ];

  const texts: string[] = [];
  for (const sel of annotationSelectors) {
    try {
      const items = page.locator(sel);
      const count = await items.count();
      for (let i = 0; i < count; i++) {
        const text = await items.nth(i).textContent({ timeout: 2000 });
        if (text && text.trim().length > 0) {
          texts.push(text.trim());
        }
      }
    } catch {
      continue;
    }
  }
  return texts.join("\n");
}

async function takeScreenshot(page: Page): Promise<string> {
  try {
    const buffer = await page.screenshot({ fullPage: false, type: "png" });
    return buffer.toString("base64");
  } catch (err) {
    console.warn("[modao] 截图失败:", err instanceof Error ? err.message : err);
    return "";
  }
}

function cleanText(raw: string): string {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
}
