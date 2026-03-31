import type { ApiEndpoint, ApiEnvironment } from "../api/api-regression";
import { defaultDebugAssertRow, type DebugAssertFormRow } from "./debugAssertions";
import type { RunVarFormRow } from "./runVariablesForm";

export type ExtractToEnvRule = { varName: string; path: string };

const DRAFT_KEYS = [
  "environmentId",
  "method",
  "path",
  "headers",
  "body",
  "timeout",
  "runVarList",
  "assertList",
  "extractToEnv",
] as const;

/** 无保存草稿时，由接口 sample 推导调试表单默认值 */
export function buildDebugModalDefaults(ep: ApiEndpoint, environments: ApiEnvironment[]): Record<string, unknown> {
  const method = (ep.method || "GET").toUpperCase();
  let bodyStr = "";
  let headersStr = "{}";
  const shRaw = (ep.sampleHeaders || "").trim();
  if (shRaw) {
    try {
      const ho = JSON.parse(shRaw) as unknown;
      if (ho && typeof ho === "object" && !Array.isArray(ho)) {
        headersStr = JSON.stringify(ho, null, 2);
      }
    } catch {
      /* keep {} */
    }
  }
  const sr = (ep.sampleRequest || "").trim();
  if (sr) {
    try {
      const o = JSON.parse(sr) as Record<string, unknown>;
      if (o && typeof o === "object" && "json" in o && o.json !== undefined) {
        bodyStr = JSON.stringify(o.json, null, 2);
        const h = o.headers;
        if (!shRaw && h && typeof h === "object" && !Array.isArray(h)) {
          headersStr = JSON.stringify(h, null, 2);
        } else if (!shRaw && method !== "GET" && bodyStr) {
          headersStr = JSON.stringify({ "Content-Type": "application/json" }, null, 2);
        }
      } else {
        bodyStr = JSON.stringify(o, null, 2);
        if (!shRaw && method !== "GET") {
          headersStr = JSON.stringify({ "Content-Type": "application/json" }, null, 2);
        }
      }
    } catch {
      bodyStr = sr;
    }
  }
  return {
    environmentId: environments[0]?.id,
    method,
    path: ep.path,
    headers: headersStr,
    body: bodyStr,
    timeout: 30,
    runVarList: [] as RunVarFormRow[],
    assertList: [defaultDebugAssertRow()] as DebugAssertFormRow[],
    extractToEnv: [] as ExtractToEnvRule[],
  };
}

export function mergeDebugDraftIntoDefaults(
  base: Record<string, unknown>,
  draftRaw: string | undefined,
  environments: ApiEnvironment[]
): Record<string, unknown> {
  const t = draftRaw?.trim();
  if (!t || t === "{}") return base;
  try {
    const d = JSON.parse(t) as Record<string, unknown>;
    if (!d || typeof d !== "object" || Array.isArray(d)) return base;
    const out = { ...base };
    for (const k of DRAFT_KEYS) {
      if (!(k in d)) continue;
      const v = d[k];
      if (v === undefined) continue;
      if (k === "assertList" && !Array.isArray(v)) continue;
      if (k === "runVarList" && !Array.isArray(v)) continue;
      if (k === "extractToEnv" && !Array.isArray(v)) continue;
      (out as Record<string, unknown>)[k] = v;
    }
    const envIds = new Set(environments.map((e) => e.id));
    const eid = out.environmentId;
    if (typeof eid === "string" && eid && !envIds.has(eid)) {
      out.environmentId = environments[0]?.id;
    }
    if (out.timeout != null && typeof out.timeout !== "number") {
      const n = Number(out.timeout);
      out.timeout = Number.isFinite(n) ? n : 30;
    }
    return out;
  } catch {
    return base;
  }
}

export function debugFormValuesToDraftJson(v: Record<string, unknown>): string {
  const runVarList = Array.isArray(v.runVarList) ? v.runVarList : [];
  const assertList = Array.isArray(v.assertList) ? v.assertList : [defaultDebugAssertRow()];
  const extractToEnv = Array.isArray(v.extractToEnv) ? v.extractToEnv : [];
  const to = v.timeout != null ? Number(v.timeout) : 30;
  return JSON.stringify({
    environmentId: v.environmentId ?? null,
    method: v.method,
    path: v.path,
    headers: (v.headers as string | undefined) ?? "",
    body: (v.body as string | undefined) ?? "",
    timeout: Number.isFinite(to) ? to : 30,
    runVarList,
    assertList,
    extractToEnv,
  });
}

export function hasSavedDebugDraft(draftRaw: string | undefined): boolean {
  const t = draftRaw?.trim();
  if (!t || t === "{}") return false;
  try {
    const d = JSON.parse(t) as unknown;
    return d != null && typeof d === "object" && !Array.isArray(d) && Object.keys(d as object).length > 0;
  } catch {
    return false;
  }
}
