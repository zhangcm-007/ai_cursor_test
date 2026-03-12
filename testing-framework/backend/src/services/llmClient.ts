/**
 * 大模型客户端，支持三种方式（按优先级）：
 * 1. Dify 平台：DIFY_API_BASE + DIFY_API_KEY，调用 POST /chat-messages (blocking)
 * 2. 公司大模型（OpenAI 兼容）：LLM_BASE_URL + LLM_API_KEY，调用 POST /chat/completions
 * 3. Claude：ANTHROPIC_API_KEY，调用 Anthropic /v1/messages
 */

const ANTHROPIC_BASE = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-opus-4-6";

const DIFY_BASE = (
  process.env.DIFY_API_BASE ??
  process.env.DIFY_BASE_URL ??
  process.env.DIFY_BASE ??
  ""
).trim();
const DIFY_API_KEY = (process.env.DIFY_API_KEY ?? process.env.DIFY_KEY ?? "").trim();
/** 图片识别专用 Dify Agent：单独配置 API Key，Base 默认与主应用相同 */
const DIFY_IMAGE_AGENT_BASE = (
  process.env.DIFY_IMAGE_AGENT_BASE ?? process.env.DIFY_API_BASE ?? process.env.DIFY_BASE_URL ?? process.env.DIFY_BASE ?? ""
).trim();
const DIFY_IMAGE_AGENT_API_KEY = (process.env.DIFY_IMAGE_AGENT_API_KEY ?? "").trim();

/** 公司内部图片解析接口（OpenAI 兼容 /v1/chat/completions，支持 image_url） */
const COMPANY_IMAGE_API_BASE = (process.env.COMPANY_IMAGE_API_BASE ?? "").trim();
const COMPANY_IMAGE_API_KEY = (process.env.COMPANY_IMAGE_API_KEY ?? "").trim();

const OPENAI_BASE = (process.env.LLM_BASE_URL ?? process.env.LLM_BASE_BASE ?? "").trim();
const OPENAI_API_KEY = (process.env.LLM_API_KEY ?? "").trim();

const ANTHROPIC_API_KEY = (process.env.ANTHROPIC_API_KEY ?? "").trim();
const MODEL = (process.env.LLM_MODEL ?? DEFAULT_MODEL).trim();

function isDifyConfigured(): boolean {
  return !!DIFY_BASE && !!DIFY_API_KEY;
}

export function isDifyImageAgentConfigured(): boolean {
  return !!DIFY_IMAGE_AGENT_BASE && !!DIFY_IMAGE_AGENT_API_KEY;
}

export function isCompanyImageApiConfigured(): boolean {
  return !!COMPANY_IMAGE_API_BASE;
}

function isOpenAIConfigured(): boolean {
  return !!OPENAI_BASE && !!OPENAI_API_KEY;
}

function isClaudeConfigured(): boolean {
  return !!ANTHROPIC_API_KEY;
}

export function isConfigured(): boolean {
  return isDifyConfigured() || isOpenAIConfigured() || isClaudeConfigured();
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Dify: POST /chat-messages, response_mode=blocking，将 system+user 合并为 query */
async function chatViaDify(
  messages: ChatMessage[],
  _options?: { model?: string; maxTokens?: number }
): Promise<string> {
  const systemParts: string[] = [];
  const userParts: string[] = [];
  for (const m of messages) {
    if (m.role === "system") systemParts.push(m.content);
    else if (m.role === "user") userParts.push(m.content);
  }
  const query =
    systemParts.length > 0
      ? `【系统指令】\n${systemParts.join("\n\n")}\n\n【用户请求】\n${userParts.join("\n\n")}`
      : userParts.join("\n\n");

  const url = `${DIFY_BASE.replace(/\/$/, "")}/chat-messages`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DIFY_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        user: "testing-platform",
        response_mode: "blocking",
        inputs: {},
      }),
    });
  } catch (e) {
    const err = e as Error & { cause?: Error };
    const detail = err.cause?.message ?? err.message;
    throw new Error(
      `Dify 请求网络异常（无法连接 ${url}）: ${detail}。请检查 DIFY_API_BASE 是否正确、Dify 服务是否可访问（内网需保证后端能访问）。`
    );
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Dify API 请求失败: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { answer?: string };
  const answer = data.answer;
  if (answer == null) throw new Error("Dify 响应缺少 answer");
  return answer;
}

