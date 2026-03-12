import { prisma } from "../prisma.js";
import { getFullContent } from "./requirementContent.js";
import { chat, isConfigured } from "./llmClient.js";

function parseJsonBlock(text: string): unknown {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return JSON.parse(codeBlock[1].trim()) as unknown;
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) return JSON.parse(arrMatch[0]) as unknown;
  return JSON.parse(text.trim()) as unknown;
}

export async function generateTestPoints(options: {
  requirementId: string;
  includeHistory?: boolean;
  historyCount?: number;
}): Promise<{ created: number; attachmentErrors: string[] }> {
  if (!isConfigured()) throw new Error("LLM not configured");
  const { requirementId } = options;
  const { fullContent, attachmentErrors } = await getFullContent(requirementId);
  console.log(`[生成测试点] requirementId=${requirementId}, fullContent 长度=${fullContent.length}, attachmentErrors=[${attachmentErrors.join(", ")}]`);
  console.log(`[生成测试点] fullContent 预览:\n${fullContent.slice(0, 500)}${fullContent.length > 500 ? "\n...(省略)" : ""}`);

  const systemPrompt = `你是一名测试工程师。根据需求描述生成测试点。测试点需覆盖功能、边界、异常等类型。只输出一个 JSON 数组，不要其他说明。格式：[{"pointId":"TP-01","description":"...","type":"功能|边界|异常"}]。pointId 从 TP-01 递增。`;
  const userPrompt = `## 当前需求\n${fullContent}\n\n请生成测试点 JSON 数组：`;

  console.log(`[生成测试点] 开始调用模型...`);
  const content = await chat([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  const arr = parseJsonBlock(content) as { pointId?: string; description?: string; type?: string }[];
  if (!Array.isArray(arr)) throw new Error("Invalid LLM output: not an array");
  console.log(`[生成测试点] 模型返回 ${arr.length} 条，开始写入数据库`);

  const existing = await prisma.testPoint.findMany({
    select: { pointId: true },
  });
  const used = new Set(existing.map((p) => p.pointId));
  const maxNum = existing.length
    ? Math.max(
        0,
        ...existing
          .map((p) => parseInt(p.pointId.replace(/^TP-?/i, ""), 10))
          .filter((n) => !Number.isNaN(n))
      )
    : 0;
  let nextNum = maxNum + 1;
  for (const item of arr) {
    const pointId =
      item.pointId && !used.has(item.pointId) ? item.pointId : `TP-${String(nextNum).padStart(2, "0")}`;
    used.add(pointId);
    nextNum++;
    await prisma.testPoint.create({
      data: {
        requirementId,
        pointId,
        description: String(item.description ?? "").slice(0, 2000),
        type: String(item.type ?? "功能").slice(0, 50),
      },
    });
  }
  console.log(`[生成测试点] 完成，创建 ${arr.length} 个测试点`);
  return { created: arr.length, attachmentErrors };
}

export async function generateTestCases(options: {
  requirementId: string;
  testPointIds?: string[];
  includeHistory?: boolean;
  historyCount?: number;
}): Promise<{ created: number; attachmentErrors: string[] }> {
  if (!isConfigured()) throw new Error("LLM not configured");
  const { requirementId, testPointIds } = options;

  const { fullContent, attachmentErrors } = await getFullContent(requirementId);
  console.log(`[生成测试用例] requirementId=${requirementId}, testPointIds=${testPointIds?.length ?? "全部"}, fullContent 长度=${fullContent.length}, attachmentErrors=[${attachmentErrors.join(", ")}]`);
  console.log(`[生成测试用例] fullContent 预览:\n${fullContent.slice(0, 500)}${fullContent.length > 500 ? "\n...(省略)" : ""}`);

  let points = await prisma.testPoint.findMany({
    where: testPointIds?.length ? { id: { in: testPointIds }, requirementId } : { requirementId },
    orderBy: { pointId: "asc" },
  });
  if (points.length === 0) {
    const requirement = await prisma.requirement.findUnique({
      where: { id: requirementId },
      select: { title: true },
    });
    const title = requirement?.title ?? "需求";
    await prisma.testPoint.create({
      data: {
        requirementId,
        pointId: "REQ-整体",
        description: `基于「${title}」直接生成的测试点（未先生成测试点）`,
        type: "功能",
      },
    });
    points = await prisma.testPoint.findMany({
      where: { requirementId },
      orderBy: { pointId: "asc" },
    });
  }

  const pointIdToId = new Map(points.map((p) => [p.pointId.trim(), p.id]));
  const pointsDesc = points.map((p) => `${p.pointId}: ${p.description}`).join("\n");
  const pointIdList = points.map((p) => p.pointId).join("、");

  const systemPrompt = `你是一名测试工程师。根据需求和测试点生成测试用例。只输出一个 JSON 数组，不要其他说明。格式：[{"pointId":"<测试点ID>","title":"...","priority":"P0|P1|P2","preconditions":"...","steps":"...","expected":"..."}]。其中 pointId 必须与下面测试点列表中的测试点 ID 完全一致（照抄列表中的 pointId，不要改成 TP-01 等）。caseId 由系统按需求内全局递增分配，无需在输出中填写。`;
  const userPrompt = `## 当前需求\n${fullContent}\n\n## 测试点列表（输出的 pointId 必须从下列中照抄，不可改写）\n${pointsDesc}\n\n可选测试点 ID：${pointIdList}\n\n请为上述测试点生成测试用例 JSON 数组：`;

  console.log(`[生成测试用例] 开始调用模型...`);
  const content = await chat([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  const arr = parseJsonBlock(content) as {
    pointId?: string;
    caseId?: string;
    title?: string;
    priority?: string;
    preconditions?: string;
    steps?: string;
    expected?: string;
  }[];
  if (!Array.isArray(arr)) throw new Error("Invalid LLM output: not an array");
  console.log(`[生成测试用例] 模型返回 ${arr.length} 条，开始写入数据库`);

  const existingCases = await prisma.testCase.findMany({
    where: { testPointId: { in: points.map((p) => p.id) } },
    select: { caseId: true },
  });
  const parseCaseNum = (caseId: string): number => {
    const num = parseInt(caseId.replace(/^TC-?/i, "").trim(), 10);
    if (!Number.isNaN(num) && num > 0) return num;
    const fallback = parseInt(caseId.replace(/\D/g, ""), 10);
    return !Number.isNaN(fallback) && fallback > 0 ? fallback : 0;
  };
  const maxExisting = existingCases.length
    ? Math.max(0, ...existingCases.map((c) => parseCaseNum(c.caseId)))
    : 0;
  let nextCaseNum = maxExisting + 1;
  let created = 0;
  for (const item of arr) {
    const pt = (item.pointId ?? "").trim();
    const testPointId = pointIdToId.get(pt);
    if (!testPointId) continue;
    const caseId = `TC-${String(nextCaseNum).padStart(3, "0")}`;
    nextCaseNum++;
    await prisma.testCase.create({
      data: {
        testPointId,
        caseId,
        title: String(item.title ?? "").slice(0, 500),
        priority: ["P0", "P1", "P2"].includes(String(item.priority)) ? item.priority : "P1",
        preconditions: String(item.preconditions ?? "").slice(0, 2000),
        steps: String(item.steps ?? "").slice(0, 2000),
        expected: String(item.expected ?? "").slice(0, 2000),
      },
    });
    created++;
  }
  console.log(`[生成测试用例] 完成，创建 ${created} 条测试用例`);
  return { created, attachmentErrors };
}
