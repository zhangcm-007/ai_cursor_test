from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.db_types import PrismaSQLiteDateTime, utc_naive_now


class Requirement(Base):
    __tablename__ = "Requirement"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String)
    content: Mapped[str] = mapped_column(String, default="")
    createdAt: Mapped[datetime] = mapped_column(
        "createdAt", PrismaSQLiteDateTime(), nullable=False, default=utc_naive_now
    )
    updatedAt: Mapped[datetime] = mapped_column(
        "updatedAt", PrismaSQLiteDateTime(), nullable=False, default=utc_naive_now, onupdate=utc_naive_now
    )

    testCases: Mapped[list["TestCase"]] = relationship(back_populates="requirement", cascade="all, delete-orphan")
    attachments: Mapped[list["RequirementAttachment"]] = relationship(
        back_populates="requirement", cascade="all, delete-orphan"
    )


class RequirementAttachment(Base):
    __tablename__ = "RequirementAttachment"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    requirementId: Mapped[str] = mapped_column("requirementId", String, ForeignKey("Requirement.id", ondelete="CASCADE"))
    filename: Mapped[str] = mapped_column(String)
    filePath: Mapped[str] = mapped_column(String)
    mimeType: Mapped[str] = mapped_column("mimeType", String, default="")
    size: Mapped[int] = mapped_column(Integer, default=0)
    extractedText: Mapped[Optional[str]] = mapped_column("extractedText", Text, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(
        "createdAt", PrismaSQLiteDateTime(), nullable=False, default=utc_naive_now
    )

    requirement: Mapped["Requirement"] = relationship(back_populates="attachments")


class TestCase(Base):
    __tablename__ = "TestCase"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    requirementId: Mapped[str] = mapped_column("requirementId", String, ForeignKey("Requirement.id", ondelete="CASCADE"))
    caseId: Mapped[str] = mapped_column(String)
    featurePointL1: Mapped[str] = mapped_column("featurePointL1", String, default="")
    featurePoint: Mapped[str] = mapped_column("featurePoint", String, default="")
    title: Mapped[str] = mapped_column(String)
    priority: Mapped[str] = mapped_column(String, default="P1")
    preconditions: Mapped[str] = mapped_column(String, default="")
    steps: Mapped[str] = mapped_column(String, default="")
    expected: Mapped[str] = mapped_column(String, default="")
    validationPoints: Mapped[str] = mapped_column(String, default="")
    createdAt: Mapped[datetime] = mapped_column(
        "createdAt", PrismaSQLiteDateTime(), nullable=False, default=utc_naive_now
    )
    updatedAt: Mapped[datetime] = mapped_column(
        "updatedAt", PrismaSQLiteDateTime(), nullable=False, default=utc_naive_now, onupdate=utc_naive_now
    )

    requirement: Mapped["Requirement"] = relationship(back_populates="testCases")
