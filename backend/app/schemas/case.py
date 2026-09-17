from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

from app.schemas.complaint import SharedStatement
from app.schemas.mediation import MediationReport

CaseStatus = Literal[
    "DRAFT",
    "AWAITING_RESPONSE",
    "COUNTER_DRAFT",
    "COUNTER_COMPLETED",
    "APOLOGY_DRAFT",
    "APOLOGY_COMPLETED",
    "EXPIRED",
]

ViewerRole = Literal["A", "B"]

# 지금 이 사건에서 할 수 있는 행동. 프론트는 이것만 보고 버튼을 노출한다.
# 전이 규칙을 프론트·백에 이중으로 두지 않기 위함이다 (API_Design A-5).
Action = Literal[
    "converse",
    "submit_statement",
    "choose_response_type",
    "submit_apology",
]

_ACTIONS: dict[str, dict[str, list[str]]] = {
    "DRAFT": {"A": ["converse", "submit_statement"], "B": []},
    "AWAITING_RESPONSE": {"A": [], "B": ["choose_response_type"]},
    "COUNTER_DRAFT": {"A": [], "B": ["converse", "submit_statement"]},
    "APOLOGY_DRAFT": {"A": [], "B": ["submit_apology"]},
    "COUNTER_COMPLETED": {"A": [], "B": []},
    "APOLOGY_COMPLETED": {"A": [], "B": []},
    "EXPIRED": {"A": [], "B": []},
}


def available_actions(status: str, role: str) -> list[str]:
    return list(_ACTIONS.get(status, {}).get(role, []))


class Apology(BaseModel):
    body: str
    understood_point: str | None = None
    admitted_point: str | None = None
    future_commitment: str | None = None
    submitted_at: datetime


class CaseContent(BaseModel):
    """만료된 사건에는 절대 담기지 않는다 (DFD §7.3)."""

    cards: dict[str, SharedStatement] = {}
    report: MediationReport | None = None
    apology: Apology | None = None


class CaseCreated(BaseModel):
    """토큰 원문이 노출되는 유일한 응답. 이후 어떤 조회로도 다시 얻을 수 없다."""

    public_token: str
    writer_token: str
    status: CaseStatus
    expires_at: datetime


class CaseView(BaseModel):
    status: CaseStatus
    viewer_role: ViewerRole
    expires_at: datetime
    available_actions: list[Action]
    content: CaseContent | None


class StatementSubmission(BaseModel):
    side: Literal["A", "B"]
    card: SharedStatement


class ResponseTypeSubmission(BaseModel):
    response_type: Literal["COUNTER", "APOLOGY"]


# 앞뒤 공백을 떼고 나서도 내용이 남아야 한다. min_length만으로는 "   "가 통과한다.
NonBlank = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=8000)]


class ApologySubmission(BaseModel):
    """B가 직접 작성한 텍스트를 그대로 저장한다. AI를 호출하지 않는다 (PRD §13)."""

    body: NonBlank
    understood_point: str | None = Field(default=None, max_length=8000)
    admitted_point: str | None = Field(default=None, max_length=8000)
    future_commitment: str | None = Field(default=None, max_length=8000)
