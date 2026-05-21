---
name: trace-analyzer
description: >-
  通过 traceId 追踪分布式全链路调用日志，按时间排序输出，自动生成 Mermaid 时序图，
  并输出为 Markdown 报告文件。可选结合数据库（MongoDB/MySQL/SQL Server）查询业务数据、
  GitLab 搜索源码定位问题。当用户提供 traceId 并希望查看完整请求流程、生成时序图、
  追踪分布式调用链、排查跨服务问题时使用此 skill。
---

# 全链路追踪分析器

通过 traceId 追踪分布式全链路调用日志，按时间排序输出 Markdown 报告 + Mermaid 时序图。

> **路径约定**：本文件所在目录即为 `SKILL_HOME`。下文所有命令中的 `$SKILL_HOME` 请替换为本文件的实际所在目录路径。
> 例如本文件位于 `/Users/you/.cursor/skills/trace-analyzer/SKILL.md`，则 `SKILL_HOME=/Users/you/.cursor/skills/trace-analyzer`。
> Windows 全局安装：`%USERPROFILE%\.cursor\skills\trace-analyzer`（本仓库已放在此处时，任意项目打开 Cursor 均可 @ 本 `SKILL.md` 调用）。

## 前置条件

1. 使用 `python3` 执行所有脚本（脚本会自动读取配置文件）
2. 如果脚本报 "Config not found" 错误，提示用户执行：
   `cp $SKILL_HOME/config.example.yaml $SKILL_HOME/config.yaml` 并填写环境信息

## 工作流程

### 步骤 1：获取 TraceId、环境和时间范围

向用户确认：
- **traceId**：要追踪的链路标识符
- **环境**：查询哪个环境（dev/test，以 config 中的定义为准）
- **时间范围**（可选）：如用户未提供，默认查最近 3 小时

### 步骤 2：查询全链路日志并生成报告

```bash
# 默认查最近 3 小时
python3 $SKILL_HOME/scripts/trace_query.py trace \
  --env <ENV> --trace-id "<TRACE_ID>"

# 指定时间范围（分钟）
python3 $SKILL_HOME/scripts/trace_query.py trace \
  --env <ENV> --trace-id "<TRACE_ID>" --time-range 1440

# 指定精确时间区间
python3 $SKILL_HOME/scripts/trace_query.py trace \
  --env <ENV> --trace-id "<TRACE_ID>" \
  --time-from "2026-03-17 14:00:00" --time-to "2026-03-17 15:00:00"
```

时间参数说明：

| 参数 | 说明 | 示例 |
|------|------|------|
| `--time-range` | 最近 N 分钟（默认 180，即 3 小时） | `--time-range 1440`（24h） |
| `--time-from` | 起始时间 | `--time-from "2026-03-17 14:00:00"` |
| `--time-to` | 结束时间（默认当前） | `--time-to "2026-03-17 15:00:00"` |

如果查询无结果，脚本会提示扩大时间范围。

其他可选参数：
- `--full`：stdout 输出完整报告（含全量有序日志），默认只输出精简摘要
- `--no-file`：不生成文件，仅输出到 stdout
- `--output-dir <DIR>`：临时覆盖输出目录
- `--json`：输出结构化 JSON（不生成 .md 文件）

### 步骤 3：展示结果

**默认模式**：stdout 输出精简摘要（概览 + 时序图 + 调用链路概述 + 错误分析），完整报告自动保存为 .md 文件。
**完整模式**：当用户明确要求查看完整/全部/每一条有序日志时，加 `--full` 参数，stdout 输出包含全量日志的完整报告。

判断是否加 `--full` 的依据：
- 用户说"查看全部日志"、"输出完整日志"、"每条日志都要"、"详细日志" → 加 `--full`
- 用户只说"查一下链路"、"看看调用情况"、"分析一下" → 不加，使用默认摘要模式

### 步骤 4：查询业务数据（可选）

```bash
# MongoDB
python3 $SKILL_HOME/scripts/db_query.py \
  --env <ENV> --db-type mongodb --database <DB_NAME> \
  --collection <COLLECTION> --query '{"orderId": "xxx"}' [--limit 10]

# MySQL
python3 $SKILL_HOME/scripts/db_query.py \
  --env <ENV> --db-type mysql --sql "SELECT * FROM orders WHERE order_id = 'xxx'"

# SQL Server
python3 $SKILL_HOME/scripts/db_query.py \
  --env <ENV> --db-type sqlserver --sql "SELECT TOP 10 * FROM orders WHERE order_id = 'xxx'"
```

### 步骤 5：通过 GitLab 定位源码（可选）

```bash
# 按类名/方法名搜索代码
python3 $SKILL_HOME/scripts/gitlab_api.py search \
  --keyword "ClassName.methodName" [--project "project-name"]

# 查看文件内容（自动按环境选择分支: dev→dev_merge_all, test→test）
python3 $SKILL_HOME/scripts/gitlab_api.py file \
  --project "group/ai-agent" --path "src/main/java/.../Service.java" --env <ENV>

# 通过服务名查找对应的 GitLab 项目
python3 $SKILL_HOME/scripts/gitlab_api.py service --name "ai-agent"
```

## 安全规则

**以下安全限制已在脚本层面强制执行，不可绕过：**

### 数据库：只读
- SQL 只允许 `SELECT`、`SHOW`、`DESCRIBE`、`EXPLAIN`、`WITH` 开头的语句
- 以下关键字被禁止：`INSERT`、`UPDATE`、`DELETE`、`DROP`、`ALTER`、`TRUNCATE`、`CREATE`、`EXEC`、`GRANT`、`REVOKE` 等
- MongoDB 只使用 `find()` 查询，不支持任何写操作
- 违规 SQL 会被脚本直接拦截，不会发送到数据库

### GitLab：只读
- 只允许 GET 请求（搜索代码、列出项目、读取文件内容）
- **禁止**任何写操作：push、commit、merge、delete、create branch/tag 等
- GitLab token 建议仅授予 `read_api` scope

## 配置说明

配置文件：`$SKILL_HOME/config.yaml`

| 配置段 | 说明 |
|--------|------|
| **elk** | 各环境的 Kibana/ES 连接信息，索引模式独立 |
| **database** | 各环境的 MongoDB/MySQL/SQL Server 连接 |
| **gitlab** | GitLab API + 服务→项目映射 + 各环境分支 |
| **output** | .md 报告输出目录（`output.directory`） |

### 多环境配置要点

- **ELK 索引**：dev 用 `logstash-ai-finance-applog-dev-*`，test 用 `logstash-ai-finance-applog-test-*`
- **GitLab 分支**：dev 用 `dev_merge_all`，test 用 `test`
- **数据库**：每个环境各自独立的连接地址和认证

## 错误处理

| 错误 | 解决方案 |
|------|----------|
| ES 连接失败 | 检查 VPN，确认 kibana_url 配置 |
| 数据库连接失败 | 检查地址/端口/认证，确认 VPN |
| GitLab 401 | 重新生成 `read_api` 权限的 token |
| 未找到日志 | 确认 traceId 正确，增大 `--size` |

## 更多参考

当用户询问该 Skill 的使用方法或配置细节时，再参阅同目录下的 GUIDE.md 和 reference.md。日常调用不需要读取它们。
