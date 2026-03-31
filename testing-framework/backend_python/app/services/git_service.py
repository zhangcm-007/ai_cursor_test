"""与 Node 版 gitService 一致：按 commit 从本地仓库取代码"""

from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path

CODE_EXT = frozenset(
    {"ts", "tsx", "js", "jsx", "vue", "py", "go", "java", "rs", "css", "html", "json", "md", "txt", "mjs", "cjs"}
)
MAX_FILES = 6
MAX_CONTENT_LENGTH = 8000
_SHA_RE = re.compile(r"^[0-9a-fA-F]{7,40}$")


def normalize_commit_ref(inp: str) -> str:
    s = inp.strip()
    if not s:
        return s
    if "/commit/" in s or "/commits/" in s:
        part = (s.split("/commit/")[-1] if "/commit/" in s else s.split("/commits/")[-1]).split("#")[0].split("?")[0].strip()
        ref = part.split("/")[0].strip()
        if _SHA_RE.match(ref):
            print(f"[gitService] 从 commit 详情页链接解析出 SHA: {ref}")
            return ref
        raise RuntimeError(f'无法从链接中解析出 commit SHA。当前解析到: "{ref}"')
    if _SHA_RE.match(s):
        return s
    if "/" in s or "." in s:
        raise RuntimeError(
            "提交记录看起来像链接或路径，但未包含 /commit/。请填写 commit SHA 或完整 commit 详情页链接。"
        )
    return s


def is_code_file(name: str) -> bool:
    ext = Path(name).suffix.lstrip(".").lower()
    return ext in CODE_EXT


def matches_path(file_path: str, path_filters: list[str] | None) -> bool:
    if not path_filters:
        return True
    normalized = file_path.replace("\\", "/")
    for p in path_filters:
        prefix = p.replace("\\", "/").rstrip("/") + "/"
        if normalized == prefix.rstrip("/") or normalized.startswith(prefix):
            return True
    return False


def list_files_at_ref(repo_path: str, ref: str, path_filters: list[str] | None) -> list[str]:
    safe_ref = re.sub(r"[\s$`]", "", ref)
    out = subprocess.run(
        ["git", "ls-tree", "-r", "--name-only", safe_ref],
        cwd=repo_path,
        capture_output=True,
        text=True,
        timeout=120,
        check=True,
    ).stdout
    lines = [x for x in out.splitlines() if x]
    filtered = [f for f in lines if is_code_file(f) and matches_path(f, path_filters)]
    print(f"[gitService] listFilesAtRef ref={safe_ref} 全仓文件数={len(lines)} 代码且路径匹配数={len(filtered)}")
    return filtered


def get_file_content_at_ref(repo_path: str, ref: str, file_path: str) -> str:
    safe_ref = re.sub(r"[\s$`]", "", ref)
    safe_path = file_path.replace("\\", "/")
    out = subprocess.run(
        ["git", "show", f"{safe_ref}:{safe_path}"],
        cwd=repo_path,
        capture_output=True,
        text=True,
        timeout=120,
        check=True,
    ).stdout
    return out


def get_code_from_git(repo_path: str, commit: str, path_filters: list[str] | None = None) -> list[dict[str, str]]:
    print(f"[gitService] getCodeFromGit 入参: repoPath={repo_path} commit={commit} pathFilters={path_filters or []}")
    if not repo_path or not Path(repo_path, ".git").exists():
        raise RuntimeError("DEV_CODE_REPO_PATH 未配置或路径不是有效的 Git 仓库")
    trim = commit.strip()
    if not trim:
        raise RuntimeError("提交记录不能为空")
    ref = normalize_commit_ref(trim)
    if not ref:
        raise RuntimeError("提交记录不能为空")
    print(f'[gitService] 实际传给 git 的 ref: "{ref}" 长度={len(ref)}')
    try:
        file_list = list_files_at_ref(repo_path, ref, path_filters)
        print(f"[gitService] 筛选后文件数={len(file_list)} 前几名: {', '.join(file_list[:10]) or '(无)'}")
    except subprocess.CalledProcessError as e:
        print(f"[gitService] git ls-tree 执行失败: {e.stderr}")
        raise
    result: list[dict[str, str]] = []
    for i, fp in enumerate(file_list[:MAX_FILES]):
        try:
            content = get_file_content_at_ref(repo_path, ref, fp)
            if len(content) > MAX_CONTENT_LENGTH:
                content = content[:MAX_CONTENT_LENGTH] + "\n\n...(已截断)"
            result.append({"name": fp, "content": content})
            print(f"[gitService] 已读取 {i + 1}/{min(len(file_list), MAX_FILES)}: {fp} 长度={len(content)}")
        except Exception as e:
            print(f"[gitService] 读取 {fp} 失败: {e}")
    print(f"[gitService] getCodeFromGit 返回 {len(result)} 个文件")
    return result


def is_git_repo_configured() -> bool:
    repo = (os.getenv("DEV_CODE_REPO_PATH") or "").strip()
    return bool(repo and Path(repo, ".git").exists())
