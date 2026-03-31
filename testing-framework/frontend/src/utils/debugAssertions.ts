import { message } from "antd";
import type { FormInstance } from "antd/es/form";

/** 调试断言：表单行 ↔ 后端 assert 数组 */

export type DebugAssertFormRow = {
  type: string;
  /** status.equals */
  statusCode?: string;
  path?: string;
  /** jsonpath_equals，可为数字/字符串/JSON 字面量 */
  equals?: string;
  headerName?: string;
  headerContains?: string;
  bodyContains?: string;
};

export const DEBUG_ASSERT_TYPE_OPTIONS = [
  { value: "status", label: "HTTP 状态码" },
  { value: "jsonpath_exists", label: "JSONPath 存在" },
  { value: "jsonpath_equals", label: "JSONPath 等于" },
  { value: "header_contains", label: "响应头包含" },
  { value: "body_contains", label: "响应体包含子串" },
];

export function defaultDebugAssertRow(): DebugAssertFormRow {
  return { type: "status", statusCode: "200" };
}

export function apiAssertToFormRow(a: Record<string, unknown>): DebugAssertFormRow {
  const t = String(a.type || "");
  if (t === "status") return { type: "status", statusCode: String(a.equals ?? "200") };
  if (t === "jsonpath_exists")
    return { type: "jsonpath_exists", path: String(a.path ?? (a as { jsonpath?: string }).jsonpath ?? "") };
  if (t === "jsonpath_equals") {
    const eq = a.equals;
    const es =
      eq !== null && typeof eq === "object" ? JSON.stringify(eq) : eq === undefined ? "" : String(eq);
    return {
      type: "jsonpath_equals",
      path: String(a.path ?? (a as { jsonpath?: string }).jsonpath ?? ""),
      equals: es,
    };
  }
  if (t === "header_contains")
    return {
      type: "header_contains",
      headerName: String(a.name ?? ""),
      headerContains: String(a.contains ?? ""),
    };
  if (t === "body_contains") return { type: "body_contains", bodyContains: String(a.contains ?? "") };
  return defaultDebugAssertRow();
}

export function rowToApiAssert(r: DebugAssertFormRow): Record<string, unknown> | null {
  if (!r?.type) return null;
  switch (r.type) {
    case "status": {
      const n = parseInt(String(r.statusCode ?? "200"), 10);
      return { type: "status", equals: Number.isNaN(n) ? 200 : n };
    }
    case "jsonpath_exists": {
      const p = (r.path || "").trim();
      if (!p) return null;
      return { type: "jsonpath_exists", path: p };
    }
    case "jsonpath_equals": {
      const p = (r.path || "").trim();
      if (!p) return null;
      const raw = (r.equals ?? "").trim();
      if (raw === "") return { type: "jsonpath_equals", path: p, equals: "" };
      try {
        return { type: "jsonpath_equals", path: p, equals: JSON.parse(raw) as unknown };
      } catch {
        const num = Number(raw);
        if (!Number.isNaN(num) && String(num) === raw) return { type: "jsonpath_equals", path: p, equals: num };
        if (raw === "true") return { type: "jsonpath_equals", path: p, equals: true };
        if (raw === "false") return { type: "jsonpath_equals", path: p, equals: false };
        if (raw === "null") return { type: "jsonpath_equals", path: p, equals: null };
        return { type: "jsonpath_equals", path: p, equals: raw };
      }
    }
    case "header_contains": {
      const n = (r.headerName || "").trim().toLowerCase();
      if (!n) return null;
      return { type: "header_contains", name: n, contains: r.headerContains || "" };
    }
    case "body_contains": {
      const c = (r.bodyContains || "").trim();
      if (!c) return null;
      return { type: "body_contains", contains: c };
    }
    default:
      return null;
  }
}

export function serializeAssertListForApi(rows: DebugAssertFormRow[] | undefined): object[] | undefined {
  if (!rows?.length) return undefined;
  const out = rows.map(rowToApiAssert).filter((x): x is Record<string, unknown> => x != null);
  return out.length ? out : undefined;
}

/** 从响应点选 / 快捷按钮追加一条断言到 Form.List assertList */
export function appendAssertionToDebugForm(form: FormInstance, a: Record<string, unknown>) {
  const list = (form.getFieldValue("assertList") as DebugAssertFormRow[]) ?? [];
  const row = apiAssertToFormRow(a);
  form.setFieldsValue({ assertList: [...list, row] });
  const idx = list.length;
  setTimeout(() => form.scrollToField?.(["assertList", idx, "type"]), 0);
  message.success("已追加断言");
}
