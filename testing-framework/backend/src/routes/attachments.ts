import { Router } from "express";
import { prisma } from "../prisma.js";
import path from "path";
import { existsSync } from "fs";

export const attachmentsRouter = Router();

attachmentsRouter.get("/:id/file", async (req, res) => {
  const a = await prisma.requirementAttachment.findUnique({
    where: { id: req.params.id },
  });
  if (!a) return res.status(404).send();
  const fullPath = path.resolve(a.filePath);
  if (!existsSync(fullPath)) return res.status(404).send();
  if (req.query.download === "1") {
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(a.filename)}"`);
  }
  res.sendFile(fullPath);
});
