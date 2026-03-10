import { api, type Requirement } from "./client";

export const requirementsApi = {
  list: () => api.get<Requirement[]>("/requirements").then((r) => r.data),
  get: (id: string) =>
    api.get<Requirement>(`/requirements/${id}`).then((r) => r.data),
  create: (data: { title: string; content?: string }) =>
    api.post<Requirement>("/requirements", data).then((r) => r.data),
  update: (id: string, data: { title?: string; content?: string }) =>
    api.put<Requirement>(`/requirements/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/requirements/${id}`),
};
