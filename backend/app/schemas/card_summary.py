from typing import Literal

from pydantic import BaseModel

from app.schemas.complaint import SharedStatement


class CardSummaryRequest(BaseModel):
    """공유 항목 선택이 끝난 카드. 대화 원문은 받지 않는다."""

    card: SharedStatement


class CardSummary(BaseModel):
    cute_charge: str
    incident_summary: str
    story_intro: str


class CardSummaryResponse(CardSummary):
    mode: Literal["openai", "local"]
