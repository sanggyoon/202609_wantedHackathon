"""사건 영속 계층. SQL은 전부 여기에만 둔다.

RLS가 켜져 있고 정책이 없으므로 service_role(= DATABASE_URL의 postgres 유저)만
통과한다. 링크 권한 판정은 DB가 아니라 이 계층 위의 API가 토큰 해시로 한다
(docs/API_Design.md §6.1).
"""

from dataclasses import dataclass
from datetime import datetime

from app.db import connection

CASE_LIFETIME_DAYS = 7


@dataclass(frozen=True)
class CaseRow:
    id: str
    status: str
    response_type: str | None
    created_at: datetime
    answered_at: datetime | None
    expires_at: datetime
    writer_token_hash: str | None


CARD_COLUMNS = (
    "side, cute_charge, incident_summary, incident_description, emotions, "
    "emotion_reason, hurt_point, different_viewpoint, desired_outcome, "
    "expected_behavior, assumption"
)


def create_case(public_token_hash: str, writer_token_hash: str) -> CaseRow:
    with connection() as conn:
        row = conn.execute(
            """
            insert into cases (public_token_hash, writer_token_hash, expires_at)
            values (%s, %s, now() + make_interval(days => %s))
            returning id, status, response_type, created_at, answered_at,
                      expires_at, writer_token_hash
            """,
            (public_token_hash, writer_token_hash, CASE_LIFETIME_DAYS),
        ).fetchone()
    return _to_case(row)


def find_by_public_token_hash(public_token_hash: str) -> CaseRow | None:
    with connection() as conn:
        row = conn.execute(
            """
            select id, status, response_type, created_at, answered_at,
                   expires_at, writer_token_hash
              from cases
             where public_token_hash = %s
            """,
            (public_token_hash,),
        ).fetchone()
    return _to_case(row) if row else None


def load_content(case_id: str) -> dict:
    """카드·리포트·사과문을 한 번에 읽는다. 없는 것은 생략된다."""
    with connection() as conn:
        cards = conn.execute(
            f"select {CARD_COLUMNS} from statement_cards where case_id = %s",
            (case_id,),
        ).fetchall()
        report = conn.execute(
            """
            select common_ground, different_views, hurt_points_a, hurt_points_b,
                   possible_misunderstanding, conversation_starter
              from mediation_reports where case_id = %s
            """,
            (case_id,),
        ).fetchone()
        apology = conn.execute(
            """
            select body, understood_point, admitted_point, future_commitment,
                   submitted_at
              from apologies where case_id = %s
            """,
            (case_id,),
        ).fetchone()
    return {
        "cards": {row.pop("side"): row for row in cards},
        "report": report,
        "apology": apology,
    }


def _to_case(row: dict) -> CaseRow:
    return CaseRow(
        id=str(row["id"]),
        status=row["status"],
        response_type=row["response_type"],
        created_at=row["created_at"],
        answered_at=row["answered_at"],
        expires_at=row["expires_at"],
        writer_token_hash=row["writer_token_hash"],
    )
