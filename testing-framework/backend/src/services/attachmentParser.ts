import {
  chatWithImageViaDify,
  chatWithImageViaCompanyApi,
  isDifyImageAgentConfigured,
  isCompanyImageApiConfigured,
} from "./llmClient.js";

const IMAGE_PROMPT = "请识别图片中的全部文字，按阅读顺序输出纯文本。若图中无文字，请回复「图中无文字」。";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp)$/i;

export async function parseAttachment(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<string | null> {
  const type = (mimeType || "").toLowerCase();
  const isImageByMime = type.startsWith("image/");
  const isImageByExt = IMAGE_EXT.test(filename);
  const treatAsImage = isImageByMime || isImageByExt;

  if (treatAsImage) {
    const effectiveMime = isImageByMime ? type : "image/png";
    const useCompany = isCompanyImageApiConfigured();
    const useDify = isDifyImageAgentConfigured();
    if (!useCompany && !useDify) {
      console.warn(`[附件解析] 图片 "${filename}" 未解析：未配置 COMPANY_IMAGE_API_BASE 或 DIFY_IMAGE_AGENT_API_KEY`);
      return null;
    }
    if (useCompany) {
      console.log(`[附件解析] 图片 "${filename}" 使用公司内部接口 (COMPANY_IMAGE_API_BASE 已配置)`);
    } else {
      console.log(`[附件解析] 图片 "${filename}" 使用 Dify 接口 (COMPANY_IMAGE_API_BASE 未配置)`);
    }
    try {
      const text = useCompany
        ? await chatWithImageViaCompanyApi(IMAGE_PROMPT, buffer, effectiveMime)
        : await chatWithImageViaDify(IMAGE_PROMPT, buffer, effectiveMime);
      console.log(`[附件解析] 图片 "${filename}" 识别成功, 长度=${text?.length ?? 0}`);
      return text;
    } catch (err) {
      console.error(`[附件解析] 图片 "${filename}" 识别失败:`, err instanceof Error ? err.message : err);
      return null;
    }
  }

  if (type === "application/pdf") {
    try {
      const pdfParse = (await import("pdf-parse")).default;
      const data = await pdfParse(buffer);
      return (data?.text ?? "").trim() || null;
    } catch {
      return null;
    }
  }

  if (
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    type === "application/msword"
  ) {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return (result?.value ?? "").trim() || null;
    } catch {
      return null;
    }
  }

  if (type === "text/plain" || type === "text/markdown" || type === "text/csv") {
    try {
      const text = buffer.toString("utf8").replace(/\r\n/g, "\n").trim();
      return text || null;
    } catch {
      return null;
    }
  }

  return null;
}
