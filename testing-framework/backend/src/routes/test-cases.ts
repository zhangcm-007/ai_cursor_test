import { Router } from "express";
import { prisma } from "../prisma.js";

export const testCasesRouter = Router();

testCasesRouter.get("/", async (req, res) => {
  const requirementId = req.query.requirementId as string | undefined;
  const priority = req.query.priority as string | undefined;
  const list = await prisma.testCase.findMany({
    where: {
      ...(requirementId && {
        testPoint: { requirementId },
      }),
      ...(priority && { priority }),
    },
    orderBy: [{ testPoint: { pointId: "asc" } }, { caseId: "asc" }],
    include: {
      testPoint: { include: { requirement: { select: { id: true, title: true } } } },
    },
  });
  res.json(list);
});

testCasesRouter.get("/:id", async (req, res) => {
  const r = await prisma.testCase.findUnique({
    where: { id: req.params.id },
    include: { testPoint: { include: { requirement: true } } },
  });
  if (!r) return res.status(404).json({ error: "Not found" });
  res.json(r);
});

testCasesRouter.post("/", async (req, res) => {
  const { testPointId, caseId, title, priority, preconditions, steps, expected } = req.body;
  if (!testPointId || !caseId || !title)
    return res.status(400).json({ error: "testPointId, caseId, title required" });
  const r = await prisma.testCase.create({
    data: {
      testPointId,
      caseId,
      title,
      priority: priority ?? "P1",
      preconditions: preconditions ?? "",
      steps: steps ?? "",
      expected: expected ?? "",
    },
  });
  res.json(r);
});

testCasesRouter.put("/:id", async (req, res) => {
  const { caseId, title, priority, preconditions, steps, expected } = req.body;
  const r = await prisma.testCase.update({
    where: { id: req.params.id },
    data: {
      ...(caseId != null && { caseId }),
      ...(title != null && { title }),
      ...(priority != null && { priority }),
      ...(preconditions != null && { preconditions }),
      ...(steps != null && { steps }),
      ...(expected != null && { expected }),
    },
  });
  res.json(r);
});

testCasesRouter.delete("/:id", async (req, res) => {
  await prisma.testCase.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
