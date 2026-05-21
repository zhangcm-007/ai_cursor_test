# 资产清单（整理日期：2026-05-18）

来源：`C:\Users\zhangcm\.cursor\skills\` 与 `C:\Users\zhangcm\.cursor\rules\`

---

## Skills

### 1. testcase-generator

- **路径**：`skills/testcase-generator/`
- **描述**：根据 PRD/接口文档/需求图生成标准化测试用例，对齐 PRD 内嵌验收场景
- **触发**：「生成用例」「generate testcases」、`@` 需求文档
- **附属文件**：
  - `references/domain-rules.md`、`boundary.md`、`concurrency.md`
  - `examples/case-template.md`
  - `scripts/export_excel.py`

### 2. requirement-doc-generator

- **路径**：`skills/requirement-doc-generator/`
- **描述**：整理测试侧需求清单，提取 PRD 内嵌测试用例与验收标准
- **触发**：「生成需求清单」「生成需求文档」「整理需求」「需求整理」

### 3. requirement-clarification-analyzer

- **路径**：`skills/requirement-clarification-analyzer/`
- **描述**：测试视角需求澄清，对照 PRD 测试用例找冲突与缺口
- **触发**：「分析需求」「找出未澄清的点」「澄清需求」「需求有哪些问题」

### 4. trace-analyzer

- **路径**：`skills/trace-analyzer/`
- **描述**：traceId 全链路日志、Mermaid 时序图、Markdown 报告；可选 DB/GitLab
- **触发**：提供 traceId、查看请求流程、分布式排查
- **附属文件**：`scripts/trace_query.py`、`db_query.py`、`gitlab_api.py`、`GUIDE.md`、`reference.md`
- **配置**：仅含 `config.example.yaml`；本地需自建 `config.yaml`（已 gitignore）

---

## Rules

| 文件 | 说明 |
|------|------|
| `test-engineer-conventions.mdc` | `test/` 目录结构、requirements/testcases/reports 落盘 |
| `testcase-standard.mdc` | 用例字段、TC 编号、优先级、覆盖要求 |
| `testcase-excel-export-standard.mdc` | xlsx 列序、单 Sheet、与 export_excel.py 一致 |
| `testcase-standard.mm` | FreeMind 思维导图结构参考 |
| `requirement-doc-standard.mdc` | 需求清单须含 PRD 内嵌测试场景（glob 匹配 PRD/requirements） |
| `requirement-clarification-standard.mdc` | 澄清文档须对照 PRD 验收标准 |

---

## 未纳入本包的内容

| 项 | 原因 |
|----|------|
| `trace-analyzer/config.yaml` | 含数据库密码、GitLab Token、内网 URL |
| `trace-analyzer/.claude/settings.local.json` | 本地 IDE 配置 |
| `skills-cursor/*` | Cursor 内置 Skill，非用户创建 |
| `d:\AI_需求\agent_skill\` 下其他仓库 | 独立项目，可按需另建仓库 |

---

## 上传 GitLab 检查清单

- [ ] 确认无 `config.yaml`、无 Token/密码被提交
- [ ] 填写 GitLab 远程地址后 `git init` / `git remote add` / `git push`
- [ ] 仓库可见性（Private 推荐）
- [ ] 团队成员按 INSTALL.md 安装
