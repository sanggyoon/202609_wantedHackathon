from typing import Literal

from pydantic import BaseModel, Field, field_validator

EmotionLabel = Literal[
    "화남",
    "빡침",
    "짜증",
    "억울함",
    "무시당한 느낌",
    "서운함",
    "섭섭함",
    "상처받음",
    "답답함",
    "속상함",
    "불안",
    "걱정",
    "외로움",
]

EmotionImage = Literal[
    "anger.png",
    "irritated.png",
    "wronged.png",
    "hurt.png",
    "frustration.png",
    "sadness.png",
    "anxiety.png",
    "loneliness.png",
    "asset1.png",
]

WarpAxis = Literal["화남", "질투", "슬픔", "포기", "황당", "서운함"]


class EmotionScore(BaseModel):
    label: EmotionLabel
    mention_count: int = Field(ge=0, le=20)
    score: int = Field(ge=0, le=100)


class WarpParams(BaseModel):
    max_k: float = Field(default=2.5, ge=0, le=5)
    neighbor_bleed: float = Field(default=0.15, ge=0, le=1)
    radial_sharpness: float = Field(default=2.0, ge=1, le=4)
    base: float = Field(default=0.05, ge=0, le=0.3)


class EmotionProfile(BaseModel):
    version: Literal["ai-warp-v1"] = "ai-warp-v1"
    representative_emotion: EmotionLabel | None = None
    image: EmotionImage = "asset1.png"
    scores: list[EmotionScore] = Field(default_factory=list, max_length=13)
    axes: dict[WarpAxis, float]
    resolved_by: Literal["ai", "user", "fallback"]
    params: WarpParams = Field(default_factory=WarpParams)

    @field_validator("axes")
    @classmethod
    def _all_axes_are_bounded(cls, value: dict[str, float]) -> dict[str, float]:
        expected = {"화남", "질투", "슬픔", "포기", "황당", "서운함"}
        if set(value) != expected or any(score < 0 or score > 1 for score in value.values()):
            raise ValueError("invalid warp axes")
        return value


class EmotionProfileRequest(BaseModel):
    messages: list[str] = Field(min_length=1, max_length=20)
    emotions: list[str] = Field(default_factory=list, max_length=13)

    @field_validator("messages")
    @classmethod
    def _messages_are_non_blank(cls, value: list[str]) -> list[str]:
        cleaned = [message.strip() for message in value if message.strip()]
        if (
            not cleaned
            or any(len(message) > 8000 for message in cleaned)
            or sum(map(len, cleaned)) > 80_000
        ):
            raise ValueError("invalid messages")
        return cleaned

    @field_validator("emotions")
    @classmethod
    def _emotions_are_bounded(cls, value: list[str]) -> list[str]:
        if any(len(emotion) > 50 for emotion in value):
            raise ValueError("invalid emotions")
        return value


class EmotionProfileResponse(BaseModel):
    profile: EmotionProfile
    needs_clarification: bool = False
    candidates: list[EmotionLabel] = Field(default_factory=list)
    mode: Literal["openai", "local"]


class EmotionProfileResolveRequest(BaseModel):
    profile: EmotionProfile
    selected_emotion: EmotionLabel


class EmotionWarpRequest(BaseModel):
    profile: EmotionProfile
