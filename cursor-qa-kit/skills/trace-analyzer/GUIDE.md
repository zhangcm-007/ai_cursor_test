# 全链路追踪分析器 - 使用指导说明书

## 一、简介

**Trace Analyzer** 是一个 AI Coding Skill，用于通过 `traceId` 追踪分布式系统的全链路调用日志，自动生成可视化的 Mermaid 时序图和结构化的 Markdown 分析报告。

本 Skill 不绑定特定 AI 工具，可在 Cursor、Claude Code、Codex、OpenClaw 等任何支持 Skill/Agent 的 AI 编程工具中使用。

> **路径约定**：本文档中 `$SKILL_HOME` 代表 trace-analyzer 的安装根目录（即本文件所在目录）。不同工具的安装位置不同，常见如：
> - Cursor: `~/.cursor/skills/trace-analyzer`
> - Claude Code: `~/.claude/skills/trace-analyzer`
> - Codex: `~/.codex/skills/trace-analyzer`
> - 也可放在任意自定义目录下

### 核心能力

| 能力 | 说明 |
|------|------|
| 全链路日志追踪 | 通过 traceId 从 ELK 查询全部相关日志，按时间排序 |
| Mermaid 时序图 | 自动识别服务间调用关系，生成序列图 |
| 调用链路概述 | 提取关键事件（工具调用、Dubbo RPC、Agent 生命周期等）形成时间线 |
| 错误智能分析 | 自动分组错误、识别重试、给出可能原因及修复建议 |
| 数据库查询 | 支持 MongoDB / MySQL / SQL Server 只读查询 |
| GitLab 源码搜索 | 按类名/方法名搜索代码，查看文件内容 |
| 多环境支持 | dev / test 独立配置，通过 `--env` 切换 |
| Markdown 报告 | 自动输出 `.md` 文件到指定目录 |

---

## 二、安装与配置

### 2.1 前置条件

- **Python 3**：确保系统已安装 `python3`
- **网络**：能访问 Kibana、数据库、GitLab（通常需要 VPN）

### 2.2 安装依赖

```bash
pip3 install requests pyyaml pymongo pymysql pymssql
```

> 如果遇到 `externally-managed-environment` 错误，可加 `--break-system-packages` 参数。

### 2.3 配置文件

配置文件位置：`$SKILL_HOME/config.yaml`（与 SKILL.md 同目录）

首次使用，从模板创建：

```bash
cp $SKILL_HOME/config.example.yaml $SKILL_HOME/config.yaml
```

然后编辑 `config.yaml`，填入实际的环境信息。配置分为四个部分：

#### ELK 配置

```yaml
elk:
  environments:
    dev:
      kibana_url: "http://your-kibana.example.com"  # Kibana 地址
      api_path: "/elasticsearch/_msearch"            # API 路径
      query_type: "msearch"                          # 查询类型: msearch 或 search
      kbn_version: "7.3.2"                           # Kibana 版本号
      index_pattern: "logstash-your-app-dev-*"       # 索引模式
      auth:
        type: none                                   # none / basic / token

    test:
      # ... 与 dev 类似，替换 index_pattern 等
```

#### 数据库配置

```yaml
database:
  environments:
    dev:
      mongodb:
        uri: "mongodb://user:pass@host:port/db"
        database: "your-db"
      mysql:
        host: "mysql-host"
        port: 3306
        username: "user"
        password: "pass"
        database: "your_db"
      sqlserver:
        host: "sqlserver-host"
        port: 1433
        username: "user"
        password: "pass"
        database: "your_db"
```

#### GitLab 配置

```yaml
gitlab:
  url: "http://your-gitlab.com"
  token: "your-private-token"          # 建议仅授予 read_api scope
  default_group: "Your-Group"
  branches:
    dev: "dev_merge_all"               # dev 环境对应的分支
    test: "test"                       # test 环境对应的分支
  service_project_map:                 # 日志中服务名 → GitLab 项目路径
    ai-agent: "Group/ai-agent"
    ai-gateway: "Group/ai-gateway"
```

#### 输出配置

```yaml
output:
  directory: "/your/path/to/reports"   # .md 报告的存储目录
```

