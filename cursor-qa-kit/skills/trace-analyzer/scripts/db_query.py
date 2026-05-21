#!/usr/bin/env python3
"""Database query utility - supports MongoDB, MySQL, SQL Server.

⚠️ SAFETY: This script is READ-ONLY. Only SELECT / find queries are allowed.
All write operations (INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE,
EXEC, GRANT, REVOKE) are blocked at the script level.
"""

import argparse
import json
import re
import sys
from pathlib import Path

import yaml

CONFIG_PATH = Path(__file__).parent.parent / "config.yaml"

FORBIDDEN_SQL_KEYWORDS = [
    "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE",
    "CREATE", "REPLACE", "RENAME", "EXEC", "EXECUTE",
    "GRANT", "REVOKE", "MERGE", "CALL",
    "SET ", "LOCK ", "UNLOCK ",
]


def validate_sql_readonly(sql: str) -> None:
    """Reject any SQL that is not a pure read query."""
    normalized = re.sub(r'--.*$', '', sql, flags=re.MULTILINE)
    normalized = re.sub(r'/\*.*?\*/', '', normalized, flags=re.DOTALL)
    normalized = normalized.strip().upper()

    if not normalized.startswith(("SELECT", "SHOW", "DESCRIBE", "DESC", "EXPLAIN", "WITH")):
        print(f"BLOCKED: Only SELECT queries are allowed. Got: {sql[:80]}", file=sys.stderr)
        sys.exit(1)

    for kw in FORBIDDEN_SQL_KEYWORDS:
        pattern = r'\b' + kw.strip() + r'\b'
        if re.search(pattern, normalized):
            print(f"BLOCKED: Dangerous keyword '{kw.strip()}' detected. Only read queries are allowed.", file=sys.stderr)
            sys.exit(1)


def load_config() -> dict:
    if not CONFIG_PATH.exists():
        print(f"ERROR: Config not found at {CONFIG_PATH}", file=sys.stderr)
        sys.exit(1)
    with open(CONFIG_PATH, encoding="utf-8") as f:
        return yaml.safe_load(f)


def get_db_config(config: dict, env: str, db_type: str) -> dict:
    db = config.get("database", {})
    envs = db.get("environments", {})
    if env not in envs:
        print(f"ERROR: DB environment '{env}' not found. Available: {list(envs.keys())}", file=sys.stderr)
        sys.exit(1)
    env_cfg = envs[env]
    if db_type not in env_cfg:
        available = list(env_cfg.keys())
        print(f"ERROR: DB type '{db_type}' not configured for env '{env}'. Available: {available}", file=sys.stderr)
        sys.exit(1)
    return env_cfg[db_type]


