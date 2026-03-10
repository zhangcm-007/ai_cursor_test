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
TP_DIR = os.path.join(FRAMEWORK_ROOT, "02-测试点")
OUTPUT_DIR = os.path.join(FRAMEWORK_ROOT, "04-导出XMind")


def _parse_table_rows(table_rows):
    """表格行转成子节点列表 [(标题, [])]。跳过表头行。"""
    nodes = []
    for row in table_rows:
        if not row or not any(r for r in row):
            continue
        first = row[0].strip()
        second = row[1].strip() if len(row) > 1 else ""
        if "测试点ID" in first or "需求对应" in first or first == "---":
            continue
        if first and second:
            nodes.append((f"{first} | {second[:80]}", []))
        elif first:
            nodes.append((first[:120], []))
    return nodes


def parse_testpoint_md(md_path):
    """解析测试点 Markdown，返回 (根标题, 树)。树为 [(section_title, [(sub_title, [(node_title, [])])])]。"""
    with open(md_path, "r", encoding="utf-8") as f:
        content = f.read()

    title_match = re.search(r"^#\s+测试点\s*[-–—]\s*(.+)$", content, re.MULTILINE)
    root_title = title_match.group(1).strip() if title_match else "测试点"

    # 收集 (level, heading) 和紧跟着的 table
    items = []
    lines = content.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        if re.match(r"^#+\s+", line):
            level = len(line) - len(line.lstrip("#"))
            heading = line.lstrip("#").strip()
            i += 1
            table_rows = []
            while i < len(lines) and re.match(r"^\|", lines[i]) and "---" not in lines[i]:
                cells = [c.strip() for c in re.split(r"\|", lines[i])[1:-1]]
                if cells:
                    table_rows.append(cells)
                i += 1
            items.append((level, heading, table_rows))
        else:
            i += 1

    # 按层级建树：##(2) -> ###(3) -> ####(4)+table。stack 中 (level, list) 表示该 list 用于追加当前层节点。
    tree = []
    stack = [(1, tree)]

    for level, heading, table_rows in items:
        if level < 2:
            continue
        row_nodes = _parse_table_rows(table_rows) if table_rows else []
        node = (heading, row_nodes)
        while len(stack) > 1 and stack[-1][0] >= level:
            stack.pop()
        parent_list = stack[-1][1]
        parent_list.append(node)
        stack.append((level, node[1]))

    return root_title, tree


def build_outline_txt(root_title, tree):
    """生成完整大纲文本（扁平化所有层级）。"""
    lines = [root_title]
    for sec_title, sec_children in tree:
        lines.append("\t" + sec_title)
        for sub_title, sub_children in sec_children:
            lines.append("\t\t" + sub_title)
            for node_title, _ in sub_children:
                lines.append("\t\t\t" + node_title)
    return "\n".join(lines)


def _add_children_xmind(parent_topic, tree, xmind_lib):
    """递归把 tree 加入 parent_topic。"""
    for title, children in tree:
        t = parent_topic.addSubTopic()
        t.setTitle(title[:500] if len(title) > 500 else title)
        if children:
            for sub_title, sub_children in children:
                st = t.addSubTopic()
                st.setTitle(sub_title[:500] if len(sub_title) > 500 else sub_title)
                for node_title, _ in sub_children:
                    st.addSubTopic().setTitle(node_title[:500] if len(node_title) > 500 else node_title)


def write_xmind(root_title, tree, output_path):
    """用 xmind 库写入 .xmind。"""
    try:
        import xmind
    except ImportError:
        print("请先安装: pip install xmind")
        return False

    workbook = xmind.load(output_path) if os.path.exists(output_path) else xmind.Workbook()
    sheet = workbook.getPrimarySheet()
    sheet.setTitle(root_title[:31] if len(root_title) > 31 else root_title)
    root = sheet.getRootTopic()
    root.setTitle(root_title)

    for sec_title, sec_children in tree:
        sec_topic = root.addSubTopic()
        sec_topic.setTitle(sec_title[:500])
        for sub_title, sub_children in sec_children:
            sub_topic = sec_topic.addSubTopic()
            sub_topic.setTitle(sub_title[:500])
            for node_title, _ in sub_children:
                sub_topic.addSubTopic().setTitle(node_title[:500])

    xmind.save(workbook, output_path)
    return True


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    if len(sys.argv) > 1:
        md_files = [p for p in sys.argv[1:] if p.endswith(".md")]
    else:
        if not os.path.isdir(TP_DIR):
            print("目录不存在:", TP_DIR)
            return
        md_files = [
            os.path.join(TP_DIR, f)
            for f in os.listdir(TP_DIR)
            if f.endswith(".md") and not f.startswith(".")
        ]

    if not md_files:
        print("未找到测试点 .md 文件。请将测试点放入 02-测试点/ 或指定文件路径。")
        return

    for md_path in md_files:
        if not os.path.isfile(md_path):
            continue
        try:
            root_title, tree = parse_testpoint_md(md_path)
        except Exception as e:
            print("解析失败", md_path, ":", e)
            import traceback
            traceback.print_exc()
            continue
        if not tree:
            print("未解析到测试点结构:", md_path)
            continue

        base = os.path.splitext(os.path.basename(md_path))[0]
        safe_name = re.sub(r'[\\/:*?"<>|]', "_", base)

        outline_path = os.path.join(OUTPUT_DIR, f"{safe_name}_xmind_outline.txt")
        with open(outline_path, "w", encoding="utf-8") as f:
            f.write(build_outline_txt(root_title, tree))
        print("已生成大纲:", outline_path)

        xmind_path = os.path.join(OUTPUT_DIR, f"{safe_name}.xmind")
        if write_xmind(root_title, tree, xmind_path):
            print("已生成 XMind:", xmind_path)
        else:
            print("未安装 xmind 库，仅生成大纲。执行: pip install xmind")
    print("导出完成。")


if __name__ == "__main__":
    main()
