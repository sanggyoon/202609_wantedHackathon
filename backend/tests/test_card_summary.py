import json
import unittest
from unittest.mock import patch

from app.schemas.card_summary import CardSummary, CardSummaryRequest
from app.schemas.complaint import NOT_SHARED, SharedStatement
from app.services.card_summary import generate_card_summary, ground_summary

CARD = {
    "incident_description": "약속 시간에 연락 없이 한 시간 늦었다. 그동안 계속 기다렸다.",
    "emotions": ["서운함"],
    "emotion_reason": "기다린 시간이 길어서",
    "desired_outcome": "늦을 땐 먼저 연락해주기",
}


def make_request(**overrides) -> CardSummaryRequest:
    return CardSummaryRequest(card=SharedStatement(**{**CARD, **overrides}))


def model_reply(charge: str, summary: str) -> str:
    return json.dumps({"cute_charge": charge, "incident_summary": summary})


class GroundSummaryTest(unittest.TestCase):
    def ground(self, charge: str, summary: str, **overrides) -> CardSummary:
        return ground_summary(
            CardSummary(cute_charge=charge, incident_summary=summary),
            make_request(**overrides),
        )

    def test_valid_values_are_trimmed_and_kept(self):
        result = self.ground("  연락두절죄 ", " 약속에 연락 없이 늦었다 ")
        self.assertEqual(result.cute_charge, "연락두절죄")
        self.assertEqual(result.incident_summary, "약속에 연락 없이 늦었다")

    def test_charge_must_end_with_joe(self):
        self.assertEqual(self.ground("연락두절", "요약").cute_charge, "")

    def test_bare_joe_is_not_a_charge(self):
        self.assertEqual(self.ground("죄", "요약").cute_charge, "")

    def test_long_charge_is_dropped_not_truncated(self):
        self.assertEqual(self.ground("가" * 11 + "죄", "요약").cute_charge, "가" * 11 + "죄")
        self.assertEqual(self.ground("가" * 12 + "죄", "요약").cute_charge, "")

    def test_long_summary_is_dropped_not_truncated(self):
        self.assertEqual(self.ground("연락두절죄", "가" * 60).incident_summary, "가" * 60)
        self.assertEqual(self.ground("연락두절죄", "가" * 61).incident_summary, "")

    def test_withheld_incident_never_gets_a_summary(self):
        result = self.ground("연락두절죄", "모델이 만든 요약", incident_description=NOT_SHARED)
        self.assertEqual(result.incident_summary, "")
        self.assertEqual(result.cute_charge, "연락두절죄")


class LocalModeTest(unittest.TestCase):
    def test_local_uses_first_sentence_and_no_charge(self):
        with patch("app.services.card_summary.is_openai_configured", return_value=False):
            result = generate_card_summary(make_request())
        self.assertEqual(result.mode, "local")
        self.assertEqual(result.cute_charge, "")
        self.assertEqual(result.incident_summary, "약속 시간에 연락 없이 한 시간 늦었다")

    def test_local_withheld_incident_has_no_summary(self):
        with patch("app.services.card_summary.is_openai_configured", return_value=False):
            result = generate_card_summary(make_request(incident_description=NOT_SHARED))
        self.assertEqual(result.incident_summary, "")

    def test_local_long_first_sentence_is_dropped(self):
        with patch("app.services.card_summary.is_openai_configured", return_value=False):
            result = generate_card_summary(make_request(incident_description="가" * 61))
        self.assertEqual(result.incident_summary, "")


class OpenAIModeTest(unittest.TestCase):
    def run_model(self, reply: str, request: CardSummaryRequest):
        with (
            patch("app.services.card_summary.is_openai_configured", return_value=True),
            patch(
                "app.services.card_summary.call_openai_json_chat", return_value=reply
            ) as model,
        ):
            return generate_card_summary(request), model

    def test_model_sees_only_the_shared_card(self):
        request = make_request(assumption=NOT_SHARED)
        result, model = self.run_model(model_reply("연락두절죄", "연락 없이 늦었다"), request)
        messages = model.call_args.kwargs["messages"]
        self.assertEqual(len(messages), 2)
        self.assertEqual(messages[0]["role"], "system")
        self.assertEqual(messages[1], {"role": "user", "content": request.card.model_dump_json()})
        self.assertFalse(model.call_args.kwargs["schema"]["additionalProperties"])
        self.assertEqual(model.call_args.kwargs["schema_name"], "card_summary")
        self.assertEqual(result.mode, "openai")
        self.assertEqual(result.cute_charge, "연락두절죄")
        self.assertEqual(result.incident_summary, "연락 없이 늦었다")

    def test_model_output_is_grounded(self):
        result, _ = self.run_model(
            model_reply("아주아주나쁜연락두절대마왕죄", "요약"), make_request()
        )
        self.assertEqual(result.cute_charge, "")
        self.assertEqual(result.incident_summary, "요약")
