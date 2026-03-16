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

export const generateApi = {
  testCasesStart: (body: {
    requirementId: string;
    includeHistory?: boolean;
    historyCount?: number;
  }) =>
    api.post<{ jobId: string }>("/generate/test-cases", body).then((r) => r.data),
  testCasesStatus: (jobId: string) =>
    api.get<TestCasesJobState>(`/generate/test-cases/status/${jobId}`).then((r) => r.data),
};
