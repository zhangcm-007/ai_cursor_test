/**
 * Traverse a parsed JSON value using a dot-path expression.
 * Supports: `data.code`, `$.data.list[0].id`, `list[2].name`
 */
export function resolveJsonPath(obj: unknown, path: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const parts = path
    .trim()
    .replace(/^\$\.?/, "")
    .split(/\./)
    .filter(Boolean);
  let cur: unknown = obj;
  for (const raw of parts) {
    const segs = raw.split(/\[/).map((s) => s.replace(/]$/, ""));
    for (const seg of segs) {
      if (cur === null || cur === undefined) return { ok: false, error: `路径中断，当前值为 ${String(cur)}` };
      if (/^\d+$/.test(seg)) {
        if (!Array.isArray(cur)) return { ok: false, error: `"${seg}" 需要数组，但当前值不是数组` };
        cur = cur[parseInt(seg)];
      } else {
        if (typeof cur !== "object") return { ok: false, error: `无法在非对象值上访问 "${seg}"` };
        cur = (cur as Record<string, unknown>)[seg];
      }
    }
  }
  if (cur === undefined) return { ok: false, error: "路径未匹配到值" };
  return { ok: true, value: cur };
}

/** 生成 jsonpath-ng 风格路径段 */
export function extendJsonPath(base: string, key: string): string {
  if (/^[a-zA-Z_$][\w$]*$/.test(key)) {
    return base === "$" ? `$.${key}` : `${base}.${key}`;
  }
  const esc = key.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `${base}["${esc}"]`;
}

export type JsonAssertSuggestion = {
  key: string;
  label: string;
  assert: Record<string, unknown>;
};

const MAX_EQUALS = 48;
const MAX_EXISTS_ROOT = 16;

function formatEqualsLabel(path: string, value: unknown): string {
  const pv =
    typeof value === "string"
      ? value.length > 18
        ? JSON.stringify(value.slice(0, 18) + "…")
        : JSON.stringify(value)
      : value === null
        ? "null"
        : String(value);
  return `${path} = ${pv}`;
}

/**
 * 从 JSON 生成「一键追加」断言建议：叶子 jsonpath_equals + 根下对象/数组子键的 jsonpath_exists。
 */
export function collectJsonAssertSuggestions(data: unknown): JsonAssertSuggestion[] {
  const equalsOut: JsonAssertSuggestion[] = [];

  const walkPrimitives = (value: unknown, path: string) => {
    if (equalsOut.length >= MAX_EQUALS) return;
    if (value !== null && typeof value === "object") {
      if (Array.isArray(value)) {
        value.forEach((item, i) => walkPrimitives(item, `${path}[${i}]`));
        return;
      }
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        walkPrimitives(v, extendJsonPath(path, k));
      }
      return;
    }
    equalsOut.push({
      key: `eq-${path}-${equalsOut.length}`,
      label: formatEqualsLabel(path, value),
      assert: { type: "jsonpath_equals", path, equals: value as string | number | boolean | null },
    });
  };

  walkPrimitives(data, "$");

  const existsOut: JsonAssertSuggestion[] = [];
  if (data !== null && typeof data === "object" && !Array.isArray(data)) {
    for (const k of Object.keys(data as object)) {
      if (existsOut.length >= MAX_EXISTS_ROOT) break;
      const v = (data as Record<string, unknown>)[k];
      if (v !== null && typeof v === "object") {
        const p = extendJsonPath("$", k);
        existsOut.push({
          key: `ex-${p}`,
          label: `存在 ${p}`,
          assert: { type: "jsonpath_exists", path: p },
        });
      }
    }
  }

  return [...equalsOut, ...existsOut];
}
