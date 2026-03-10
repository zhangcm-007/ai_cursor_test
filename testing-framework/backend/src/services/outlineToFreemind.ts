function escapeMm(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function outlineTextToFreemind(outlineText: string): string {
  const lines = outlineText.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return "";
  const first = lines[0].replace(/^\t+/, "").trim();
  if (!first) return "";
  const rest = lines.slice(1);
  const stack: { level: number }[] = [];
  const result: string[] = [];
  for (const line of rest) {
    const stripped = line.replace(/^\t+/, "");
    const level = line.length - stripped.length;
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
      result.push("</node>");
    }
    result.push('<node TEXT="' + escapeMm(stripped.trim()) + '">');
    stack.push({ level });
  }
  while (stack.length > 0) {
    stack.pop();
    result.push("</node>");
  }
  const childrenXml = result.join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.0.1">
<node TEXT="${escapeMm(first)}">
${childrenXml}
</node>
</map>`;
}
