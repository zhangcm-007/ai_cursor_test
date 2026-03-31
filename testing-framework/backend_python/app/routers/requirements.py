from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Requirement, TestCase
from app.util import new_id

router = APIRouter(prefix="/requirements", tags=["requirements"])


def _requirement_row(r: Requirement, test_case_count: int) -> dict:
    return {
        "id": r.id,
        "title": r.title,
        "content": r.content or "",
        "createdAt": r.createdAt,
        "updatedAt": r.updatedAt,
        "testCaseCount": test_case_count,
        "_count": {"testCases": test_case_count},
    }


@router.get("")
def list_requirements(db: Session = Depends(get_db)):
    rows = db.query(Requirement).order_by(Requirement.updatedAt.desc()).all()
    counts = dict(
        db.query(TestCase.requirementId, func.count(TestCase.id)).group_by(TestCase.requirementId).all()
    )
    return [_requirement_row(r, int(counts.get(r.id, 0))) for r in rows]


@router.get("/{req_id}")
def get_requirement(req_id: str, db: Session = Depends(get_db)):
    r = db.query(Requirement).filter(Requirement.id == req_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    atts = [
        {
            "id": a.id,
            "requirementId": a.requirementId,
            "filename": a.filename,
            "filePath": a.filePath,
            "mimeType": a.mimeType,
            "size": a.size,
            "extractedText": a.extractedText,
            "createdAt": a.createdAt,
        }
        for a in r.attachments
    ]
    return {
        "id": r.id,
        "title": r.title,
        "content": r.content or "",
        "createdAt": r.createdAt,
        "updatedAt": r.updatedAt,
        "attachments": atts,
    }


@router.post("")
def create_requirement(body: dict, db: Session = Depends(get_db)):
    title = body.get("title")
    if not title:
        raise HTTPException(status_code=400, detail="title is required")
    content = body.get("content") if body.get("content") is not None else ""
    r = Requirement(id=new_id(), title=title, content=content or "")
    db.add(r)
    db.commit()
    db.refresh(r)
    return {
        "id": r.id,
        "title": r.title,
        "content": r.content or "",
        "createdAt": r.createdAt,
        "updatedAt": r.updatedAt,
    }


@router.put("/{req_id}")
def update_requirement(req_id: str, body: dict, db: Session = Depends(get_db)):
    r = db.query(Requirement).filter(Requirement.id == req_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    if body.get("title") is not None:
        r.title = body["title"]
    if body.get("content") is not None:
        r.content = body["content"]
    db.commit()
    db.refresh(r)
    return {
        "id": r.id,
        "title": r.title,
        "content": r.content or "",
        "createdAt": r.createdAt,
        "updatedAt": r.updatedAt,
    }


@router.delete("/{req_id}", status_code=204)
def delete_requirement(req_id: str, db: Session = Depends(get_db)):
    r = db.query(Requirement).filter(Requirement.id == req_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(r)
    db.commit()
    return None
