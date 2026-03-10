import { Router } from "express";
import { prisma } from "../prisma.js";

export const testPointsRouter = Router();

testPointsRouter.get("/", async (req, res) => {
  const requirementId = req.query.requirementId as string | undefined;
  const list = await prisma.testPoint.findMany({
    where: requirementId ? { requirementId } : undefined,
    orderBy: { pointId: "asc" },
    include: {
      requirement: { select: { id: true, title: true } },
      _count: { select: { testCases: true } },
    },
  });
  res.json(list);
});

testPointsRouter.get("/:id", async (req, res) => {
  const r = await prisma.testPoint.findUnique({
    where: { id: req.params.id },
    include: { requirement: true },
  });
  if (!r) return res.status(404).json({ error: "Not found" });
  res.json(r);
});

testPointsRouter.post("/", async (req, res) => {
  const { requirementId, pointId, description, type } = req.body;
  if (!requirementId || !pointId || !description)
    return res.status(400).json({ error: "requirementId, pointId, description required" });
  const r = await prisma.testPoint.create({
    data: {
      requirementId,
      pointId,
      description,
      type: type ?? "功能",
    },
  });
  res.json(r);
});

testPointsRouter.put("/:id", async (req, res) => {
  const { pointId, description, type } = req.body;
  const r = await prisma.testPoint.update({
    where: { id: req.params.id },
    data: {
      ...(pointId != null && { pointId }),
      ...(description != null && { description }),
      ...(type != null && { type }),
    },
  });
  res.json(r);
});

testPointsRouter.delete("/:id", async (req, res) => {
  await prisma.testPoint.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
