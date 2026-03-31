/** 运行变量表格行（用于 Form.List，避免字段名 `name` 与列表索引冲突） */
export type RunVarFormRow = { varName: string; varValue: string };

export function emptyRunVarRow(): RunVarFormRow {
  return { varName: "", varValue: "" };
}

/**
 * 将表格行合并为请求用的 Record；跳过变量名为空的行；重复变量名返回错误。
 */
export function runVarListToRecord(
  rows: RunVarFormRow[] | undefined
): { ok: true; record: Record<string, string> | undefined } | { ok: false; message: string } {
  if (!rows?.length) return { ok: true, record: undefined };
  const out: Record<string, string> = {};
  const seen = new Set<string>();
  for (const r of rows) {
    const k = (r.varName ?? "").trim();
    if (!k) continue;
    if (seen.has(k)) {
      return { ok: false, message: `变量名重复：${k}` };
    }
    seen.add(k);
    out[k] = String(r.varValue ?? "");
  }
  if (Object.keys(out).length === 0) return { ok: true, record: undefined };
  return { ok: true, record: out };
}

/** 环境 variables JSON → 表格行（用于环境页编辑） */
export function variablesJsonToVarList(raw: string | undefined): RunVarFormRow[] {
  try {
    const t = (raw ?? "").trim() || "{}";
    const o = JSON.parse(t) as unknown;
    if (!o || typeof o !== "object" || Array.isArray(o)) return [];
    return Object.entries(o as Record<string, unknown>).map(([k, v]) => ({
      varName: k,
      varValue: String(v ?? ""),
    }));
  } catch {
    return [];
  }
}

/** 表格行 → 存库的 variables JSON 字符串 */
export function varListToVariablesJson(
  rows: RunVarFormRow[] | undefined
): { ok: true; json: string } | { ok: false; message: string } {
  const r = runVarListToRecord(rows);
  if (!r.ok) return r;
  const obj = r.record ?? {};
  return { ok: true, json: JSON.stringify(obj, null, 2) };
}

/** 把运行变量合并进环境已有 variables JSON（同名键以 patch 为准） */
export function mergeVariablesJsonWithRecord(
  existingJson: string | undefined,
  patch: Record<string, string>
): string {
  let base: Record<string, string> = {};
  try {
    const o = JSON.parse((existingJson ?? "").trim() || "{}") as unknown;
    if (o && typeof o === "object" && !Array.isArray(o)) {
      base = Object.fromEntries(
        Object.entries(o as Record<string, unknown>).map(([k, v]) => [k, String(v ?? "")])
      );
    }
  } catch {
    base = {};
  }
  return JSON.stringify({ ...base, ...patch }, null, 2);
}
