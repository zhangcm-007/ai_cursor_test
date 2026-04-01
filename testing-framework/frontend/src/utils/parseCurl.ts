/** 将常见 curl 命令解析为接口清单字段（path 仅保留 pathname + search，不含 host） */

export interface ParsedCurl {
  method: string;
  path: string;
  name: string;
  description: string;
  protocol: string;
  sampleRequest: string;
  /** 解析出的请求头（供表单「Headers JSON」等使用） */
  headers: Record<string, string>;
}

/** Windows CMD「复制为 cURL」：行尾的 ^ 表示续行 */
function normalizeWindowsCmdLineContinuations(s: string): string {
  return s.replace(/\^[ \t]*(\r\n|\n|\r)[ \t]*/g, " ");
}

const CARET_SENT = "\uE000";

/** CMD 中 ^\^" 表示字符串内的一个双引号（Chrome 复制 JSON body 常见） */
function normalizeWindowsDataRawInner(inner: string): string {
  let t = inner.split("^^").join(CARET_SENT);
  let prev = "";
  while (t !== prev) {
    prev = t;
    t = t.replace(/\^\\\^"/g, '"');
  }
  t = t.replace(/\^\{/g, "{");
  t = t.replace(/\^\}/g, "}");
  t = t.replace(/\^@/g, "@");
  t = t.replace(/\^,/g, ",");
  t = t.replace(/\^\*/g, "*");
  t = t.replace(/\^"/g, '"');
  t = t.replace(/\^(.)/g, "$1");
  return t.split(CARET_SENT).join("^");
}

/**
 * 在 `-H ^" ... ^"` 的内层中查找结束的 `^"`（内层引号用 `^\^"` 表示，不能误当成结束）。
 */
function findClosingCaretQuote(s: string, innerStart: number): number {
  let i = innerStart;
  while (i < s.length) {
    if (i + 3 < s.length && s.slice(i, i + 4) === "^\\^\"") {
      i += 4;
      continue;
    }
    if (i + 1 < s.length && s[i] === "^" && s[i + 1] === '"') {
      return i;
    }
    if (s[i] === "^" && i + 1 < s.length) {
      i += 2;
      continue;
    }
    i++;
  }
  return -1;
}

/**
 * 将 Chrome「复制为 cURL (cmd)」转为可稳定分词的 Unix 风格。
 * 关键：不能全局 `^"`→`"`，否则会拆坏 `-H` 里带 `^\^"…^\^"` 的 sec-ch-ua 等头；须按段提取再 JSON.stringify。
 */
export function normalizeWindowsCurlCmd(raw: string): string {
  let s = normalizeWindowsCmdLineContinuations(raw.trim());

  const dataFlags = ["--data-raw", "--data-binary", "--data", "-d"] as const;
  for (const flag of dataFlags) {
    const escaped = flag.replace(/-/g, "\\-");
    const re = new RegExp(`${escaped}\\s+\\^"`, "i");
    const m = re.exec(s);
    if (!m) continue;
    const innerStart = m.index + m[0].length;
    const closeIdx = s.lastIndexOf('^"');
    if (closeIdx <= innerStart) continue;
    const rawInner = s.slice(innerStart, closeIdx);
    const normalizedBody = normalizeWindowsDataRawInner(rawInner);
    const replacement = `${flag} ${JSON.stringify(normalizedBody)}`;
    s = s.slice(0, m.index) + replacement + s.slice(closeIdx + 2);
    break;
  }

  const replaceCurlUrlOnce = (input: string): string => {
    const m = /\bcurl\s+\^"/i.exec(input);
    if (!m) return input;
    const innerStart = m.index + m[0].length;
    const close = findClosingCaretQuote(input, innerStart);
    if (close < 0) return input;
    const innerNorm = normalizeWindowsDataRawInner(input.slice(innerStart, close));
    const prefix = m[0].replace(/\^"$/, "");
    return input.slice(0, m.index) + prefix + JSON.stringify(innerNorm) + input.slice(close + 2);
  };

  const replaceAllHeaderBlocks = (input: string, flag: "H" | "header"): string => {
    const pat =
      flag === "H"
        ? "(^|\\s)-H\\s+\\^\""
        : "(^|\\s)--header\\s+\\^\"";
    let out = input;
    let guard = 0;
    while (guard++ < 400) {
      const m = new RegExp(pat, "i").exec(out);
      if (!m) break;
      const innerStart = m.index + m[0].length;
      const close = findClosingCaretQuote(out, innerStart);
      if (close < 0) break;
      const innerNorm = normalizeWindowsDataRawInner(out.slice(innerStart, close));
      const prefix = m[0].replace(/\^"$/, "");
      out = out.slice(0, m.index) + prefix + JSON.stringify(innerNorm) + out.slice(close + 2);
    }
    return out;
  };

  let out = s;
  out = replaceCurlUrlOnce(out);
  out = replaceAllHeaderBlocks(out, "H");
  out = replaceAllHeaderBlocks(out, "header");

  s = out.split("^^").join(CARET_SENT);
  let p = "";
  while (s !== p) {
    p = s;
    s = s.replace(/\^\\\^"/g, '"');
  }
  s = s.replace(/\^\{/g, "{");
  s = s.replace(/\^\}/g, "}");
  s = s.replace(/\^@/g, "@");
  s = s.replace(/\^,/g, ",");
  s = s.replace(/\^\*/g, "*");
  s = s.replace(/\^"/g, '"');
  s = s.replace(/\^(.)/g, "$1");
  return s.split(CARET_SENT).join("^");
}

function tokenizeCurl(input: string): string[] {
  const s = input.replace(/\\\r?\n/g, " ").trim();
  const tokens: string[] = [];
  let i = 0;
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i >= s.length) break;
    const q = s[i];
    if (q === '"' || q === "'") {
      let j = i + 1;
      let esc = false;
      for (; j < s.length; j++) {
        if (esc) {
          esc = false;
          continue;
        }
        if (s[j] === "\\") {
          esc = true;
          continue;
        }
        if (s[j] === q) break;
      }
      tokens.push(s.slice(i + 1, j));
      i = j + 1;
    } else {
      let j = i;
      while (j < s.length && !/\s/.test(s[j])) j++;
      tokens.push(s.slice(i, j));
      i = j;
    }
  }
  return tokens;
}

const NO_ARG_FLAGS = new Set([
  "-s",
  "-k",
  "-l",
  "-v",
  "--silent",
  "--show-error",
  "--insecure",
  "--location",
  "--compressed",
  "-g",
  "--globoff",
]);

const ONE_ARG_FLAGS = new Set([
  "-x",
  "--request",
  "-h",
  "--header",
  "-d",
  "--data",
  "--data-raw",
  "--data-binary",
  "-b",
  "--cookie",
  "-u",
  "--user",
  "-e",
  "--referer",
  "--url",
]);

function looksLikeUrl(t: string): boolean {
  return /^https?:\/\//i.test(t) || (t.startsWith("/") && t.length > 1);
}

function urlToPath(full: string): string {
  try {
    const u = new URL(full);
    return (u.pathname || "/") + u.search;
  } catch {
    return full.startsWith("/") ? full : `/${full}`;
  }
}

/**
 * 仅返回请求体字符串。后端「从清单生成步骤」会把整段 `sampleRequest` 解析为 JSON 对象并作为 request.json，
 * 因此这里不能只存 { headers, json } 包装层，否则会整包当作 body 发出。
 */
function formatSampleBody(body: string | null): string {
  if (body === null || body === "") return "";
  const t = body.trim();
  if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
    try {
      return JSON.stringify(JSON.parse(t), null, 2);
    } catch {
      return t;
    }
  }
  return t;
}

/**
 * 解析 curl 字符串；失败时抛出带中文说明的 Error。
 */
export function parseCurlCommand(raw: string): ParsedCurl {
  const text = raw.trim();
  if (!text) throw new Error("请粘贴 curl 命令");

  const lower = text.toLowerCase();
  if (!lower.includes("curl")) throw new Error("内容中未识别到 curl");

  const looksWindowsCmdCurl =
    text.includes('^"') ||
    /\^\s*(\r\n|\n|\r)/.test(text) ||
    /^curl\s+\^"/i.test(text.trimStart());
  const normalized = looksWindowsCmdCurl ? normalizeWindowsCurlCmd(text) : text;
  const tokens = tokenizeCurl(normalized.replace(/\\\r?\n/g, " "));
  if (tokens.length === 0) throw new Error("无法解析 curl");

  let i = 0;
  if (tokens[0].toLowerCase() === "curl") i++;

  let method = "GET";
  const headers: Record<string, string> = {};
  let body: string | null = null;
  let url: string | null = null;

  while (i < tokens.length) {
    const t = tokens[i];
    const tl = t.toLowerCase();

    if (NO_ARG_FLAGS.has(tl)) {
      i++;
      continue;
    }

    if (ONE_ARG_FLAGS.has(tl)) {
      const flag = tl;
      i++;
      if (i >= tokens.length) throw new Error(`参数不完整：${t}`);
      const val = tokens[i];
      i++;
      if (flag === "-x" || flag === "--request") {
        method = val.toUpperCase();
      } else if (flag === "--url") {
        url = val;
      } else if (flag === "-h" || flag === "--header") {
        const idx = val.indexOf(":");
        if (idx >= 0) {
          const name = val.slice(0, idx).trim();
          const v = val.slice(idx + 1).trim();
          if (name.toLowerCase() !== "content-length") headers[name] = v;
        } else if (val.endsWith(";")) {
          const name = val.slice(0, -1).trim();
          if (name) headers[name] = "";
        }
      } else if (
        flag === "-d" ||
        flag === "--data" ||
        flag === "--data-raw" ||
        flag === "--data-binary"
      ) {
        body = body === null ? val : `${body}&${val}`;
      }
      continue;
    }

    if (tl.startsWith("-")) {
      i++;
      continue;
    }

    if (url === null && looksLikeUrl(t)) {
      url = t;
      i++;
      continue;
    }

    i++;
  }

  if (!url) throw new Error("未识别到 URL（需以 http(s):// 开头或为 path）");

  const path = urlToPath(url);

  if (method === "GET" && body !== null && body !== "") {
    method = "POST";
  }

  const sampleRequest = formatSampleBody(body);
  const shortPath = path.length > 48 ? `${path.slice(0, 45)}…` : path;
  const name = `${method} ${shortPath}`;

  return {
    method,
    path,
    name,
    description: "由 curl 导入",
    protocol: "http",
    sampleRequest,
    headers,
  };
}
