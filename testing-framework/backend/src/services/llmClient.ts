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

const OPENAI_BASE = (process.env.LLM_BASE_URL ?? process.env.LLM_BASE_BASE ?? "").trim();
const OPENAI_API_KEY = (process.env.LLM_API_KEY ?? "").trim();

const ANTHROPIC_API_KEY = (process.env.ANTHROPIC_API_KEY ?? "").trim();
const MODEL = (process.env.LLM_MODEL ?? DEFAULT_MODEL).trim();

function isDifyConfigured(): boolean {
  return !!DIFY_BASE && !!DIFY_API_KEY;
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
