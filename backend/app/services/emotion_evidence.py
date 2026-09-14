"""Conservative safeguards for speaker emotion vs wishes about someone else."""

import re

NO_EMOTION = "특별한 감정 없음"


def has_no_emotion_statement(message: str) -> bool:
    # Do not turn a statement about the partner into the speaker's emotion.
    return any(
        re.fullmatch(
            r"(?:저는|나는|난|전)?\s*(?:그때는|그때|그냥)?\s*"
            r"(?:(?:아무|별|특별한)\s*감정(?:은|이|도)?\s*(?:없.*|안\s*들.*)|"
            r"아무렇지도\s*않(?:았|아|은|음).*)",
            sentence.strip(),
        )
        for sentence in re.split(r"[.!?\n]", message)
        if sentence.strip()
    )


def is_other_emotion_request(sentence: str) -> bool:
    # A wish for anger to subside is not evidence the speaker is angry.
    # Only match standalone clauses; mixed or explicit self reports stay with the extractor.
    return bool(
        re.fullmatch(
            r"(?:(?:상대(?:방)?|남자친구|여자친구|남친|여친|걔|너)(?:가|는|도)?\s*)?"
            r"(?:이제\s*|그냥\s*)?화\s*(?:를\s*)?(?:좀\s*)?"
            r"(?:풀|안\s*냈|내지\s*않|내지\s*말).+",
            sentence.strip(),
        )
    )


def only_other_emotion_request(message: str) -> bool:
    sentences = [s.strip() for s in re.split(r"[.!?\n]", message) if s.strip()]
    return bool(sentences) and all(is_other_emotion_request(s) for s in sentences)


def speaker_emotion_text(message: str) -> str:
    return ". ".join(s for s in re.split(r"[.!?\n]", message) if not is_other_emotion_request(s))


def merge_emotion_labels(old: list[str], new: list[str]) -> list[str]:
    if NO_EMOTION in new:
        return [NO_EMOTION]
    if new:
        return list(dict.fromkeys([v for v in old if v != NO_EMOTION] + new))
    return old
