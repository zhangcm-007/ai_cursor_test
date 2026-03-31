from __future__ import annotations

import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import BACKEND_CWD
from app.database import get_db
from app.models import Requirement, RequirementAttachment
from app.services.attachment_parser import parse_attachment
from app.util import new_id

router = APIRouter(prefix="/attachments", tags=["attachments"])


@router.post("/upload")
async def upload_attachments(
    requirementId: str = Form(...),
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    if not requirementId:
        raise HTTPException(status_code=400, detail="requirementId is required")
    if not files:
        raise HTTPException(status_code=400, detail="至少上传一个文件")

    req = db.query(Requirement).filter(Requirement.id == requirementId).first()
    if not req:
        raise HTTPException(status_code=404, detail="需求不存在")

    uploads_dir = Path(BACKEND_CWD) / "uploads" / requirementId
    uploads_dir.mkdir(parents=True, exist_ok=True)
    created: list[dict[str, str]] = []

    for file in files:
        originalname = file.filename or "file"
        ext = Path(originalname).suffix or ""
        base = Path(originalname).stem or "file"
        safe_name = f"{base}-{uuid.uuid4().hex[:8]}{ext}"
        dest = uploads_dir / safe_name
        data = await file.read()
        dest.write_bytes(data)
        rel = str(dest.relative_to(Path(BACKEND_CWD)))

        att = RequirementAttachment(
            id=new_id(),
            requirementId=requirementId,
            filename=originalname,
            filePath=rel,
            mimeType=file.content_type or "",
            size=len(data),
        )
        db.add(att)
        db.flush()

        extracted = parse_attachment(data, file.content_type or "", originalname)
        if extracted is not None:
            att.extractedText = extracted
        else:
            print(f'[上传附件] "{originalname}" 解析结果为空 (mimeType={file.content_type or ""})')

        created.append({"id": att.id, "filename": att.filename})

    db.commit()
    return {"created": created}


@router.get("/{att_id}/file")
def get_attachment_file(att_id: str, download: Optional[str] = None, db: Session = Depends(get_db)):
    a = db.query(RequirementAttachment).filter(RequirementAttachment.id == att_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Not found")
    full_path = (Path(BACKEND_CWD) / a.filePath).resolve()
    try:
        full_path.relative_to(Path(BACKEND_CWD).resolve())
    except ValueError:
        raise HTTPException(status_code=404, detail="Not found")
    if not full_path.is_file():
        raise HTTPException(status_code=404, detail="Not found")

    headers = {}
    if download == "1":
        from urllib.parse import quote

        enc = quote(a.filename)
        headers["Content-Disposition"] = f"attachment; filename*=UTF-8''{enc}"
    return FileResponse(str(full_path), filename=a.filename, headers=headers)
