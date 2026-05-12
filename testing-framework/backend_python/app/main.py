from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import BACKEND_CWD
from app.routers import api_regression, attachments, export, generate, modao, requirements, stats, tapd_bug, test_cases

_scheduler: BackgroundScheduler | None = None


def _ensure_data_dirs() -> None:
    Path(BACKEND_CWD).mkdir(parents=True, exist_ok=True)
    (Path(BACKEND_CWD) / "uploads").mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _scheduler
    _ensure_data_dirs()
    _scheduler = BackgroundScheduler()
    api_regression.register_scheduled_jobs(_scheduler)
    tapd_bug.register_tapd_bug_jobs(_scheduler)
    _scheduler.start()
    yield
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None


app = FastAPI(title="Testing Framework API (Python)", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(requirements.router, prefix="/api")
app.include_router(test_cases.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(generate.router, prefix="/api")
app.include_router(attachments.router, prefix="/api")
app.include_router(api_regression.router, prefix="/api")
app.include_router(tapd_bug.router, prefix="/api")
app.include_router(modao.router, prefix="/api")


@app.get("/health")
def health():
    return {"ok": True}
