import os
from pathlib import Path

from dotenv import load_dotenv

_root = Path(__file__).resolve().parent.parent

# 仅加载 Python 后端目录下的 .env（与 Node backend 隔离）
load_dotenv(_root / ".env")

# 可选：为迁移期兼容，设为 1 时额外加载 backend/.env
if os.getenv("LOAD_LEGACY_BACKEND_DOTENV", "").lower() in ("1", "true", "yes"):
    load_dotenv(_root.parent / "backend" / ".env")

PORT = int(os.getenv("PORT", "3000"))

# 附件根目录：backend_python/data/（物理路径 uploads/<requirementId>/）
_data_dir = (_root / "data").resolve()
BACKEND_CWD = _data_dir

_default_db = _data_dir / "python.db"
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{_default_db.as_posix()}",
)

# 接口回归 Webhook：请求头 X-Api-Key；未设置则拒绝 Webhook
API_REGRESSION_TRIGGER_KEY = os.getenv("API_REGRESSION_TRIGGER_KEY", "").strip()

# 测试报告基础 URL：拼接 HTML 报告链接用，如 http://192.168.x.x:8001/api
REPORT_BASE_URL = os.getenv("REPORT_BASE_URL", "").strip().rstrip("/")

# TAPD 缺陷日报
# 方式一：Basic Auth（API 账号 + 口令）
TAPD_API_USER = os.getenv("TAPD_API_USER", "").strip()
TAPD_API_PASSWORD = os.getenv("TAPD_API_PASSWORD", "").strip()
# 方式二：个人访问令牌（PAT），优先使用
TAPD_ACCESS_TOKEN = os.getenv("TAPD_ACCESS_TOKEN", "").strip()
TAPD_WORKSPACE_ID = os.getenv("TAPD_WORKSPACE_ID", "").strip()
BUG_REPORT_CRON = os.getenv("BUG_REPORT_CRON", "0 18 * * 1-5").strip()
