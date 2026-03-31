import { prisma } from "../prisma.js";
import { getFullContent } from "./requirementContent.js";
import { chat, isConfigured } from "./llmClient.js";
import { getCodeFromGit, isGitRepoConfigured } from "./gitService.js";

function parseJsonBlock(text: string): unknown {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return JSON.parse(codeBlock[1].trim()) as unknown;
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) return JSON.parse(arrMatch[0]) as unknown;
  return JSON.parse(text.trim()) as unknown;
}

const DEV_CODE_MAX_LENGTH = 15000;
const DEV_CODE_FILE_MAX_LENGTH = 8000;
const DEV_CODE_FILE_MAX_COUNT = 6;

/** 按扩展名给出 Markdown 代码块语言标识，便于模型按文档理解代码 */
function langFromFilename(name: string): string {
  const ext = name.replace(/^.*\./, "").toLowerCase();
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    go: "go",
    java: "java",
    rs: "rust",
    vue: "vue",
    css: "css",
    html: "html",
    json: "json",
    md: "markdown",
  };
  return map[ext] ?? "text";
}

export async function generateTestCases(options: {
  requirementId: string;
  includeHistory?: boolean;
  historyCount?: number;
  devCode?: string;
  /** 以「文档/技能」形式带给模型：带文件名与语言，多文件分段，避免整段粘贴 */
  devCodeFiles?: { name: string; content: string }[];
  /** 根据提交记录从配置的 Git 仓库自动拉取代码（需配置 DEV_CODE_REPO_PATH） */
  devCodeRef?: { commit: string; paths?: string[] };
}): Promise<{ created: number; attachmentErrors: string[] }> {
  if (!isConfigured()) throw new Error("LLM not configured");
  const { requirementId, devCode: rawDevCode, devCodeFiles: rawFiles, devCodeRef } = options;

  const { fullContent, attachmentErrors } = await getFullContent(requirementId);
  console.log(`[生成测试用例] requirementId=${requirementId}, fullContent 长度=${fullContent.length}, attachmentErrors=[${attachmentErrors.join(", ")}]`);
  console.log(`[生成测试用例] fullContent 预览:\n${fullContent.slice(0, 500)}${fullContent.length > 500 ? "\n...(省略)" : ""}`);

  const files: { name: string; content: string }[] = [];

  if (devCodeRef?.commit?.trim()) {
    const repoPath = (process.env.DEV_CODE_REPO_PATH ?? "").trim();
    const gitConfigured = isGitRepoConfigured();
    console.log(`[生成测试用例] devCodeRef 已填写: commit="${devCodeRef.commit}" paths=${JSON.stringify(devCodeRef.paths ?? [])} DEV_CODE_REPO_PATH=${repoPath || "(未配置)"} isGitRepoConfigured=${gitConfigured}`);
    if (!gitConfigured) {
      console.warn("[生成测试用例] 未配置或无效的 DEV_CODE_REPO_PATH，将跳过按提交记录拉取代码。请在 .env 中设置并指向有效的 Git 仓库根目录。");
    } else {
      try {
        console.log(`[生成测试用例] 开始从 Git 拉取代码: repoPath=${repoPath} commit=${devCodeRef.commit}`);
        const fromGit = getCodeFromGit(repoPath, devCodeRef.commit.trim(), devCodeRef.paths);
        for (let i = 0; i < fromGit.length && files.length < DEV_CODE_FILE_MAX_COUNT; i++) {
          files.push(fromGit[i]);
        }
        if (fromGit.length > 0) {
          console.log(`[生成测试用例] 从 Git 提交 ${devCodeRef.commit} 拉取 ${fromGit.length} 个文件: ${fromGit.map((f) => f.name).join(", ")}`);
        } else {
          console.warn("[生成测试用例] 从 Git 拉取结果为空，请检查 commit/分支名是否正确、路径过滤是否过严。");
        }
      } catch (e) {
        console.error("[生成测试用例] 根据提交记录拉取代码失败:", e instanceof Error ? e.message : e);
        throw new Error("根据提交记录拉取代码失败：" + (e instanceof Error ? e.message : String(e)));
      }
    }
  }

  if (Array.isArray(rawFiles) && rawFiles.length > 0) {
    for (let i = 0; i < rawFiles.length && files.length < DEV_CODE_FILE_MAX_COUNT; i++) {
      const f = rawFiles[i];
      const name = typeof f?.name === "string" ? f.name.trim() || `code-${i + 1}` : `code-${i + 1}`;
      const content = typeof f?.content === "string" ? f.content.trim() : "";
      if (!content) continue;
      const snippet =
        content.length <= DEV_CODE_FILE_MAX_LENGTH
          ? content
          : content.slice(0, DEV_CODE_FILE_MAX_LENGTH) + "\n\n...(已截断)";
      files.push({ name, content: snippet });
    }
    console.log(`[生成测试用例] 开发代码（skill 方式）: ${files.length} 个文件`);
  }
  const devCode = typeof rawDevCode === "string" ? rawDevCode.trim() : "";
  if (devCode && files.length < DEV_CODE_FILE_MAX_COUNT) {
    const snippet =
      devCode.length <= DEV_CODE_FILE_MAX_LENGTH
        ? devCode
        : devCode.slice(0, DEV_CODE_FILE_MAX_LENGTH) + "\n\n...(已截断)";
    files.push({ name: "粘贴的代码", content: snippet });
  }

  const hasDevCode = files.length > 0;
  if (hasDevCode) console.log(`[生成测试用例] 已附带开发代码（${files.length} 个片段），以文档形式带给模型`);

  const systemPrompt = `你是一名测试工程师。请根据以下需求描述生成测试用例，严格参照给定的结构。需求描述将在稍后提供。${hasDevCode ? "若提供了开发代码（以文件/文档形式给出），请结合各文件中的接口、分支与异常生成用例，使步骤、预期和验证点与实现一致。" : ""}

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
  let userPrompt = `## 当前需求\n${fullContent}\n\n请根据上述需求全面生成测试用例 JSON 数组：覆盖正常流程、分支、边界与异常，数量要足够（按需求复杂度生成，通常 5～30 条）。每条务必包含 featurePointL1、featurePoint、title、priority、preconditions、steps、expected、validationPoints。`;
  if (hasDevCode) {
    const codeSection = files
      .map(
        (f) =>
          `### 文件: ${f.name}\n\`\`\`${langFromFilename(f.name)}\n${f.content}\n\`\`\``
      )
      .join("\n\n");
    userPrompt += `\n\n## 开发代码（实现参考，以文档形式提供）\n以下为实现该需求的相关代码文件，请结合需求与各文件内容生成测试用例，使步骤、预期和验证点与实现一致（如接口字段、错误码、分支逻辑）。\n\n${codeSection}`;
  }

  const CHAT_TIMEOUT_MS = 5 * 60 * 1000; // 5 分钟，带开发代码时模型响应较慢
  const PREVIEW_LEN = 800;
  const USER_PREVIEW_LEN = 2000;
  console.log(`[生成测试用例] 提供给模型的内容预览 —— systemPrompt 长度=${systemPrompt.length}`);
  console.log(`[生成测试用例] systemPrompt 前 ${PREVIEW_LEN} 字:\n${systemPrompt.slice(0, PREVIEW_LEN)}${systemPrompt.length > PREVIEW_LEN ? "\n...(省略)" : ""}`);
  console.log(`[生成测试用例] userPrompt 长度=${userPrompt.length}`);
  console.log(`[生成测试用例] userPrompt 前 ${USER_PREVIEW_LEN} 字:\n${userPrompt.slice(0, USER_PREVIEW_LEN)}${userPrompt.length > USER_PREVIEW_LEN ? "\n...(省略)" : ""}`);
  console.log(`[生成测试用例] 开始调用模型（超时 ${CHAT_TIMEOUT_MS / 1000}s）...`);
  const content = await Promise.race([
    chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("生成超时（模型响应过慢）。请减少开发代码量或稍后重试。")),
        CHAT_TIMEOUT_MS
      )
    ),
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
