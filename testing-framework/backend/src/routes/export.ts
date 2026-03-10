import { Router } from "express";
import { prisma } from "../prisma.js";
import { outlineTextToFreemind } from "../services/outlineToFreemind.js";

export const exportRouter = Router();

exportRouter.post("/xmind-outline", async (req, res) => {
  const { requirementIds, format } = req.body as { requirementIds?: string[]; format?: "txt" | "mm" };
  if (!requirementIds?.length)
    return res.status(400).json({ error: "requirementIds is required" });
  const points = await prisma.testPoint.findMany({
    where: { requirementId: { in: requirementIds } },
    include: { requirement: { select: { title: true } } },
    orderBy: [{ requirement: { title: "asc" } }, { pointId: "asc" }],
  });
  const lines: string[] = [];
  let lastReq = "";
  for (const p of points) {
    const reqTitle = p.requirement.title;
    if (reqTitle !== lastReq) {
      lines.push(reqTitle);
      lastReq = reqTitle;
    }
    const desc = (p.description || "").replace(/\n/g, " ").slice(0, 200);
    lines.push(`\t${p.pointId}${desc ? " " + desc : ""}`);
  }
  const outlineText = lines.join("\n");
  if (format === "mm") {
    const mm = outlineTextToFreemind(outlineText);
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=xmind_testpoints.mm");
    res.send(Buffer.from(mm, "utf-8"));
    return;
  }
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=xmind_testpoints.txt");
  res.send(outlineText);
});

exportRouter.post("/xmind", async (req, res) => {
  const { requirementIds, testCaseIds, format } = req.body as {
    requirementIds?: string[];
    testCaseIds?: string[];
    format?: "txt" | "mm";
  };
  let cases: { caseId: string; title: string; priority: string; preconditions: string; steps: string; expected: string; testPoint: { pointId: string; requirement: { title: string } } }[];
  if (testCaseIds?.length) {
    const raw = await prisma.testCase.findMany({
      where: { id: { in: testCaseIds } },
      include: { testPoint: { include: { requirement: { select: { title: true } } } } },
    });
    cases = raw.sort(
      (a, b) =>
        a.testPoint.requirement.title.localeCompare(b.testPoint.requirement.title) ||
        a.testPoint.pointId.localeCompare(b.testPoint.pointId) ||
        a.caseId.localeCompare(b.caseId)
    ) as never;
  } else if (requirementIds?.length) {
    const raw = await prisma.testCase.findMany({
      where: { testPoint: { requirementId: { in: requirementIds } } },
      include: { testPoint: { include: { requirement: { select: { title: true } } } } },
    });
    cases = raw.sort(
      (a, b) =>
        a.testPoint.requirement.title.localeCompare(b.testPoint.requirement.title) ||
        a.testPoint.pointId.localeCompare(b.testPoint.pointId) ||
        a.caseId.localeCompare(b.caseId)
    ) as never;
  } else {
    return res.status(400).json({ error: "Provide requirementIds or testCaseIds" });
  }
  const lines: string[] = [];
  let lastReq = "";
  let lastPoint = "";
  for (const c of cases) {
    const reqTitle = c.testPoint.requirement.title;
    const pointId = c.testPoint.pointId;
    if (reqTitle !== lastReq) {
      lines.push(reqTitle);
      lastReq = reqTitle;
      lastPoint = "";
    }
    if (pointId !== lastPoint) {
      lines.push(`\t${pointId}`);
      lastPoint = pointId;
    }
    lines.push(`\t\t${c.caseId} ${c.title}`);
    if (c.priority) lines.push(`\t\t\t优先级：${c.priority}`);
    if (c.preconditions) lines.push(`\t\t\t前置条件：${c.preconditions.replace(/\n/g, " ")}`);
    if (c.steps) lines.push(`\t\t\t测试步骤：${c.steps.replace(/\n/g, " ")}`);
    if (c.expected) lines.push(`\t\t\t预期结果：${c.expected.replace(/\n/g, " ")}`);
  }
  const outlineText = lines.join("\n");
  if (format === "mm") {
    const mm = outlineTextToFreemind(outlineText);
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=xmind_outline.mm");
    res.send(Buffer.from(mm, "utf-8"));
    return;
  }
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=xmind_outline.txt");
  res.send(outlineText);
});
