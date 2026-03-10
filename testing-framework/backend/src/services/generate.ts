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

  const systemPrompt = `你是一名测试工程师。根据需求描述生成测试点。测试点需覆盖功能、边界、异常等类型。只输出一个 JSON 数组，不要其他说明。格式：[{"pointId":"TP-01","description":"...","type":"功能|边界|异常"}]。pointId 从 TP-01 递增。`;
  const userPrompt = `## 当前需求\n${fullContent}\n\n请生成测试点 JSON 数组：`;

  const content = await chat([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  const arr = parseJsonBlock(content) as { pointId?: string; description?: string; type?: string }[];
  if (!Array.isArray(arr)) throw new Error("Invalid LLM output: not an array");

  const existing = await prisma.testPoint.findMany({
    where: { requirementId },
    select: { pointId: true },
  });
  const used = new Set(existing.map((p) => p.pointId));
  let nextNum = 1;
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

  const pointIdToId = new Map(points.map((p) => [p.pointId, p.id]));
  const pointsDesc = points.map((p) => `${p.pointId}: ${p.description}`).join("\n");

  const systemPrompt = `你是一名测试工程师。根据需求和测试点生成测试用例。只输出一个 JSON 数组，不要其他说明。格式：[{"pointId":"TP-01","caseId":"TC-001","title":"...","priority":"P0|P1|P2","preconditions":"...","steps":"...","expected":"..."}]。caseId 按测试点分别从 TC-001 递增。`;
  const userPrompt = `## 当前需求\n${fullContent}\n\n## 测试点列表\n${pointsDesc}\n\n请为上述测试点生成测试用例 JSON 数组：`;

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

  const caseNumByPoint = new Map<string, number>();
  let created = 0;
  for (const item of arr) {
    const testPointId = pointIdToId.get(item.pointId ?? "");
    if (!testPointId) continue;
    const pt = item.pointId ?? "";
    const n = (caseNumByPoint.get(pt) ?? 0) + 1;
    caseNumByPoint.set(pt, n);
    const caseId =
      item.caseId && /^TC-\d+$/.test(item.caseId) ? item.caseId : `TC-${String(n).padStart(3, "0")}`;
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
  return { created, attachmentErrors };
}
