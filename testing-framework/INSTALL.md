# 测试平台 - 安装部署指南

## 环境要求

| 工具 | 版本要求 | 用途 |
|------|---------|------|
| **Node.js** | >= 18 | 前端构建、Prisma CLI |
| **npm** | >= 9（随 Node.js 安装） | 包管理 |
| **Python** | >= 3.10 | 后端运行 |
| **pip** | 随 Python 安装 | Python 包管理 |
| **Git** | 任意版本 | 拉取代码 |

## 一键安装步骤

### 1. 克隆代码

```bash
git clone git@github.com:zhangcm-007/ai_cursor_test.git
cd ai_code/testing-framework
```

### 2. 安装后端（Python）

后端 Python 依赖清单（`requirements.txt` 中已包含，无需手动逐个安装）：

| 包名 | 用途 |
|------|------|
| fastapi | Web 框架 |
| uvicorn | ASGI 服务器 |
| sqlalchemy | ORM 数据库操作 |
| python-dotenv | 读取 .env 环境变量 |
| httpx | HTTP 客户端（接口调试/回归） |
| jsonpath-ng | JSONPath 断言 |
| apscheduler | 定时任务调度 |
| python-multipart | 文件上传 |
| pypdf | PDF 解析 |
| python-docx | Word 文档解析 |
| playwright | 浏览器自动化（墨刀原型提取） |

```bash
cd backend_python

# 安装 Python 依赖（上表所有包一键安装）
pip install -r requirements.txt

# 安装 Prisma CLI（用于初始化数据库）
npm install

# 初始化数据库（自动创建 data/python.db）
npm run db:push

cd ..
```

### 3. 配置后端环境变量

复制环境变量模板并填写：

```bash
cd backend_python
cp ../backend/.env.example .env
```

编辑 `backend_python/.env`，至少配置一种大模型（用于生成测试用例）：

```env
# 方式一：Dify 平台（推荐）
DIFY_API_BASE=https://your-dify.company.com/v1
DIFY_API_KEY=app-xxxx

# 方式二：OpenAI 兼容接口
# LLM_BASE_URL=https://your-llm.company.com/v1
# LLM_API_KEY=your-key

# 方式三：Claude
# ANTHROPIC_API_KEY=sk-ant-xxx
```

> 不配置大模型也能正常使用接口回归测试功能，只是无法自动生成测试用例。

### 4. 安装前端

```bash
cd frontend

# 安装前端依赖
npm install

cd ..
```

### 5. 启动服务

打开两个终端窗口，分别启动：

**终端 1 - 启动后端：**

```bash
cd backend_python
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**终端 2 - 启动前端：**

```bash
cd frontend
npm run dev
```

### 6. 访问

- **本机访问**：http://localhost:5173
- **局域网访问**：http://你的IP:5173（同事电脑使用）

---

## 快速命令速查

```bash
# === 完整安装（首次使用，从项目根目录执行） ===
cd backend_python && pip install -r requirements.txt && npm install && npm run db:push && cd ..
cd frontend && npm install && cd ..

# === 启动后端 ===
cd backend_python
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# === 启动前端（另一个终端） ===
cd frontend
npm run dev
```

---

## 目录结构

```
testing-framework/
├── backend_python/          # Python 后端（FastAPI）
│   ├── app/                 # 应用代码
│   │   ├── main.py          # 入口
│   │   ├── config.py        # 配置
│   │   ├── database.py      # 数据库连接
│   │   ├── models.py        # 数据模型
│   │   ├── routers/         # API 路由
│   │   └── services/        # 业务逻辑
│   ├── data/                # 数据目录（SQLite + 上传文件）
│   ├── prisma/              # 数据库 Schema
│   ├── requirements.txt     # Python 依赖
│   ├── package.json         # Prisma CLI 依赖
│   └── .env                 # 环境变量（需自行创建）
├── frontend/                # React 前端
│   ├── src/
│   │   ├── pages/           # 页面组件
│   │   ├── components/      # 通用组件
│   │   ├── api/             # API 调用
│   │   └── utils/           # 工具函数
│   ├── package.json         # 前端依赖
│   └── vite.config.ts       # Vite 配置
└── docs/                    # 文档
```

---

## 常见问题

### Q: 后端启动报 `ModuleNotFoundError`
A: 确认已执行 `pip install -r requirements.txt`，且使用的是正确的 Python 环境。

### Q: 前端启动报端口被占用
A: 默认端口 5173，如被占用 Vite 会自动换到 5174。也可指定端口：
```bash
set VITE_DEV_PORT=3000
npm run dev
```

### Q: 数据库初始化报错
A: 确认已在 `backend_python` 目录下执行过 `npm install`（安装 Prisma CLI），然后再执行 `npm run db:push`。

### Q: 同事访问不了我的服务
A: 检查以下几点：
1. 后端启动时用了 `--host 0.0.0.0`
2. 前端 `vite.config.ts` 中有 `host: "0.0.0.0"`
3. Windows 防火墙放行了 5173 和 8000 端口：
   ```powershell
   # 管理员 PowerShell 执行
   netsh advfirewall firewall add rule name="TestPlatform-Frontend" dir=in action=allow protocol=tcp localport=5173
   netsh advfirewall firewall add rule name="TestPlatform-Backend" dir=in action=allow protocol=tcp localport=8000
   ```

### Q: 接口回归测试中密码如何自动加密
A: 在环境变量中，变量名以 `Pwd` 结尾（如 `rawPwd`），值填明文密码。引用 `{{rawPwd}}` 时会自动进行 AiWealth 密码加密。
