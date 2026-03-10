import { api, type Stats } from "./client";

export const statsApi = {
  get: () => api.get<Stats>("/stats").then((r) => r.data),
};
