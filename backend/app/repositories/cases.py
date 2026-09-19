"""사건 영속 계층. SQL은 전부 여기에만 둔다.

RLS가 켜져 있고 정책이 없으므로 service_role(= DATABASE_URL의 postgres 유저)만
통과한다. 링크 권한 판정은 DB가 아니라 이 계층 위의 API가 토큰 해시로 한다
(docs/API_Design.md §6.1).
"""

from dataclasses import dataclass
from datetime import datetime

from psycopg.types.json import Jsonb

from app.db import connection
from app.schemas.complaint import SharedStatement
from app.schemas.mediation import MediationReport

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
    "side, cute_charge, incident_summary, story_intro, incident_description, emotions, "
    "emotion_scores, "
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


# ---------------------------------------------------------------------------
# 쓰기
# ---------------------------------------------------------------------------
#
# 모든 쓰기는 **상태 조건부 UPDATE를 먼저** 실행한다. 그 UPDATE가 사건 행에 락을
# 걸기 때문에, 동시에 들어온 두 번째 요청은 첫 번째가 커밋될 때까지 기다렸다가
# 바뀐 상태를 보고 0행을 얻는다. 이것이 "최초 성공 요청만 반영"의 구현이다
# (docs/Data_Flow.md §7.2). 반환값 False는 호출자에게 409를 뜻한다.


def submit_statement_a(case_id: str, card: SharedStatement) -> bool:
    """DRAFT → AWAITING_RESPONSE. A 카드 저장과 전이가 한 트랜잭션."""
    with connection() as conn:
        moved = conn.execute(
            "update cases set status = 'AWAITING_RESPONSE' "
            " where id = %s and status = 'DRAFT'",
            (case_id,),
        ).rowcount
        if moved == 0:
            return False
        _insert_card(conn, case_id, "A", card)
        return True


def choose_response_type(case_id: str, response_type: str) -> bool:
    """AWAITING_RESPONSE → COUNTER_DRAFT 또는 APOLOGY_DRAFT."""
    target = "COUNTER_DRAFT" if response_type == "COUNTER" else "APOLOGY_DRAFT"
    with connection() as conn:
        return (
            conn.execute(
                "update cases set status = %s, response_type = %s "
                " where id = %s and status = 'AWAITING_RESPONSE'",
                (target, response_type, case_id),
            ).rowcount
            == 1
        )


def complete_counter(case_id: str, card: SharedStatement, report: MediationReport) -> bool:
    """COUNTER_DRAFT → COUNTER_COMPLETED.

    B 카드·중재 리포트·상태 전이가 **한 트랜잭션**이다. 어느 하나가 실패하면
    전부 롤백되므로 사용자는 온전히 재시도할 수 있다.
    """
    with connection() as conn:
        moved = conn.execute(
            "update cases set status = 'COUNTER_COMPLETED', answered_at = now(), "
            "       expires_at = now() + make_interval(days => %s) "
            " where id = %s and status = 'COUNTER_DRAFT'",
            (CASE_LIFETIME_DAYS, case_id),
        ).rowcount
        if moved == 0:
            return False
        _insert_card(conn, case_id, "B", card)
        conn.execute(
            """
            insert into mediation_reports
                (case_id, common_ground, different_views, hurt_points_a,
                 hurt_points_b, possible_misunderstanding, conversation_starter)
            values (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                case_id,
                report.common_ground,
                report.different_views,
                report.hurt_points_a,
                report.hurt_points_b,
                report.possible_misunderstanding,
                report.conversation_starter,
            ),
        )
        return True


def complete_apology(case_id: str, apology: dict) -> bool:
    """APOLOGY_DRAFT → APOLOGY_COMPLETED. 입력 텍스트를 그대로 저장한다."""
    with connection() as conn:
        moved = conn.execute(
            "update cases set status = 'APOLOGY_COMPLETED', answered_at = now(), "
            "       expires_at = now() + make_interval(days => %s) "
            " where id = %s and status = 'APOLOGY_DRAFT'",
            (CASE_LIFETIME_DAYS, case_id),
        ).rowcount
        if moved == 0:
            return False
        conn.execute(
            """
            insert into apologies
                (case_id, body, understood_point, admitted_point, future_commitment)
            values (%s, %s, %s, %s, %s)
            """,
            (
                case_id,
                apology["body"],
                apology.get("understood_point"),
                apology.get("admitted_point"),
                apology.get("future_commitment"),
            ),
        )
        return True


def _insert_card(conn, case_id: str, side: str, card: SharedStatement) -> None:
    conn.execute(
        """
        insert into statement_cards
            (case_id, side, cute_charge, incident_summary, story_intro, incident_description,
             emotions, emotion_scores, emotion_reason, hurt_point, different_viewpoint,
             desired_outcome, expected_behavior, assumption)
        values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            case_id,
            side,
            card.cute_charge,
            card.incident_summary,
            card.story_intro,
            card.incident_description,
            card.emotions,
            Jsonb(card.emotion_scores.model_dump()) if card.emotion_scores else Jsonb({}),
            card.emotion_reason,
            card.hurt_point,
            card.different_viewpoint,
            card.desired_outcome,
            card.expected_behavior,
            card.assumption,
        ),
    )
