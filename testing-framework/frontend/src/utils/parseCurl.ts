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

  const dataFlags = ["--data-urlencode", "--data-raw", "--data-binary", "--data", "-d"] as const;
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

// Bash/curl 常见「标志与参数粘连」（如 -H 与 Accept 头、-d 与 JSON 无空格连在一起）。
// 若不拆开，整段无法匹配 ONE_ARG_FLAGS 中的 -h/-d，会被当作未知「-」参数整段丢弃。
function expandGluedFlagTokens(tokens: string[]): string[] {
  const out: string[] = [];

  const splitData = (t: string): [string, string] | null => {
    const tl = t.toLowerCase();
    const prefixes = ["--data-urlencode", "--data-raw", "--data-binary", "--data", "-d"] as const;
    for (const prefix of prefixes) {
      if (tl !== prefix && !tl.startsWith(prefix)) continue;
      if (tl === prefix) return null;
      const rest = t.slice(prefix.length);
      if (rest.startsWith("=")) return [prefix, rest.slice(1)];
      const q = rest[0];
      if (q === "'" || q === '"') {
        if (rest.length >= 2 && rest[rest.length - 1] === q) {
          return [prefix, rest.slice(1, -1)];
        }
        return null;
      }
      if (prefix === "-d") {
        const c = rest[0];
        if (
          c &&
          (c === "=" ||
            c === "{" ||
            c === "[" ||
            c === "(" ||
            c === "@" ||
            c === "'" ||
            c === '"' ||
            /^\d/.test(rest))
        ) {
          return ["-d", rest];
        }
        return null;
      }
      if (rest.length > 0) return [prefix, rest];
    }
    return null;
  };

  const splitHeader = (t: string): [string, string] | null => {
    const tl = t.toLowerCase();
    if (tl.startsWith("--header=")) {
      return ["--header", t.slice("--header=".length)];
    }
    if (tl.startsWith("--header")) {
      if (tl === "--header") return null;
      const rest = t.slice("--header".length);
      if (rest.startsWith("=")) return ["--header", rest.slice(1)];
      const q = rest[0];
      if (q === "'" || q === '"') {
        if (rest.length >= 2 && rest[rest.length - 1] === q) {
          return ["--header", rest.slice(1, -1)];
        }
        return null;
      }
      if (rest.length > 0) return ["--header", rest];
    }
    if (tl.startsWith("-h") && t.length > 2 && !tl.startsWith("--")) {
      const rest = t.slice(2);
      if (rest.startsWith("=")) return ["-h", rest.slice(1)];
      const q = rest[0];
      if (q === "'" || q === '"') {
        if (rest.length >= 2 && rest[rest.length - 1] === q) {
          return ["-h", rest.slice(1, -1)];
        }
        return null;
      }
      const ci = rest.indexOf(":");
      if (ci > 0) {
        const afterColon = rest.slice(ci + 1, ci + 3);
        if (afterColon !== "//") {
          return ["-h", rest];
        }
      }
    }
    return null;
  };

  for (const t of tokens) {
    const data = splitData(t);
    if (data) {
      out.push(data[0], data[1]);
      continue;
    }
    const hdr = splitHeader(t);
    if (hdr) {
      out.push(hdr[0], hdr[1]);
      continue;
    }
    out.push(t);
  }
  return out;
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
  "--get",
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
  "--data-urlencode",
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

function urlToPathAndQuery(full: string): { pathname: string; queryParams: Record<string, string> } {
  try {
    const u = new URL(full);
    const queryParams: Record<string, string> = {};
    u.searchParams.forEach((v, k) => {
      queryParams[k] = v;
    });
    return { pathname: u.pathname || "/", queryParams };
  } catch {
    const qIdx = full.indexOf("?");
    if (qIdx >= 0) {
      const pathname = full.slice(0, qIdx) || "/";
      const queryParams: Record<string, string> = {};
      try {
        new URLSearchParams(full.slice(qIdx + 1)).forEach((v, k) => {
          queryParams[k] = v;
        });
      } catch { /* ignore */ }
      return { pathname: pathname.startsWith("/") ? pathname : `/${pathname}`, queryParams };
    }
    const p = full.startsWith("/") ? full : `/${full}`;
    return { pathname: p, queryParams: {} };
  }
}

/**
 * 从带 query string 的路径中提取参数，返回解码后的 Record 和干净路径。
 * 供调试表单等外部模块在已有 path 含 `?key=%E4%B8%AD%E6%96%87` 时自动解码使用。
 */
export function splitPathAndQueryParams(path: string): { pathname: string; queryParams: Record<string, string> } {
  const qIdx = path.indexOf("?");
  if (qIdx < 0) return { pathname: path, queryParams: {} };
  const pathname = path.slice(0, qIdx) || "/";
  const queryParams: Record<string, string> = {};
  try {
    new URLSearchParams(path.slice(qIdx + 1)).forEach((v, k) => {
      queryParams[k] = v;
    });
  } catch { /* ignore */ }
  return { pathname, queryParams };
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
  const tokens = expandGluedFlagTokens(tokenizeCurl(normalized.replace(/\\\r?\n/g, " ")));
  if (tokens.length === 0) throw new Error("无法解析 curl");

  let i = 0;
  if (tokens[0].toLowerCase() === "curl") i++;

  let method = "GET";
  let explicitMethod = false;
  const headers: Record<string, string> = {};
  let body: string | null = null;
  let url: string | null = null;
  let useGet = false;
  const urlEncodeParams: string[] = [];

  while (i < tokens.length) {
    const t = tokens[i];
    const tl = t.toLowerCase();

    if (t === "-G") {
      useGet = true;
      i++;
      continue;
    }

    if (NO_ARG_FLAGS.has(tl)) {
      if (tl === "--get") useGet = true;
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
        explicitMethod = true;
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
      } else if (flag === "--data-urlencode") {
        urlEncodeParams.push(val);
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

  // 解析 URL，分离 pathname 和已有的 query params（自动 URL 解码为可读中文）
  const { pathname: path, queryParams: urlQueryParams } = urlToPathAndQuery(url);

  // 收集所有 query/body 参数到一个对象
  const allParams: Record<string, string> = { ...urlQueryParams };

  // --data-urlencode → 合入参数对象
  for (const p of urlEncodeParams) {
    const eq = p.indexOf("=");
    if (eq >= 0) {
      allParams[p.slice(0, eq)] = p.slice(eq + 1);
    } else {
      allParams[p] = "";
    }
  }

  // --get/-G 时把 -d body 拆为 query 参数
  if (useGet && body !== null) {
    try {
      new URLSearchParams(body).forEach((v, k) => {
        allParams[k] = v;
      });
    } catch { /* keep body as-is below */ }
    body = null;
  }

  // 有 query 参数时以可读 JSON 作为 sampleRequest
  if (Object.keys(allParams).length > 0) {
    const jsonBody = JSON.stringify(allParams, null, 2);
    body = body === null ? jsonBody : body;
  }

  if (!explicitMethod && !useGet && body !== null && body !== "") {
    method = "POST";
  }
  if (useGet && !explicitMethod) {
    method = "GET";
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