/**
 * 调用 Dify 图片识别 Agent：先上传文件到 Dify，再发 chat-messages 带图片。
 * 需配置 DIFY_IMAGE_AGENT_API_KEY（与主应用可同 BASE，Key 用新 Agent 的）。
 */
export async function chatWithImageViaDify(
  userPrompt: string,
  imageBuffer: Buffer,
  mimeType: string
): Promise<string> {
  if (!DIFY_IMAGE_AGENT_BASE || !DIFY_IMAGE_AGENT_API_KEY) {
    throw new Error("未配置图片识别 Agent，请在 .env 中设置 DIFY_IMAGE_AGENT_API_KEY（Base 可选 DIFY_IMAGE_AGENT_BASE）");
  }
  const base = DIFY_IMAGE_AGENT_BASE.replace(/\/$/, "");
  console.log(`[附件解析] 调用 Dify 图片识别 Agent: ${base} (Key 前6位: ${DIFY_IMAGE_AGENT_API_KEY.slice(0, 6)}...)`);
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/jpeg" || mimeType === "image/jpg" ? "jpg" : mimeType === "image/webp" ? "webp" : mimeType === "image/gif" ? "gif" : "png";
  const filename = `image.${ext}`;

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(imageBuffer)], { type: mimeType }), filename);
  form.append("user", "testing-platform");

  const uploadRes = await fetch(`${base}/files/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${DIFY_IMAGE_AGENT_API_KEY}` },
    body: form as unknown as BodyInit,
  });
  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Dify 图片上传失败: ${uploadRes.status} ${err}`);
  }
  const uploadData = (await uploadRes.json()) as { id?: string };
  const uploadFileId = uploadData.id;
  if (!uploadFileId) throw new Error("Dify 文件上传响应缺少 id");

  const chatRes = await fetch(`${base}/chat-messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DIFY_IMAGE_AGENT_API_KEY}`,
    },
    body: JSON.stringify({
      query: userPrompt,
      user: "testing-platform",
      response_mode: "streaming",
      inputs: {},
      files: [
        { type: "image", transfer_method: "local_file", upload_file_id: uploadFileId },
      ],
    }),
  });
  if (!chatRes.ok) {
    const err = await chatRes.text();
    throw new Error(`Dify 图片识别请求失败: ${chatRes.status} ${err}`);
  }
  const contentType = chatRes.headers.get("content-type") || "";
  let answer: string;
  if (contentType.includes("text/event-stream") && chatRes.body) {
    answer = await readDifyStreamAnswer(chatRes.body);
  } else {
    const chatData = (await chatRes.json()) as { answer?: string };
    answer = chatData.answer ?? "";
  }
  if (answer == null || answer === "") throw new Error("Dify 图片识别响应无内容");
  return answer;
}

/**
 * 调用公司内部图片解析接口：POST /v1/chat/completions，messages 中带 image_url（base64）与文本。
 * 需配置 COMPANY_IMAGE_API_BASE（如 http://8.215.74.54:9600）；可选 COMPANY_IMAGE_API_KEY。
 */
export async function chatWithImageViaCompanyApi(
  userPrompt: string,
  imageBuffer: Buffer,
  mimeType: string
): Promise<string> {
  if (!COMPANY_IMAGE_API_BASE) {
    throw new Error("未配置公司图片解析接口，请在 .env 中设置 COMPANY_IMAGE_API_BASE");
  }
  const base = COMPANY_IMAGE_API_BASE.replace(/\/$/, "");
  console.log(`[附件解析] 调用公司图片解析接口: ${base}/v1/chat/completions`);
  const b64 = imageBuffer.toString("base64");
  const dataUrl = `data:${mimeType || "image/png"};base64,${b64}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    accept: "application/json",
  };
  if (COMPANY_IMAGE_API_KEY) headers.Authorization = `Bearer ${COMPANY_IMAGE_API_KEY}`;
  const res = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl } },
            { type: "text", text: userPrompt },
          ],
        },
      ],
      temperature: 0,
      max_tokens: 120000,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`公司图片解析接口请求失败: ${res.status} ${err}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (content == null) throw new Error("公司图片解析接口响应无 content");
  return content;
}

/** 解析 Dify 流式 SSE，收集 agent_message 的 answer 直至 message_end */
async function readDifyStreamAnswer(body: ReadableStream<Uint8Array>): Promise<string> {
  const chunks: string[] = [];
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawMessageEnd = false;
  try {
    while (!sawMessageEnd) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]" || data === "") continue;
        try {
          const obj = JSON.parse(data) as { event?: string; answer?: string; message?: string };
          if (obj.event === "agent_message" && obj.answer != null) chunks.push(obj.answer);
          if (obj.event === "message" && obj.answer != null) chunks.push(obj.answer);
          if (obj.event === "message_end") {
            sawMessageEnd = true;
            break;
          }
          if (obj.event === "error") {
            const msg = (obj as { message?: string }).message ?? data;
            throw new Error(`Dify 流式返回错误: ${msg}`);
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  return chunks.join("");
}

/** OpenAI 兼容：POST /chat/completions（公司大模型或 Dify OpenAI 网关） */
async function chatViaOpenAI(
  messages: ChatMessage[],
  options?: { model?: string; maxTokens?: number }
): Promise<string> {
  const url = `${OPENAI_BASE.replace(/\/$/, "")}/chat/completions`;
  const body = {
    model: options?.model ?? process.env.LLM_MODEL ?? "gpt-3.5-turbo",
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: options?.maxTokens ?? 4096,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 404) {
      throw new Error(
        `请求 ${url} 返回 404，该地址可能未提供 OpenAI 兼容的 /chat/completions 接口。若您使用的是 Dify，请在 .env 中配置 DIFY_API_BASE 与 DIFY_API_KEY（不要用 LLM_BASE_URL 指向 Dify 地址），本平台将自动改用 Dify 的 /chat-messages 接口。`
      );
    }
    throw new Error(`公司大模型/OpenAI 兼容 API 请求失败: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (content == null) throw new Error("响应缺少 content");
  return content;
}

