import { api } from "./client";

export interface ModaoPage {
  name: string;
  textContent: string;
  annotations: string;
  screenshotBase64: string;
}

export interface ModaoExtractResult {
  prototypeName: string;
  pages: ModaoPage[];
}

export type ModaoJobStatus = "pending" | "running" | "completed" | "failed";

export interface ModaoJobState {
  status: ModaoJobStatus;
  result?: ModaoExtractResult;
  error?: string;
}

export const modaoApi = {
  extractStart: (body: { url: string; password: string }) =>
    api
      .post<{ jobId: string }>("/modao/extract", body, { timeout: 10000 })
      .then((r) => r.data),

  extractStatus: (jobId: string) =>
    api
      .get<ModaoJobState>(`/modao/extract/status/${jobId}`, { timeout: 30000 })
      .then((r) => r.data),
};

export function base64ToFile(base64: string, filename: string): File {
  const byteString = atob(base64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new File([ab], filename, { type: "image/png" });
}

export function assembleContent(pages: ModaoPage[]): string {
  return pages
    .map((p) => {
      let section = `## 页面：${p.name}\n${p.textContent || "(无文字内容)"}`;
      if (p.annotations) {
        section += `\n\n### 标注\n${p.annotations}`;
      }
      return section;
    })
    .join("\n\n---\n\n");
}
