# 安装说明

## 方式一：个人级（本机所有项目可用）

适用于当前 Windows 用户，路径示例：

```powershell
# 在仓库根目录 cursor-qa-kit/ 下执行
$KIT = "D:\AI_需求\cursor-qa-kit"   # 改为你的克隆路径
$CURSOR = "$env:USERPROFILE\.cursor"

# Skills
Copy-Item -Recurse -Force "$KIT\skills\*" "$CURSOR\skills\"

# Rules
New-Item -ItemType Directory -Force -Path "$CURSOR\rules" | Out-Null
Copy-Item -Force "$KIT\rules\*" "$CURSOR\rules\"

# trace-analyzer 配置（首次）
$cfg = "$CURSOR\skills\trace-analyzer\config.yaml"
if (-not (Test-Path $cfg)) {
  Copy-Item "$CURSOR\skills\trace-analyzer\config.example.yaml" $cfg
  Write-Host "请编辑 config.yaml 填写 ELK/数据库/GitLab（勿提交到 Git）"
}
```

重启 Cursor 或新开 Agent 对话后生效。

## 方式二：项目级（推荐团队 / 换 Cursor 账号）

将内容放入**业务仓库**根目录，随 Git 共享：

```
your-project/
  .cursor/
    skills/          # 从本包 skills/ 复制
    rules/           # 从本包 rules/ 复制
```

项目级资产不依赖 Cursor 登录账号，clone 仓库即可使用。

## 验证

1. Cursor 设置中查看 **Rules** 是否出现 `test-engineer-conventions` 等。
2. 对话中说「生成用例」或 `@SKILL.md`，Agent 应能匹配对应 Skill。
3. 生成文件应落在工作区 `test/requirements/`、`test/testcases/`、`test/reports/`。

## 与 Skills 内路径引用

部分 Skill 正文写的是 `~/.cursor/rules/xxx.mdc`。若只用**项目级** Rules，请：

- 将 rules 放到 `项目/.cursor/rules/`，或
- 批量把 Skill 内 `~/.cursor/rules/` 改为 `.cursor/rules/`（可选，按需修改）。
