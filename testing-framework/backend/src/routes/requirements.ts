import { Router } from "express";
import { prisma } from "../prisma.js";

export const requirementsRouter = Router();

requirementsRouter.get("/", async (_req, res) => {
  const list = await prisma.requirement.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { testPoints: true } },
      testPoints: { select: { _count: { select: { testCases: true } } } },
    },
  });
  const listWithTestCaseCount = list.map((r) => {
    const testCaseCount = r.testPoints.reduce((s, tp) => s + tp._count.testCases, 0);
    const { testPoints, ...rest } = r;
    return { ...rest, testCaseCount };
  });
  res.json(listWithTestCaseCount);
});

requirementsRouter.get("/:id", async (req, res) => {
  const r = await prisma.requirement.findUnique({
    where: { id: req.params.id },
    include: {
      testPoints: true,
      attachments: true,
    },
  });
  if (!r) return res.status(404).json({ error: "Not found" });
  res.json(r);
});

requirementsRouter.post("/", async (req, res) => {
  const { title, content } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });
  const r = await prisma.requirement.create({
    data: { title, content: content ?? "" },
  });
  res.json(r);
});

requirementsRouter.put("/:id", async (req, res) => {
  const { title, content } = req.body;
  const r = await prisma.requirement.update({
    where: { id: req.params.id },
    data: { ...(title != null && { title }), ...(content != null && { content }) },
  });
  res.json(r);
});

requirementsRouter.delete("/:id", async (req, res) => {
  await prisma.requirement.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
