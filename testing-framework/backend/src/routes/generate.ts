import { Router } from "express";
import { generateTestPoints, generateTestCases } from "../services/generate.js";
import { isConfigured } from "../services/llmClient.js";

export const generateRouter = Router();

generateRouter.post("/test-points", async (req, res) => {
  if (!isConfigured()) {
    const hasDifyBase = !!(process.env.DIFY_API_BASE ?? process.env.DIFY_BASE_URL ?? process.env.DIFY_BASE);
    const hasLlmBase = !!(process.env.LLM_BASE_URL ?? process.env.LLM_BASE_BASE);
    const hint =
      process.env.LLM_API_KEY && !hasLlmBase && !hasDifyBase
        ? "当前仅配置了 LLM_API_KEY。请补全：用 Dify 时在 .env 中设置 DIFY_API_BASE 与 DIFY_API_KEY；用公司大模型时设置 LLM_BASE_URL。参见 .env.example。"
        : "LLM not configured. 请在 .env 中配置 Dify（DIFY_API_BASE + DIFY_API_KEY）或公司大模型（LLM_BASE_URL + LLM_API_KEY）或 Claude（ANTHROPIC_API_KEY），参见 .env.example。";
    return res.status(503).json({ error: hint });
  }
  const { requirementId, includeHistory, historyCount } = req.body;
  if (!requirementId) return res.status(400).json({ error: "requirementId is required" });
  try {
    const result = await generateTestPoints({
      requirementId,
      includeHistory: includeHistory !== false,
      historyCount: historyCount ?? 5,
    });
    res.json(result);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    res.status(500).json({ error: err.message });
  }
});

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
  const { requirementId, testPointIds, includeHistory, historyCount } = req.body;
  if (!requirementId) return res.status(400).json({ error: "requirementId is required" });
  try {
    const result = await generateTestCases({
      requirementId,
      testPointIds: Array.isArray(testPointIds) ? testPointIds : undefined,
      includeHistory: includeHistory !== false,
      historyCount: historyCount ?? 5,
    });
    res.json(result);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    res.status(500).json({ error: err.message });
  }
});
