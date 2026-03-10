const API_BASE = "/api";

export const attachmentsApi = {
  getFileUrl: (attachmentId: string, download = false) =>
    `${API_BASE}/attachments/${attachmentId}/file${download ? "?download=1" : ""}`,
};
