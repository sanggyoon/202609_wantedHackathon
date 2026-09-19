import json

from app.schemas.emotion_warp import (
    EmotionLabel,
    EmotionProfile,
    EmotionProfileResponse,
    EmotionScore,
)
from app.services.openai_gateway import call_openai_json_chat, is_openai_configured

LABELS: tuple[EmotionLabel, ...] = (
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
)

IMAGE_BY_LABEL = {
    "화남": "anger.png",
    "빡침": "anger.png",
    "짜증": "irritated.png",
    "억울함": "wronged.png",
    "무시당한 느낌": "wronged.png",
    "서운함": "hurt.png",
    "섭섭함": "hurt.png",
    "상처받음": "hurt.png",
    "답답함": "frustration.png",
    "속상함": "sadness.png",
    "불안": "anxiety.png",
    "걱정": "anxiety.png",
    "외로움": "loneliness.png",
}

AXIS_LABELS = {
    "화남": ("화남", "빡침", "짜증", "불안"),
    "질투": ("억울함", "무시당한 느낌", "불안"),
    "슬픔": ("속상함", "상처받음", "외로움", "걱정"),
    "포기": ("외로움", "빡침"),
    "황당": ("답답함",),
    "서운함": ("서운함", "섭섭함", "걱정"),
}

SCORE_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["emotions"],
    "properties": {
        "emotions": {
            "type": "array",
            "minItems": 0,
            "maxItems": 13,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["label", "mention_count", "score"],
                "properties": {
                    "label": {"type": "string", "enum": list(LABELS)},
                    "mention_count": {"type": "integer", "minimum": 0, "maximum": 20},
                    "score": {"type": "integer", "minimum": 0, "maximum": 100},
                },
            },
        }
    },
}

SYSTEM_PROMPT = """You score emotions in Korean relationship-conflict messages.
Analyze ONLY the user's messages supplied in the JSON array. Do not invent facts or emotions.
Return only these labels: 화남, 빡침, 짜증, 억울함, 무시당한 느낌, 서운함, 섭섭함,
상처받음, 답답함, 속상함, 불안, 걱정, 외로움.
mention_count is the number of distinct user messages where the emotion is directly expressed or
clearly conveyed by context. Repetition inside one message counts once. score is an integer 0-100
combining frequency, wording intensity and context. Omit labels with no evidence. Similar labels may
coexist only when each is independently supported. Never score the assistant's wording."""


def generate_emotion_profile(
    messages: list[str], existing_emotions: list[str]
) -> EmotionProfileResponse:
    mode = "openai" if is_openai_configured() else "local"
    if mode == "openai":
        try:
            content = call_openai_json_chat(
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": json.dumps(messages, ensure_ascii=False)},
                ],
                schema=SCORE_SCHEMA,
                schema_name="emotion_document_scores",
            )
            scores = _normalize_scores(json.loads(content).get("emotions", []))
            if not scores and existing_emotions:
                mode = "local"
                scores = _local_scores(existing_emotions)
        except Exception:
            mode = "local"
            scores = _local_scores(existing_emotions)
    else:
        scores = _local_scores(existing_emotions)
    return _build_response(scores, mode)


def resolve_emotion_profile(profile: EmotionProfile, selected: EmotionLabel) -> EmotionProfile:
    candidates = _winner_candidates(profile.scores)
    if selected not in candidates:
        raise ValueError("selected emotion is not tied for the lead")
    return profile.model_copy(
        update={
            "representative_emotion": selected,
            "image": IMAGE_BY_LABEL[selected],
            "resolved_by": "user",
        }
    )


def _normalize_scores(raw: list[object]) -> list[EmotionScore]:
    best: dict[str, EmotionScore] = {}
    for item in raw:
        try:
            score = EmotionScore.model_validate(item)
        except Exception:
            continue
        if score.mention_count == 0 and score.score == 0:
            continue
        current = best.get(score.label)
        if current is None:
            best[score.label] = score
        else:
            best[score.label] = EmotionScore(
                label=score.label,
                mention_count=max(current.mention_count, score.mention_count),
                score=max(current.score, score.score),
            )
    return [best[label] for label in LABELS if label in best]


def _local_scores(emotions: list[str]) -> list[EmotionScore]:
    seen = set(emotions)
    return [
        EmotionScore(label=label, mention_count=1, score=60)
        for label in LABELS
        if label in seen
    ]


def _winner_candidates(scores: list[EmotionScore]) -> list[EmotionLabel]:
    if not scores:
        return []
    max_count = max(item.mention_count for item in scores)
    by_count = [item for item in scores if item.mention_count == max_count]
    max_score = max(item.score for item in by_count)
    return [item.label for item in by_count if item.score == max_score]


def _build_response(scores: list[EmotionScore], mode: str) -> EmotionProfileResponse:
    candidates = _winner_candidates(scores)
    representative = candidates[0] if len(candidates) == 1 else None
    profile = EmotionProfile(
        representative_emotion=representative,
        image=IMAGE_BY_LABEL[representative] if representative else "asset1.png",
        scores=scores,
        axes=_axes(scores),
        resolved_by="ai" if representative and mode == "openai" else "fallback",
    )
    return EmotionProfileResponse(
        profile=profile,
        needs_clarification=len(candidates) > 1,
        candidates=candidates if len(candidates) > 1 else [],
        mode=mode,
    )


def _axes(scores: list[EmotionScore]) -> dict[str, float]:
    values = {item.label: item.score / 100 for item in scores}
    base = 0.05
    return {
        axis: round(max(base, min(1.0, sum(values.get(label, 0) for label in labels))), 4)
        for axis, labels in AXIS_LABELS.items()
    }
