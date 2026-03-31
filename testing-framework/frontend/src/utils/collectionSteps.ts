import type { ApiEndpoint } from "../api/api-regression";

export type ParsedCollectionStep = {
  jsonIndex: number;
  order: number;
  name: string;
  method: string;
  path: string;
  protocol: string;
  priority: string;
  includeInSubset: boolean;
};

/** 从集合 definition JSON 解析 HTTP(S) 等步骤的请求 method/path（与清单匹配用） */
export function parseCollectionDefinitionSteps(definitionRaw: string): ParsedCollectionStep[] {
  if (!definitionRaw?.trim()) return [];
  try {
    const d = JSON.parse(definitionRaw) as { steps?: unknown[] };
    const arr = Array.isArray(d.steps) ? d.steps : [];
    const out: ParsedCollectionStep[] = [];
    for (let jsonIndex = 0; jsonIndex < arr.length; jsonIndex++) {
      const s = arr[jsonIndex];
      if (s == null || typeof s !== "object") continue;
      const row = s as Record<string, unknown>;
      const req = row.request as Record<string, unknown> | undefined;
      const method = String(req?.method ?? "GET").toUpperCase();
      const path = String(req?.path ?? "");
      const protocol = String(row.protocol ?? "http").toLowerCase();
      const ord = out.length + 1;
      const defaultName = path ? `${method} ${path}` : `步骤 ${ord}`;
      const rawName = row.name;
      const name =
        rawName === undefined || rawName === null ? defaultName : String(rawName);
      const priority = String(row.priority ?? "");
      const includeInSubset = row.includeInSubset === true;
      out.push({ jsonIndex, order: ord, name, method, path, protocol, priority, includeInSubset });
    }
    return out;
  } catch {
    return [];
  }
}

/** 更新某一步的任意顶层字段，返回新 definition 字符串 */
export function updateStepFieldInDefinition(
  definitionRaw: string,
  stepJsonIndex: number,
  patch: Record<string, unknown>
): string {
  try {
    const d = JSON.parse(definitionRaw) as { steps?: unknown[] };
    const steps = Array.isArray(d.steps) ? d.steps : [];
    if (stepJsonIndex < 0 || stepJsonIndex >= steps.length) return definitionRaw;
    const s = steps[stepJsonIndex];
    if (s == null || typeof s !== "object") return definitionRaw;
    Object.assign(s, patch);
    return JSON.stringify(d, null, 2);
  } catch {
    return definitionRaw;
  }
}

/** 更新某一步的 name 并返回整段 definition 字符串（格式化缩进） */
export function updateStepNameInDefinition(
  definitionRaw: string,
  stepJsonIndex: number,
  newName: string
): string {
  try {
    const d = JSON.parse(definitionRaw) as { steps?: unknown[] };
    const steps = Array.isArray(d.steps) ? d.steps : [];
    if (stepJsonIndex < 0 || stepJsonIndex >= steps.length) return definitionRaw;
    const s = steps[stepJsonIndex];
    if (s == null || typeof s !== "object") return definitionRaw;
    const o = s as Record<string, unknown>;
    const cur = o.name === undefined || o.name === null ? "" : String(o.name);
    if (cur === newName) return definitionRaw;
    o.name = newName;
    return JSON.stringify(d, null, 2);
  } catch {
    return definitionRaw;
  }
}

/** 拖拽排序：将 steps[fromIndex] 移到 toIndex 位置，返回新 definition 字符串 */
export function reorderStepsInDefinition(
  definitionRaw: string,
  fromIndex: number,
  toIndex: number
): string {
  if (fromIndex === toIndex) return definitionRaw;
  try {
    const d = JSON.parse(definitionRaw) as { steps?: unknown[] };
    const steps = Array.isArray(d.steps) ? [...d.steps] : [];
    if (
      fromIndex < 0 ||
      fromIndex >= steps.length ||
      toIndex < 0 ||
      toIndex >= steps.length
    )
      return definitionRaw;
    const [item] = steps.splice(fromIndex, 1);
    steps.splice(toIndex, 0, item);
    d.steps = steps;
    return JSON.stringify(d, null, 2);
  } catch {
    return definitionRaw;
  }
}

