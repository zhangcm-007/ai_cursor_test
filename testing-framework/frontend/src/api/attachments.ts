import { api } from "./client";

const API_BASE = "/api";

export const attachmentsApi = {
  getFileUrl: (attachmentId: string, download = false) =>
    `${API_BASE}/attachments/${attachmentId}/file${download ? "?download=1" : ""}`,
  upload: (requirementId: string, files: File[]) => {
    const form = new FormData();
    form.append("requirementId", requirementId);
    files.forEach((f) => form.append("files", f));
    return api
      .post<{ created: { id: string; filename: string }[] }>("/attachments/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000,
      })
      .then((r) => r.data);
  },
};
