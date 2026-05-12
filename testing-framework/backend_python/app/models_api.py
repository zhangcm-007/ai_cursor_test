"""接口测试相关表，与 backend_python/prisma/schema.prisma 对齐。"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.db_types import PrismaSQLiteDateTime, utc_naive_now


class ApiEnvironment(Base):
    __tablename__ = "ApiEnvironment"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    baseUrl: Mapped[str] = mapped_column("baseUrl", String)
    variables: Mapped[str] = mapped_column(String, default="{}")
    autoExtractedVariables: Mapped[str] = mapped_column("autoExtractedVariables", String, default="{}")
    webhookUrl: Mapped[str] = mapped_column("webhookUrl", String, default="")
    createdAt: Mapped[datetime] = mapped_column(
        "createdAt", PrismaSQLiteDateTime(), nullable=False, default=utc_naive_now
    )
    updatedAt: Mapped[datetime] = mapped_column(
        "updatedAt", PrismaSQLiteDateTime(), nullable=False, default=utc_naive_now, onupdate=utc_naive_now
    )

    runs: Mapped[list["ApiRun"]] = relationship(back_populates="environment", cascade="all, delete-orphan")
    schedules: Mapped[list["ApiRegressionSchedule"]] = relationship(
        back_populates="environment", cascade="all, delete-orphan"
    )


class ApiCollection(Base):
    __tablename__ = "ApiCollection"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(String, default="")
    definition: Mapped[str] = mapped_column(Text, default="{}")
    lastDebugResult: Mapped[str] = mapped_column("lastDebugResult", Text, default="")
    createdAt: Mapped[datetime] = mapped_column(
        "createdAt", PrismaSQLiteDateTime(), nullable=False, default=utc_naive_now
    )
    updatedAt: Mapped[datetime] = mapped_column(
        "updatedAt", PrismaSQLiteDateTime(), nullable=False, default=utc_naive_now, onupdate=utc_naive_now
    )

    runs: Mapped[list["ApiRun"]] = relationship(back_populates="collection", cascade="all, delete-orphan")
    schedules: Mapped[list["ApiRegressionSchedule"]] = relationship(
        back_populates="collection", cascade="all, delete-orphan"
    )


class ApiEndpoint(Base):
    __tablename__ = "ApiEndpoint"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    method: Mapped[str] = mapped_column(String)
    path: Mapped[str] = mapped_column(String)
    name: Mapped[str] = mapped_column(String, default="")
    description: Mapped[str] = mapped_column(String, default="")
    protocol: Mapped[str] = mapped_column(String, default="http")
    sampleRequest: Mapped[str] = mapped_column("sampleRequest", Text, default="")
    sampleHeaders: Mapped[str] = mapped_column("sampleHeaders", Text, default="")
    debugDraft: Mapped[str] = mapped_column("debugDraft", Text, default="{}")
    apiDoc: Mapped[str] = mapped_column("apiDoc", Text, default="")
    createdAt: Mapped[datetime] = mapped_column(
        "createdAt", PrismaSQLiteDateTime(), nullable=False, default=utc_naive_now
    )
    updatedAt: Mapped[datetime] = mapped_column(
        "updatedAt", PrismaSQLiteDateTime(), nullable=False, default=utc_naive_now, onupdate=utc_naive_now
    )


class ApiRegressionSchedule(Base):
    __tablename__ = "ApiRegressionSchedule"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    cronExpression: Mapped[str] = mapped_column("cronExpression", String)
    regressionMode: Mapped[str] = mapped_column("regressionMode", String, default="full")
    environmentId: Mapped[str] = mapped_column("environmentId", String, ForeignKey("ApiEnvironment.id", ondelete="CASCADE"))
    collectionId: Mapped[str] = mapped_column("collectionId", String, ForeignKey("ApiCollection.id", ondelete="CASCADE"))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    skipHoliday: Mapped[bool] = mapped_column("skipHoliday", Boolean, default=False)
    createdAt: Mapped[datetime] = mapped_column(
        "createdAt", PrismaSQLiteDateTime(), nullable=False, default=utc_naive_now
    )
    updatedAt: Mapped[datetime] = mapped_column(
        "updatedAt", PrismaSQLiteDateTime(), nullable=False, default=utc_naive_now, onupdate=utc_naive_now
    )

    environment: Mapped["ApiEnvironment"] = relationship(back_populates="schedules")
    collection: Mapped["ApiCollection"] = relationship(back_populates="schedules")


class ApiRun(Base):
    __tablename__ = "ApiRun"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    status: Mapped[str] = mapped_column(String)
    triggeredBy: Mapped[str] = mapped_column("triggeredBy", String, default="manual")
    regressionMode: Mapped[str] = mapped_column("regressionMode", String, default="full")
    correlationId: Mapped[Optional[str]] = mapped_column("correlationId", String, nullable=True)
    requirementId: Mapped[Optional[str]] = mapped_column("requirementId", String, nullable=True)
    environmentId: Mapped[str] = mapped_column("environmentId", String, ForeignKey("ApiEnvironment.id", ondelete="CASCADE"))
    environmentName: Mapped[str] = mapped_column("environmentName", String, default="")
    baseUrlSnapshot: Mapped[str] = mapped_column("baseUrlSnapshot", String, default="")
    collectionId: Mapped[str] = mapped_column("collectionId", String, ForeignKey("ApiCollection.id", ondelete="CASCADE"))
    startedAt: Mapped[datetime] = mapped_column(
        "startedAt", PrismaSQLiteDateTime(), nullable=False, default=utc_naive_now
    )
    finishedAt: Mapped[Optional[datetime]] = mapped_column(
        "finishedAt", PrismaSQLiteDateTime(), nullable=True
    )
    errorMessage: Mapped[Optional[str]] = mapped_column("errorMessage", Text, nullable=True)

    environment: Mapped["ApiEnvironment"] = relationship(back_populates="runs")
    collection: Mapped["ApiCollection"] = relationship(back_populates="runs")
    steps: Mapped[list["ApiRunStep"]] = relationship(back_populates="run", cascade="all, delete-orphan")


class ApiRunStep(Base):
    __tablename__ = "ApiRunStep"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    runId: Mapped[str] = mapped_column("runId", String, ForeignKey("ApiRun.id", ondelete="CASCADE"))
    orderIndex: Mapped[int] = mapped_column("orderIndex", Integer)
    name: Mapped[str] = mapped_column(String)
    requestMethod: Mapped[str] = mapped_column("requestMethod", String, default="")
    requestUrl: Mapped[str] = mapped_column("requestUrl", String, default="")
    statusCode: Mapped[Optional[int]] = mapped_column("statusCode", Integer, nullable=True)
    passed: Mapped[bool] = mapped_column(Boolean, default=False)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    requestBodyMasked: Mapped[Optional[str]] = mapped_column("requestBodyMasked", Text, nullable=True)
    responseBodyMasked: Mapped[Optional[str]] = mapped_column("responseBodyMasked", Text, nullable=True)
    assertionResults: Mapped[str] = mapped_column("assertionResults", Text, default="[]")
    durationMs: Mapped[Optional[int]] = mapped_column("durationMs", Integer, nullable=True)

    run: Mapped["ApiRun"] = relationship(back_populates="steps")


class TapdReportTemplate(Base):
    """报表模板：定义日报中要统计的指标及其查询条件。"""
    __tablename__ = "TapdReportTemplate"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, default="")
    description: Mapped[str] = mapped_column(String, default="")
    builtIn: Mapped[bool] = mapped_column("builtIn", Boolean, default=False)
    metrics: Mapped[str] = mapped_column("metrics", Text, default="[]")
    createdAt: Mapped[datetime] = mapped_column(
        "createdAt", PrismaSQLiteDateTime(), nullable=False, default=utc_naive_now
    )
    updatedAt: Mapped[datetime] = mapped_column(
        "updatedAt", PrismaSQLiteDateTime(), nullable=False, default=utc_naive_now, onupdate=utc_naive_now
    )


class TapdBugReportConfig(Base):
    """TAPD 缺陷日报配置：每条记录代表一个独立的定时推送任务。"""
    __tablename__ = "TapdBugReportConfig"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, default="")
    webhookUrl: Mapped[str] = mapped_column("webhookUrl", String, default="")
    templateId: Mapped[Optional[str]] = mapped_column("templateId", String, nullable=True)
    filters: Mapped[str] = mapped_column("filters", Text, default="{}")
    cronExpression: Mapped[str] = mapped_column("cronExpression", String, default="0 18 * * 1-5")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    createdAt: Mapped[datetime] = mapped_column(
        "createdAt", PrismaSQLiteDateTime(), nullable=False, default=utc_naive_now
    )
    updatedAt: Mapped[datetime] = mapped_column(
        "updatedAt", PrismaSQLiteDateTime(), nullable=False, default=utc_naive_now, onupdate=utc_naive_now
    )
