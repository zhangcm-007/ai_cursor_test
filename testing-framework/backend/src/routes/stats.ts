import { Router } from "express";
import { prisma } from "../prisma.js";

export const statsRouter = Router();

statsRouter.get("/", async (_req, res) => {
  const [requirements, testPoints, testCases] = await Promise.all([
    prisma.requirement.count(),
    prisma.testPoint.count(),
    prisma.testCase.count(),
  ]);
  res.json({ requirements, testPoints, testCases });
});
