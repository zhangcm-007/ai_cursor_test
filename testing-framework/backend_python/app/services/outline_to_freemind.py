import re


def escape_mm(text: str) -> str:
    if not text:
        return ""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def outline_text_to_freemind(outline_text: str) -> str:
    lines = [l for l in re.split(r"\r?\n", outline_text) if l.strip() != ""]
    if not lines:
        return ""
    first = re.sub(r"^\t+", "", lines[0]).strip()
    if not first:
        return ""
    rest = lines[1:]
    stack: list[int] = []
    result: list[str] = []
    for line in rest:
        stripped = re.sub(r"^\t+", "", line)
        level = len(line) - len(stripped)
        while stack and stack[-1] >= level:
            stack.pop()
            result.append("</node>")
        result.append('<node TEXT="' + escape_mm(stripped.strip()) + '">')
        stack.append(level)
    while stack:
        stack.pop()
        result.append("</node>")
    children_xml = "\n".join(result)
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<map version="1.0.1">
<node TEXT="{escape_mm(first)}">
{children_xml}
</node>
</map>"""