---

## 三、在 Cursor 中使用

### 3.1 触发方式

在 Cursor 的 AI 聊天中，用**自然语言**描述你的需求即可自动触发该 Skill。无需手动调用命令。

### 3.2 常用提问示例

#### 全链路追踪 — 摘要模式（默认，推荐）

默认只返回精简摘要（概览 + 时序图 + 调用链路概述 + 错误分析），节省 token。完整日志自动保存到 `.md` 文件中。

```
帮我查看 traceId abc123def456 的全链路日志，dev 环境
```

```
追踪这个请求 traceId=69b91d0bc59389f582f57aacb4aeee35，test 环境，查最近 24 小时
```

```
查一下 traceId abc123 的调用链，dev 环境，时间范围 2026-03-17 09:00:00 到 2026-03-17 10:00:00
```

#### 全链路追踪 — 完整模式（需明确要求）

如果你需要在聊天中直接看到**每一条**有序日志，请在提问中明确说明，AI 会加上 `--full` 参数输出完整报告：

```
帮我查看 traceId abc123 的全链路日志，dev 环境，输出完整日志
```

```
追踪 traceId abc123，test 环境，我需要看到每条详细日志
```

```
查全链路 traceId abc123，dev 环境，给我完整的有序日志
```

> **提示**：完整模式会输出所有日志（可能几百条），token 消耗较大。如果只是快速排查问题，推荐使用默认的摘要模式。

#### 关键字搜索日志

```
帮我在 test 环境搜索包含 NullPointerException 的日志
```

```
搜索 dev 环境最近 1 小时包含 "OrderService" 的日志
```

#### 查询数据库

```
查一下 dev 环境 MongoDB llm-conversation 库 chat_message 表中 conversationId 为 xxx 的数据
```

```
在 test 环境的 MySQL 中查询 SELECT * FROM orders WHERE user_id = '123'
```

#### GitLab 源码搜索

```
帮我在 GitLab 搜索 FinancialToolExecutionExceptionProcessor 这个类的源码
```

```
查看 ai-agent 项目中 RetryHelper.java 的源码，dev 环境
```

#### 综合排查

```
追踪 traceId abc123，dev 环境，分析一下错误原因，如果有报错帮我定位一下源码
```

### 3.3 AI 会自动完成的事情

当你提供 traceId 后，AI 会依次：

1. 调用 `trace_query.py` 查询 ELK 日志
2. 生成并保存完整的 `.md` 报告文件
3. 在聊天中展示精简摘要（概览、时序图、链路概述、错误分析）
4. 告知你完整报告的文件路径
5. 如果你要求，还会进一步查数据库或搜索源码

> 如果你在提问中说了"完整日志"、"详细日志"、"每条日志"等字样，AI 会自动切换到完整模式，在聊天中展示全部有序日志。

---

## 四、报告内容说明

### 两种输出模式

| | 摘要模式（默认） | 完整模式（`--full`） |
|---|---|---|
| **触发方式** | 正常提问 | 提问中说"完整日志"/"详细日志" |
| **聊天中展示** | 概览 + 时序图 + 链路概述 + 错误分析 | 以上全部 + 有序日志 + 错误详情 |
| **.md 文件** | 包含全部内容 | 包含全部内容 |
| **Token 消耗** | ~6,000 | ~38,000 |
| **适用场景** | 快速排查、了解调用流程 | 需要逐条审查日志内容 |

### 完整报告包含以下章节：

### 4.1 概览表格

| 项目 | 说明 |
|------|------|
| TraceId | 追踪的链路 ID |
| 环境 | dev / test |
| 日志总数 | 该 traceId 下查到的日志条数 |
| 涉及服务 | 该请求经过的所有微服务 |
| 总耗时 | 首条日志到末条日志的时间跨度 |
| 错误数 | ERROR / FATAL 级别日志数量 |

### 4.2 Mermaid 时序图

自动识别服务间调用关系，生成可视化序列图。支持：
- 服务间调用（实线箭头 `->>`）与返回（虚线箭头 `-->>`）
- ERROR 标记（`⚠️ ERROR` 注释）
- 单服务链路的内部调用展示

