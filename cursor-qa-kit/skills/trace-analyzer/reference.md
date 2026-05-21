# Trace Analyzer - Reference

> `$SKILL_HOME` 指本文件所在目录，即 trace-analyzer 的安装根目录。

## 脚本命令一览

### trace_query.py - 全链路追踪 + 时序图生成

```bash
# 文本格式输出（时间线 + Mermaid）
python3 $SKILL_HOME/scripts/trace_query.py trace --env dev --trace-id "abc123"

# JSON 格式输出（含结构化数据 + Mermaid 代码）
python3 $SKILL_HOME/scripts/trace_query.py trace --env test --trace-id "abc123" --json

# 仅输出 Mermaid 时序图代码
python3 $SKILL_HOME/scripts/trace_query.py trace --env test --trace-id "abc123" --mermaid-only

# 按关键字搜索日志
python3 $SKILL_HOME/scripts/trace_query.py search --env test --keyword "NullPointerException" --time-range 60

# 指定最大日志条数
python3 $SKILL_HOME/scripts/trace_query.py trace --env test --trace-id "abc123" --size 1000
```

### db_query.py - 数据库查询

支持三种数据库，每个环境独立配置。

#### MongoDB

```bash
# 按条件查询文档
python3 $SKILL_HOME/scripts/db_query.py \
  --env test --db-type mongodb \
  --database llm-conversation --collection chat_message \
  --query '{"conversationId": "69b8cc8a656c2e2047ed05b5"}' \
  --limit 10

# 指定投影和排序
python3 $SKILL_HOME/scripts/db_query.py \
  --env test --db-type mongodb \
  --database llm-conversation --collection chat_message \
  --query '{"userId": "68785fa2391e304c2304e61a"}' \
  --projection '{"content": 1, "createTime": 1}' \
  --sort '{"createTime": -1}' \
  --limit 5
```

#### MySQL

```bash
python3 $SKILL_HOME/scripts/db_query.py \
  --env test --db-type mysql \
  --sql "SELECT * FROM orders WHERE user_id = '123'" \
  --limit 10
```

#### SQL Server

```bash
python3 $SKILL_HOME/scripts/db_query.py \
  --env test --db-type sqlserver \
  --sql "SELECT TOP 10 * FROM transactions WHERE trace_id = 'abc123'"
```

### gitlab_api.py - GitLab 代码搜索

```bash
# 全局搜索代码
python3 $SKILL_HOME/scripts/gitlab_api.py search --keyword "OrderService.createOrder"

# 在指定项目中搜索
python3 $SKILL_HOME/scripts/gitlab_api.py search --keyword "PaymentController" --project "group/payment-service"

# 按名称搜索项目（映射服务名到仓库）
python3 $SKILL_HOME/scripts/gitlab_api.py projects --search "ai-agent"

# 获取文件内容
python3 $SKILL_HOME/scripts/gitlab_api.py file --project "group/ai-agent" --path "src/main/java/com/example/Service.java"
```

## 多环境配置说明

dev 和 test 环境完全独立配置，互不影响：

| 配置项 | dev | test |
|--------|-----|------|
| **ELK 索引** | `logstash-ai-finance-applog-dev-*` | `logstash-ai-finance-applog-test-*` |
| **MongoDB** | 各自独立的连接 URI 和默认数据库 | 各自独立的连接 URI 和默认数据库 |
| **MySQL** | 独立的 host/port/credentials | 独立的 host/port/credentials |
| **SQL Server** | 独立的 host/port/credentials | 独立的 host/port/credentials |
| **Kibana** | 可以相同或不同 | 可以相同或不同 |

所有命令通过 `--env` 参数切换环境，无需修改配置。

## Mermaid 时序图生成算法

### 服务转换检测

1. 按时间排序所有日志
2. 跟踪当前活跃的服务
3. 当日志从 ServiceA 切换到 ServiceB 时，记录 `A ->> B`（调用）
4. 使用栈结构处理嵌套调用（A→B→C→B→A）
5. 当日志回到栈中上一个服务时，记录 `B -->> A`（返回）

### 调用信息提取

| 模式类型 | 匹配内容 | 示例 |
|----------|----------|------|
| `http_call` | HTTP 方法 + URL | `POST /api/v1/orders` |
| `response_status` | HTTP 状态码 | `status=200` |
| `duration` | 耗时 | `duration=45ms` |
| `exception` | 异常信息 | `NullPointerException: ...` |

## ELK 字段映射

| 配置项 | 实际字段名 | 说明 |
|--------|-----------|------|
| `trace_id` | `traceId` | 链路追踪 ID |
| `timestamp` | `@timestamp` | 时间戳 |
| `service` | `project_name` | 服务/应用名 |
| `level` | `level` | 日志级别 |
| `message` | `message` | 日志消息 |
| `logger` | `loggerName` | Logger 全限定类名 |
| `hostname` | `hostname` | 主机名 |
| `source_class` | `source.class` | 源码类名 |
| `source_method` | `source.method` | 源码方法名 |

## 数据库驱动

| 类型 | 驱动包 | 安装命令 |
|------|--------|----------|
| MongoDB | pymongo | `pip3 install pymongo` |
| MySQL | pymysql | `pip3 install pymysql` |
| SQL Server | pymssql | `pip3 install pymssql` |

## 常见使用场景

### 场景 1: 快速追踪一个请求

```bash
python3 $SKILL_HOME/scripts/trace_query.py trace --env test --trace-id "abc123" --json
```

### 场景 2: 排查接口报错

```bash
# 1. 追踪日志
python3 $SKILL_HOME/scripts/trace_query.py trace --env test --trace-id "abc123"

# 2. 搜索源码
python3 $SKILL_HOME/scripts/gitlab_api.py search --keyword "FunctionCallAgent.run0"

# 3. 查相关业务数据
python3 $SKILL_HOME/scripts/db_query.py \
  --env test --db-type mongodb \
  --database llm-conversation --collection chat_message \
  --query '{"traceId": "abc123"}'
```

### 场景 3: 切换环境对比

```bash
# dev 环境
python3 $SKILL_HOME/scripts/trace_query.py trace --env dev --trace-id "xxx"

# test 环境
python3 $SKILL_HOME/scripts/trace_query.py trace --env test --trace-id "yyy"
```
