#!/usr/bin/env python3
"""GitLab API utility for source code search and project discovery.

⚠️ SAFETY: This script is READ-ONLY. Only GET requests are used.
No push, commit, merge, delete, or any write operation is supported.
All API calls use requests.get() exclusively.
"""

import argparse
import json
import sys
from pathlib import Path
from urllib.parse import quote

import requests
import yaml

CONFIG_PATH = Path(__file__).parent.parent / "config.yaml"


def load_config() -> dict:
    if not CONFIG_PATH.exists():
        print(f"ERROR: Config not found at {CONFIG_PATH}", file=sys.stderr)
        sys.exit(1)
    with open(CONFIG_PATH, encoding="utf-8") as f:
        return yaml.safe_load(f)


def get_gitlab_config(config: dict) -> dict:
    gl = config.get("gitlab", {})
    if not gl.get("url") or not gl.get("token"):
        print("ERROR: GitLab url and token must be set in config.yaml", file=sys.stderr)
        sys.exit(1)
    return gl


def gitlab_request(gl_config: dict, endpoint: str, params: dict = None) -> dict | list:
    url = f"{gl_config['url'].rstrip('/')}/api/v4{endpoint}"
    headers = {"PRIVATE-TOKEN": gl_config["token"]}
    resp = requests.get(url, headers=headers, params=params or {}, timeout=30, verify=False)
    if resp.status_code != 200:
        print(f"ERROR: GitLab API returned {resp.status_code}", file=sys.stderr)
        print(resp.text[:500], file=sys.stderr)
        sys.exit(1)
    return resp.json()


def search_code(gl_config: dict, keyword: str, project: str = None, group: str = None) -> list[dict]:
    """Search for code across GitLab projects."""
    results = []

    if project:
        encoded = quote(project, safe="")
        endpoint = f"/projects/{encoded}/search"
        params = {"scope": "blobs", "search": keyword, "per_page": 20}
        raw = gitlab_request(gl_config, endpoint, params)
        for item in raw:
            results.append({
                "project": project,
                "file": item.get("filename", ""),
                "path": item.get("path", ""),
                "ref": item.get("ref", "main"),
                "startline": item.get("startline", 0),
                "data": item.get("data", "")[:500],
            })
    elif group:
        encoded = quote(group, safe="")
        endpoint = f"/groups/{encoded}/search"
        params = {"scope": "blobs", "search": keyword, "per_page": 20}
        raw = gitlab_request(gl_config, endpoint, params)
        for item in raw:
            results.append({
                "project": item.get("project_id", ""),
                "file": item.get("filename", ""),
                "path": item.get("path", ""),
                "ref": item.get("ref", "main"),
                "startline": item.get("startline", 0),
                "data": item.get("data", "")[:500],
            })
    else:
        default_group = gl_config.get("default_group")
        if default_group:
            return search_code(gl_config, keyword, group=default_group)
        endpoint = "/search"
        params = {"scope": "blobs", "search": keyword, "per_page": 20}
        raw = gitlab_request(gl_config, endpoint, params)
        for item in raw:
            results.append({
                "project": item.get("project_id", ""),
                "file": item.get("filename", ""),
                "path": item.get("path", ""),
                "ref": item.get("ref", "main"),
                "startline": item.get("startline", 0),
                "data": item.get("data", "")[:500],
            })

    return results


def list_projects(gl_config: dict, group: str = None, search: str = None) -> list[dict]:
    """List GitLab projects, optionally filtered by group or search term."""
    if group:
        encoded = quote(group, safe="")
        endpoint = f"/groups/{encoded}/projects"
        params = {"per_page": 50, "order_by": "name", "sort": "asc"}
        if search:
            params["search"] = search
    else:
        endpoint = "/projects"
        params = {"per_page": 50, "order_by": "name", "sort": "asc", "membership": True}
        if search:
            params["search"] = search

    raw = gitlab_request(gl_config, endpoint, params)
    return [
        {
            "id": p["id"],
            "name": p.get("name", ""),
            "path_with_namespace": p.get("path_with_namespace", ""),
            "web_url": p.get("web_url", ""),
            "default_branch": p.get("default_branch", "main"),
            "description": (p.get("description") or "")[:200],
        }
        for p in raw
    ]


def get_file_content(gl_config: dict, project: str, file_path: str, ref: str = "main") -> str:
    """Get the content of a specific file from a GitLab project."""
    encoded_project = quote(project, safe="")
    encoded_path = quote(file_path, safe="")
    endpoint = f"/projects/{encoded_project}/repository/files/{encoded_path}/raw"
    params = {"ref": ref}

    url = f"{gl_config['url'].rstrip('/')}/api/v4{endpoint}"
    headers = {"PRIVATE-TOKEN": gl_config["token"]}
    resp = requests.get(url, headers=headers, params=params, timeout=30, verify=False)
    if resp.status_code != 200:
        print(f"ERROR: Failed to get file: {resp.status_code}", file=sys.stderr)
        return ""
    return resp.text


def main():
    parser = argparse.ArgumentParser(description="GitLab API Utility")
    subparsers = parser.add_subparsers(dest="command", required=True)

    sp_search = subparsers.add_parser("search", help="Search code")
    sp_search.add_argument("--keyword", required=True, help="Search keyword (class/method name)")
    sp_search.add_argument("--project", default=None, help="Specific project (path_with_namespace)")
    sp_search.add_argument("--group", default=None, help="GitLab group to search in")

    sp_projects = subparsers.add_parser("projects", help="List projects")
    sp_projects.add_argument("--group", default=None, help="GitLab group")
    sp_projects.add_argument("--search", default=None, help="Search by project name")

    sp_file = subparsers.add_parser("file", help="Get file content")
    sp_file.add_argument("--project", required=True, help="Project path_with_namespace")
    sp_file.add_argument("--path", required=True, help="File path in repo")
    sp_file.add_argument("--ref", default=None, help="Branch/tag (default: from config by --env)")
    sp_file.add_argument("--env", default=None, help="Environment, used to resolve branch")

    sp_service = subparsers.add_parser("service", help="Find project for a service name")
    sp_service.add_argument("--name", required=True, help="Service/project_name from logs")

    args = parser.parse_args()
    config = load_config()
    gl_config = get_gitlab_config(config)
    branches = gl_config.get("branches", {})
    service_map = gl_config.get("service_project_map", {})

    if args.command == "search":
        results = search_code(gl_config, args.keyword, args.project, args.group)
        print(json.dumps({"count": len(results), "results": results}, ensure_ascii=False, indent=2))

    elif args.command == "projects":
        projects = list_projects(gl_config, args.group, args.search)
        print(json.dumps({"count": len(projects), "projects": projects}, ensure_ascii=False, indent=2))

    elif args.command == "file":
        ref = args.ref
        if not ref and args.env:
            ref = branches.get(args.env, "main")
        if not ref:
            ref = "main"
        content = get_file_content(gl_config, args.project, args.path, ref)
        print(content)

    elif args.command == "service":
        name = args.name
        if name in service_map:
            project_path = service_map[name]
            print(json.dumps({
                "service": name,
                "project": project_path,
                "branches": branches,
            }, ensure_ascii=False, indent=2))
        else:
            print(json.dumps({
                "service": name,
                "project": None,
                "message": f"Service '{name}' not in service_project_map. Available: {list(service_map.keys())}",
            }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
