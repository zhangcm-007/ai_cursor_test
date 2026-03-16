import { Router } from "express";
import { prisma } from "../prisma.js";
import { outlineTextToFreemind } from "../services/outlineToFreemind.js";

export const exportRouter = Router();

exportRouter.post("/xmind", async (req, res) => {
  const { requirementIds, testCaseIds, format } = req.body as {
    requirementIds?: string[];
    testCaseIds?: string[];
    format?: "txt" | "mm";
  };
  let cases: { caseId: string; featurePointL1: string; featurePoint: string; title: string; priority: string; preconditions: string; steps: string; expected: string; validationPoints: string; requirement: { title: string } }[];
  if (testCaseIds?.length) {
    const raw = await prisma.testCase.findMany({
      where: { id: { in: testCaseIds } },
      include: { requirement: { select: { title: true } } },
    });
    cases = raw;
  } else if (requirementIds?.length) {
    const raw = await prisma.testCase.findMany({
      where: { requirementId: { in: requirementIds } },
      include: { requirement: { select: { title: true } } },
    });
    cases = raw;
  } else {
    return res.status(400).json({ error: "Provide requirementIds or testCaseIds" });
  }
  /** 二级节点：优先用二级功能点，否则从标题取「xxx-」前部分 */
  function getL2(c: { featurePoint?: string | null; title: string }): string {
    if (c.featurePoint != null && String(c.featurePoint).trim()) return String(c.featurePoint).trim();
    const match = c.title.match(/^([^-－]+)[-－]/);
    return match ? match[1].trim() : "";
  }
  cases.sort(
    (a, b) =>
      a.requirement.title.localeCompare(b.requirement.title) ||
      (a.featurePointL1 ?? "").trim().localeCompare((b.featurePointL1 ?? "").trim()) ||
      getL2(a).localeCompare(getL2(b)) ||
      a.caseId.localeCompare(b.caseId)
  );
  const lines: string[] = [];
  let lastReq = "";
  let lastL1 = "";
  let lastL2 = "";
  for (const c of cases) {
    const reqTitle = c.requirement.title;
    const l1 = (c.featurePointL1 ?? "").trim();
    const l2 = getL2(c);
    if (reqTitle !== lastReq) {
      lines.push(reqTitle);
      lastReq = reqTitle;
      lastL1 = "";
      lastL2 = "";
    }
    if (l1 && l1 !== lastL1) {
      lines.push(`\t${l1}`);
      lastL1 = l1;
      lastL2 = "";
    }
    if (l2 && l2 !== lastL2) {
      lines.push(`\t\t${l2}`);
      lastL2 = l2;
    }
    const caseIndent = l1 || l2 ? (l1 && l2 ? "\t\t\t" : l1 ? "\t\t" : "\t") : "\t";
    const detailIndent = caseIndent + "\t";
    lines.push(`${caseIndent}${c.caseId} ${c.title}`);
    if (c.priority) lines.push(`${detailIndent}优先级：${c.priority}`);
    if (c.preconditions) lines.push(`${detailIndent}前置条件：${c.preconditions.replace(/\n/g, " ")}`);
    if (c.steps) lines.push(`${detailIndent}测试步骤：${c.steps.replace(/\n/g, " ")}`);
    if (c.expected) lines.push(`${detailIndent}预期结果：${c.expected.replace(/\n/g, " ")}`);
    if (c.validationPoints) {
      const vps = c.validationPoints.split(/\n/).filter(Boolean);
      vps.forEach((vp: string) => lines.push(`${detailIndent}验证点：${vp.replace(/\n/g, " ")}`));
    }
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
