import { api } from "./client";

export interface GenerateTestPointsResult {
  created: number;
  attachmentErrors: string[];
}

export interface GenerateTestCasesResult {
  created: number;
  attachmentErrors: string[];
}

export const generateApi = {
  testPoints: (body: {
    requirementId: string;
    includeHistory?: boolean;
    historyCount?: number;
  }) =>
    api
      .post<GenerateTestPointsResult>("/generate/test-points", body)
      .then((r) => r.data),
  testCases: (body: {
    requirementId: string;
    testPointIds?: string[];
    includeHistory?: boolean;
    historyCount?: number;
  }) =>
    api
      .post<GenerateTestCasesResult>("/generate/test-cases", body)
      .then((r) => r.data),
};
