from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Requirement, TestCase

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("")
def stats(db: Session = Depends(get_db)):
    requirements = db.query(func.count(Requirement.id)).scalar() or 0
    test_cases = db.query(func.count(TestCase.id)).scalar() or 0
    return {"requirements": int(requirements), "testCases": int(test_cases)}
