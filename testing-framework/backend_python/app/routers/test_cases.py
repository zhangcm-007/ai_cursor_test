from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import Optional

from app.database import get_db
from app.models import TestCase
from app.util import new_id

router = APIRouter(prefix="/test-cases", tags=["test-cases"])


def _tc_dict(tc: TestCase, req_brief: bool = True) -> dict:
    req = tc.requirement
    req_payload = None
    if req:
        if req_brief:
            req_payload = {"id": req.id, "title": req.title}
        else:
            req_payload = {
                "id": req.id,
                "title": req.title,
                "content": req.content or "",
                "createdAt": req.createdAt,
                "updatedAt": req.updatedAt,
            }
    return {
        "id": tc.id,
        "requirementId": tc.requirementId,
        "caseId": tc.caseId,
        "featurePointL1": tc.featurePointL1 or "",
        "featurePoint": tc.featurePoint or "",
        "title": tc.title,
        "priority": tc.priority or "P1",
        "preconditions": tc.preconditions or "",
        "steps": tc.steps or "",
        "expected": tc.expected or "",
        "validationPoints": tc.validationPoints or "",
        "createdAt": tc.createdAt,
        "updatedAt": tc.updatedAt,
        "requirement": req_payload,
    }


@router.get("")
def list_test_cases(
    requirementId: Optional[str] = None,
    priority: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(TestCase).options(joinedload(TestCase.requirement))
    if requirementId:
        q = q.filter(TestCase.requirementId == requirementId)
    if priority:
        q = q.filter(TestCase.priority == priority)
    items = q.order_by(TestCase.updatedAt.desc()).all()
    return [_tc_dict(tc, req_brief=True) for tc in items]


@router.post("/batch-delete")
def batch_delete(body: dict, db: Session = Depends(get_db)):
    ids = body.get("ids")
    if not isinstance(ids, list) or len(ids) == 0:
        raise HTTPException(status_code=400, detail="ids must be a non-empty array")
    try:
        n = db.query(TestCase).filter(TestCase.id.in_(ids)).delete(synchronize_session=False)
        db.commit()
        return {"deleted": n}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/{tc_id}")
def get_test_case(tc_id: str, db: Session = Depends(get_db)):
    tc = (
        db.query(TestCase)
        .options(joinedload(TestCase.requirement))
        .filter(TestCase.id == tc_id)
        .first()
    )
    if not tc:
        raise HTTPException(status_code=404, detail="Not found")
    return _tc_dict(tc, req_brief=False)


@router.post("")
def create_test_case(body: dict, db: Session = Depends(get_db)):
    requirement_id = body.get("requirementId")
    case_id = body.get("caseId")
    title = body.get("title")
    if not requirement_id or not case_id or not title:
        raise HTTPException(status_code=400, detail="requirementId, caseId, title required")
    tc = TestCase(
        id=new_id(),
        requirementId=requirement_id,
        caseId=case_id,
        featurePointL1=body.get("featurePointL1") or "",
        featurePoint=body.get("featurePoint") or "",
        title=title,
        priority=body.get("priority") or "P1",
        preconditions=body.get("preconditions") or "",
        steps=body.get("steps") or "",
        expected=body.get("expected") or "",
        validationPoints=body.get("validationPoints") or "",
    )
    db.add(tc)
    db.commit()
    db.refresh(tc)
    return _tc_dict(tc, req_brief=False)


@router.put("/{tc_id}")
def update_test_case(tc_id: str, body: dict, db: Session = Depends(get_db)):
    tc = db.query(TestCase).filter(TestCase.id == tc_id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="Not found")
    for key in (
        "caseId",
        "featurePointL1",
        "featurePoint",
        "title",
        "priority",
        "preconditions",
        "steps",
        "expected",
        "validationPoints",
    ):
        if key in body and body[key] is not None:
            setattr(tc, key, body[key])
    db.commit()
    db.refresh(tc)
    db_tc = (
        db.query(TestCase)
        .options(joinedload(TestCase.requirement))
        .filter(TestCase.id == tc_id)
        .first()
    )
    return _tc_dict(db_tc, req_brief=False)


@router.delete("/{tc_id}", status_code=204)
def delete_test_case(tc_id: str, db: Session = Depends(get_db)):
    tc = db.query(TestCase).filter(TestCase.id == tc_id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(tc)
    db.commit()
    return None
