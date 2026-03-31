from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models import Requirement


@dataclass
class GetFullContentResult:
    full_content: str
    attachment_errors: list[str]


def get_full_content(db: Session, requirement_id: str) -> GetFullContentResult:
    req = db.query(Requirement).filter(Requirement.id == requirement_id).first()
    if not req:
        raise ValueError("Requirement not found")
    parts = [f"# {req.title}\n", req.content or ""]
    errors: list[str] = []
    atts = sorted(req.attachments, key=lambda a: a.id)
    print(f"[getFullContent] requirementId={requirement_id}, 附件数={len(atts)}")
    for a in atts:
        et = (a.extractedText or "").strip()
        if et:
            parts.append(f"\n## 附件: {a.filename}\n{et}")
        elif (a.mimeType or "").startswith("image/"):
            parts.append(f"\n## 附件: {a.filename} (图片)")
        else:
            errors.append(a.filename)
    full = "\n".join(parts).strip()
    print(f"[getFullContent] 完成, fullContent 长度={len(full)}, attachmentErrors={len(errors)}")
    return GetFullContentResult(full_content=full, attachment_errors=errors)
