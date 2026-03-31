import { Router } from "express";
import { randomUUID } from "crypto";
import { extractModaoPrototype, type ModaoExtractResult } from "../services/modaoService.js";

export const modaoRouter = Router();

type JobStatus = "pending" | "running" | "completed" | "failed";
interface ModaoJob {
  status: JobStatus;
  result?: ModaoExtractResult;
  error?: string;
  createdAt: number;
}
const modaoJobs = new Map<string, ModaoJob>();

let runningCount = 0;
const MAX_CONCURRENT = 1;

modaoRouter.post("/extract", async (req, res) => {
  const { url, password } = req.body ?? {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url is required" });
  }
  if (!password || typeof password !== "string") {
    return res.status(400).json({ error: "password is required" });
  }
  if (runningCount >= MAX_CONCURRENT) {
    return res.status(429).json({ error: "当前已有提取任务在运行，请稍后再试" });
  }

  const jobId = randomUUID();
  modaoJobs.set(jobId, { status: "pending", createdAt: Date.now() });
  console.log(`[modao] 收到提取请求 jobId=${jobId} url=${url}`);
  res.json({ jobId });

  setImmediate(() => {
    (async () => {
      const job = modaoJobs.get(jobId)!;
      job.status = "running";
      runningCount++;
      console.log(`[modao] 任务开始执行 jobId=${jobId}`);
      try {
        const result = await extractModaoPrototype(url, password);
        job.status = "completed";
        job.result = result;
        console.log(
          `[modao] 任务完成 jobId=${jobId} pages=${result.pages.length}`
        );
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        job.status = "failed";
        job.error = err.message;
        console.error(`[modao] 任务失败 jobId=${jobId} error=${err.message}`);
      } finally {
        runningCount--;
      }
    })();
  });
});

modaoRouter.get("/extract/status/:jobId", (req, res) => {
  const job = modaoJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });

  const payload: {
    status: JobStatus;
    result?: ModaoExtractResult;
    error?: string;
  } = { status: job.status };

  if (job.status === "completed" && job.result) payload.result = job.result;
  if (job.status === "failed" && job.error) payload.error = job.error;
  res.json(payload);
});
