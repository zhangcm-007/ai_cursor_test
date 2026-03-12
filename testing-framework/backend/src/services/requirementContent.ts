import { prisma } from "../prisma.js";

export interface GetFullContentResult {
  fullContent: string;
  attachmentErrors: string[];
}

export async function getFullContent(requirementId: string): Promise<GetFullContentResult> {
  const requirement = await prisma.requirement.findUnique({
    where: { id: requirementId },
    include: { attachments: true },
  });
  if (!requirement) throw new Error("Requirement not found");

  const parts: string[] = [`# ${requirement.title}\n`, requirement.content || ""];
  const attachmentErrors: string[] = [];

  console.log(`[getFullContent] requirementId=${requirementId}, 附件数=${requirement.attachments.length}`);

  for (const a of requirement.attachments) {
    if (a.extractedText?.trim()) {
      parts.push(`\n## 附件: ${a.filename}\n${a.extractedText.trim()}`);
    } else if (a.mimeType?.startsWith("image/")) {
      parts.push(`\n## 附件: ${a.filename} (图片)`);
    } else {
      attachmentErrors.push(a.filename);
    }
  }

  const fullContent = parts.join("\n").trim();
  console.log(`[getFullContent] 完成, fullContent 长度=${fullContent.length}, attachmentErrors=${attachmentErrors.length} 个`);
  return {
    fullContent,
    attachmentErrors,
  };
}
