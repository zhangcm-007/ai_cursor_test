/**
 * 启动 dev 后执行：node scripts/capture-console.mjs
 * 打开前端并收集 console error / pageerror / 关键请求失败
 */
import { chromium } from "playwright";

async function probeVitePort(hosts, from, to) {
  for (const host of hosts) {
    for (let p = from; p <= to; p++) {
      const url = `http://${host}:${p}/`;
      try {
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), 2500);
        const r = await fetch(url, { signal: ac.signal });
        clearTimeout(t);
        if (r.ok || (r.status >= 200 && r.status < 500)) return { host, port: p };
      } catch {
        /* try next */
      }
    }
  }
  return null;
}

const hosts = (process.env.CAPTURE_HOSTS || "127.0.0.1,localhost").split(",").map((s) => s.trim());
let base = process.env.BASE_URL;
if (!base) {
  const hit = await probeVitePort(hosts, 5173, 5190);
  if (!hit) {
    console.error("未探测到 Vite（5173–5190），请设置 BASE_URL");
    process.exit(2);
  }
  base = `http://${hit.host}:${hit.port}`;
  console.log("capture-console: using", base);
}
const routes = ["/", "/requirements", "/test-cases", "/export"];

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];

page.on("console", (msg) => {
  const t = msg.type();
  if (t === "error") {
    errors.push({ kind: "console", type: t, text: msg.text() });
  }
});
page.on("pageerror", (err) => {
  errors.push({ kind: "pageerror", text: err.message, stack: err.stack });
});
page.on("requestfailed", (req) => {
  const url = req.url();
  if (url.includes("/@vite/client") || url.includes("?token=") || url.endsWith(".wasm")) return;
  if (!url.includes("/api/") && !url.includes(".tsx") && !url.includes("/src/")) return;
  errors.push({
    kind: "requestfailed",
    url,
    error: req.failure()?.errorText,
  });
});

for (const path of routes) {
  const url = `${base}${path}`;
  await page.goto(url, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(2000);
}

await browser.close();

if (errors.length) {
  console.error(JSON.stringify(errors, null, 2));
  process.exit(1);
}
console.log("capture-console: no errors");
process.exit(0);
