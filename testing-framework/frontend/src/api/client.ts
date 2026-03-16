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
  /** 附件解析后的文本（图片 OCR、PDF/Word 提取等） */
  extractedText?: string | null;
}

export interface Requirement {
  id: string;
  title: string;
  content: string | null;
  updatedAt: string;
  attachments?: RequirementAttachment[];
  _count?: { testCases: number };
  testCaseCount?: number;
}

export interface TestCase {
  id: string;
  requirementId: string;
  caseId: string;
  /** 一级功能点（大模块） */
  featurePointL1: string | null;
  /** 二级功能点（一级下的模块） */
  featurePoint: string | null;
  title: string;
  priority: string | null;
  preconditions: string | null;
  steps: string | null;
  expected: string | null;
  /** 验证点，多条可用换行分隔 */
  validationPoints: string | null;
  updatedAt?: string;
  requirement?: Requirement;
}

export interface Stats {
  requirements: number;
  testCases: number;
}
