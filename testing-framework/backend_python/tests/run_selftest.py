"""
后端自检：不启动独立进程，使用 FastAPI TestClient 直连路由。
运行：在 backend_python 目录下执行  python tests/run_selftest.py
"""

from __future__ import annotations

import json
import sys
import traceback
from pathlib import Path

# 保证可导入 app
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))


def main() -> int:
    errors: list[str] = []

    def check(name: str, fn) -> None:
        try:
            fn()
            print(f"[OK] {name}")
        except Exception as e:
            errors.append(f"{name}: {e}")
            print(f"[FAIL] {name}: {e}")
            traceback.print_exc()

    # 1) 导入
    def t_import():
        from app.main import app  # noqa: F401
        from app.database import SessionLocal
        from app.models import Requirement, TestCase
        from app.models_api import ApiEnvironment

        db = SessionLocal()
        try:
            db.query(Requirement).limit(1).all()
            db.query(TestCase).limit(1).all()
            db.query(ApiEnvironment).limit(1).all()
        finally:
            db.close()

    check("import + ORM 读库", t_import)

    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)

    # 2) health
    def t_health():
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json().get("ok") is True

    check("GET /health", t_health)

    # 3) stats
    def t_stats():
        r = client.get("/api/stats")
        assert r.status_code == 200
        j = r.json()
        assert "requirements" in j and "testCases" in j
        assert isinstance(j["requirements"], int)

    check("GET /api/stats", t_stats)

    # 4) requirements list
    def t_req_list():
        r = client.get("/api/requirements")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        for row in data:
            assert "id" in row and "title" in row
            assert "testCaseCount" in row or "_count" in row

    check("GET /api/requirements", t_req_list)

    created_req_id: str | None = None

    # 5) create requirement
    def t_req_create():
        nonlocal created_req_id
        r = client.post("/api/requirements", json={"title": "__selftest__", "content": "x"})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("title") == "__selftest__"
        created_req_id = j["id"]

    check("POST /api/requirements", t_req_create)

    # 6) get one + test-cases filter
    def t_req_get_and_cases():
        assert created_req_id
        r = client.get(f"/api/requirements/{created_req_id}")
        assert r.status_code == 200, r.text
        assert r.json()["id"] == created_req_id

        r2 = client.get("/api/test-cases", params={"requirementId": created_req_id})
        assert r2.status_code == 200
        assert isinstance(r2.json(), list)

    check("GET /api/requirements/{id} + GET /api/test-cases?requirementId=", t_req_get_and_cases)

    # 7) create test case
    tc_id: str | None = None

    def t_tc_create():
        nonlocal tc_id
        assert created_req_id
        r = client.post(
            "/api/test-cases",
            json={
                "requirementId": created_req_id,
                "caseId": "TC-SELF-001",
                "title": "自检用例",
                "priority": "P2",
                "featurePointL1": "自检",
                "featurePoint": "模块",
                "preconditions": "",
                "steps": "1. 步骤",
                "expected": "通过",
                "validationPoints": "可见",
            },
        )
        assert r.status_code == 200, r.text
        tc_id = r.json()["id"]

    check("POST /api/test-cases", t_tc_create)

    # 8) export 400
    def t_export_400():
        r = client.post("/api/export/xmind", json={})
        assert r.status_code == 400

    check("POST /api/export/xmind (无参数 -> 400)", t_export_400)

    # 9) export txt
    def t_export_txt():
        assert tc_id
        r = client.post("/api/export/xmind", json={"testCaseIds": [tc_id], "format": "txt"})
        assert r.status_code == 200, r.text
        assert "TC-SELF-001" in r.text or "自检用例" in r.text

    check("POST /api/export/xmind (txt)", t_export_txt)

    # 10) batch-delete + delete requirement
    def t_cleanup():
        assert tc_id and created_req_id
        r = client.post("/api/test-cases/batch-delete", json={"ids": [tc_id]})
        assert r.status_code == 200
        assert r.json().get("deleted", 0) >= 1

        r2 = client.delete(f"/api/requirements/{created_req_id}")
        assert r2.status_code == 204

    check("POST batch-delete + DELETE requirement", t_cleanup)

    # 11) generate job 404
    def t_gen_404():
        r = client.get("/api/generate/test-cases/status/00000000-0000-0000-0000-000000000000")
        assert r.status_code == 404

    check("GET /generate/test-cases/status (无效 job -> 404)", t_gen_404)

    # 12) generate start -> 503 或 200（视 .env）
    def t_gen_start():
        r = client.post(
            "/api/generate/test-cases",
            json={"requirementId": "nonexistent-id-xxx"},
        )
        assert r.status_code in (200, 503), r.text
        if r.status_code == 200:
            assert "jobId" in r.json()
        # 不等待任务完成，避免调用真实 LLM

    check("POST /generate/test-cases (503 未配 LLM 或 200)", t_gen_start)

    api_env_id: str | None = None
    api_col_id: str | None = None

    # 13) 接口回归：环境 + 集合 + 运行（依赖外网 httpbin，失败则仅校验结构）
    def t_api_regression_run():
        nonlocal api_env_id, api_col_id
        r = client.post(
            "/api/api-regression/environments",
            json={"name": "__selftest_api__", "baseUrl": "https://httpbin.org"},
        )
        assert r.status_code == 200, r.text
        api_env_id = r.json()["id"]
        definition = {
            "steps": [
                {
                    "name": "status200",
                    "protocol": "http",
                    "priority": "P1",
                    "includeInSubset": True,
                    "request": {"method": "GET", "path": "/status/200"},
                    "assert": [{"type": "status", "equals": 200}],
                }
            ]
        }
        r2 = client.post(
            "/api/api-regression/collections",
            json={"name": "__selftest_col__", "definition": json.dumps(definition, ensure_ascii=False)},
        )
        assert r2.status_code == 200, r2.text
        api_col_id = r2.json()["id"]
        r3 = client.post(
            "/api/api-regression/runs",
            json={
                "environmentId": api_env_id,
                "collectionId": api_col_id,
                "regressionMode": "full",
                "triggeredBy": "selftest",
            },
        )
        assert r3.status_code == 200, r3.text
        run_j = r3.json()
        assert run_j["id"]
        assert run_j["status"] in ("PASSED", "FAILED")
        assert run_j.get("environmentName")
        assert run_j.get("baseUrlSnapshot")
        assert isinstance(run_j.get("steps"), list)
        assert run_j["steps"], "应有步骤结果"
        st0 = run_j["steps"][0]
        assert "assertionResults" in st0
        if run_j["status"] == "PASSED":
            assert st0.get("passed") is True

        r4 = client.get(f"/api/api-regression/runs/{run_j['id']}/report", params={"format": "md"})
        assert r4.status_code == 200
        assert "接口回归报告" in r4.text or "Run ID" in r4.text

    check("POST api-regression 环境/集合/运行 + 报告", t_api_regression_run)

    # 14) 清理接口回归自检数据
    def t_api_regression_cleanup():
        assert api_col_id and api_env_id
        client.delete(f"/api/api-regression/collections/{api_col_id}")
        client.delete(f"/api/api-regression/environments/{api_env_id}")

    check("DELETE api-regression 自检数据", t_api_regression_cleanup)

    if errors:
        print(f"\n共 {len(errors)} 项失败")
        return 1
    print("\n全部自检通过")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
