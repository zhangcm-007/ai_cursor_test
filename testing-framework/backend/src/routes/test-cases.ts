import { Router } from "express";
import { prisma } from "../prisma.js";

export const testCasesRouter = Router();

testCasesRouter.get("/", async (req, res) => {
  const requirementId = req.query.requirementId as string | undefined;
  const priority = req.query.priority as string | undefined;
  const list = await prisma.testCase.findMany({
    where: {
      ...(requirementId && { requirementId }),
      ...(priority && { priority }),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      requirement: { select: { id: true, title: true } },
    },
  });
  res.json(list);
});

testCasesRouter.post("/batch-delete", async (req, res) => {
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || ids.length === 0)
    return res.status(400).json({ error: "ids must be a non-empty array" });
  try {
    const result = await prisma.testCase.deleteMany({
      where: { id: { in: ids } },
    });
    res.json({ deleted: result.count });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    res.status(500).json({ error: err.message });
  }
});

testCasesRouter.get("/:id", async (req, res) => {
  const r = await prisma.testCase.findUnique({
    where: { id: req.params.id },
    include: { requirement: true },
  });
  if (!r) return res.status(404).json({ error: "Not found" });
  res.json(r);
});

testCasesRouter.post("/", async (req, res) => {
  const { requirementId, caseId, featurePointL1, featurePoint, title, priority, preconditions, steps, expected, validationPoints } = req.body;
  if (!requirementId || !caseId || !title)
    return res.status(400).json({ error: "requirementId, caseId, title required" });
  const r = await prisma.testCase.create({
    data: {
      requirementId,
      caseId,
      featurePointL1: featurePointL1 ?? "",
      featurePoint: featurePoint ?? "",
      title,
      priority: priority ?? "P1",
      preconditions: preconditions ?? "",
      steps: steps ?? "",
      expected: expected ?? "",
      validationPoints: validationPoints ?? "",
    },
  });
  res.json(r);
});

testCasesRouter.put("/:id", async (req, res) => {
  const { caseId, featurePointL1, featurePoint, title, priority, preconditions, steps, expected, validationPoints } = req.body;
  const r = await prisma.testCase.update({
    where: { id: req.params.id },
    data: {
      ...(caseId != null && { caseId }),
      ...(featurePointL1 != null && { featurePointL1 }),
      ...(featurePoint != null && { featurePoint }),
      ...(title != null && { title }),
      ...(priority != null && { priority }),
      ...(preconditions != null && { preconditions }),
      ...(steps != null && { steps }),
      ...(expected != null && { expected }),
      ...(validationPoints != null && { validationPoints }),
    },
  });
  res.json(r);
});

testCasesRouter.delete("/:id", async (req, res) => {
  await prisma.testCase.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
