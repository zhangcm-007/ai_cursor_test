import { Router } from "express";
import { randomUUID } from "crypto";
import { generateTestCases } from "../services/generate.js";
import { isConfigured } from "../services/llmClient.js";

export const generateRouter = Router();

type JobStatus = "pending" | "running" | "completed" | "failed";
interface TestCasesJob {
  status: JobStatus;
  result?: { created: number; attachmentErrors: string[] };
  error?: string;
  createdAt: number;
}
const testCasesJobs = new Map<string, TestCasesJob>();

generateRouter.post("/test-cases", async (req, res) => {
  if (!isConfigured()) {
    const hasDifyBase = !!(process.env.DIFY_API_BASE ?? process.env.DIFY_BASE_URL ?? process.env.DIFY_BASE);
    const hasLlmBase = !!(process.env.LLM_BASE_URL ?? process.env.LLM_BASE_BASE);
    const hint =
      process.env.LLM_API_KEY && !hasLlmBase && !hasDifyBase
        ? "当前仅配置了 LLM_API_KEY。请补全：用 Dify 时在 .env 中设置 DIFY_API_BASE 与 DIFY_API_KEY；用公司大模型时设置 LLM_BASE_URL。参见 .env.example。"
        : "LLM not configured. 请在 .env 中配置 Dify（DIFY_API_BASE + DIFY_API_KEY）或公司大模型（LLM_BASE_URL + LLM_API_KEY）或 Claude（ANTHROPIC_API_KEY），参见 .env.example。";
    return res.status(503).json({ error: hint });
  }
  const { requirementId, includeHistory, historyCount, devCode, devCodeFiles, devCodeRef } = req.body;
  if (!requirementId) return res.status(400).json({ error: "requirementId is required" });
  const jobId = randomUUID();
  testCasesJobs.set(jobId, { status: "pending", createdAt: Date.now() });
  const devCodeLen = typeof devCode === "string" ? devCode.length : 0;
  const filesCount = Array.isArray(devCodeFiles) ? devCodeFiles.length : 0;
  const hasRef = devCodeRef?.commit != null;
  console.log(`[generate] 收到请求 jobId=${jobId} requirementId=${requirementId} devCode长度=${devCodeLen} devCodeFiles数=${filesCount} devCodeRef=${hasRef ? "有" : "无"}`);
  if (hasRef) {
    console.log(`[generate] devCodeRef 参数: commit="${devCodeRef.commit}" paths=${JSON.stringify(devCodeRef.paths ?? [])}`);
  }
  res.json({ jobId });
  setImmediate(() => {
    (async () => {
      const job = testCasesJobs.get(jobId)!;
      job.status = "running";
      console.log(`[generate] 任务开始执行 jobId=${jobId}`);
      try {
        const result = await generateTestCases({
          requirementId,
          includeHistory: includeHistory !== false,
          historyCount: historyCount ?? 5,
          devCode: typeof devCode === "string" ? devCode : undefined,
          devCodeFiles: Array.isArray(devCodeFiles) ? devCodeFiles : undefined,
          devCodeRef:
            devCodeRef && typeof devCodeRef.commit === "string"
              ? {
                  commit: devCodeRef.commit,
                  paths: Array.isArray(devCodeRef.paths) ? devCodeRef.paths : undefined,
                }
              : undefined,
        });
        job.status = "completed";
        job.result = result;
        console.log(`[generate] 任务完成 jobId=${jobId} created=${result.created}`);
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        job.status = "failed";
        job.error = err.message;
        console.error(`[generate] 任务失败 jobId=${jobId} error=${err.message}`);
      }
    })();
  });
});

generateRouter.get("/test-cases/status/:jobId", (req, res) => {
  const job = testCasesJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  const payload: { status: JobStatus; result?: TestCasesJob["result"]; error?: string } = {
    status: job.status,
  };
  if (job.status === "completed" && job.result) payload.result = job.result;
  if (job.status === "failed" && job.error) payload.error = job.error;
  res.json(payload);
});
