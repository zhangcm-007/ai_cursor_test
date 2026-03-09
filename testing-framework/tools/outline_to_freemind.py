# -*- coding: utf-8 -*-
"""
将 Tab 缩进的大纲 .txt 转为 FreeMind .mm，便于在 XMind 中通过「导入 -> FreeMind Map」使用。
用法：python outline_to_freemind.py [大纲.txt]
  不传参数时，将 04-导出XMind 下所有 *_xmind_outline.txt 转为同名的 .mm
"""

import os
import re
import sys
import xml.sax.saxutils as saxutils

FRAMEWORK_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(FRAMEWORK_ROOT, "04-导出XMind")


def escape_mm(text):
    if not text:
        return ""
    return saxutils.escape(text)


def outline_to_mm(lines):
    """Tab 缩进大纲转 FreeMind XML。返回 (root_text, xml_children_string)。"""
    stack = []  # [(level, node_text), ...]
    result = []

    for line in lines:
        line = line.rstrip("\n\r")
        if not line:
            continue
        stripped = line.lstrip("\t")
        level = len(line) - len(stripped)
        text = stripped

        # 闭合比当前层级深的节点
        while stack and stack[-1][0] >= level:
            stack.pop()
            result.append("</node>")

        # 当前节点
        result.append('<node TEXT="%s">' % escape_mm(text))
        stack.append((level, text))

    # 闭合所有未闭合节点
    while stack:
        stack.pop()
        result.append("</node>")

    return "\n".join(result)


def convert_file(txt_path):
    with open(txt_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    if not lines:
        return False
    first = lines[0].strip()
    if not first:
        return False
    # 根节点为第一行（无缩进）
    root_text = first
    rest = []
    for line in lines[1:]:
        if line.startswith("\t"):
            rest.append(line)
        else:
            stripped = line.strip()
            if stripped:
                rest.append(line)
    children_xml = outline_to_mm(rest) if rest else ""

    mm_content = '''<?xml version="1.0" encoding="UTF-8"?>
<map version="1.0.1">
<node TEXT="%s">
%s
</node>
</map>''' % (escape_mm(root_text), children_xml)

    base = os.path.splitext(os.path.basename(txt_path))[0]
    base = re.sub(r"_xmind_outline$", "", base)
    mm_path = os.path.join(os.path.dirname(txt_path), base + ".mm")
    with open(mm_path, "w", encoding="utf-8") as f:
        f.write(mm_content)
    print("已生成 FreeMind .mm:", mm_path)
    return True


def main():
    if len(sys.argv) > 1:
        txt_files = [p for p in sys.argv[1:] if p.endswith(".txt")]
    else:
        if not os.path.isdir(OUTPUT_DIR):
            print("目录不存在:", OUTPUT_DIR)
            return
        txt_files = [
            os.path.join(OUTPUT_DIR, f)
            for f in os.listdir(OUTPUT_DIR)
            if f.endswith("_xmind_outline.txt") or (f.endswith(".txt") and "outline" in f)
        ]
    if not txt_files:
        print("未找到大纲 .txt 文件。可指定路径，如: python outline_to_freemind.py 04-导出XMind/xxx_xmind_outline.txt")
        return
    for path in txt_files:
        if os.path.isfile(path):
            try:
                convert_file(path)
            except Exception as e:
                print("转换失败", path, ":", e)
    print("完成。")


if __name__ == "__main__":
    main()
