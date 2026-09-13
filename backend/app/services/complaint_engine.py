from __future__ import annotations

import json
import re
from collections.abc import Iterable
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.complaint import (
    ComplaintAIExtracted,
    ComplaintConversationRequest,
    ComplaintConversationResponse,
    ComplaintConversationState,
    ComplaintEmotion,
    ComplaintIncident,
    ComplaintMissingField,
    ComplaintOptionalInfo,
)
from app.services.openai_gateway import call_openai_json_chat, is_openai_configured

ReplyMode = Literal[
    "empathize_then_question",
    "clarify_vague_answer",
    "clarify_assumption",
    "reflect_and_confirm",
    "soft_redirect",
    "ready_summary",
]


class ConversationQualitySignals(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    reply_mode: ReplyMode = Field(default="empathize_then_question", alias="replyMode")
    is_vague: bool = Field(default=False, alias="isVague")
    emotional_intensity: Literal["low", "medium", "high"] = Field(
        default="medium", alias="emotionalIntensity"
    )
    assumption_risk: bool = Field(default=False, alias="assumptionRisk")
    should_reflect: bool = Field(default=True, alias="shouldReflect")
    user_tone: str = Field(default="", alias="userTone")
    natural_hook: str = Field(default="", alias="naturalHook")


class ComplaintTurnExtraction(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    extracted: ComplaintAIExtracted = Field(default_factory=ComplaintAIExtracted)
    confirmed_fields: list[ComplaintMissingField] = Field(
        default_factory=list, alias="confirmedFields"
    )
    quality_signals: ConversationQualitySignals = Field(
        default_factory=ConversationQualitySignals,
        alias="qualitySignals",
    )


class ComplaintAssistantDraft(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    assistant_message: str = Field(alias="assistantMessage")


QUESTION_PRIORITY: list[ComplaintMissingField] = [
    "incident",
    "emotion",
    "emotion_reason",
    "desired_outcome",
]

EMOTION_KEYWORDS = {
    "걱정": "걱정",
    "불안": "불안",
    "서운": "서운함",
    "섭섭": "섭섭함",
    "화": "화남",
    "짜증": "짜증",
    "빡": "빡침",
    "열받": "화남",
    "속상": "속상함",
    "외로": "외로움",
    "상처": "상처받음",
    "무시": "무시당한 느낌",
    "답답": "답답함",
    "억울": "억울함",
}

ASSUMPTION_MARKERS = [
    "분명",
    "아마",
    "혹시",
    "몰래",
    "것 같",
    "거 같",
    "듯",
    "느낌",
    "의심",
    "나를 신경 안",
    "나한테 관심",
]

REQUEST_MARKERS = [
    "해줬으면",
    "했으면",
    "좋겠",
    "바라",
    "원해",
    "알아줬으면",
    "다음부터",
    "앞으로",
    "늦으면",
    "늦을 때",
]

HURT_MARKERS = [
    "서운",
    "섭섭",
    "싫",
    "짜증",
    "빡",
    "화",
    "열받",
    "속상",
    "상처",
    "무시",
    "걸렸",
    "기분",
    "거짓말",
    "속였",
    "속임",
    "숨겼",
    "숨김",
    "솔직",
    "기만",
]

REASON_MARKERS = [
    "때문",
    "해서",
    "하여",
    "같아서",
    "느껴져서",
    "느껴졌",
    "라서",
    "어서",
    "니까",
]


def handle_complaint_message(
    request: ComplaintConversationRequest,
) -> ComplaintConversationResponse:
    state = normalize_state(request.state)
    message = request.message.strip()
    turn = extract_complaint_info(state, message)
    confirmed_fields = sanitize_confirmed_fields(state, turn.extracted, turn.confirmed_fields)
    extracted = gate_extracted_by_confirmed(turn.extracted, confirmed_fields)
    state = merge_complaint_state(state, extracted, confirmed_fields)
    state.missing_fields = get_missing_fields(state)
    state.ready_to_generate = len(state.missing_fields) == 0
    assistant_message = build_assistant_message(
        state, message, turn.quality_signals, confirmed_fields
    )

    return ComplaintConversationResponse(
        conversationId=request.conversation_id,
        state=state,
        extracted=extracted,
        assistantMessage=assistant_message,
        missingFields=state.missing_fields,
        readyToGenerate=state.ready_to_generate,
    )


def normalize_state(state: ComplaintConversationState | None) -> ComplaintConversationState:
    current = state or ComplaintConversationState()
    current.missing_fields = get_missing_fields(current)
    current.ready_to_generate = len(current.missing_fields) == 0
    return current


def extract_complaint_info(
    state: ComplaintConversationState, message: str
) -> ComplaintTurnExtraction:
    if is_openai_configured():
        return extract_with_openai(state, message)
    extracted = supplement_with_local_evidence(extract_with_fallback(message), message)
    confirmed_fields = infer_confirmed_fields_locally(state, extracted, message)
    quality_signals = infer_quality_signals_locally(state, extracted, message, confirmed_fields)
    return ComplaintTurnExtraction(
        extracted=extracted,
        confirmedFields=confirmed_fields,
        qualitySignals=quality_signals,
    )


def extract_with_openai(state: ComplaintConversationState, message: str) -> ComplaintTurnExtraction:
    extracted_schema = {
        "type": "object",
        "additionalProperties": False,
        "required": [
            "incident",
            "hurtPoint",
            "emotions",
            "expectedBehavior",
            "desiredOutcome",
            "optional",
        ],
        "properties": {
            "incident": {
                "type": "object",
                "additionalProperties": False,
                "required": ["description", "facts", "assumptions"],
                "properties": {
                    "description": {"type": ["string", "null"]},
                    "facts": {"type": "array", "items": {"type": "string"}},
                    "assumptions": {"type": "array", "items": {"type": "string"}},
                },
            },
            "hurtPoint": {"type": ["string", "null"]},
            "emotions": {
                "type": "object",
                "additionalProperties": False,
                "required": ["emotions", "reason"],
                "properties": {
                    "emotions": {"type": "array", "items": {"type": "string"}},
                    "reason": {"type": ["string", "null"]},
                },
            },
            "expectedBehavior": {"type": ["string", "null"]},
            "desiredOutcome": {"type": ["string", "null"]},
            "optional": {
                "type": "object",
                "additionalProperties": False,
                "required": ["nicknameA", "nicknameB", "date", "place", "quotes", "punishmentIdea"],
                "properties": {
                    "nicknameA": {"type": ["string", "null"]},
                    "nicknameB": {"type": ["string", "null"]},
                    "date": {"type": ["string", "null"]},
                    "place": {"type": ["string", "null"]},
                    "quotes": {"type": "array", "items": {"type": "string"}},
                    "punishmentIdea": {"type": ["string", "null"]},
                },
            },
        },
    }
    schema = {
        "type": "object",
        "additionalProperties": False,
        "required": ["extracted", "confirmedFields", "qualitySignals"],
        "properties": {
            "extracted": extracted_schema,
            "confirmedFields": {
                "type": "array",
                "items": {
                    "type": "string",
                    "enum": [
                        "incident",
                        "hurt_point",
                        "emotion",
                        "emotion_reason",
                        "expected_behavior",
                        "desired_outcome",
                    ],
                },
            },
            "qualitySignals": {
                "type": "object",
                "additionalProperties": False,
                "required": [
                    "replyMode",
                    "isVague",
                    "emotionalIntensity",
                    "assumptionRisk",
                    "shouldReflect",
                    "userTone",
                    "naturalHook",
                ],
                "properties": {
                    "replyMode": {
                        "type": "string",
                        "enum": [
                            "empathize_then_question",
                            "clarify_vague_answer",
                            "clarify_assumption",
                            "reflect_and_confirm",
                            "soft_redirect",
                            "ready_summary",
                        ],
                    },
                    "isVague": {"type": "boolean"},
                    "emotionalIntensity": {"type": "string", "enum": ["low", "medium", "high"]},
                    "assumptionRisk": {"type": "boolean"},
                    "shouldReflect": {"type": "boolean"},
                    "userTone": {"type": "string"},
                    "naturalHook": {"type": "string"},
                },
            },
        },
    }
    prompt = f"""
You extract structured facts from a Korean relationship complaint interview.

Rules:
- Extract only information the user actually said.
- Also decide which fields the latest user message confirms in context. Use meaning, not
keyword matching.
- confirmedFields must include only fields that the latest user message directly answers or
clearly contains. Do not include a field only because it was inferred or already existed in
Existing state.
- incident: the user described what happened.
- hurt_point: the user identified the specific bothersome point. Examples include lying, no
contact, ignoring, breaking a promise, hiding something, or "that part".
- emotion: the user stated a feeling or emotional reaction.
- emotion_reason: the user explained why the feeling happened, what thought it caused, or what
meaning they attached to the event. Confirm this only if emotion is confirmed in this turn or
already confirmed in Existing state.
- expected_behavior: the user stated what they expected at that moment.
- desired_outcome: the user stated what they want the other person to do, change, understand,
or acknowledge now/future.
- Separate objective facts from assumptions.
- If the user says "분명 나 몰래 여자 만난 거야" or similar, do not write that as a fact. Put it in
assumptions.
- Do not invent names, dates, places, motives, or outcomes.
- Keep all values concise and in Korean.
- Do not decide the next question or readiness. The application code will do that from
confirmedFields.
- Also produce qualitySignals for the speaking layer:
- clarify_vague_answer: the user is vague, evasive, or only says "몰라", "그냥", "좀 그래", "짜증나"
without enough scene/reason.
- clarify_assumption: the user states a suspicion as if it is fact, such as cheating, lying,
hiding, motives, or "분명".
- reflect_and_confirm: the user gave a concrete, emotionally meaningful answer and it is
useful to mirror it before asking the next thing.
  - empathize_then_question: normal case.
  - soft_redirect: user message is off-topic or does not answer the current thread.
  - ready_summary: only if the latest message completed all required core fields.
- naturalHook is a short Korean phrase capturing the emotional/context hook to reflect, for
example "거짓말보다 솔직하지 않았다는 느낌", "새벽까지 연락을 기다린 시간".

Existing state:
{state.model_dump_json(by_alias=True)}

Latest user message:
{message}
"""
    content = call_openai_json_chat(
        messages=[
            {"role": "system", "content": "Return only JSON matching the schema."},
            {"role": "user", "content": prompt},
        ],
        schema=schema,
        schema_name="complaint_interview_extraction",
    )
    return ComplaintTurnExtraction.model_validate(json.loads(content))


def extract_with_fallback(message: str) -> ComplaintAIExtracted:
    sentences = split_sentences(message)
    facts: list[str] = []
    assumptions: list[str] = []

    for sentence in sentences:
        if is_assumption(sentence):
            assumptions.append(normalize_assumption(sentence))
        elif has_incident_signal(sentence):
            fact = extract_fact_clause(sentence)
            if fact:
                facts.append(fact)

    emotions = unique(label for marker, label in EMOTION_KEYWORDS.items() if marker in message)
    reason = infer_emotion_reason(message)
    if emotions and not reason and facts:
        reason = f"{facts[0]} 때문에"
    desired = infer_desired_outcome(sentences)
    expected = infer_expected_behavior(sentences, desired)
    hurt_point = infer_hurt_point(message, facts, assumptions)

    description = summarize_incident(facts)
    optional = ComplaintOptionalInfo(
        date=infer_date(message),
        place=infer_place(message),
        quotes=infer_quotes(message),
    )

    return ComplaintAIExtracted(
        incident=ComplaintIncident(
            description=description, facts=facts[:6], assumptions=assumptions[:6]
        ),
        hurtPoint=hurt_point,
        emotions=ComplaintEmotion(emotions=emotions[:5], reason=reason),
        expectedBehavior=expected,
        desiredOutcome=desired,
        optional=optional,
    )


def supplement_with_local_evidence(
    extracted: ComplaintAIExtracted, message: str
) -> ComplaintAIExtracted:
    local = extract_with_fallback(message)
    facts = clean_incident_facts(merge_unique(extracted.incident.facts, local.incident.facts))
    return ComplaintAIExtracted(
        incident=ComplaintIncident(
            description=clean_incident_description(
                extracted.incident.description or local.incident.description, facts
            ),
            facts=facts,
            assumptions=merge_unique(extracted.incident.assumptions, local.incident.assumptions),
        ),
        hurtPoint=extracted.hurt_point or local.hurt_point,
        emotions=ComplaintEmotion(
            emotions=merge_unique(extracted.emotions.emotions, local.emotions.emotions),
            reason=extracted.emotions.reason or local.emotions.reason,
        ),
        expectedBehavior=extracted.expected_behavior or local.expected_behavior,
        desiredOutcome=extracted.desired_outcome or local.desired_outcome,
        optional=merge_optional(extracted.optional, local.optional),
    )


def merge_complaint_state(
    base: ComplaintConversationState,
    incoming: ComplaintAIExtracted,
    confirmed_fields: list[ComplaintMissingField],
) -> ComplaintConversationState:
    merged_confirmed = merge_unique(base.confirmed_fields, confirmed_fields)
    return ComplaintConversationState(
        incident=ComplaintIncident(
            description=prefer_existing(base.incident.description, incoming.incident.description),
            facts=merge_unique(base.incident.facts, incoming.incident.facts),
            assumptions=merge_unique(base.incident.assumptions, incoming.incident.assumptions),
        ),
        hurtPoint=prefer_new(base.hurt_point, incoming.hurt_point),
        emotion=ComplaintEmotion(
            emotions=merge_unique(base.emotion.emotions, incoming.emotions.emotions),
            reason=prefer_new(base.emotion.reason, incoming.emotions.reason),
        ),
        expectedBehavior=prefer_new(base.expected_behavior, incoming.expected_behavior),
        desiredOutcome=prefer_new(
            base.desired_outcome, incoming.desired_outcome or incoming.expected_behavior
        ),
        optional=merge_optional(base.optional, incoming.optional),
        confirmedFields=merged_confirmed,
    )


def infer_confirmed_fields_locally(
    state: ComplaintConversationState,
    extracted: ComplaintAIExtracted,
    message: str,
) -> list[ComplaintMissingField]:
    confirmed: list[ComplaintMissingField] = []

    incident_confirmed = bool(
        extracted.incident.description or extracted.incident.facts
    ) and has_incident_evidence(message)
    hurt_confirmed = bool(extracted.hurt_point) and has_hurt_evidence(message)
    emotion_confirmed = bool(extracted.emotions.emotions) and has_emotion_evidence(message)
    reason_confirmed = bool(extracted.emotions.reason) and has_reason_evidence(
        message, state, emotion_confirmed
    )
    desired_confirmed = bool(
        extracted.desired_outcome or extracted.expected_behavior
    ) and has_desired_evidence(message)

    if incident_confirmed:
        confirmed.append("incident")
    if hurt_confirmed:
        confirmed.append("hurt_point")
    if emotion_confirmed:
        confirmed.append("emotion")
    if reason_confirmed:
        confirmed.append("emotion_reason")
    if desired_confirmed:
        confirmed.append("desired_outcome")

    return confirmed


def infer_quality_signals_locally(
    state: ComplaintConversationState,
    extracted: ComplaintAIExtracted,
    message: str,
    confirmed_fields: list[ComplaintMissingField],
) -> ConversationQualitySignals:
    message_clean = message.strip()
    is_vague = bool(
        re.fullmatch(
            r"(몰라|모르겠어|그냥|음|좀|그냥 그래|짜증나|개빡침|빡침|서운해|화나)[\s.?!]*",
            message_clean,
        )
    )
    assumption_risk = bool(extracted.incident.assumptions) or is_assumption(message_clean)
    emotional_intensity: Literal["low", "medium", "high"] = (
        "high" if re.search(r"개빡|빡침|열받|최악|진짜", message_clean) else "medium"
    )

    if assumption_risk and "incident" not in confirmed_fields:
        reply_mode: ReplyMode = "clarify_assumption"
    elif is_vague:
        reply_mode = "clarify_vague_answer"
    elif len(confirmed_fields) >= 2:
        reply_mode = "reflect_and_confirm"
    elif not confirmed_fields and state.confirmed_fields:
        reply_mode = "soft_redirect"
    else:
        reply_mode = "empathize_then_question"

    return ConversationQualitySignals(
        replyMode=reply_mode,
        isVague=is_vague,
        emotionalIntensity=emotional_intensity,
        assumptionRisk=assumption_risk,
        shouldReflect=reply_mode != "soft_redirect",
        userTone=infer_user_tone(message_clean),
        naturalHook=infer_natural_hook(message_clean, extracted),
    )


def sanitize_confirmed_fields(
    state: ComplaintConversationState,
    extracted: ComplaintAIExtracted,
    confirmed_fields: list[ComplaintMissingField],
) -> list[ComplaintMissingField]:
    confirmed = set(confirmed_fields)
    if (
        "incident" in confirmed
        and not has_text(extracted.incident.description)
        and not extracted.incident.facts
    ):
        confirmed.remove("incident")
    if "hurt_point" in confirmed and not has_text(extracted.hurt_point):
        confirmed.remove("hurt_point")
    if "emotion" in confirmed and not extracted.emotions.emotions:
        confirmed.remove("emotion")
    if "emotion_reason" in confirmed and (
        not has_text(extracted.emotions.reason)
        or ("emotion" not in confirmed and "emotion" not in state.confirmed_fields)
    ):
        confirmed.remove("emotion_reason")
    if "expected_behavior" in confirmed and not has_text(extracted.expected_behavior):
        confirmed.remove("expected_behavior")
    if (
        "desired_outcome" in confirmed
        and not has_text(extracted.desired_outcome)
        and not has_text(extracted.expected_behavior)
    ):
        confirmed.remove("desired_outcome")
    return [field for field in confirmed_fields if field in confirmed]


def infer_user_tone(message: str) -> str:
    if re.search(r"개빡|빡침|열받|짜증", message):
        return "화가 많이 난 짧은 말투"
    if re.search(r"몰라|모르겠", message):
        return "정리가 잘 안 된 말투"
    if len(message) > 80:
        return "길게 털어놓는 말투"
    return "짧고 편하게 말하는 말투"


def infer_natural_hook(message: str, extracted: ComplaintAIExtracted) -> str:
    if has_deception_evidence(message):
        return "솔직하지 않았다는 느낌"
    if "연락" in message:
        return "기다리는 동안 연락이 없었던 점"
    if extracted.hurt_point:
        return extracted.hurt_point
    if extracted.emotions.emotions:
        return ", ".join(extracted.emotions.emotions)
    return first(extracted.incident.facts) or message[:30]


def gate_extracted_by_confirmed(
    extracted: ComplaintAIExtracted,
    confirmed_fields: list[ComplaintMissingField],
) -> ComplaintAIExtracted:
    confirmed = set(confirmed_fields)
    return ComplaintAIExtracted(
        incident=extracted.incident
        if "incident" in confirmed
        else ComplaintIncident(assumptions=extracted.incident.assumptions),
        hurtPoint=extracted.hurt_point if "hurt_point" in confirmed else None,
        emotions=ComplaintEmotion(
            emotions=extracted.emotions.emotions if "emotion" in confirmed else [],
            reason=extracted.emotions.reason if "emotion_reason" in confirmed else None,
        ),
        expectedBehavior=extracted.expected_behavior if "expected_behavior" in confirmed else None,
        desiredOutcome=extracted.desired_outcome if "desired_outcome" in confirmed else None,
        optional=extracted.optional,
    )


def get_missing_fields(state: ComplaintConversationState) -> list[ComplaintMissingField]:
    missing: list[ComplaintMissingField] = []
    confirmed = set(state.confirmed_fields)
    if "incident" not in confirmed:
        missing.append("incident")
    if "emotion" not in confirmed:
        missing.append("emotion")
    if "emotion_reason" not in confirmed:
        missing.append("emotion_reason")
    if "desired_outcome" not in confirmed:
        missing.append("desired_outcome")
    return [field for field in QUESTION_PRIORITY if field in missing]


def build_assistant_message(
    state: ComplaintConversationState,
    latest_user_message: str = "",
    quality_signals: ConversationQualitySignals | None = None,
    confirmed_fields: list[ComplaintMissingField] | None = None,
) -> str:
    quality = finalize_quality_signals(state, quality_signals, confirmed_fields or [])
    if is_openai_configured():
        return generate_persona_assistant_message(state, latest_user_message, quality)
    return build_fallback_assistant_message(state, latest_user_message, quality)


def finalize_quality_signals(
    state: ComplaintConversationState,
    quality_signals: ConversationQualitySignals | None,
    confirmed_fields: list[ComplaintMissingField],
) -> ConversationQualitySignals:
    quality = quality_signals or ConversationQualitySignals()
    if state.ready_to_generate:
        quality.reply_mode = "ready_summary"
        quality.should_reflect = True
    elif state.incident.assumptions and "incident" in state.missing_fields:
        quality.reply_mode = "clarify_assumption"
        quality.assumption_risk = True
    elif not confirmed_fields and state.confirmed_fields:
        quality.reply_mode = "soft_redirect"
    return quality


def generate_persona_assistant_message(
    state: ComplaintConversationState,
    latest_user_message: str,
    quality_signals: ConversationQualitySignals,
) -> str:
    target = first(state.missing_fields)
    schema = {
        "type": "object",
        "additionalProperties": False,
        "required": ["assistantMessage"],
        "properties": {
            "assistantMessage": {"type": "string"},
        },
    }
    prompt = f"""
You are the speaking layer for a Korean AI interview service that turns relationship
disappointments into a cute complaint letter.

Persona:
- You feel like a real INFP close friend: warm, intuitive, emotionally observant, slightly
playful, not corporate.
- You are the mediator 밤톨. Always speak in friendly Korean 존댓말 (~해요, ~해볼까요), never 반말,
including when adapting the examples below.
- React to the user's exact context first. Do not sound like a form, counselor, or customer
support bot.
- If readyToGenerate is false, use this shape: one context-specific reaction sentence, then
one question.
- Never output only a bare question unless the user message is empty.
- Name the concrete thing the user said when reacting. For example:
- Reflect the stated event without assuming the partner's motive.
- For emotion, ask "그때 마음은 어떤 감정에 가까웠나요?"
- For hurt_point, ask "그중 가장 마음에 걸렸던 부분은 무엇인가요?"
- For emotion_reason, ask "어떤 생각 때문에 더 서운하게 느껴졌나요?"
- Use at most one emoji, and only if it feels natural.
- Do not overdo sympathy. Avoid dramatic therapy language.

Conversation control:
- The app, not you, decides readiness and the next field.
- If readyToGenerate is false, ask exactly one question, only about targetMissingField.
- If readyToGenerate is true, do not ask a question. Invite the user to check the summary card
that the UI will show.
- Never ask for multiple things in one turn.
- Do not mention internal field names, JSON, checklist, or "수집".
- Keep the whole message to 1-3 short sentences.
- Use replyMode:
  - empathize_then_question: light, context-aware empathy, then the next question.
- clarify_vague_answer: acknowledge that it may be hard to organize, then ask for one concrete
scene/thought.
- clarify_assumption: validate the feeling without treating suspicion as fact, then ask what
they directly saw/heard/felt.
  - reflect_and_confirm: mirror the user's words in a natural way, then ask the next question.
  - soft_redirect: gently connect back to the complaint letter without scolding.
  - ready_summary: say the picture is clear and ask them to check the summary card.

Target missing field:
{target or "none"}

Field intent:
- incident: Ask what happened, casually.
- hurt_point: Ask what part hit/bothered them most.
- emotion: Ask what feeling was biggest.
- emotion_reason: Ask what thought or meaning made that feeling stronger.
- desired_outcome: Ask what they want the other person to understand or do.

Current structured state:
{state.model_dump_json(by_alias=True)}

Quality signals:
{quality_signals.model_dump_json(by_alias=True)}

Latest user message:
{latest_user_message}

Critical assumption handling:
- If qualitySignals.assumptionRisk is true or replyMode is clarify_assumption, never phrase
the suspected event as if it happened.
- Say "그렇게 의심될 만큼", "그렇게 느껴질 만큼", or "불안해질 만한 신호" instead.
- Bad: "그 비밀스러운 만남에서..."
- Good: "그렇게 의심될 만큼 뭔가 걸리는 신호가 있었던 거네. 직접 본 장면이나 들은 말은 뭐였어?"
"""
    content = call_openai_json_chat(
        messages=[
            {"role": "system", "content": "Return only JSON matching the schema."},
            {"role": "user", "content": prompt},
        ],
        schema=schema,
        schema_name="complaint_persona_reply",
    )
    draft = ComplaintAssistantDraft.model_validate(json.loads(content))
    message = draft.assistant_message.strip() or build_fallback_assistant_message(
        state, latest_user_message, quality_signals
    )
    return enforce_single_question(message, state)


def build_fallback_assistant_message(
    state: ComplaintConversationState,
    latest_user_message: str = "",
    quality_signals: ConversationQualitySignals | None = None,
) -> str:
    quality = quality_signals or ConversationQualitySignals()
    if state.ready_to_generate:
        return "이제 제가 이해한 내용이 모였어요. 고소장 초안에서 마음이 잘 담겼는지 확인해봐요."
    if quality.reply_mode == "clarify_assumption" and first(state.missing_fields) == "incident":
        return "그렇게 의심될 만큼 마음이 불안하셨군요. 직접 봤거나 들은 장면은 무엇이었나요?"
    questions = {
        "incident": "그 마음이 든 구체적인 장면을 하나 들려주실래요?",
        "hurt_point": "그 일에서 가장 서운했던 부분은 무엇인가요?",
        "emotion": "그때 마음은 어떤 감정에 가장 가까웠나요?",
        "emotion_reason": "어떤 생각 때문에 그 감정이 더 커졌나요?",
        "desired_outcome": "상대가 알아주거나 바꿔주었으면 하는 것은 무엇인가요?",
    }
    target = state.missing_fields[0]
    return "말씀해주신 마음을 차근차근 살펴볼게요. " + questions[target]


def enforce_single_question(message: str, state: ComplaintConversationState) -> str:
    clean = re.sub(r"\s+", " ", message).strip()
    if state.ready_to_generate or clean.count("?") <= 1:
        return clean

    sentences = re.findall(r"[^.!?]+[.!?]?", clean)
    question_indices = [index for index, sentence in enumerate(sentences) if "?" in sentence]
    if len(question_indices) <= 1:
        return clean

    last_question_index = question_indices[-1]
    kept_sentences = [
        sentence.strip()
        for index, sentence in enumerate(sentences)
        if index == last_question_index or "?" not in sentence
    ]
    return " ".join(sentence for sentence in kept_sentences if sentence).strip()


def merge_optional(
    base: ComplaintOptionalInfo, incoming: ComplaintOptionalInfo
) -> ComplaintOptionalInfo:
    return ComplaintOptionalInfo(
        nicknameA=prefer_new(base.nickname_a, incoming.nickname_a),
        nicknameB=prefer_new(base.nickname_b, incoming.nickname_b),
        date=prefer_new(base.date, incoming.date),
        place=prefer_new(base.place, incoming.place),
        quotes=merge_unique(base.quotes, incoming.quotes),
        punishmentIdea=prefer_new(base.punishment_idea, incoming.punishment_idea),
    )


def split_sentences(text: str) -> list[str]:
    parts = re.split(r"[.!?\n。]+", text)
    return [part.strip() for part in parts if part.strip()]


def is_assumption(sentence: str) -> bool:
    return any(marker in sentence for marker in ASSUMPTION_MARKERS)


def is_request(sentence: str) -> bool:
    return any(marker in sentence for marker in REQUEST_MARKERS)


def has_incident_evidence(message: str) -> bool:
    return any(extract_fact_clause(sentence) for sentence in split_sentences(message))


def has_hurt_evidence(message: str) -> bool:
    if has_deception_evidence(message):
        return True
    return any(marker in message for marker in HURT_MARKERS) and (
        has_incident_signal(message) or "게" in message or "점" in message or "것" in message
    )


def has_emotion_evidence(message: str) -> bool:
    return any(marker in message for marker in EMOTION_KEYWORDS)


def has_reason_evidence(
    message: str,
    state: ComplaintConversationState,
    emotion_confirmed: bool,
) -> bool:
    if not emotion_confirmed and "emotion" not in state.confirmed_fields:
        return False
    if any(marker in message for marker in REASON_MARKERS):
        return True
    if has_incident_evidence(message) and (
        emotion_confirmed or "emotion" in state.confirmed_fields
    ):
        return True
    return False


def has_desired_evidence(message: str) -> bool:
    return any(marker in message for marker in REQUEST_MARKERS)


def has_incident_signal(sentence: str) -> bool:
    return bool(
        re.search(
            r"\d|어제|오늘|그때|새벽|밤|아침|카톡|전화|연락|약속|술|친구|말|갔|했|안 했|없었",
            sentence,
        )
    )


def has_deception_evidence(message: str) -> bool:
    return any(
        marker in message for marker in ["거짓말", "속였", "속임", "숨겼", "숨김", "솔직", "기만"]
    )


def normalize_assumption(sentence: str) -> str:
    clean = sentence.strip()
    if clean.startswith("분명"):
        return f"사용자는 '{clean}'라고 의심하고 있다"
    return clean


def infer_emotion_reason(message: str) -> str | None:
    message = strip_request_tail(message)
    patterns = [
        r"(나를 .{2,60}?(?:같아서|같았어|느껴져서|느껴졌어))",
        r"((?:무슨 일|사고).{2,50}?걱정(?:됐|돼).{0,20})",
        r"(연락.{2,60}?(?:없어서|안 해서).{0,40})",
        r"(.{2,80}?(?:같아서|느껴져서|느껴졌고|생각이 들어서|걱정돼서|걱정됐고|서운했어|서운했음))",
    ]
    for pattern in patterns:
        match = re.search(pattern, message)
        if match:
            return cleanup_reason(match.group(1))
    return None


def infer_desired_outcome(sentences: list[str]) -> str | None:
    for sentence in reversed(sentences):
        if any(marker in sentence for marker in REQUEST_MARKERS):
            return cleanup_request(sentence)
    return None


def infer_expected_behavior(sentences: list[str], desired: str | None) -> str | None:
    for sentence in reversed(sentences):
        if (
            "해줬으면" in sentence
            or "했으면" in sentence
            or "연락" in sentence
            and ("늦" in sentence or "중간" in sentence)
        ):
            return cleanup_request(sentence)
    return desired


def infer_hurt_point(message: str, facts: list[str], assumptions: list[str]) -> str | None:
    if "거짓말" in message and "솔직" in message:
        return "솔직하게 말하지 않고 거짓말한 점"
    if has_deception_evidence(message):
        return "상대가 거짓말하거나 솔직하게 말하지 않은 점"
    if "연락" in message and ("없" in message or "안" in message):
        return "연락 없이 기다리게 된 점"
    if "신경" in message:
        return "상대가 자신을 신경 쓰지 않는 것처럼 느껴진 점"
    if "무시" in message:
        return "무시당한 것처럼 느껴진 점"
    if "서운" in message:
        return first(assumptions) or first(facts)
    return None


def summarize_incident(facts: list[str]) -> str | None:
    if not facts:
        return None
    return " ".join(facts[:2]).strip()


def infer_date(message: str) -> str | None:
    match = re.search(r"(어제|오늘|그제|지난\s*[^\s]+|새벽\s*\d+시|\d{1,2}월\s*\d{1,2}일)", message)
    return match.group(1) if match else None


def infer_place(message: str) -> str | None:
    match = re.search(r"([가-힣A-Za-z0-9]+(?:집|술집|카페|학교|회사|동네|모임|자리))", message)
    return match.group(1) if match else None


def infer_quotes(message: str) -> list[str]:
    return re.findall(r"[\"'“”‘’]([^\"'“”‘’]{2,80})[\"'“”‘’]", message)


def cleanup_reason(text: str) -> str:
    return text.strip().strip(",. ")


def cleanup_request(text: str) -> str:
    clean = text.strip().strip(",. ")
    for marker in ["앞으로는", "앞으로", "다음부터는", "다음부터", "늦으면", "늦을 때"]:
        index = clean.find(marker)
        if index > 0:
            clean = clean[index:]
            break
    clean = re.sub(r"^(앞으로는|앞으로|다음부터는|다음부터)\s*", "", clean)
    return clean


def extract_fact_clause(sentence: str) -> str | None:
    clean = sentence.strip().strip(",. ")
    if is_request(clean) and any(clean.startswith(marker) for marker in REQUEST_MARKERS):
        return None
    cut_markers = [
        "개빡",
        "서운",
        "섭섭",
        "걱정",
        "불안",
        "화났",
        "짜증",
        "속상",
        "앞으로",
        "다음부터",
        "해줬으면",
        "했으면",
        "좋겠",
        "바라",
        "원해",
    ]
    cut_points = [clean.find(marker) for marker in cut_markers if clean.find(marker) > 0]
    if cut_points:
        clean = clean[: min(cut_points)].strip(" ,")
        clean = re.sub(r"(고|는데|개)$", "", clean)
    return clean if has_incident_signal(clean) and not is_assumption(clean) else None


def clean_incident_facts(facts: list[str]) -> list[str]:
    cleaned: list[str] = []
    for fact in facts:
        clean = extract_fact_clause(fact)
        if clean:
            cleaned.append(clean)
    return merge_unique([], cleaned)


def clean_incident_description(description: str | None, facts: list[str]) -> str | None:
    if description:
        clean = extract_fact_clause(description)
        if clean:
            return clean
    return summarize_incident(facts)


def strip_request_tail(text: str) -> str:
    clean = text.strip()
    cut_points = [
        clean.find(marker)
        for marker in ["앞으로", "다음부터", "해줬으면", "했으면", "좋겠", "바라", "원해"]
        if clean.find(marker) > 0
    ]
    if cut_points:
        return clean[: min(cut_points)].strip(" ,.고")
    return clean


def prefer_new(base: str | None, incoming: str | None) -> str | None:
    incoming_clean = incoming.strip() if incoming else ""
    return incoming_clean or base


def prefer_existing(base: str | None, incoming: str | None) -> str | None:
    base_clean = base.strip() if base else ""
    incoming_clean = incoming.strip() if incoming else ""
    return base_clean or incoming_clean or None


def merge_unique(a: Iterable[str], b: Iterable[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for item in [*a, *b]:
        clean = item.strip()
        if clean and clean not in seen:
            seen.add(clean)
            result.append(clean)
    return result[:8]


def unique(items: Iterable[str]) -> list[str]:
    return merge_unique([], items)


def has_text(value: str | None) -> bool:
    return bool(value and value.strip())


def first(items: list[str]) -> str:
    return next((item for item in items if item.strip()), "")


def format_emotion_summary(state: ComplaintConversationState) -> str:
    names = ", ".join(state.emotion.emotions)
    reason = state.emotion.reason
    if names and reason:
        return f"{names}. {reason}"
    return names or reason or ""
