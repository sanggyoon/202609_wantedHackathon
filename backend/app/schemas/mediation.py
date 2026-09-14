from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.complaint import SharedStatement


class MediationRequest(BaseModel):
    a: SharedStatement
    b: SharedStatement


class MediationReport(BaseModel):
    common_ground: list[str]
    different_views: list[str]
    hurt_points_a: list[str]
    hurt_points_b: list[str]
    possible_misunderstanding: str | None
    conversation_starter: str = Field(min_length=1)


class MediationResponse(BaseModel):
    report: MediationReport
    mode: Literal["openai", "local"]
