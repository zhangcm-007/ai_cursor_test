import { api } from "./client";

export interface GenerateTestPointsResult {
  created: number;
  attachmentErrors: string[];
}

export type TestPointsJobStatus = "pending" | "running" | "completed" | "failed";

export interface TestPointsJobState {
  status: TestPointsJobStatus;
  result?: GenerateTestPointsResult;
  error?: string;
}

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
  testPointsStart: (body: {
    requirementId: string;
    includeHistory?: boolean;
    historyCount?: number;
  }) =>
    api.post<{ jobId: string }>("/generate/test-points", body).then((r) => r.data),
  testPointsStatus: (jobId: string) =>
    api.get<TestPointsJobState>(`/generate/test-points/status/${jobId}`).then((r) => r.data),
  testCasesStart: (body: {
    requirementId: string;
    testPointIds?: string[];
    includeHistory?: boolean;
    historyCount?: number;
  }) =>
    api.post<{ jobId: string }>("/generate/test-cases", body).then((r) => r.data),
  testCasesStatus: (jobId: string) =>
    api.get<TestCasesJobState>(`/generate/test-cases/status/${jobId}`).then((r) => r.data),
};
