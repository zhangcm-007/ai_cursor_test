import { Router } from "express";
import { prisma } from "../prisma.js";

export const testPointsRouter = Router();

testPointsRouter.get("/", async (req, res) => {
  const requirementId = req.query.requirementId as string | undefined;
  try {
    const list = await prisma.testPoint.findMany({
      where: requirementId ? { requirementId } : undefined,
      orderBy: { updatedAt: "desc" },
      include: {
        requirement: { select: { id: true, title: true } },
        _count: { select: { testCases: true } },
      },
    });
    res.json(list);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    res.status(500).json({ error: err.message });
  }
});

testPointsRouter.post("/batch-delete", async (req, res) => {
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || ids.length === 0)
    return res.status(400).json({ error: "ids must be a non-empty array" });
  try {
    const result = await prisma.testPoint.deleteMany({
      where: { id: { in: ids } },
    });
    res.json({ deleted: result.count });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    res.status(500).json({ error: err.message });
  }
});

testPointsRouter.get("/:id", async (req, res) => {
  try {
    const r = await prisma.testPoint.findUnique({
      where: { id: req.params.id },
      include: { requirement: true },
    });
    if (!r) return res.status(404).json({ error: "Not found" });
    res.json(r);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    res.status(500).json({ error: err.message });
  }
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
  try {
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
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    res.status(500).json({ error: err.message });
  }
});

testPointsRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.testPoint.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    res.status(500).json({ error: err.message });
  }
});
