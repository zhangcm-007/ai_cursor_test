import { api, type TestPoint } from "./client";

export const testPointsApi = {
  list: (requirementId?: string) =>
    api
      .get<TestPoint[]>("/test-points", {
        params: requirementId ? { requirementId } : {},
      })
      .then((r) => r.data),
  get: (id: string) =>
    api.get<TestPoint>(`/test-points/${id}`).then((r) => r.data),
  create: (data: {
    requirementId: string;
    pointId: string;
    description: string;
    type?: string;
  }) => api.post<TestPoint>("/test-points", data).then((r) => r.data),
  update: (
    id: string,
    data: { pointId?: string; description?: string; type?: string }
  ) => api.put<TestPoint>(`/test-points/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/test-points/${id}`),
};
