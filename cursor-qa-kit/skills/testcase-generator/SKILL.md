---
name: testcase-generator
description: 根据 PRD/接口文档/需求图自动生成标准化测试用例。须对齐 PRD 内嵌验收/测试场景。当用户说「生成用例」、「generate testcases」或 @ 需求文档时触发。
---

# Skill：testcase-generator

## 角色与规范

- 以**测试工程师**视角生成用例；**落盘目录**见 `~/.cursor/rules/test-engineer-conventions.mdc`（`test/testcases/`）。
- 字段、覆盖维度、标题、优先级等须遵守：`~/.cursor/rules/testcase-standard.mdc`。
- **xlsx / mm 导出**须遵守：`~/.cursor/rules/testcase-excel-export-standard.mdc`（列序、单 Sheet、模块合并、标题前缀等）。
- mm 思维导图结构可参考：`~/.cursor/rules/testcase-standard.mm`。

## 触发场景

- 用户 @ PRD / 接口文档 / 需求图 / `test_*-requirements.md`
- 用户说「生成用例」或输入 `generate testcases`

## 执行流程

### Step 1：读取需求来源（含 PRD 测试用例）

按优先级读取：

1. **`test_*-requirements.md`**（若已整理）：重点看 **§9 PRD 验收与测试场景** 及字段规范
2. **产品 PRD**：除功能描述外，**必须**提取「验收标准 / 测试用例」章节中的 **步骤 + 预期结果**，作为用例步骤/预期的首选来源（原文对齐，不自行改写期望）
3. 接口文档、前端规范、`test_*-clarification.md`（仅处理仍标注 `[待澄清]` 的项）

读取本 Skill 目录下 `references/domain-rules.md`，识别业务领域，调整优先级与覆盖重点。

### Step 2：套用用例模板

按本 Skill 目录下 `examples/case-template.md` 生成，严格遵守：

- **三层结构**：`# 模块名` → `## 子模块名` → 表格（每个子模块一张独立表格）
- **编号格式**：`TC-001`，全文档全局自增，跨子模块和模块连续不重置
- **字段顺序**：编号、标题、测试点、用例类型、前置条件、步骤、预期结果、实际结果、执行状态、优先级
- **文件命名（写入磁盘）**：`test_{功能模块名}-testcases.md`（须 `test_` 前缀）
- **mm 顶节点**：功能模块名称（与 md/xlsx  basename 一致，不含 `test_` 前缀亦可与 md 主文件名对齐）

### Step 3：覆盖维度检查

参考本 Skill 目录：

- `references/boundary.md`：边界值
- `references/concurrency.md`：并发幂等

每个需求至少覆盖：

| 维度 | 说明 |
|------|------|
| 正向 | 标准输入，主流程成功 |
| 反向 | 无效输入，拒绝并正确提示 |
| 必填项校验 | 逐字段置空、全空、仅空格；提示明确且前端拦截 |
| 边界 | 最大/最小/空值/临界长度 |
| 异常 | 网络中断、超时等 |
| 并发幂等 | 重复提交、并发脏数据 |
| 权限 | 角色/未登录/越权 |
| 数据隔离 | 多用户数据不互串 |
| 性能 | **仅接口测试**时关注 |
| 兼容性 | 浏览器/系统/分辨率（按需） |
| 回滚/撤销 | 失败后状态还原 |

**PRD 测试用例映射**：PRD §7.x / 验收表格每条场景至少对应 1 条 TC；测试点或前置条件标注 `〔PRD §x.x 步骤N〕` 便于溯源。

**有长度限制的字段**：除校验用例外，须含最短/最长合法值在 **表单、列表、详情**（及预览若有）的展示用例。

### Step 4：具体测试数据要求

步骤与预期中的输入**必须使用具体值**，禁止描述性空话（见 `testcase-standard.mdc` §6.1）。

### Step 5：导出三种格式

用例 md 落盘后，调用本 Skill 目录下脚本：

```bash
python "%USERPROFILE%\.cursor\skills\testcase-generator\scripts\export_excel.py" test/testcases/test_<模块>-testcases.md test/testcases/
```

（`output_dir` 未指定时默认为 md 所在目录；新用例一律使用 `test/testcases/`。）

同时输出：

1. **Markdown 表格** —— 对话中展示
2. **xlsx** —— **单 Sheet**；含「模块」「子模块」列；连续相同主模块在「模块」列**纵向合并**；「标题」列导出时自动加 `【主模块名】` 前缀（md 内标题仍写纯标题）
3. **mm** —— FreeMind XML，可导入 XMind

依赖：`pip install openpyxl`

## 输出路径（默认）

落盘至**当前工作区** `{project_root}/test/testcases/`（不存在则先创建 `test/` 与 `test/testcases/`）：

```
test/testcases/
├── test_{功能模块名}-testcases.md
├── test_{功能模块名}-testcases.xlsx
└── test_{功能模块名}-testcases.mm
```

目录与命名详见用户级 Rule：`~/.cursor/rules/test-engineer-conventions.mdc`。

## 优先级定义

| 优先级 | 含义 | 执行要求 |
|--------|------|----------|
| P0 | 冒烟，阻塞上线 | 必须 100% 通过 |
| P1 | 核心业务流程 | 每版必测 |
| P2 | 一般功能场景 | 按需执行 |
| P3 | 边缘/低频场景 | 时间充裕时执行 |
