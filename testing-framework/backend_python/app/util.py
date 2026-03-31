"""与 Prisma cuid 无强绑定，生成短唯一 id 供 SQLite 主键使用"""

import secrets


def new_id() -> str:
    return secrets.token_hex(12)