def json_serializer(obj):
    """Handle non-serializable types."""
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    if isinstance(obj, bytes):
        return obj.decode("utf-8", errors="replace")
    if hasattr(obj, "__str__"):
        return str(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


# ========== MongoDB ==========

def query_mongodb(db_config: dict, database: str, collection: str,
                  query_str: str, projection_str: str, limit: int, sort_str: str) -> list[dict]:
    from pymongo import MongoClient

    uri = db_config.get("uri", "")
    if not uri:
        host = db_config.get("host", "localhost")
        port = db_config.get("port", 27017)
        username = db_config.get("username", "")
        password = db_config.get("password", "")
        auth_db = db_config.get("auth_database", "admin")
        if username and password:
            uri = f"mongodb://{username}:{password}@{host}:{port}/{auth_db}"
        else:
            uri = f"mongodb://{host}:{port}"

    client = MongoClient(uri, serverSelectionTimeoutMS=10000, connectTimeoutMS=10000)
    try:
        db_name = database or db_config.get("database", "")
        if not db_name:
            print("ERROR: --database is required for MongoDB queries", file=sys.stderr)
            sys.exit(1)

        db = client[db_name]
        coll = db[collection]

        query = json.loads(query_str) if query_str else {}
        projection = json.loads(projection_str) if projection_str else None
        sort = json.loads(sort_str) if sort_str else None

        cursor = coll.find(query, projection)
        if sort:
            sort_list = list(sort.items()) if isinstance(sort, dict) else sort
            cursor = cursor.sort(sort_list)
        if limit:
            cursor = cursor.limit(limit)

        rows = []
        for doc in cursor:
            if "_id" in doc:
                doc["_id"] = str(doc["_id"])
            rows.append(doc)
        return rows
    finally:
        client.close()


# ========== MySQL ==========

def query_mysql(db_config: dict, sql: str, limit: int) -> list[dict]:
    validate_sql_readonly(sql)
    import pymysql

    conn = pymysql.connect(
        host=db_config["host"],
        port=db_config.get("port", 3306),
        user=db_config["username"],
        password=db_config["password"],
        database=db_config["database"],
        charset=db_config.get("charset", "utf8mb4"),
        cursorclass=pymysql.cursors.DictCursor,
        connect_timeout=10,
        read_timeout=30,
    )
    try:
        with conn.cursor() as cursor:
            if limit and "LIMIT" not in sql.upper():
                sql = f"{sql.rstrip(';')} LIMIT {limit}"
            cursor.execute(sql)
            return cursor.fetchall()
    finally:
        conn.close()


# ========== SQL Server ==========

def query_sqlserver(db_config: dict, sql: str, limit: int) -> list[dict]:
    validate_sql_readonly(sql)
    import pymssql

    conn = pymssql.connect(
        server=db_config["host"],
        port=db_config.get("port", 1433),
        user=db_config["username"],
        password=db_config["password"],
        database=db_config["database"],
        charset=db_config.get("charset", "utf8"),
        login_timeout=10,
        timeout=30,
        as_dict=True,
    )
    try:
        with conn.cursor() as cursor:
            if limit and "TOP" not in sql.upper() and "LIMIT" not in sql.upper():
                sql = sql.replace("SELECT", f"SELECT TOP {limit}", 1)
            cursor.execute(sql)
            return cursor.fetchall()
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description="Database Query Utility (MongoDB/MySQL/SQL Server)")
    parser.add_argument("--env", required=True, help="环境 (dev/test/prod)")
    parser.add_argument("--db-type", required=True, choices=["mongodb", "mysql", "sqlserver"],
                        help="数据库类型")

    parser.add_argument("--sql", default=None, help="SQL 查询语句 (MySQL/SQL Server)")
    parser.add_argument("--database", default=None, help="数据库名 (MongoDB 必填，可覆盖配置)")
    parser.add_argument("--collection", default=None, help="集合名 (MongoDB)")
    parser.add_argument("--query", default=None, help="MongoDB 查询条件 JSON")
    parser.add_argument("--projection", default=None, help="MongoDB 投影字段 JSON")
    parser.add_argument("--sort", default=None, help='MongoDB 排序 JSON, 如 {"createTime": -1}')
    parser.add_argument("--limit", type=int, default=50, help="最大行数 (默认 50)")

    args = parser.parse_args()
    config = load_config()
    db_config = get_db_config(config, args.env, args.db_type)

    if args.db_type == "mongodb":
        if not args.collection:
            print("ERROR: --collection is required for MongoDB", file=sys.stderr)
            sys.exit(1)
        rows = query_mongodb(
            db_config, args.database, args.collection,
            args.query, args.projection, args.limit, args.sort,
        )
    elif args.db_type == "mysql":
        if not args.sql:
            print("ERROR: --sql is required for MySQL", file=sys.stderr)
            sys.exit(1)
        rows = query_mysql(db_config, args.sql, args.limit)
    elif args.db_type == "sqlserver":
        if not args.sql:
            print("ERROR: --sql is required for SQL Server", file=sys.stderr)
            sys.exit(1)
        rows = query_sqlserver(db_config, args.sql, args.limit)
    else:
        print(f"ERROR: Unsupported db type: {args.db_type}", file=sys.stderr)
        sys.exit(1)

    output = {"db_type": args.db_type, "env": args.env, "row_count": len(rows), "rows": rows}
    print(json.dumps(output, ensure_ascii=False, indent=2, default=json_serializer))


if __name__ == "__main__":
    main()
