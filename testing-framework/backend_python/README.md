# Python 后端（FastAPI）

与 Node/Express 版 **API 路径与行为对齐**，但 **数据库、`.env`、附件目录与 Node 完全隔离**：

| 项目 | Python（本目录） | Node（`backend/`） |
|------|------------------|---------------------|
| SQLite | `data/python.db` | `prisma/dev.db` |
| Prisma schema | `prisma/schema.prisma` | `backend/prisma/schema.prisma` |
| 环境变量 | 默认仅 `backend_python/.env` | `backend/.env` |
| 附件文件 | `data/uploads/<requirementId>/` | `backend/uploads/` |

迁移旧数据：若曾共用 `backend/prisma/dev.db`，需自行用 SQLite 工具导出/导入到 `data/python.db`，或接受新库从零开始。

**接口回归**：`/api/api-regression/*`，说明见 [docs/API_REGRESSION.md](../docs/API_REGRESSION.md)。

## 环境

- Python 3.9+（推荐 3.10+）
- `pip install -r requirements.txt`
- 初始化表结构需 **Prisma CLI**：`npm install`（本目录 `package.json`）

## 数据库

```bash
cd backend_python
npm install
npm run db:push
```

## 自检

```bash
python tests/run_selftest.py
```

含健康检查、需求/用例、导出、生成占位、接口回归（需可访问 `https://httpbin.org`）。

## 运行

```bash
set PORT=3001
uvicorn app.main:app --reload --host 0.0.0.0 --port 3001
```

前端 `vite` 将 `/api` 代理到 **3001** 时请使用本进程。

## 配置

- **`backend_python/.env`**：`DATABASE_URL`（可选）、`API_REGRESSION_TRIGGER_KEY`、`DEV_CODE_REPO_PATH` 等。
- **`LOAD_LEGACY_BACKEND_DOTENV=1`**：额外加载 `backend/.env`（仅迁移兼容，不推荐长期开启）。
- `DATABASE_URL` 未设置时默认：`sqlite:///.../backend_python/data/python.db`。

## 与 Prisma / SQLite

`DateTime` 在 SQLite 中为 **INTEGER（UTC 毫秒）**；`app/db_types.py` 中 `PrismaSQLiteDateTime` 与 Prisma 写入格式一致。

## 与 Node 版的差异

- 生成任务使用内存 `jobId`（多 worker 不共享）。
- 大 JSON / multipart 可按需调中间件或反向代理限制。



## 后台运行命令，进到backend_python目录下
- python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
## 前端运行命令 进到D:\ai_code\testing-framework\frontend目录下
- npm run dev