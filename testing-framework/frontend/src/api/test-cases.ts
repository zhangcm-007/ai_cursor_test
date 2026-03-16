import { api, type TestCase } from "./client";

export const testCasesApi = {
  list: (params?: { requirementId?: string; priority?: string }) =>
    api.get<TestCase[]>("/test-cases", { params }).then((r) => r.data),
  get: (id: string) =>
    api.get<TestCase>(`/test-cases/${id}`).then((r) => r.data),
  create: (data: {
    requirementId: string;
    caseId: string;
    featurePointL1?: string;
    featurePoint?: string;
    title: string;
    priority?: string;
    preconditions?: string;
    steps?: string;
    expected?: string;
    validationPoints?: string;
  }) => api.post<TestCase>("/test-cases", data).then((r) => r.data),
  update: (
    id: string,
    data: Partial<{
      caseId: string;
      featurePointL1: string;
      featurePoint: string;
      title: string;
      priority: string;
      preconditions: string;
      steps: string;
      expected: string;
      validationPoints: string;
    }>
  ) => api.put<TestCase>(`/test-cases/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/test-cases/${id}`),
  batchDelete: (ids: string[]) =>
    api.post<{ deleted: number }>("/test-cases/batch-delete", { ids }).then((r) => r.data),
};