/** 删除 definition 中指定下标的步骤，返回新 definition 字符串 */
export function removeStepFromDefinition(
  definitionRaw: string,
  stepIndex: number
): string {
  try {
    const d = JSON.parse(definitionRaw) as { steps?: unknown[] };
    const steps = Array.isArray(d.steps) ? [...d.steps] : [];
    if (stepIndex < 0 || stepIndex >= steps.length) return definitionRaw;
    steps.splice(stepIndex, 1);
    d.steps = steps;
    return JSON.stringify(d, null, 2);
  } catch {
    return definitionRaw;
  }
}

/** 向 definition.steps 末尾追加新步骤，返回新 definition 字符串 */
export function appendStepsToDefinition(
  definitionRaw: string,
  newSteps: Array<{ name: string; method: string; path: string; protocol?: string; headers?: Record<string, unknown>; json?: unknown }>
): string {
  try {
    const d = JSON.parse(definitionRaw || "{}") as Record<string, unknown>;
    const steps = Array.isArray(d.steps) ? [...d.steps] : [];
    for (const s of newSteps) {
      const step: Record<string, unknown> = {
        name: s.name || `${s.method} ${s.path}`,
        protocol: s.protocol || "http",
        request: {
          method: s.method,
          path: s.path,
          ...(s.headers && Object.keys(s.headers).length ? { headers: s.headers } : {}),
          ...(s.json !== undefined && s.json !== null ? { json: s.json } : {}),
        },
      };
      steps.push(step);
    }
    d.steps = steps;
    return JSON.stringify(d, null, 2);
  } catch {
    return definitionRaw;
  }
}

export type GeneratedAssertion = {
  type: string;
  equals?: unknown;
  path?: string;
  contains?: string;
  label: string;
};

/**
 * 根据调试步骤的实际响应，自动推断常用断言。
 * 返回带 label 的断言列表，供前端展示或直接写入 definition。
 */
export function generateAssertionsFromStep(
  statusCode: number | null,
  responseBody: string
): GeneratedAssertion[] {
  const assertions: GeneratedAssertion[] = [];

  if (statusCode != null) {
    assertions.push({
      type: "status",
      equals: statusCode,
      label: `状态码 = ${statusCode}`,
    });
  }

  if (!responseBody?.trim()) return assertions;

  let parsed: unknown;
  try {
    parsed = JSON.parse(responseBody);
  } catch {
    return assertions;
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    if (Array.isArray(parsed)) {
      assertions.push({
        type: "jsonpath_type",
        path: "$",
        label: "响应体为数组",
      });
    }
    return assertions;
  }

  const obj = parsed as Record<string, unknown>;
  const codeFields = ["code", "status", "errno", "errcode", "ret", "resultCode", "error_code"];
  const msgFields = ["message", "msg", "errMsg", "errorMessage", "error_msg", "description"];
  const dataFields = ["data", "result", "results", "content", "payload", "body", "list", "items"];
  const boolFields = ["success", "ok"];

  for (const [key, val] of Object.entries(obj)) {
    const kl = key.toLowerCase();
    if (codeFields.some((f) => f.toLowerCase() === kl)) {
      assertions.push({
        type: "jsonpath_equals",
        path: `$.${key}`,
        equals: val,
        label: `$.${key} = ${JSON.stringify(val)}`,
      });
    } else if (boolFields.some((f) => f.toLowerCase() === kl)) {
      assertions.push({
        type: "jsonpath_equals",
        path: `$.${key}`,
        equals: val,
        label: `$.${key} = ${JSON.stringify(val)}`,
      });
    } else if (msgFields.some((f) => f.toLowerCase() === kl)) {
      assertions.push({
        type: "jsonpath_exists",
        path: `$.${key}`,
        label: `$.${key} 存在`,
      });
    } else if (dataFields.some((f) => f.toLowerCase() === kl)) {
      assertions.push({
        type: "jsonpath_exists",
        path: `$.${key}`,
        label: `$.${key} 存在`,
      });
    } else if (val === null || typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
      assertions.push({
        type: "jsonpath_equals",
        path: `$.${key}`,
        equals: val,
        label: `$.${key} = ${JSON.stringify(val)}`,
      });
    } else {
      assertions.push({
        type: "jsonpath_exists",
        path: `$.${key}`,
        label: `$.${key} 存在`,
      });
    }
  }

  return assertions;
}

