from __future__ import annotations

import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import TestCase
from app.services.outline_to_freemind import outline_text_to_freemind

router = APIRouter(prefix="/export", tags=["export"])


def _get_l2(c: dict[str, Any]) -> str:
    fp = c.get("featurePoint")
    if fp is not None and str(fp).strip():
        return str(fp).strip()
    title = c.get("title") or ""
    m = re.match(r"^([^-－]+)[-－]", str(title))
    return m.group(1).strip() if m else ""


@router.post("/xmind")
def export_xmind(body: dict, db: Session = Depends(get_db)):
    requirement_ids = body.get("requirementIds") or []
    test_case_ids = body.get("testCaseIds") or []
    fmt = body.get("format") or "txt"
    if test_case_ids:
        raw = (
            db.query(TestCase)
            .options(joinedload(TestCase.requirement))
            .filter(TestCase.id.in_(test_case_ids))
            .all()
        )
    elif requirement_ids:
        raw = (
            db.query(TestCase)
            .options(joinedload(TestCase.requirement))
            .filter(TestCase.requirementId.in_(requirement_ids))
            .all()
        )
    else:
        raise HTTPException(status_code=400, detail="Provide requirementIds or testCaseIds")

    cases: list[dict[str, Any]] = []
    for c in raw:
        req = c.requirement
        cases.append(
            {
                "caseId": c.caseId,
                "featurePointL1": c.featurePointL1,
                "featurePoint": c.featurePoint,
                "title": c.title,
                "priority": c.priority,
                "preconditions": c.preconditions,
                "steps": c.steps,
                "expected": c.expected,
                "validationPoints": c.validationPoints,
                "requirement": {"title": req.title if req else ""},
            }
        )

    cases.sort(
        key=lambda a: (
            (a["requirement"]["title"] or ""),
            (str(a.get("featurePointL1") or "").strip()),
            _get_l2(a),
            a["caseId"],
        )
    )

    lines: list[str] = []
    last_req = ""
    last_l1 = ""
    last_l2 = ""
    for c in cases:
        req_title = c["requirement"]["title"]
        l1 = (c.get("featurePointL1") or "").strip()
        l2 = _get_l2(c)
        if req_title != last_req:
            lines.append(req_title)
            last_req = req_title
            last_l1 = ""
            last_l2 = ""
        if l1 and l1 != last_l1:
            lines.append(f"\t{l1}")
            last_l1 = l1
            last_l2 = ""
        if l2 and l2 != last_l2:
            lines.append(f"\t\t{l2}")
            last_l2 = l2
        case_indent = "\t\t\t" if (l1 and l2) else ("\t\t" if l1 else "\t")
        detail_indent = case_indent + "\t"
        lines.append(f"{case_indent}{c['caseId']} {c['title']}")
        if c.get("priority"):
            lines.append(f"{detail_indent}优先级：{c['priority']}")
        if c.get("preconditions"):
            pc = str(c["preconditions"]).replace("\n", " ")
            lines.append(f"{detail_indent}前置条件：{pc}")
        if c.get("steps"):
            st = str(c["steps"]).replace("\n", " ")
            lines.append(f"{detail_indent}测试步骤：{st}")
        if c.get("expected"):
            ex = str(c["expected"]).replace("\n", " ")
            lines.append(f"{detail_indent}预期结果：{ex}")
        if c.get("validationPoints"):
            vps = [x for x in str(c["validationPoints"]).split("\n") if x]
            for vp in vps:
                lines.append(f"{detail_indent}验证点：{vp.replace(chr(10), ' ')}")

    outline_text = "\n".join(lines)
    if fmt == "mm":
        mm = outline_text_to_freemind(outline_text)
        return Response(
            content=mm.encode("utf-8"),
            media_type="application/xml; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="xmind_outline.mm"'},
        )
    return Response(
        content=outline_text.encode("utf-8"),
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="xmind_outline.txt"'},
    )
