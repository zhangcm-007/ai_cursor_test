from __future__ import annotations

import os
import threading
import time
import uuid
from typing import Any, TypedDict

from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.database import SessionLocal
from app.services import llm_client
from app.services.generate_service import generate_test_cases

router = APIRouter(prefix="/generate", tags=["generate"])


class JobState(TypedDict, total=False):
    status: str
    result: dict[str, Any]
    error: str
    createdAt: float


test_cases_jobs: dict[str, JobState] = {}
_jobs_lock = threading.Lock()


def _run_generate_job(
    job_id: str,
    requirement_id: str,
    dev_code: str | None,
    dev_code_files: list[dict[str, str]] | None,
    dev_code_ref: dict[str, Any] | None,
) -> None:
    db = SessionLocal()
    try:
        with _jobs_lock:
            j = test_cases_jobs.get(job_id)
            if j:
                j["status"] = "running"
        print(f"[generate] 任务开始执行 jobId={job_id}")
        result = generate_test_cases(
            db,
            requirement_id,
            dev_code=dev_code,
            dev_code_files=dev_code_files,
            dev_code_ref=dev_code_ref,
        )
        with _jobs_lock:
            j = test_cases_jobs.get(job_id)
            if j:
                j["status"] = "completed"
                j["result"] = result
        print(f"[generate] 任务完成 jobId={job_id} created={result.get('created')}")
    except Exception as e:
        msg = str(e)
        with _jobs_lock:
            j = test_cases_jobs.get(job_id)
            if j:
                j["status"] = "failed"
                j["error"] = msg
        print(f"[generate] 任务失败 jobId={job_id} error={msg}")
    finally:
        db.close()


@router.post("/test-cases")
def start_test_cases_generation(
    body: dict,
    background_tasks: BackgroundTasks,
):
    if not llm_client.is_configured():
        has_dify_base = bool(
            os.getenv("DIFY_API_BASE") or os.getenv("DIFY_BASE_URL") or os.getenv("DIFY_BASE")
        )
        has_llm_base = bool(os.getenv("LLM_BASE_URL") or os.getenv("LLM_BASE_BASE"))
        hint = (
            "当前仅配置了 LLM_API_KEY。请补全：用 Dify 时在 .env 中设置 DIFY_API_BASE 与 DIFY_API_KEY；用公司大模型时设置 LLM_BASE_URL。参见 .env.example。"
            if os.getenv("LLM_API_KEY") and not has_llm_base and not has_dify_base
            else "LLM not configured. 请在 .env 中配置 Dify（DIFY_API_BASE + DIFY_API_KEY）或公司大模型（LLM_BASE_URL + LLM_API_KEY）或 Claude（ANTHROPIC_API_KEY），参见 .env.example。"
        )
        raise HTTPException(status_code=503, detail=hint)

    requirement_id = body.get("requirementId")
    if not requirement_id:
        raise HTTPException(status_code=400, detail="requirementId is required")

    job_id = str(uuid.uuid4())
    with _jobs_lock:
        test_cases_jobs[job_id] = {"status": "pending", "createdAt": time.time() * 1000}

    dev_code = body.get("devCode")
    dev_code_s = dev_code.strip() if isinstance(dev_code, str) else None
    dev_code_files = body.get("devCodeFiles") if isinstance(body.get("devCodeFiles"), list) else None
    dev_code_ref_raw = body.get("devCodeRef")
    dev_code_ref = None
    if isinstance(dev_code_ref_raw, dict) and isinstance(dev_code_ref_raw.get("commit"), str):
        dev_code_ref = {
            "commit": dev_code_ref_raw["commit"],
            "paths": dev_code_ref_raw["paths"]
            if isinstance(dev_code_ref_raw.get("paths"), list)
            else None,
        }

    dev_code_len = len(dev_code_s or "")
    files_count = len(dev_code_files or [])
    has_ref = bool(dev_code_ref and (dev_code_ref.get("commit") or "").strip())
    print(
        f"[generate] 收到请求 jobId={job_id} requirementId={requirement_id} "
        f"devCode长度={dev_code_len} devCodeFiles数={files_count} devCodeRef={'有' if has_ref else '无'}"
    )
    if has_ref:
        print(
            f'[generate] devCodeRef 参数: commit="{dev_code_ref["commit"]}" '
            f'paths={dev_code_ref.get("paths") or []}'
        )

    background_tasks.add_task(
        _run_generate_job,
        job_id,
        requirement_id,
        dev_code_s,
        dev_code_files,
        dev_code_ref,
    )
    return {"jobId": job_id}


@router.get("/test-cases/status/{job_id}")
def test_cases_status(job_id: str):
    with _jobs_lock:
        job = test_cases_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    payload: dict[str, Any] = {"status": job["status"]}
    if job["status"] == "completed" and job.get("result") is not None:
        payload["result"] = job["result"]
    if job["status"] == "failed" and job.get("error"):
        payload["error"] = job["error"]
    return payload
