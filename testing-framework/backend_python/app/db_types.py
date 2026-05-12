"""与 Prisma + SQLite 兼容：DateTime 列实际存 INTEGER（UTC 毫秒）。"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.types import Integer, TypeDecorator


def utc_naive_now() -> datetime:
    """返回本地时间（naive datetime），名称保留以兼容已有调用。"""
    return datetime.now()


class PrismaSQLiteDateTime(TypeDecorator):
    """读 INTEGER 毫秒；写时把 datetime 转为毫秒，与 Prisma 一致。"""

    impl = Integer
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, datetime):
            # .timestamp() 对 naive datetime 按本地时区处理，对 aware datetime 直接转换
            return int(value.timestamp() * 1000)
        if isinstance(value, (int, float)):
            return int(value)
        return value

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, datetime):
            return value
        if isinstance(value, (int, float)):
            return datetime.fromtimestamp(float(value) / 1000.0)
        if isinstance(value, str):
            s = value.strip().replace("Z", "+00:00")
            try:
                dt = datetime.fromisoformat(s)
            except ValueError:
                return value
            if dt.tzinfo is not None:
                return datetime.fromtimestamp(dt.timestamp())
            return dt
        return value