/**
 * 将断言数组写入 definition 中指定步骤的 assert 字段。
 * 与已有断言去重（按 type+path+equals 判断）。
 */
export function addAssertionsToDefinitionStep(
  definitionRaw: string,
  stepIndex: number,
  newAssertions: GeneratedAssertion[]
): { next: string; added: number } {
  try {
    const d = JSON.parse(definitionRaw) as { steps?: unknown[] };
    const steps = Array.isArray(d.steps) ? d.steps : [];
    if (stepIndex < 0 || stepIndex >= steps.length) return { next: definitionRaw, added: 0 };
    const step = steps[stepIndex];
    if (step == null || typeof step !== "object") return { next: definitionRaw, added: 0 };
    const s = step as Record<string, unknown>;
    const existing = Array.isArray(s.assert) ? (s.assert as Record<string, unknown>[]) : [];

    const isDuplicate = (a: GeneratedAssertion): boolean =>
      existing.some(
        (e) =>
          e.type === a.type &&
          (e.path ?? e.jsonpath) === a.path &&
          (a.equals === undefined || JSON.stringify(e.equals) === JSON.stringify(a.equals))
      );

    const toAdd = newAssertions.filter((a) => !isDuplicate(a));
    if (toAdd.length === 0) return { next: definitionRaw, added: 0 };

    const mapped = toAdd.map(({ label: _label, ...rest }) => rest);
    s.assert = [...existing, ...mapped];
    return { next: JSON.stringify(d, null, 2), added: toAdd.length };
  } catch {
    return { next: definitionRaw, added: 0 };
  }
}

/** 删除 definition 中指定步骤的第 assertIndex 条断言 */
export function removeAssertionFromDefinitionStep(
  definitionRaw: string,
  stepIndex: number,
  assertIndex: number
): string {
  try {
    const d = JSON.parse(definitionRaw) as { steps?: unknown[] };
    const steps = Array.isArray(d.steps) ? d.steps : [];
    if (stepIndex < 0 || stepIndex >= steps.length) return definitionRaw;
    const step = steps[stepIndex];
    if (step == null || typeof step !== "object") return definitionRaw;
    const s = step as Record<string, unknown>;
    const existing = Array.isArray(s.assert) ? [...(s.assert as unknown[])] : [];
    if (assertIndex < 0 || assertIndex >= existing.length) return definitionRaw;
    existing.splice(assertIndex, 1);
    s.assert = existing;
    return JSON.stringify(d, null, 2);
  } catch {
    return definitionRaw;
  }
}

/** 更新 definition 中指定步骤的指定断言，返回新 definition 字符串 */
export function updateAssertionInDefinitionStep(
  definitionRaw: string,
  stepIndex: number,
  assertIndex: number,
  patch: Record<string, unknown>
): string {
  try {
    const d = JSON.parse(definitionRaw) as { steps?: unknown[] };
    const steps = Array.isArray(d.steps) ? d.steps : [];
    if (stepIndex < 0 || stepIndex >= steps.length) return definitionRaw;
    const step = steps[stepIndex];
    if (step == null || typeof step !== "object") return definitionRaw;
    const s = step as Record<string, unknown>;
    const existing = Array.isArray(s.assert) ? [...(s.assert as Record<string, unknown>[])] : [];
    if (assertIndex < 0 || assertIndex >= existing.length) return definitionRaw;
    existing[assertIndex] = { ...existing[assertIndex], ...patch };
    s.assert = existing;
    return JSON.stringify(d, null, 2);
  } catch {
    return definitionRaw;
  }
}

export type DefinitionStepAssertion = {
  type: string;
  path?: string;
  equals?: unknown;
  contains?: string;
  name?: string;
  values?: unknown[];
  expected?: string;
  label: string;
};

