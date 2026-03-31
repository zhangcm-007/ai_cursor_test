"""与 Prisma + SQLite 兼容：DateTime 列实际存 INTEGER（UTC 毫秒）。"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.types import Integer, TypeDecorator


def utc_naive_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class PrismaSQLiteDateTime(TypeDecorator):
    """读 INTEGER 毫秒；写时把 datetime 转为毫秒，与 Prisma 一致。"""

    impl = Integer
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, datetime):
            if value.tzinfo is not None:
                v = value.astimezone(timezone.utc)
            else:
                v = value.replace(tzinfo=timezone.utc)
            return int(v.timestamp() * 1000)
        if isinstance(value, (int, float)):
            return int(value)
        return value

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, datetime):
            return value
        if isinstance(value, (int, float)):
            return datetime.fromtimestamp(float(value) / 1000.0, tz=timezone.utc).replace(tzinfo=None)
        if isinstance(value, str):
            s = value.strip().replace("Z", "+00:00")
            try:
                dt = datetime.fromisoformat(s)
            except ValueError:
                return value
            if dt.tzinfo is not None:
                return dt.astimezone(timezone.utc).replace(tzinfo=None)
            return dt
        return value
