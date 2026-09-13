from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ComplaintMissingField = Literal[
    "incident",
    "hurt_point",
    "emotion",
    "emotion_reason",
    "expected_behavior",
    "desired_outcome",
]


class ComplaintIncident(BaseModel):
    description: str | None = None
    facts: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)


class ComplaintEmotion(BaseModel):
    emotions: list[str] = Field(default_factory=list)
    reason: str | None = None


class ComplaintOptionalInfo(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    nickname_a: str | None = Field(default=None, alias="nicknameA")
    nickname_b: str | None = Field(default=None, alias="nicknameB")
    date: str | None = None
    place: str | None = None
    quotes: list[str] = Field(default_factory=list)
    punishment_idea: str | None = Field(default=None, alias="punishmentIdea")


class ComplaintConversationState(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    incident: ComplaintIncident = Field(default_factory=ComplaintIncident)
    hurt_point: str | None = Field(default=None, alias="hurtPoint")
    emotion: ComplaintEmotion = Field(default_factory=ComplaintEmotion)
    expected_behavior: str | None = Field(default=None, alias="expectedBehavior")
    desired_outcome: str | None = Field(default=None, alias="desiredOutcome")
    optional: ComplaintOptionalInfo = Field(default_factory=ComplaintOptionalInfo)
    confirmed_fields: list[ComplaintMissingField] = Field(
        default_factory=list, alias="confirmedFields"
    )
    missing_fields: list[ComplaintMissingField] = Field(default_factory=list, alias="missingFields")
    ready_to_generate: bool = Field(default=False, alias="readyToGenerate")


class ComplaintAIExtracted(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    incident: ComplaintIncident = Field(default_factory=ComplaintIncident)
    hurt_point: str | None = Field(default=None, alias="hurtPoint")
    emotions: ComplaintEmotion = Field(default_factory=ComplaintEmotion)
    expected_behavior: str | None = Field(default=None, alias="expectedBehavior")
    desired_outcome: str | None = Field(default=None, alias="desiredOutcome")
    optional: ComplaintOptionalInfo = Field(default_factory=ComplaintOptionalInfo)


class ComplaintConversationRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    conversation_id: str = Field(default="temp", alias="conversationId")
    message: str
    state: ComplaintConversationState | None = None


class ComplaintConversationResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    conversation_id: str = Field(alias="conversationId")
    state: ComplaintConversationState
    extracted: ComplaintAIExtracted
    assistant_message: str = Field(alias="assistantMessage")
    missing_fields: list[ComplaintMissingField] = Field(alias="missingFields")
    ready_to_generate: bool = Field(alias="readyToGenerate")
    mode: Literal["openai", "local"] = "local"