/** Claude：Anthropic /v1/messages */
async function chatViaClaude(
  messages: ChatMessage[],
  options?: { model?: string; maxTokens?: number }
): Promise<string> {
  const model = options?.model ?? MODEL;
  const maxTokens = options?.maxTokens ?? 4096;

  const systemParts: string[] = [];
  const apiMessages: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of messages) {
    if (m.role === "system") systemParts.push(m.content);
    else apiMessages.push({ role: m.role as "user" | "assistant", content: m.content });
  }
  const system = systemParts.length ? systemParts.join("\n\n") : undefined;

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages: apiMessages,
  };
  if (system) body.system = system;

  const res = await fetch(`${ANTHROPIC_BASE}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 401) {
      throw new Error(
        "Claude API 认证失败。请检查 .env 中 ANTHROPIC_API_KEY，并从 https://console.anthropic.com/ 复制正确 Key 后重启后端。"
      );
    }
    if (res.status === 400 && err.includes("credit balance is too low")) {
      throw new Error(
        "Claude 账户余额不足。请前往 https://console.anthropic.com/ 的 Plans & Billing 充值，或改用公司大模型/Dify（见 .env.example）。"
      );
    }
    throw new Error(`Claude API failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = data.content?.[0]?.type === "text" ? data.content[0].text : undefined;
  if (text == null) throw new Error("Claude 响应缺少 content");
  return text;
}

export async function chat(
  messages: ChatMessage[],
  options?: { model?: string; maxTokens?: number }
): Promise<string> {
  if (isDifyConfigured()) return chatViaDify(messages, options);
  if (isOpenAIConfigured()) return chatViaOpenAI(messages, options);
  if (isClaudeConfigured()) return chatViaClaude(messages, options);
  throw new Error(
    "未配置大模型。请在 .env 中配置：Dify（DIFY_API_BASE + DIFY_API_KEY）、或公司大模型（LLM_BASE_URL + LLM_API_KEY）、或 Claude（ANTHROPIC_API_KEY）。参见 .env.example。"
  );
}
