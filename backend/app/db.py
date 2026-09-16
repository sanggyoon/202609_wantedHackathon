from collections.abc import Iterator
from contextlib import contextmanager
from threading import Lock
from typing import Any

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.core.config import settings

_pool: ConnectionPool | None = None
_lock = Lock()


class DatabaseNotConfigured(RuntimeError):
    """DATABASE_URL이 비어 있다. 배포 환경변수 배선 누락이 대표적인 원인이다."""


def get_pool() -> ConnectionPool:
    """풀을 최초 사용 시점에 만든다.

    import 시점에 연결하면 DATABASE_URL이 없는 환경에서 앱이 뜨지 않는다.
    CI는 `python -c "import app.main"`으로 임포트만 검증하므로 지연 생성이 필수다.
    """
    global _pool
    if _pool is not None:
        return _pool
    with _lock:
        if _pool is None:
            if not settings.database_url.strip():
                raise DatabaseNotConfigured("DATABASE_URL is not set")
            _pool = ConnectionPool(
                settings.database_url,
                min_size=0,
                max_size=5,
                open=True,
                # Supabase Transaction pooler(PgBouncer)는 prepared statement를
                # 세션 간에 유지하지 못한다. 끄지 않으면 간헐적으로 깨진다.
                kwargs={"prepare_threshold": None, "row_factory": dict_row},
            )
    return _pool


@contextmanager
def connection() -> Iterator[Any]:
    """블록이 정상 종료되면 커밋, 예외가 나면 롤백한다."""
    with get_pool().connection() as conn:
        yield conn


def close_pool() -> None:
    global _pool
    with _lock:
        if _pool is not None:
            _pool.close()
            _pool = None
