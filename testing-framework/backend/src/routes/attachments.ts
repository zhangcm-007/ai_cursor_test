import { Router } from "express";
import { prisma } from "../prisma.js";
import path from "path";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import multer from "multer";
import { randomUUID } from "crypto";
import { parseAttachment } from "../services/attachmentParser.js";

export const attachmentsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

attachmentsRouter.post("/upload", upload.array("files", 20), async (req, res) => {
  const requirementId = req.body?.requirementId as string;
  const files = (req as unknown as { files: Express.Multer.File[] }).files;
  if (!requirementId) return res.status(400).json({ error: "requirementId is required" });
  if (!files?.length) return res.status(400).json({ error: "至少上传一个文件" });
  const requirement = await prisma.requirement.findUnique({ where: { id: requirementId } });
  if (!requirement) return res.status(404).json({ error: "需求不存在" });
  const uploadsDir = path.join(process.cwd(), "uploads", requirementId);
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });
  const created: { id: string; filename: string }[] = [];
  for (const file of files) {
    const originalname =
      Buffer.from(file.originalname, "latin1").toString("utf8") || file.originalname;
    const ext = path.extname(originalname) || "";
    const base = path.basename(originalname, ext) || "file";
    const safeName = `${base}-${randomUUID().slice(0, 8)}${ext}`;
    const filePath = path.join(uploadsDir, safeName);
    writeFileSync(filePath, file.buffer);
    const a = await prisma.requirementAttachment.create({
      data: {
        requirementId,
        filename: originalname,
        filePath: path.relative(process.cwd(), filePath),
        mimeType: file.mimetype || "",
        size: file.size,
      },
    });
    const extracted = await parseAttachment(file.buffer, file.mimetype || "", originalname);
    if (extracted != null) {
      await prisma.requirementAttachment.update({
        where: { id: a.id },
        data: { extractedText: extracted },
      });
    } else {
      console.warn(`[上传附件] "${originalname}" 解析结果为空 (mimeType=${file.mimetype || ""})`);
    }
    created.push({ id: a.id, filename: a.filename });
  }
  res.json({ created });
});

attachmentsRouter.get("/:id/file", async (req, res) => {
  const a = await prisma.requirementAttachment.findUnique({
    where: { id: req.params.id },
  });
  if (!a) return res.status(404).send();
  const fullPath = path.resolve(a.filePath);
  if (!existsSync(fullPath)) return res.status(404).send();
  if (req.query.download === "1") {
    const encoded = encodeURIComponent(a.filename);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encoded}`
    );
  }
  res.sendFile(fullPath);
});
