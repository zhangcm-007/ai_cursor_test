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

export async function generateTestCases(options: {
  requirementId: string;
  includeHistory?: boolean;
  historyCount?: number;
}): Promise<{ created: number; attachmentErrors: string[] }> {
  if (!isConfigured()) throw new Error("LLM not configured");
  const { requirementId } = options;

  const { fullContent, attachmentErrors } = await getFullContent(requirementId);
  console.log(`[生成测试用例] requirementId=${requirementId}, fullContent 长度=${fullContent.length}, attachmentErrors=[${attachmentErrors.join(", ")}]`);
  console.log(`[生成测试用例] fullContent 预览:\n${fullContent.slice(0, 500)}${fullContent.length > 500 ? "\n...(省略)" : ""}`);

  const systemPrompt = `你是一名测试工程师。请根据以下需求描述生成测试用例，严格参照给定的结构。需求描述将在稍后提供。

覆盖要求：
- 需全面覆盖需求中的主流程、关键分支、边界条件、异常/错误场景（异常包括：输入无效数据、网络超时、服务器错误、权限不足等）。
- 根据需求复杂度生成足够数量的用例，避免重复。通常生成不少于5条、不超过30条测试用例，具体数量由需求复杂度和场景数量决定。

每条测试用例包含以下字段（不要 pointId）：
1. featurePointL1：一级功能点（需求下的分类/大类），如"个人红包"、"群红包"、"账户余额"、"支付方式"。同一分类的用例填相同一级功能点。
2. featurePoint：二级功能点（一级下的具体模块），如"红包领取"、"发送群红包"。同一子模块的用例填相同二级功能点。
3. title：测试用例名称，简洁描述场景，可中英文（如"提现页面展示已激活卡片 / Withdrawal page displays activated card"）。建议优先使用中文，保留必要英文术语。
4. priority：P0（核心流程/阻塞性）、P1（重要功能/非阻塞）、P2（边缘/异常/易用性）。请按此标准赋值。
5. preconditions：前置条件，执行前系统应满足的状态（一条或短句，可多句）。
6. steps：测试步骤，按编号列出原子操作（如"1. 进入提现流程 2. 查看选卡页面"）。
7. expected：预期结果，完成步骤后系统应达到的状态（简短明确）。
8. validationPoints：验证点，用于确认预期结果的详细检查项；多条时用数组，如["卡片可点击，无 disabled 状态", "无【未激活】标签"]，或单条字符串。每个验证点应具体、可观察。

只输出一个 JSON 数组，不要其他说明。格式示例：
[{"featurePointL1":"群红包","featurePoint":"红包领取","title":"...","priority":"P1","preconditions":"...","steps":"...","expected":"...","validationPoints":["验证点1","验证点2"]}]
caseId 由系统分配，无需在输出中填写。`;
  const userPrompt = `## 当前需求\n${fullContent}\n\n请根据上述需求全面生成测试用例 JSON 数组：覆盖正常流程、分支、边界与异常，数量要足够（按需求复杂度生成，通常 5～30 条）。每条务必包含 featurePointL1、featurePoint、title、priority、preconditions、steps、expected、validationPoints。`;

  console.log(`[生成测试用例] 开始调用模型...`);
  const content = await chat([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  const arr = parseJsonBlock(content) as {
    featurePointL1?: string;
    featurePoint?: string;
    title?: string;
    priority?: string;
    preconditions?: string;
    steps?: string;
    expected?: string;
    validationPoints?: string | string[];
  }[];
  if (!Array.isArray(arr)) throw new Error("Invalid LLM output: not an array");
  console.log(`[生成测试用例] 模型返回 ${arr.length} 条，开始写入数据库`);

  const existingCases = await prisma.testCase.findMany({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: { requirementId } as any,
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
    const caseId = `TC-${String(nextCaseNum).padStart(3, "0")}`;
    nextCaseNum++;
    const rawVp = item.validationPoints;
    const validationPointsStr = Array.isArray(rawVp)
      ? rawVp.map((s) => String(s).trim()).filter(Boolean).join("\n")
      : String(rawVp ?? "").trim();
    const featurePointL1 = String(item.featurePointL1 ?? "").trim().slice(0, 200);
    const featurePoint = String(item.featurePoint ?? "").trim().slice(0, 200);
    const payload = {
      requirementId,
      caseId,
      featurePointL1,
      featurePoint,
      title: String(item.title ?? "").slice(0, 500),
      priority: ["P0", "P1", "P2"].includes(String(item.priority)) ? item.priority : "P1",
      preconditions: String(item.preconditions ?? "").slice(0, 2000),
      steps: String(item.steps ?? "").slice(0, 2000),
      expected: String(item.expected ?? "").slice(0, 2000),
      validationPoints: validationPointsStr.slice(0, 2000),
    };
    try {
      await prisma.testCase.create({ data: payload as unknown as Parameters<typeof prisma.testCase.create>[0]["data"] });
    } catch (createErr: unknown) {
      const msg = createErr instanceof Error ? createErr.message : String(createErr);
      if (msg.includes("validationPoints") || msg.includes("featurePoint") || msg.includes("featurePointL1") || msg.includes("Unknown arg")) {
        const { validationPoints: _vp, featurePoint: _fp, featurePointL1: _fp1, ...rest } = payload;
        await prisma.testCase.create({ data: { ...rest } as unknown as Parameters<typeof prisma.testCase.create>[0]["data"] });
        console.warn("[生成测试用例] 当前 Prisma 未包含 validationPoints 字段，已省略该字段写入。请执行 npx prisma generate 后重新生成。");
      } else {
        throw createErr;
      }
    }
    created++;
  }
  console.log(`[生成测试用例] 完成，创建 ${created} 条测试用例`);
  return { created, attachmentErrors };
}
