import { api } from "./client";

export type XmindExportFormat = "txt" | "mm";

export const exportApi = {
  xmind: (body: {
    requirementIds?: string[];
    testCaseIds?: string[];
    format?: XmindExportFormat;
  }) =>
    api
      .post("/export/xmind", body, { responseType: "blob" })
      .then((r) => r.data as Blob),
  xmindTestPoints: (body: {
    requirementIds: string[];
    format?: XmindExportFormat;
  }) =>
    api
      .post("/export/xmind-outline", body, { responseType: "blob" })
      .then((r) => r.data as Blob),
};
