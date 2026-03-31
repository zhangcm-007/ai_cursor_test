# 接口回归测试（Python FastAPI）

## 栈与数据

- **实现**：仅 [backend_python](../backend_python/)（FastAPI + SQLAlchemy + httpx + [jsonpath-ng](https://github.com/h2non/jsonpath-ng)）。
- **数据库（与 Node 隔离）**：DDL 与 SQLite 文件在 **Python 侧**，[backend_python/prisma/schema.prisma](../backend_python/prisma/schema.prisma)，默认库文件 **`backend_python/data/python.db`**。改表后执行：`cd backend_python && npm install && npm run db:push`（需 Node 仅用于 Prisma CLI）。
- **Node** 使用 [backend/prisma/schema.prisma](../backend/prisma/schema.prisma) 与 **`backend/prisma/dev.db`**（仅需求/用例/附件元数据等），**不含**接口回归相关表。

## 阶段能力（路线图）

| 阶段 | 内容 |
|------|------|
| 一期 | HTTP(S) 顺序执行、环境多 baseUrl、集合 JSON、报告、Webhook、定时（APScheduler）、接口清单与模板生成 |
| 二期 | SSE、WebRTC（专项） |
| 三期 | YApi 同步 |
| 四期 | 并发步骤、压测（LoadRun） |

## 本地联调

1. 初始化 Python 库：`cd backend_python && npm install && npm run db:push`
2. Python 依赖：`pip install -r requirements.txt`
3. 配置：在 **`backend_python/.env`** 写密钥等（默认**不再**读取 `backend/.env`；迁移期可设 `LOAD_LEGACY_BACKEND_DOTENV=1`）。
4. 启动：`set PORT=3001` 后 `uvicorn app.main:app --reload --host 0.0.0.0 --port 3001`
5. 前端 [vite.config.ts](../frontend/vite.config.ts) 将 `/api` 代理到 **3001**（与 Python 一致）。

## 变量合并优先级（`{{name}}`）

1. 集合步骤执行过程中的 **extract** 写入上下文（覆盖同名）
2. **`POST /runs` 的 `runVariables`**（覆盖环境同名键）
3. **环境 `variables` JSON**
4. 占位符仍缺省时读 **进程环境变量** `os.environ`

**串联展开**：对每一段文本会**多轮**替换（至多 16 次，直至不再变化）。因此运行变量 `email` 填 `{{$randEmail|qq.com}}`、Body 里写 `{{email}}` 时，会先展开为内置语法再生成随机邮箱；也可在 Body 中直接写 `{{$randEmail|qq.com}}`。

### 内置动态占位（`{{$...}}`，每次替换时即时计算）

与 `{{myVar}}` 不同：以 **`$`** 开头，**不**从环境 / 运行变量里取，由执行器生成。

| 占位符 | 含义 |
|--------|------|
| `{{$uuid}}` | UUID v4 |
| `{{$timestampMs}}` | 当前毫秒时间戳 |
| `{{$timestamp}}` | 当前秒时间戳 |
| `{{$randInt}}` | 0～999999 随机整数 |
| `{{$randInt|…}}` | 区间内随机整数：两段数字用竖线分隔，如 ``{{$randInt|100000|999999}}`` |
| `{{$randEmail}}` | `test` + 随机 6 位数字 + `@example.com` |
| `{{$randEmail|…}}` | 同上，竖线后为域名，如 ``{{$randEmail|qq.com}}`` |

**注册邮箱示例**

- **固定邮箱**：`"email": "159@qq.com"` 或运行变量 `{"email":"159@qq.com"}` + `"email": "{{email}}"`（须合法 JSON，占位符加引号）。
- **每次随机邮箱**：`"email": "{{$randEmail|qq.com}}"`。
- **按时间唯一**：`"email": "u{{$timestampMs}}@qq.com"`。

**「每次加 1」**：当前未做持久化序号。可用 **CI 传入** `runVariables` 如 `{"n": "7"}`，body 里 `"user{{n}}@qq.com"`；或用 **`{{$timestampMs}}`** 保证唯一。若需要平台内自增序列（`{{$seq:名称}}`），需后续加库存储。

## `definition` 步骤结构（一期 HTTP）

```json
{
  "steps": [
    {
      "name": "示例",
      "protocol": "http",
      "priority": "P1",
      "includeInSubset": true,
      "request": {
        "method": "GET",
        "path": "/api/health",
        "headers": {},
        "json": {}
      },
      "extract": {
        "token": "$.data.token"
      },
      "assert": [
        { "type": "status", "equals": 200 },
        { "type": "jsonpath_exists", "path": "$.data" },
        { "type": "jsonpath_equals", "path": "$.code", "equals": 0 },
        { "type": "header_contains", "name": "content-type", "contains": "json" },
        { "type": "body_contains", "contains": "ok" }
      ]
    }
  ]
}
```

- **JSONPath**：与 **jsonpath-ng** 语法一致（如 `$.data.token`）。
- **`regressionMode: subset`**：保留 `priority == "P1"` 或 `includeInSubset == true` 的步骤。
- **一期**：`protocol` 为 `sse` / `webrtc` 的步骤会失败并提示二期支持。

## Webhook 触发

1. 环境变量 `API_REGRESSION_TRIGGER_KEY` 非空时启用。
2. `POST /api/api-regression/trigger/webhook`，头 `X-Api-Key: <同上>`，JSON body 与 `POST /api/api-regression/runs` 相同（如 `environmentId`、`collectionId`、`regressionMode`）。

CI 示例：

```bash
curl -sS -X POST "http://127.0.0.1:3001/api/api-regression/trigger/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: $API_REGRESSION_TRIGGER_KEY" \
  -d '{"environmentId":"<env>","collectionId":"<col>","regressionMode":"full"}'
```

## 定时任务

- `POST /api/api-regression/schedules`，Cron **五段**：`分 时 日 月 周`（与 APScheduler 一致）。
- 须绑定 `environmentId`、`collectionId`、`regressionMode`。
- **多 uvicorn worker** 时，每个进程各有一份调度器，可能**重复触发**；一期建议单 worker 或独立 scheduler 进程。

## 安全与运维

- 勿在库中明文存生产密码；优先登录步骤 + 环境变量注入。
- 响应与请求体会**脱敏、截断**后入库。
- 单 Run 默认**遇错即停**；整次与单步**超时**见 Runner 常量。

## API 前缀

所有路由位于 **`/api/api-regression/`** 下（见 `app/routers/api_regression.py`）。