### 4.3 调用链路概述

以表格形式提取关键事件的时间线：

| 图标 | 含义 |
|------|------|
| 🚀 | Agent 启动 |
| ✅ | Agent 执行完成 |
| 🔧 | 工具调用开始 |
| 📦 | 工具返回结果 |
| ❌ | 工具执行出错 |
| 📡 | Dubbo RPC 调用（含耗时） |
| 🌐 | HTTP 请求入口 |
| ⏱️ | 请求完成（含总耗时） |
| ⚠️ | ERROR 级别日志 |

### 4.4 错误分析

对所有错误自动进行：
- **分组**：相同类 + 相似消息的错误合并为同一类
- **统计**：出现次数、时间范围
- **重试检测**：同一错误多次出现时提示"可能存在重试机制"
- **根因推断**：根据错误特征给出可能原因及建议

| 错误特征 | 自动推断 |
|----------|----------|
| `Missing required field: xxx` | 上游未传必要字段，检查参数映射 |
| XML/HTML 格式内容 | 模型返回格式不符，需调整 prompt |
| `action.call() error` | 多次重试失败，检查根因 |
| `NullPointerException` | 空指针，检查上游返回值 |
| `Timeout` / `timed out` | 下游响应超时 |
| `Connection refused/reset` | 下游服务不可达 |

### 4.5 有序日志

所有日志按时间排序展示，包含：
- 时间戳、服务名、类名.方法名、日志级别
- 主机名
- 日志消息内容
- 与上一条日志的时间间隔（如 `+985ms`）
- 服务切换处用分割线 `---` 标记

### 4.6 错误详情

所有 ERROR / FATAL 日志的原始信息单独列出，方便快速定位。

---

## 五、命令行参数速查

如需直接在终端运行脚本，以下是完整参数说明。

### 5.1 trace_query.py

```bash
# 基本用法
python3 $SKILL_HOME/scripts/trace_query.py trace \
  --env <ENV> --trace-id "<TRACE_ID>"
```

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--env` | 环境名称 (dev/test) | 必填 |
| `--trace-id` | traceId | 必填 |
| `--time-range` | 最近 N 分钟 | 180 (3 小时) |
| `--time-from` | 起始时间 (`yyyy-MM-dd HH:mm:ss`) | - |
| `--time-to` | 结束时间 | 当前时间 |
| `--size` | 最大日志条数 | 500 |
| `--full` | stdout 输出完整报告（含全量有序日志） | false（默认只输出摘要） |
| `--json` | 输出 JSON 格式 | false |
| `--mermaid-only` | 仅输出 Mermaid 代码 | false |
| `--no-file` | 不保存 .md 文件 | false |
| `--output-dir` | 覆盖输出目录 | 取 config.yaml |

```bash
# 关键字搜索
python3 $SKILL_HOME/scripts/trace_query.py search \
  --env <ENV> --keyword "<KEYWORD>" [--time-range 60]
```

### 5.2 db_query.py

```bash
# MongoDB
python3 $SKILL_HOME/scripts/db_query.py \
  --env <ENV> --db-type mongodb \
  --database <DB> --collection <COLL> \
  --query '{"field": "value"}' [--limit 10]

# MySQL
python3 $SKILL_HOME/scripts/db_query.py \
  --env <ENV> --db-type mysql \
  --sql "SELECT * FROM table WHERE id = 'xxx'" [--limit 10]

# SQL Server
python3 $SKILL_HOME/scripts/db_query.py \
  --env <ENV> --db-type sqlserver \
  --sql "SELECT TOP 10 * FROM table WHERE id = 'xxx'"
```

### 5.3 gitlab_api.py

```bash
# 搜索代码
python3 $SKILL_HOME/scripts/gitlab_api.py search \
  --keyword "ClassName" [--project "group/project"]

# 查看文件
python3 $SKILL_HOME/scripts/gitlab_api.py file \
  --project "group/project" --path "src/.../File.java" [--env dev]

# 服务名 → 项目映射
python3 $SKILL_HOME/scripts/gitlab_api.py service --name "ai-agent"

