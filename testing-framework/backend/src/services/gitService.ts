/**
 * 根据提交记录（commit / branch）从本地 Git 仓库查询代码文件内容，
 * 供生成测试用例时以「文档」形式带给模型。
 * 需配置环境变量 DEV_CODE_REPO_PATH 指向代码仓库根目录。
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import path from "path";

const CODE_EXT = new Set([
  "ts", "tsx", "js", "jsx", "vue", "py", "go", "java", "rs", "css", "html", "json", "md", "txt", "mjs", "cjs",
]);
const MAX_FILES = 6;
const MAX_CONTENT_LENGTH = 8000;

/** 仅接受 commit SHA（7～40 位十六进制），从 GitLab/GitHub 的 commit 详情页链接中解析，绝不把 URL 或路径传给 git */
function normalizeCommitRef(input: string): string {
  const s = input.trim();
  if (!s) return s;
  const shaOnly = /^[0-9a-fA-F]{7,40}$/;

  if (s.includes("/commit/") || s.includes("/commits/")) {
    const part = (s.split("/commit/").pop() ?? s.split("/commits/").pop() ?? "")
      .replace(/#.*$/, "")
      .replace(/\?.*$/, "")
      .trim();
    const ref = part.split("/")[0].trim();
    if (shaOnly.test(ref)) {
      console.log(`[gitService] 从 commit 详情页链接解析出 SHA: ${ref}（请确认 DEV_CODE_REPO_PATH 指向该链接对应的仓库）`);
      return ref;
    }
    throw new Error(
      `无法从链接中解析出 commit SHA。请粘贴「commit 详情页」完整链接（以 /commit/ 后跟 SHA 结尾），例如：.../commit/f566ec78acfd676ab08ff4c342b760b1c1c7ebd3。当前解析到: "${ref}"`
    );
  }

  if (shaOnly.test(s)) return s;
  if (s.includes("/") || s.includes(".")) {
    throw new Error(
      "提交记录看起来像链接或路径，但未包含 /commit/。请只填写 commit SHA（如 f566ec78acfd...）或完整的 commit 详情页链接（含 /commit/ 和 SHA）。"
    );
  }
  return s;
}

function isCodeFile(name: string): boolean {
  const ext = path.extname(name).replace(/^\./, "").toLowerCase();
  return CODE_EXT.has(ext);
}

function matchesPath(filePath: string, pathFilters: string[]): boolean {
  if (!pathFilters || pathFilters.length === 0) return true;
  const normalized = filePath.replace(/\\/g, "/");
  return pathFilters.some((p) => {
    const prefix = p.replace(/\\/g, "/").replace(/\/?$/, "/");
    return normalized === prefix || normalized.startsWith(prefix);
  });
}

/**
 * 在指定仓库的指定 commit（或分支）下列出文件路径。
 */
function listFilesAtRef(repoPath: string, ref: string, pathFilters?: string[]): string[] {
  const safeRef = ref.replace(/[\s$`]/g, "");
  const out = execSync(`git ls-tree -r --name-only "${safeRef}"`, {
    cwd: repoPath,
    encoding: "utf-8",
    maxBuffer: 2 * 1024 * 1024,
  });
  const lines = out.split(/\r?\n/).filter(Boolean);
  const filtered = lines.filter((f) => isCodeFile(f) && matchesPath(f, pathFilters ?? []));
  console.log(`[gitService] listFilesAtRef ref=${safeRef} 全仓文件数=${lines.length} 代码且路径匹配数=${filtered.length}`);
  return filtered;
}

/**
 * 获取指定 commit 下某文件的内容。
 */
function getFileContentAtRef(repoPath: string, ref: string, filePath: string): string {
  const safeRef = ref.replace(/[\s$`]/g, "");
  const safePath = filePath.replace(/\\/g, "/");
  const out = execSync(`git show "${safeRef}:${safePath}"`, {
    cwd: repoPath,
    encoding: "utf-8",
    maxBuffer: 2 * 1024 * 1024,
  });
  return out;
}

export interface DevCodeFile {
  name: string;
  content: string;
}

/**
 * 根据提交记录从本地 Git 仓库拉取代码文件列表及内容。
 * @param repoPath 仓库根目录（通常来自 DEV_CODE_REPO_PATH）
 * @param commit 提交 SHA 或分支名（如 main、feature/xxx）
 * @param pathFilters 可选路径前缀，只取这些路径下的文件（如 ["src/", "lib/"]）
 */
export function getCodeFromGit(
  repoPath: string,
  commit: string,
  pathFilters?: string[]
): DevCodeFile[] {
  console.log(`[gitService] getCodeFromGit 入参: repoPath=${repoPath} commit=${commit} pathFilters=${JSON.stringify(pathFilters ?? [])}`);
  if (!repoPath || !existsSync(path.join(repoPath, ".git"))) {
    console.error("[gitService] 校验失败: repoPath 为空或非 Git 仓库");
    throw new Error("DEV_CODE_REPO_PATH 未配置或路径不是有效的 Git 仓库");
  }
  const trimCommit = commit.trim();
  if (!trimCommit) throw new Error("提交记录不能为空");
  const ref = normalizeCommitRef(trimCommit);
  if (!ref) throw new Error("提交记录不能为空");
  console.log(`[gitService] 实际传给 git 的 ref（仅 SHA/分支）: "${ref}" 长度=${ref.length}`);

  let fileList: string[];
  try {
    fileList = listFilesAtRef(repoPath, ref, pathFilters);
    console.log(`[gitService] git ls-tree 筛选后文件数=${fileList.length} 前几名: ${fileList.slice(0, 10).join(", ") || "(无)"}`);
  } catch (e) {
    console.error("[gitService] git ls-tree 执行失败:", e instanceof Error ? e.message : e);
    throw e;
  }

  const result: DevCodeFile[] = [];
  const toFetch = Math.min(fileList.length, MAX_FILES);
  for (let i = 0; i < toFetch; i++) {
    const filePath = fileList[i];
    try {
      let content = getFileContentAtRef(repoPath, ref, filePath);
      if (content.length > MAX_CONTENT_LENGTH) {
        content = content.slice(0, MAX_CONTENT_LENGTH) + "\n\n...(已截断)";
      }
      result.push({ name: filePath, content });
      console.log(`[gitService] 已读取 ${i + 1}/${toFetch}: ${filePath} 长度=${content.length}`);
    } catch (e) {
      console.warn(`[gitService] 读取 ${filePath} 失败:`, e instanceof Error ? e.message : e);
    }
  }
  console.log(`[gitService] getCodeFromGit 返回 ${result.length} 个文件`);
  return result;
}

/**
 * 是否配置了可用的代码仓库路径。
 */
export function isGitRepoConfigured(): boolean {
  const repoPath = (process.env.DEV_CODE_REPO_PATH ?? "").trim();
  if (!repoPath) return false;
  return existsSync(path.join(repoPath, ".git"));
}
