# -*- coding: utf-8 -*-
"""
将 02-测试点 目录下的 Markdown 测试点转为 XMind 思维导图。
依赖：pip install xmind
运行：python export_testpoints_to_xmind.py [测试点文件.md]
  不传参数时，自动处理 02-测试点 下所有 .md 文件。
输出：04-导出XMind/*.xmind 与 *_xmind_outline.txt
"""

import os
import re
import sys

FRAMEWORK_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POINT_DIR = os.path.join(FRAMEWORK_ROOT, "02-测试点")
OUTPUT_DIR = os.path.join(FRAMEWORK_ROOT, "04-导出XMind")


def parse_testpoints_md(md_path):
    """解析测试点 Markdown：返回 (标题, [(一级分类, 二级分类, [(测试点ID, 描述, 说明)], ...)])"""
    with open(md_path, "r", encoding="utf-8") as f:
        content = f.read()

    title_match = re.search(r"^#\s+测试点\s*-\s*(.+)$", content, re.MULTILINE)
    title = title_match.group(1).strip() if title_match else "测试点"

    # 从 ## 详细测试点 开始解析
    detail_match = re.search(r"##\s+详细测试点\s*\n(.*)", content, re.DOTALL)
    block = detail_match.group(1) if detail_match else content

    # 按 ### 一、 或 ### 二、 分割一级分类
    sections = re.findall(
        r"###\s+([^\n]+)\s*\n\n(.*?)(?=\n###\s+|\n---\s*\n|\Z)",
        block,
        re.DOTALL,
    )
    tree = []  # [(一级名, [(二级名, [(tp_id, desc, note)])])]

    for sec1_name, sec1_body in sections:
        sec1_name = sec1_name.strip()
        # 找 #### 二级标题
        sub_sections = re.findall(
            r"####\s+([^\n]+)\s*\n\n(.*?)(?=\n####\s+|\n###\s+|\Z)",
            sec1_body,
            re.DOTALL,
        )
        if sub_sections:
            sec1_children = []
            for sec2_name, sec2_body in sub_sections:
                rows = parse_table_rows(sec2_body)
                sec1_children.append((sec2_name.strip(), rows))
            tree.append((sec1_name, sec1_children))
        else:
            # 无 ####，直接在一级下解析表格
            rows = parse_table_rows(sec1_body)
            tree.append((sec1_name, [("", rows)]))

    return title, tree


def parse_table_rows(body):
    """从表格中解析出 (测试点ID, 描述, 说明) 列表。"""
    rows = []
    # 匹配表体行：| xx | xx | xx |
    for line in body.split("\n"):
        line = line.strip()
        if not line.startswith("|") or line.startswith("|--") or "---" in line:
            continue
        cells = [c.strip() for c in line.split("|")[1:-1]]
        if len(cells) >= 2:
            tp_id = cells[0] if cells[0] and not cells[0].startswith("---") else ""
            desc = cells[1] if len(cells) > 1 else ""
            note = cells[2] if len(cells) > 2 else ""
            if tp_id or desc:
                rows.append((tp_id, desc, note))
    return rows


def build_outline(title, tree):
    """生成 XMind 可导入的大纲文本。"""
    lines = [title]
    for sec1_name, sec1_children in tree:
        lines.append("\t" + sec1_name)
        for sec2_name, rows in sec1_children:
            if sec2_name:
                lines.append("\t\t" + sec2_name)
                prefix = "\t\t\t"
            else:
                prefix = "\t\t"
            for tp_id, desc, note in rows:
                node = f"{tp_id} {desc}" if tp_id else desc
                if note:
                    node += f"（{note}）"
                lines.append(prefix + node)
    return "\n".join(lines)


def write_xmind(title, tree, output_path):
    """写入 .xmind 文件。"""
    try:
        import xmind
    except ImportError:
        print("请先安装: pip install xmind")
        return False

    workbook = xmind.load(output_path) if os.path.exists(output_path) else xmind.Workbook()
    sheet = workbook.getPrimarySheet()
    sheet.setTitle(title[:31])
    root = sheet.getRootTopic()
    root.setTitle(title)

    for sec1_name, sec1_children in tree:
        t1 = root.addSubTopic()
        t1.setTitle(sec1_name)
        for sec2_name, rows in sec1_children:
            if sec2_name:
                t2 = t1.addSubTopic()
                t2.setTitle(sec2_name)
                parent = t2
            else:
                parent = t1
            for tp_id, desc, note in rows:
                node_title = f"{tp_id} {desc}" if tp_id else desc
                if note:
                    node_title += f"（{note}）"
                parent.addSubTopic().setTitle(node_title[:500])

    xmind.save(workbook, output_path)
    return True


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    if len(sys.argv) > 1:
        md_files = [p for p in sys.argv[1:] if p.endswith(".md")]
    else:
        if not os.path.isdir(POINT_DIR):
            print("目录不存在:", POINT_DIR)
            return
        md_files = [
            os.path.join(POINT_DIR, f)
            for f in os.listdir(POINT_DIR)
            if f.endswith(".md") and not f.startswith(".")
        ]

    if not md_files:
        print("未找到测试点 Markdown 文件。")
        return

    for md_path in md_files:
        if not os.path.isfile(md_path):
            continue
        try:
            title, tree = parse_testpoints_md(md_path)
        except Exception as e:
            print("解析失败", md_path, ":", e)
            continue
        if not tree:
            print("未解析到测试点结构:", md_path)
            continue

        base = os.path.splitext(os.path.basename(md_path))[0]
        safe_name = re.sub(r'[\\/:*?"<>|]', "_", base)

        outline_path = os.path.join(OUTPUT_DIR, f"{safe_name}_xmind_outline.txt")
        with open(outline_path, "w", encoding="utf-8") as f:
            f.write(build_outline(title, tree))
        print("已生成大纲:", outline_path)

        xmind_path = os.path.join(OUTPUT_DIR, f"{safe_name}.xmind")
        if write_xmind(title, tree, xmind_path):
            print("已生成 XMind:", xmind_path)
        else:
            print("未安装 xmind 库，仅生成大纲。执行: pip install xmind")
    print("导出完成。")


if __name__ == "__main__":
    main()