# 列出项目
python3 $SKILL_HOME/scripts/gitlab_api.py projects --search "ai-"
```

---

## 六、安全机制

本 Skill 在脚本层面强制执行了严格的只读限制，无法绕过：

### 数据库

- **允许**：`SELECT`、`SHOW`、`DESCRIBE`、`EXPLAIN`、`WITH` 开头的语句
- **禁止**：`INSERT`、`UPDATE`、`DELETE`、`DROP`、`ALTER`、`TRUNCATE`、`CREATE`、`EXEC`、`GRANT`、`REVOKE` 等
- MongoDB 仅使用 `find()` 查询
- 违规 SQL 在发送到数据库前即被拦截

### GitLab

- 仅使用 `GET` 请求（搜索、查看文件、列出项目）
- 禁止任何写操作（push、commit、merge、delete 等）
- 建议 Token 仅授予 `read_api` scope

---

## 七、常见问题 (FAQ)

### Q1: 查不到日志，提示"未找到 traceId"

**可能原因**：
1. traceId 输入错误 → 核对 traceId 是否正确
2. 默认时间范围（3 小时）不够 → 加 `--time-range 1440`（24 小时）或指定 `--time-from/--time-to`
3. 环境选错了 → 确认是 dev 还是 test
4. 日志已过期被清理 → ES 索引通常有保留策略，过老的日志可能已删除

### Q2: 连接 Kibana/数据库失败

**排查步骤**：
1. 确认 VPN 已连接
2. 检查 `config.yaml` 中的地址、端口是否正确
3. 用 `curl` 或 `ping` 测试网络连通性
4. 检查认证信息是否正确

### Q3: GitLab 返回 401

Token 过期或权限不足：
1. 到 GitLab → Settings → Access Tokens 重新生成
2. 确保 Scope 包含 `read_api`
3. 更新 `config.yaml` 中的 `gitlab.token`

### Q4: 报告中 data-query-service 的日志消息为空

某些服务的日志字段映射可能不同，`message` 字段为空。这不影响链路分析，时序图和调用链路概述仍会正常生成。

### Q5: 如何添加新的环境（如 prod）

在 `config.yaml` 中的 `elk.environments`、`database.environments` 下新增环境配置即可：

```yaml
elk:
  environments:
    prod:
      kibana_url: "http://prod-kibana.example.com"
      index_pattern: "logstash-your-app-prod-*"
      # ...
```

然后使用 `--env prod` 即可查询。

### Q6: 报告保存在哪里？

默认保存在 `config.yaml` 中 `output.directory` 配置的目录下。文件名格式：

```
trace_<env>_<traceId前12位>_<时间戳>.md
```

例如：`trace_dev_69b91d0bc593_20260317_182414.md`

---

## 八、目录结构

```
$SKILL_HOME/                 # trace-analyzer 安装根目录
├── SKILL.md                 # Skill 定义文件（AI 自动读取）
├── GUIDE.md                 # 本使用说明书
├── reference.md             # 命令参考和技术细节
├── config.example.yaml      # 配置模板
├── config.yaml              # 实际配置（需自行创建，不要提交到 Git）
└── scripts/
    ├── trace_query.py       # 核心脚本：链路追踪 + 报告生成
    ├── db_query.py          # 数据库查询脚本
    └── gitlab_api.py        # GitLab 代码搜索脚本
```

> `$SKILL_HOME` 可以是任意目录，例如 `~/.cursor/skills/trace-analyzer`、`~/.claude/skills/trace-analyzer` 等。脚本内部使用相对路径定位配置文件，不依赖绝对安装位置。

---

## 九、快速上手（5 分钟）

```
步骤 1  安装依赖
        pip3 install requests pyyaml pymongo pymysql pymssql

步骤 2  创建配置
        cp $SKILL_HOME/config.example.yaml $SKILL_HOME/config.yaml
        # 编辑 config.yaml，填入 Kibana 地址、数据库连接等

步骤 3  在 AI 聊天中使用（Cursor / Claude Code / Codex / OpenClaw 等）
        "帮我查看 traceId xxxxxxx 的全链路日志，dev 环境"

        AI 会自动调用脚本、生成报告、展示分析结果。
```
