"""生成测试用例（与 Node generate.ts 对齐）"""

from __future__ import annotations

import json
import os
import re
import threading
from typing import Any

from sqlalchemy.orm import Session

from app.models import TestCase
from app.services import git_service, llm_client, requirement_content
from app.util import new_id

DEV_CODE_FILE_MAX_LENGTH = 8000
DEV_CODE_FILE_MAX_COUNT = 6
CHAT_TIMEOUT_SEC = 300
PREVIEW_LEN = 800
USER_PREVIEW_LEN = 2000


def parse_json_block(text: str) -> Any:
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if m:
        return json.loads(m[1].strip())
    m2 = re.search(r"\[[\s\S]*\]", text)
    if m2:
        return json.loads(m2[0])
    return json.loads(text.strip())


def lang_from_filename(name: str) -> str:
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    m = {
        "ts": "typescript",
        "tsx": "typescript",
        "js": "javascript",
        "jsx": "javascript",
        "py": "python",
        "go": "go",
        "java": "java",
        "rs": "rust",
        "vue": "vue",
        "css": "css",
        "html": "html",
        "json": "json",
        "md": "markdown",
    }
    return m.get(ext, "text")


def generate_test_cases(
    db: Session,
    requirement_id: str,
    dev_code: str | None = None,
    dev_code_files: list[dict[str, str]] | None = None,
    dev_code_ref: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if not llm_client.is_configured():
        raise RuntimeError("LLM not configured")

    _gc = requirement_content.get_full_content(db, requirement_id)
    full = _gc.full_content
    att_errs = _gc.attachment_errors
    print(f"[生成测试用例] requirementId={requirement_id}, fullContent 长度={len(full)}")
    print(f"[生成测试用例] fullContent 预览:\n{full[:500]}{'...(省略)' if len(full) > 500 else ''}")

    files: list[dict[str, str]] = []
    ref = dev_code_ref or {}
    if (ref.get("commit") or "").strip():
        repo = (os.getenv("DEV_CODE_REPO_PATH") or "").strip()
        if git_service.is_git_repo_configured():
            try:
                from_git = git_service.get_code_from_git(
                    repo,
                    str(ref["commit"]).strip(),
                    ref.get("paths") if isinstance(ref.get("paths"), list) else None,
                )
                for item in from_git:
                    if len(files) >= DEV_CODE_FILE_MAX_COUNT:
                        break
                    files.append(item)
                if from_git:
                    print(f"[生成测试用例] 从 Git 拉取 {len(from_git)} 个文件")
                else:
                    print("[生成测试用例] 从 Git 拉取结果为空")
            except Exception as e:
                raise RuntimeError(f"根据提交记录拉取代码失败：{e}") from e
        else:
            print("[生成测试用例] 未配置 DEV_CODE_REPO_PATH，跳过 Git 拉取")

    if dev_code_files:
        for i, f in enumerate(dev_code_files):
            if len(files) >= DEV_CODE_FILE_MAX_COUNT:
                break
            name = (f.get("name") or f"code-{i+1}").strip() or f"code-{i+1}"
            content = (f.get("content") or "").strip()
            if not content:
                continue
            snippet = content[:DEV_CODE_FILE_MAX_LENGTH] + (
                "\n\n...(已截断)" if len(content) > DEV_CODE_FILE_MAX_LENGTH else ""
            )
            files.append({"name": name, "content": snippet})

    dc = (dev_code or "").strip()
    if dc and len(files) < DEV_CODE_FILE_MAX_COUNT:
        snippet = dc[:DEV_CODE_FILE_MAX_LENGTH] + (
            "\n\n...(已截断)" if len(dc) > DEV_CODE_FILE_MAX_LENGTH else ""
        )
        files.append({"name": "粘贴的代码", "content": snippet})

    has_dev = len(files) > 0
    if has_dev:
        print(f"[生成测试用例] 已附带开发代码（{len(files)} 个片段）")

    sys_p = (
        "你是一名测试工程师。请根据以下需求描述生成测试用例，严格参照给定的结构。需求描述将在稍后提供。"
        + (
            "若提供了开发代码（以文件/文档形式给出），请结合各文件中的接口、分支与异常生成用例，使步骤、预期和验证点与实现一致。"
            if has_dev
            else ""
        )
        + """

覆盖要求：
- 需全面覆盖需求中的主流程、关键分支、边界条件、异常/错误场景（异常包括：输入无效数据、网络超时、服务器错误、权限不足等）。
- 根据需求复杂度生成足够数量的用例，避免重复。通常生成不少于5条、不超过30条测试用例，具体数量由需求复杂度和场景数量决定。

每条测试用例包含以下字段（不要 pointId）：
1. featurePointL1：一级功能点（需求下的分类/大类），如"个人红包"、"群红包"、"账户余额"、"支付方式"。同一分类的用例填相同一级功能点。
2. featurePoint：二级功能点（一级下的具体模块），如"红包领取"、"发送群红包"。同一子模块的用例填相同二级功能点。
3. title：测试用例名称，简洁描述场景，可中英文（如"提现页面展示已激活卡片 / Withdrawal page displays activated card"）。建议优先使用中文，保留必要英文术语。
4. priority：P0（核心流程/阻塞性）、P1（重要功能/非阻塞）、P2（边缘/异常/易用性）。请按此标准赋值。
5. preconditions：前置条件，执行前系统应满足的状态（一条或短句，可多句）。
6. steps：测试步骤，按编号列出原子操作（如"1. 进入提现流程 2. 查看选卡页面"）。
7. expected：预期结果，完成步骤后系统应达到的状态（简短明确）。
8. validationPoints：验证点，用于确认预期结果的详细检查项；多条时用数组，如["卡片可点击，无 disabled 状态", "无【未激活】标签"]，或单条字符串。每个验证点应具体、可观察。

只输出一个 JSON 数组，不要其他说明。格式示例：
[{"featurePointL1":"群红包","featurePoint":"红包领取","title":"...","priority":"P1","preconditions":"...","steps":"...","expected":"...","validationPoints":["验证点1","验证点2"]}]
caseId 由系统分配，无需在输出中填写。"""
    )

    user_p = f"""## 当前需求
{full}

请根据上述需求全面生成测试用例 JSON 数组：覆盖正常流程、分支、边界与异常，数量要足够（按需求复杂度生成，通常 5～30 条）。每条务必包含 featurePointL1、featurePoint、title、priority、preconditions、steps、expected、validationPoints。"""
    if has_dev:
        code_section = "\n\n".join(
            f"### 文件: {f['name']}\n```{lang_from_filename(f['name'])}\n{f['content']}\n```" for f in files
        )
        user_p += f"""

## 开发代码（实现参考，以文档形式提供）
以下为实现该需求的相关代码文件，请结合需求与各文件内容生成测试用例，使步骤、预期和验证点与实现一致（如接口字段、错误码、分支逻辑）。

{code_section}"""

    print(f"[生成测试用例] systemPrompt 长度={len(sys_p)}")
    print(f"[生成测试用例] systemPrompt 前 {PREVIEW_LEN} 字:\n{sys_p[:PREVIEW_LEN]}{'...(省略)' if len(sys_p) > PREVIEW_LEN else ''}")
    print(f"[生成测试用例] userPrompt 长度={len(user_p)}")
    print(f"[生成测试用例] userPrompt 前 {USER_PREVIEW_LEN} 字:\n{user_p[:USER_PREVIEW_LEN]}{'...(省略)' if len(user_p) > USER_PREVIEW_LEN else ''}")
    print(f"[生成测试用例] 开始调用模型（超时 {CHAT_TIMEOUT_SEC}s）...")

    result_holder: dict[str, Any] = {}
    err_holder: dict[str, BaseException] = {}

    def _call():
        try:
            result_holder["text"] = llm_client.chat(
                [{"role": "system", "content": sys_p}, {"role": "user", "content": user_p}]
            )
        except BaseException as e:
            err_holder["e"] = e

    th = threading.Thread(target=_call)
    th.start()
    th.join(timeout=CHAT_TIMEOUT_SEC)
    if th.is_alive():
        raise RuntimeError("生成超时（模型响应过慢）。请减少开发代码量或稍后重试。")
    if "e" in err_holder:
        raise err_holder["e"]
    content = result_holder.get("text", "")

    arr = parse_json_block(content)
    if not isinstance(arr, list):
        raise RuntimeError("Invalid LLM output: not an array")
    print(f"[生成测试用例] 模型返回 {len(arr)} 条，开始写入数据库")

    existing = db.query(TestCase.caseId).filter(TestCase.requirementId == requirement_id).all()
    case_ids = [r[0] for r in existing]

    def parse_num(cid: str) -> int:
        m = re.match(r"^TC-?(\d+)", cid, re.I)
        if m:
            return int(m[1])
        digits = re.sub(r"\D", "", cid)
        return int(digits) if digits.isdigit() else 0

    max_n = max((parse_num(c) for c in case_ids), default=0)
    next_n = max_n + 1
    created = 0
    for item in arr:
        case_id = f"TC-{str(next_n).zfill(3)}"
        next_n += 1
        raw_vp = item.get("validationPoints")
        if isinstance(raw_vp, list):
            vp_str = "\n".join(str(x).strip() for x in raw_vp if str(x).strip())
        else:
            vp_str = str(raw_vp or "").strip()
        fp1 = str(item.get("featurePointL1") or "").strip()[:200]
        fp2 = str(item.get("featurePoint") or "").strip()[:200]
        pr = str(item.get("priority") or "P1")
        if pr not in ("P0", "P1", "P2"):
            pr = "P1"
        tc = TestCase(
            id=new_id(),
            requirementId=requirement_id,
            caseId=case_id,
            featurePointL1=fp1,
            featurePoint=fp2,
            title=str(item.get("title") or "")[:500],
            priority=pr,
            preconditions=str(item.get("preconditions") or "")[:2000],
            steps=str(item.get("steps") or "")[:2000],
            expected=str(item.get("expected") or "")[:2000],
            validationPoints=vp_str[:2000],
        )
        db.add(tc)
        created += 1
    db.commit()
    print(f"[生成测试用例] 完成，创建 {created} 条测试用例")
    return {"created": created, "attachmentErrors": att_errs}
