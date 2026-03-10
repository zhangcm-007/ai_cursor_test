import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

export interface RequirementAttachment {
  id: string;
  filename: string;
  mimeType: string | null;
  size: number;
}

export interface Requirement {
  id: string;
  title: string;
  content: string | null;
  updatedAt: string;
  attachments?: RequirementAttachment[];
  testPoints?: TestPoint[];
  _count?: { testPoints: number };
}

export interface TestPoint {
  id: string;
  requirementId: string;
  pointId: string;
  description: string | null;
  type: string | null;
  requirement?: Requirement;
  _count?: { testCases: number };
}

export interface TestCase {
  id: string;
  testPointId: string;
  caseId: string;
  title: string;
  priority: string | null;
  preconditions: string | null;
  steps: string | null;
  expected: string | null;
  testPoint?: TestPoint & { requirement?: Requirement };
}

export interface Stats {
  requirements: number;
  testPoints: number;
  testCases: number;
}
