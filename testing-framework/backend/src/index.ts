import "./loadEnv.js";
import express from "express";
import cors from "cors";
import { requirementsRouter } from "./routes/requirements.js";
import { testPointsRouter } from "./routes/test-points.js";
import { testCasesRouter } from "./routes/test-cases.js";
import { statsRouter } from "./routes/stats.js";
import { exportRouter } from "./routes/export.js";
import { generateRouter } from "./routes/generate.js";
import { attachmentsRouter } from "./routes/attachments.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/requirements", requirementsRouter);
app.use("/api/test-points", testPointsRouter);
app.use("/api/test-cases", testCasesRouter);
app.use("/api/stats", statsRouter);
app.use("/api/export", exportRouter);
app.use("/api/generate", generateRouter);
app.use("/api/attachments", attachmentsRouter);

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
