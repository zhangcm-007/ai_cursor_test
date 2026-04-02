import { api } from "./client";

export interface ApiEnvironment {
  id: string;
  name: string;
  baseUrl: string;
  /** 手动维护的环境变量 JSON */
  variables: string;
  /** 调试「自动提取到环境」写入的 JSON；与 variables 合并参与请求，同名时 variables 优先 */
  autoExtractedVariables?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ApiEnvironmentUpdateBody = Partial<{
  name: string;
  baseUrl: string;
  variables: string;
  autoExtractedVariables: string;
}>;

export interface ApiCollection {
  id: string;
  name: string;
  description: string;
  definition?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiEndpoint {
  id: string;
  method: string;
  path: string;
  name: string;
  description: string;
  protocol: string;
  sampleRequest: string;
  /** JSON 字符串：请求头对象，用于调试/curl 导入 */
  sampleHeaders?: string;
  /** 调试弹窗「保存」后的表单快照 JSON；未保存则每次从 sample 推导 */
  debugDraft?: string;
}

export interface ApiRunSummary {
  id: string;
  status: string;
  triggeredBy: string;
  regressionMode: string;
  environmentName: string;
  baseUrlSnapshot: string;
  collectionId: string;
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string;
}

export interface ApiRunStep {
  id: string;
  orderIndex: number;
  name: string;
  requestMethod: string;
  requestUrl: string;
  statusCode: number | null;
  passed: boolean;
  error: string;
  requestBodyMasked: string;
  responseBodyMasked: string;
  assertionResults: { index?: number; type?: string; passed: boolean; message?: string }[];
  durationMs: number | null;
}

export interface ApiRunDetail extends ApiRunSummary {
  steps: ApiRunStep[];
  correlationId?: string | null;
  requirementId?: string | null;
  environmentId: string;
}

export interface ApiScheduleRow {
  id: string;
  name: string;
  cronExpression: string;
  regressionMode: string;
  environmentId: string;
  collectionId: string;
  enabled: boolean;
}

export interface ApiDebugResult {
  requestMethod: string;
  requestUrl: string;
  requestHeadersMasked: string;
  requestBodyMasked: string;
  /** 单接口调试时后端附带：请求体原文（含 password 等），便于核对实际发送内容 */
  requestBodyPlain?: string;
  statusCode: number | null;
  durationMs: number;
  responseHeaders: Record<string, string>;
  responseBody: string;
  responseBodyTruncated: boolean;
  responseByteLength?: number;
  error: string;
  assertionsPassed: boolean | null;
  assertionResults: { index?: number; type?: string; passed: boolean; message?: string }[];
}

export interface ApiDebugChainStepResult extends ApiDebugResult {
  extracted: Record<string, string>;
}

export interface ApiDebugChainResult {
  ok: boolean;
  stoppedAt: number | null;
  steps: ApiDebugChainStepResult[];
  ctxKeys: string[];
  initialCtxKeys?: string[];
  error?: string;
}

export const apiRegressionApi = {
  environments: {
    list: () => api.get<ApiEnvironment[]>("/api-regression/environments").then((r) => r.data),
    create: (body: { name: string; baseUrl: string; variables?: string; autoExtractedVariables?: string }) =>
      api.post("/api-regression/environments", body).then((r) => r.data),
    update: (id: string, body: ApiEnvironmentUpdateBody) =>
      api.put(`/api-regression/environments/${id}`, body).then((r) => r.data),
    delete: (id: string) => api.delete(`/api-regression/environments/${id}`).then((r) => r.data),
  },
  collections: {
    list: () => api.get<ApiCollection[]>("/api-regression/collections").then((r) => r.data),
    get: (id: string) => api.get<ApiCollection>(`/api-regression/collections/${id}`).then((r) => r.data),
    create: (body: { name: string; description?: string; definition?: string | object }) =>
      api.post("/api-regression/collections", body).then((r) => r.data),
    update: (id: string, body: Partial<{ name: string; description: string; definition: string | object }>) =>
      api.put(`/api-regression/collections/${id}`, body).then((r) => r.data),
    delete: (id: string) => api.delete(`/api-regression/collections/${id}`).then((r) => r.data),
    generateFromEndpoints: (id: string, endpointIds: string[]) =>
      api.post(`/api-regression/collections/${id}/generate-from-endpoints`, { endpointIds }).then((r) => r.data),
    syncStepsFromDrafts: (id: string) =>
      api.post<{ definition: string; updated: number; total: number }>(
        `/api-regression/collections/${id}/sync-steps-from-drafts`
      ).then((r) => r.data),
  },
  endpoints: {
    list: () => api.get<ApiEndpoint[]>("/api-regression/endpoints").then((r) => r.data),
    create: (body: Partial<ApiEndpoint> & { path: string }) =>
      api.post("/api-regression/endpoints", body).then((r) => r.data),
    update: (
      id: string,
      body: Partial<
        Pick<
          ApiEndpoint,
          | "method"
          | "path"
          | "name"
          | "description"
          | "protocol"
          | "sampleRequest"
          | "sampleHeaders"
          | "debugDraft"
        >
      >
    ) => api.put(`/api-regression/endpoints/${id}`, body).then((r) => r.data),
    importJson: (endpoints: object[]) =>
      api.post("/api-regression/endpoints/import-json", { endpoints }).then((r) => r.data),
    delete: (id: string) => api.delete(`/api-regression/endpoints/${id}`).then((r) => r.data),
  },
  debug: {
    request: (body: {
      environmentId?: string;
      baseUrl?: string;
      method: string;
      path: string;
      url?: string;
      headers?: Record<string, string>;
      json?: unknown;
      body?: string;
      runVariables?: Record<string, string>;
      timeout?: number;
      assert?: object[];
    }) => api.post<ApiDebugResult>("/api-regression/debug/request", body).then((r) => r.data),
    debugDefinition: (body: {
      environmentId: string;
      definition: string;
      runVariables?: Record<string, string>;
      timeout?: number;
      continueOnFailure?: boolean;
      /** 默认 true：调试结束后把各步 extract 结果合并进环境 autoExtractedVariables */
      persistExtractToEnv?: boolean;
    }) => api.post<ApiDebugChainResult>("/api-regression/debug/definition", body).then((r) => r.data),
    requestChain: (body: {
      environmentId?: string;
      baseUrl?: string;
      runVariables?: Record<string, string>;
      timeout?: number;
      steps: Array<{
        method: string;
        path: string;
        url?: string;
        headers?: Record<string, string>;
        json?: unknown;
        body?: string;
        assert?: object[];
        extract?: Record<string, string>;
      }>;
    }) => api.post<ApiDebugChainResult>("/api-regression/debug/request-chain", body).then((r) => r.data),
  },
  runs: {
    list: (limit?: number) =>
      api.get<ApiRunSummary[]>("/api-regression/runs", { params: { limit } }).then((r) => r.data),
    get: (id: string) => api.get<ApiRunDetail>(`/api-regression/runs/${id}`).then((r) => r.data),
    create: (body: {
      environmentId: string;
      collectionId: string;
      regressionMode?: string;
      triggeredBy?: string;
      runVariables?: Record<string, string>;
      correlationId?: string;
    }) => api.post<ApiRunDetail>("/api-regression/runs", body).then((r) => r.data),
    reportMd: (id: string) =>
      api.get<string>(`/api-regression/runs/${id}/report`, { params: { format: "md" }, responseType: "text" }).then((r) => r.data),
  },
  schedules: {
    list: () => api.get<ApiScheduleRow[]>("/api-regression/schedules").then((r) => r.data),
    create: (body: {
      name: string;
      cronExpression: string;
      environmentId: string;
      collectionId: string;
      regressionMode?: string;
      enabled?: boolean;
    }) => api.post("/api-regression/schedules", body).then((r) => r.data),
    delete: (id: string) => api.delete(`/api-regression/schedules/${id}`).then((r) => r.data),
  },
  generate: {
    startSingleApiTests: (body: { endpointIds: string[]; environmentId?: string }) =>
      api.post<{ jobId: string }>("/api-regression/generate-api-tests", body).then((r) => r.data),
    analyzeDependencies: (body: { endpointIds: string[] }) =>
      api.post<{ chains: DependencyChain[] }>("/api-regression/analyze-dependencies", body).then((r) => r.data),
    startChainTests: (body: { chains: DependencyChain[]; endpointIds: string[]; environmentId?: string }) =>
      api.post<{ jobId: string }>("/api-regression/generate-chain-tests", body).then((r) => r.data),
    status: (jobId: string) =>
      api.get<GenJobStatus>(`/api-regression/generate-api-tests/status/${jobId}`).then((r) => r.data),
  },
};

export interface DependencyChainStep {
  endpointId: string;
  endpointName?: string;
  method?: string;
  path?: string;
  name: string;
  extract?: Record<string, string>;
  dependsOnVars?: string[];
}

export interface DependencyChain {
  name: string;
  description: string;
  steps: DependencyChainStep[];
}

export interface GenJobResult {
  collections: { id: string; name: string; stepCount: number }[];
  testCaseCount: number;
  requirementId: string;
}

export interface GenJobStatus {
  status: "pending" | "running" | "completed" | "failed";
  result?: GenJobResult;
  error?: string;
}
