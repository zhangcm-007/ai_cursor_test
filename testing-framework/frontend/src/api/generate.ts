import { api } from "./client";

export interface GenerateTestCasesResult {
  created: number;
  attachmentErrors: string[];
}

export type TestCasesJobStatus = "pending" | "running" | "completed" | "failed";

export interface TestCasesJobState {
  status: TestCasesJobStatus;
  result?: GenerateTestCasesResult;
  error?: string;
}

const DEV_CODE_MAX_SEND = 12000;

export interface DevCodeFile {
  name: string;
  content: string;
}

export const generateApi = {
  testCasesStart: (body: {
    requirementId: string;
    includeHistory?: boolean;
    historyCount?: number;
    /** 粘贴的代码（可与 devCodeFiles 同时使用，后端会以「粘贴的代码」文件名并入） */
    devCode?: string;
    /** 以文档/技能形式：多文件带文件名，模型按文件理解（推荐） */
    devCodeFiles?: DevCodeFile[];
    /** 根据提交记录由后端从配置的 Git 仓库自动拉取代码（需后端配置 DEV_CODE_REPO_PATH） */
    devCodeRef?: { commit: string; paths?: string[] };
  }) => {
    const devCode = typeof body.devCode === "string" ? body.devCode.trim() : "";
    const truncated =
      devCode.length > DEV_CODE_MAX_SEND ? devCode.slice(0, DEV_CODE_MAX_SEND) : devCode;
    const payload = {
      ...body,
      devCode: truncated || undefined,
      devCodeFiles: Array.isArray(body.devCodeFiles) ? body.devCodeFiles : undefined,
      devCodeRef: body.devCodeRef,
    };
    return api
      .post<{ jobId: string }>("/generate/test-cases", payload, { timeout: 90000 })
      .then((r) => r.data);
  },
  testCasesStatus: (jobId: string) =>
    api.get<TestCasesJobState>(`/generate/test-cases/status/${jobId}`).then((r) => r.data),
};

/** 将 File 列表读为 DevCodeFile[]，用于 skill 方式带给模型 */
export function readFilesAsDevCodeFiles(files: File[]): Promise<DevCodeFile[]> {
  const read = (f: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result ?? ""));
      r.onerror = () => reject(new Error(`读取失败: ${f.name}`));
      r.readAsText(f, "utf-8");
    });
  return Promise.all(files.map(async (f) => ({ name: f.name, content: await read(f) })));
}
