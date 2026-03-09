# -*- coding: utf-8 -*-
"""
将 03-测试用例 目录下的 Markdown 测试用例转为 XMind 思维导图。
依赖：pip install xmind
运行：python export_to_xmind.py [用例文件.md]
  不传参数时，自动处理 03-测试用例 下所有 .md 文件。
输出：04-导出XMind/*.xmind 与 *_xmind_outline.txt（可手动导入 XMind）
"""

import os
import re
import sys

FRAMEWORK_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CASE_DIR = os.path.join(FRAMEWORK_ROOT, "03-测试用例")
OUTPUT_DIR = os.path.join(FRAMEWORK_ROOT, "04-导出XMind")


def parse_md_cases(md_path):
    """从 Markdown 中解析出用例列表。"""
    with open(md_path, "r", encoding="utf-8") as f:
        content = f.read()

    title_match = re.search(r"^#\s+测试用例\s*-\s*(.+)$", content, re.MULTILINE)
    project_name = title_match.group(1).strip() if title_match else "测试用例"

    cases = []
    pattern = re.compile(
        r"###\s+(TC-\S+)\s+\[?(.+?)\]?\s*\n\n"
        r"(\|[^\n]+\|[^\n]+\|\n\|[^\n]+\|[^\n]+\|\n)"
        r"((?:\|[^\n]+\|[^\n]+\|\n)*)",
        re.DOTALL,
    )
    for m in pattern.finditer(content):
        tc_id, tc_title = m.group(1).strip(), m.group(2).strip()
        table_block = m.group(3) + (m.group(4) or "")
        priority = precond = steps = expected = ""
        for row in re.findall(r"\|\s*\*\*([^*]+)\*\*\s*\|\s*([^|]*)\s*\|", table_block):
            key, val = row[0].strip(), row[1].strip()
            if "优先级" in key:
                priority = val
            elif "前置条件" in key:
                precond = val
            elif "测试步骤" in key:
                steps = val.replace("<br>", "\n")
            elif "预期结果" in key:
                expected = val
        cases.append((tc_id, tc_title, priority, precond, steps, expected))

    return project_name, cases


def build_outline_txt(project_name, cases):
    """生成 XMind 可导入的大纲文本（Tab 缩进）。"""
    lines = [project_name]
    for tc_id, tc_title, priority, precond, steps, expected in cases:
        node = f"{tc_id} {tc_title}"
        lines.append("\t" + node)
        if priority:
            lines.append("\t\t" + f"优先级：{priority}")
        if precond:
            lines.append("\t\t" + f"前置条件：{precond}")
        if steps:
            for line in steps.split("\n"):
                line = line.strip()
                if line:
                    lines.append("\t\t" + line)
        if expected:
            lines.append("\t\t" + f"预期结果：{expected}")
    return "\n".join(lines)


def write_xmind(project_name, cases, output_path):
    """使用 xmind 库写入 .xmind 文件。"""
    try:
        import xmind
    except ImportError:
        print("请先安装: pip install xmind")
        return False

    workbook = xmind.load(output_path) if os.path.exists(output_path) else xmind.Workbook()
    sheet = workbook.getPrimarySheet()
    sheet.setTitle(project_name[:31])
    root = sheet.getRootTopic()
    root.setTitle(project_name)

    for tc_id, tc_title, priority, precond, steps, expected in cases:
        child = root.addSubTopic()
        child.setTitle(f"{tc_id} {tc_title}")
        if priority:
            child.addSubTopic().setTitle(f"优先级：{priority}")
        if precond:
            child.addSubTopic().setTitle(f"前置条件：{precond}")
        if steps:
            c3 = child.addSubTopic()
            c3.setTitle("测试步骤")
            for line in steps.replace("\n", " ").split():
                if line.strip():
                    c3.addSubTopic().setTitle(line[:200])
        if expected:
            child.addSubTopic().setTitle(f"预期结果：{expected[:500]}")

    xmind.save(workbook, output_path)
    return True


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    if len(sys.argv) > 1:
        md_files = [p for p in sys.argv[1:] if p.endswith(".md")]
    else:
        if not os.path.isdir(CASE_DIR):
            print("目录不存在:", CASE_DIR)
            return
        md_files = [
            os.path.join(CASE_DIR, f)
            for f in os.listdir(CASE_DIR)
            if f.endswith(".md") and not f.startswith(".")
        ]

    if not md_files:
        print("未找到 Markdown 用例文件。请将用例放入 03-测试用例/ 或指定文件路径。")
        return

    for md_path in md_files:
        if not os.path.isfile(md_path):
            continue
        try:
            project_name, cases = parse_md_cases(md_path)
        except Exception as e:
            print("解析失败", md_path, ":", e)
            continue
        if not cases:
            print("未解析到用例:", md_path)
            continue

        base = os.path.splitext(os.path.basename(md_path))[0]
        safe_name = re.sub(r'[\\/:*?"<>|]', "_", base)

        outline_path = os.path.join(OUTPUT_DIR, f"{safe_name}_xmind_outline.txt")
        with open(outline_path, "w", encoding="utf-8") as f:
            f.write(build_outline_txt(project_name, cases))
        print("已生成大纲:", outline_path)

        xmind_path = os.path.join(OUTPUT_DIR, f"{safe_name}.xmind")
        if write_xmind(project_name, cases, xmind_path):
            print("已生成 XMind:", xmind_path)
        else:
            print("未安装 xmind 库，仅生成大纲文件。执行: pip install xmind")
    print("导出完成。")


if __name__ == "__main__":
    main()
