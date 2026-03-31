import "./loadEnv.js";
import express from "express";
import cors from "cors";
import { requirementsRouter } from "./routes/requirements.js";
import { testCasesRouter } from "./routes/test-cases.js";
import { statsRouter } from "./routes/stats.js";
import { exportRouter } from "./routes/export.js";
import { generateRouter } from "./routes/generate.js";
import { attachmentsRouter } from "./routes/attachments.js";
import { modaoRouter } from "./routes/modao.js";

const app = express();
app.use(cors());
// 允许较大请求体（如粘贴开发代码生成测试用例），默认约 100kb 易触发 413
app.use(express.json({ limit: "10mb" }));

app.use("/api/requirements", requirementsRouter);
app.use("/api/test-cases", testCasesRouter);
app.use("/api/stats", statsRouter);
app.use("/api/export", exportRouter);
app.use("/api/generate", generateRouter);
app.use("/api/attachments", attachmentsRouter);
app.use("/api/modao", modaoRouter);

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
