from __future__ import annotations

import threading
import time
import uuid
from typing import Any, TypedDict

from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.services.modao_service import extract_modao_prototype

router = APIRouter(prefix="/modao", tags=["modao"])


class ModaoJobState(TypedDict, total=False):
    status: str
    result: dict[str, Any]
    error: str
    createdAt: float


_jobs: dict[str, ModaoJobState] = {}
_jobs_lock = threading.Lock()
_running_count = 0
_MAX_CONCURRENT = 1


def _run_extract_job(job_id: str, url: str, password: str) -> None:
    global _running_count
    with _jobs_lock:
        j = _jobs.get(job_id)
        if j:
            j["status"] = "running"
        _running_count += 1

    print(f"[modao] 任务开始执行 jobId={job_id}")
    try:
        result = extract_modao_prototype(url, password)
        with _jobs_lock:
            j = _jobs.get(job_id)
            if j:
                j["status"] = "completed"
                j["result"] = result.to_dict()
        print(f"[modao] 任务完成 jobId={job_id} pages={len(result.pages)}")
    except Exception as e:
        msg = str(e)
        with _jobs_lock:
            j = _jobs.get(job_id)
            if j:
                j["status"] = "failed"
                j["error"] = msg
        print(f"[modao] 任务失败 jobId={job_id} error={msg}")
    finally:
        with _jobs_lock:
            _running_count -= 1


@router.post("/extract")
def start_extract(body: dict, background_tasks: BackgroundTasks):
    global _running_count

    url = body.get("url")
    password = body.get("password")

    if not url or not isinstance(url, str):
        raise HTTPException(status_code=400, detail="url is required")
    if not password or not isinstance(password, str):
        raise HTTPException(status_code=400, detail="password is required")

    with _jobs_lock:
        if _running_count >= _MAX_CONCURRENT:
            raise HTTPException(status_code=429, detail="当前已有提取任务在运行，请稍后再试")

    job_id = str(uuid.uuid4())
    with _jobs_lock:
        _jobs[job_id] = {"status": "pending", "createdAt": time.time() * 1000}

    print(f"[modao] 收到提取请求 jobId={job_id} url={url}")

    background_tasks.add_task(_run_extract_job, job_id, url, password)
    return {"jobId": job_id}


@router.get("/extract/status/{job_id}")
def extract_status(job_id: str):
    with _jobs_lock:
        job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    payload: dict[str, Any] = {"status": job["status"]}
    if job["status"] == "completed" and job.get("result") is not None:
        payload["result"] = job["result"]
    if job["status"] == "failed" and job.get("error"):
        payload["error"] = job["error"]
    return payload
