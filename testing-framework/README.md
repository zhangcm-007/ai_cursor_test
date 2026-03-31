# 测试平台（前后端）

## 一键开发

在 **`testing-framework`** 根目录：

```bash
npm install
cd backend && npm install && cd ../frontend && npm install && cd ..
npm run dev
```

- **API**：`http://localhost:3001`（避免与常见 3000 端口冲突）
- **前端**：默认 `http://localhost:5173`；若 5173 被占用，Vite 会自动顺延（5174、5175…）

### 若必须打开 `http://localhost:3000`

1. 先释放本机占用的 **3000** 端口  
2. 执行：`npm run dev:web3000`（前端固定 3000，仍代理 API 到 3001）

### 控制台自检（Playwright）

先保持 `npm run dev` 运行，再在根目录：

```bash
npm run dev:capture
```

脚本会探测 **5173–5190** 上的 Vite 并访问主要路由；若端口不固定，可指定：

```bash
set BASE_URL=http://127.0.0.1:5174
npm run dev:capture
```

## 说明

- 仅启动 **frontend** 的 `npm run dev` 时，需自行启动后端，且请在 `frontend/vite.config.ts` 中保持 `/api` 代理与后端端口一致（默认 **3001**）。

### Node 与 Python 后端（已隔离）

- **Node**（`backend/`）：`prisma/dev.db`，需求/用例等；`cd backend && npx prisma db push`。
- **Python**（`backend_python/`）：`data/python.db`，含需求/用例与接口回归等；`cd backend_python && npm install && npm run db:push`。环境变量默认只读 **`backend_python/.env`**。
- 详见 [backend_python/README.md](backend_python/README.md)、[docs/API_REGRESSION.md](docs/API_REGRESSION.md)。
