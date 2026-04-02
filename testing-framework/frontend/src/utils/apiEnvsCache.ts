import type { QueryClient } from "react-query";
import type { ApiEnvironment } from "../api/api-regression";

/** 合并/写环境前取当前列表，避免仅用 hook 里的 environments 在多次快速写入时落后 */
export function getApiEnvironmentsFromCache(
  qc: QueryClient,
  fallback: ApiEnvironment[]
): ApiEnvironment[] {
  return (qc.getQueryData("api-envs") as ApiEnvironment[] | undefined) ?? fallback;
}

/** PUT 成功后立刻更新缓存，使下一次「自动提取」合并基于最新 JSON，不会用旧数据覆盖服务端 */
export function patchApiEnvironmentInCache(
  qc: QueryClient,
  environmentId: string,
  patch: Partial<Pick<ApiEnvironment, "variables" | "autoExtractedVariables">>
): void {
  qc.setQueryData<ApiEnvironment[]>("api-envs", (old) =>
    (old ?? []).map((e) => (e.id === environmentId ? { ...e, ...patch } : e))
  );
}