export function formatAssertionLabel(a: Record<string, unknown>): string {
  const t = String(a.type ?? "");
  const p = a.path ?? a.jsonpath ?? "";
  switch (t) {
    case "status":
      return `状态码 = ${a.equals}`;
    case "jsonpath_equals":
      return `${p} = ${JSON.stringify(a.equals)}`;
    case "jsonpath_exists":
      return `${p} 存在`;
    case "jsonpath_not_equals":
      return `${p} ≠ ${JSON.stringify(a.equals)}`;
    case "jsonpath_type":
      return `${p} 类型为 ${a.expected}`;
    case "body_contains":
      return `响应体包含 "${a.contains}"`;
    case "body_not_contains":
      return `响应体不包含 "${a.contains}"`;
    case "header_contains":
      return `头 ${a.name} 包含 "${a.contains}"`;
    case "status_in":
      return `状态码 ∈ [${(a.values as unknown[])?.join(", ") ?? ""}]`;
    default:
      return `${t}: ${JSON.stringify(a)}`;
  }
}

/** 从 definition JSON 解析所有步骤的断言列表 */
export function getAllStepAssertionsFromDefinition(
  definitionRaw: string
): DefinitionStepAssertion[][] {
  if (!definitionRaw?.trim()) return [];
  try {
    const d = JSON.parse(definitionRaw) as { steps?: unknown[] };
    const arr = Array.isArray(d.steps) ? d.steps : [];
    return arr.map((raw) => {
      if (raw == null || typeof raw !== "object") return [];
      const s = raw as Record<string, unknown>;
      const assertArr = Array.isArray(s.assert) ? (s.assert as Record<string, unknown>[]) : [];
      return assertArr.map((a) => ({
        type: String(a.type ?? ""),
        path: a.path != null ? String(a.path) : a.jsonpath != null ? String(a.jsonpath) : undefined,
        equals: a.equals,
        contains: a.contains != null ? String(a.contains) : undefined,
        name: a.name != null ? String(a.name) : undefined,
        values: Array.isArray(a.values) ? a.values : undefined,
        expected: a.expected != null ? String(a.expected) : undefined,
        label: formatAssertionLabel(a),
      }));
    });
  } catch {
    return [];
  }
}

export function findEndpointForStep(
  step: { method: string; path: string },
  endpoints: ApiEndpoint[]
): ApiEndpoint | undefined {
  return endpoints.find(
    (e) => (e.method || "GET").toUpperCase() === step.method && (e.path || "") === step.path
  );
}

/** 从集合 definition 生成链式调试预填行（仅 HTTP(S) 步骤，含 request / extract） */
export type ChainDebugSeedRow = {
  endpointId?: string;
  method: string;
  path: string;
  headers: string;
  body: string;
  extractJson: string;
};

export function buildChainDebugSeedFromDefinition(
  definitionRaw: string,
  endpoints: ApiEndpoint[]
): ChainDebugSeedRow[] {
  if (!definitionRaw?.trim()) return [];
  try {
    const d = JSON.parse(definitionRaw) as { steps?: unknown[] };
    const arr = Array.isArray(d.steps) ? d.steps : [];
    const out: ChainDebugSeedRow[] = [];
    for (const raw of arr) {
      if (raw == null || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      const protocol = String(row.protocol ?? "http").toLowerCase();
      if (protocol !== "http" && protocol !== "https") continue;
      const req = row.request as Record<string, unknown> | undefined;
      const method = String(req?.method ?? "GET").toUpperCase();
      const path = String(req?.path ?? "/");
      const headersObj = req?.headers;
      let headers = "{}";
      if (headersObj && typeof headersObj === "object" && !Array.isArray(headersObj)) {
        headers = JSON.stringify(headersObj, null, 2);
      }
      let body = "";
      if (req && "json" in req && req.json !== undefined) {
        body = JSON.stringify(req.json, null, 2);
      }
      const ext = row.extract;
      let extractJson = "{}";
      if (ext && typeof ext === "object" && !Array.isArray(ext)) {
        extractJson = JSON.stringify(ext, null, 2);
      }
      const matched = findEndpointForStep({ method, path }, endpoints);
      out.push({
        endpointId: matched?.id,
        method,
        path,
        headers,
        body,
        extractJson,
      });
    }
    return out;
  } catch {
    return [];
  }
}
