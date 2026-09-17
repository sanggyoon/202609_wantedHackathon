import json
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
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


INTRO = "늦은 것도 서운한데 내 탓이라고 해서 진짜 삐졌거든? 그래서 너를 '연락두절죄'로 고소할 거야!"


def model_reply(charge: str, summary: str, intro: str = INTRO) -> str:
    return json.dumps(
        {"cute_charge": charge, "incident_summary": summary, "story_intro": intro}
    )


class GroundSummaryTest(unittest.TestCase):
    def ground(self, charge: str, summary: str, intro: str = INTRO, **overrides) -> CardSummary:
        return ground_summary(
            CardSummary(cute_charge=charge, incident_summary=summary, story_intro=intro),
            make_request(**overrides),
        )

    def test_valid_values_are_trimmed_and_kept(self):
        result = self.ground("  연락두절죄 ", " 약속에 연락 없이 늦었다 ")
        self.assertEqual(result.cute_charge, "연락두절죄")
        self.assertEqual(result.incident_summary, "약속에 연락 없이 늦었다")
        self.assertEqual(result.story_intro, INTRO)

    def test_charge_must_end_with_joe(self):
        self.assertEqual(self.ground("연락두절", "요약").cute_charge, "")

    def test_bare_joe_is_not_a_charge(self):
        self.assertEqual(self.ground("죄", "요약").cute_charge, "")

    def test_long_charge_is_dropped_not_truncated(self):
        self.assertEqual(self.ground("가" * 11 + "죄", "요약").cute_charge, "가" * 11 + "죄")
        self.assertEqual(self.ground("가" * 12 + "죄", "요약").cute_charge, "")

    def test_existing_valid_charge_is_preserved(self):
        intro = "연락이 없어서 걱정하고 서운했거든? 그래서 너를 '내가정한죄'로 고소할 거야!"
        result = self.ground(
            "모델이바꾼죄",
            "요약",
            intro,
            cute_charge="내가정한죄",
        )
        self.assertEqual(result.cute_charge, "내가정한죄")
        self.assertEqual(result.story_intro, intro)

    def test_long_summary_is_dropped_not_truncated(self):
        self.assertEqual(self.ground("연락두절죄", "가" * 60).incident_summary, "가" * 60)
        self.assertEqual(self.ground("연락두절죄", "가" * 61).incident_summary, "")

    def test_intro_must_be_short_and_use_the_same_charge(self):
        self.assertEqual(
            self.ground("연락두절죄", "요약", "연락두절죄" + "가" * 10).story_intro,
            "",
        )
        self.assertEqual(self.ground("연락두절죄", "요약", "가" * 181).story_intro, "")
        self.assertEqual(
            self.ground("연락두절죄", "요약", "그래서 너를 '딴죄'로 고소할 거야!").story_intro,
            "",
        )

    def test_withheld_incident_never_gets_a_summary(self):
        result = self.ground("연락두절죄", "모델이 만든 요약", incident_description=NOT_SHARED)
        self.assertEqual(result.incident_summary, "")
        self.assertEqual(result.story_intro, "")
        self.assertEqual(result.cute_charge, "연락두절죄")


class LocalModeTest(unittest.TestCase):
    def test_local_uses_first_sentence_and_no_charge(self):
        with patch("app.services.card_summary.is_openai_configured", return_value=False):
            result = generate_card_summary(make_request())
        self.assertEqual(result.mode, "local")
        self.assertEqual(result.cute_charge, "")
        self.assertEqual(result.incident_summary, "약속 시간에 연락 없이 한 시간 늦었다")
        self.assertEqual(result.story_intro, "")

    def test_local_withheld_incident_has_no_summary(self):
        with patch("app.services.card_summary.is_openai_configured", return_value=False):
            result = generate_card_summary(make_request(incident_description=NOT_SHARED))
        self.assertEqual(result.incident_summary, "")
        self.assertEqual(result.story_intro, "")

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
        sent_card = json.loads(messages[1]["content"])
        self.assertEqual(messages[1]["role"], "user")
        self.assertEqual(sent_card["incident_description"], CARD["incident_description"])
        self.assertNotIn("incident_summary", sent_card)
        self.assertNotIn("story_intro", sent_card)
        self.assertNotIn("different_viewpoint", sent_card)
        self.assertFalse(model.call_args.kwargs["schema"]["additionalProperties"])
        self.assertEqual(model.call_args.kwargs["schema_name"], "card_summary")
        self.assertEqual(result.mode, "openai")
        self.assertEqual(result.cute_charge, "연락두절죄")
        self.assertEqual(result.incident_summary, "연락 없이 늦었다")
        self.assertEqual(result.story_intro, INTRO)
        prompt = messages[0]["content"]
        self.assertIn("slightly sulky first-person", prompt)
        self.assertIn("exact cute_charge", prompt)
        self.assertIn("preserve it exactly", prompt)
        self.assertIn("Do not invent", prompt)

    def test_model_output_is_grounded(self):
        result, _ = self.run_model(
            model_reply("아주아주나쁜연락두절대마왕죄", "요약"), make_request()
        )
        self.assertEqual(result.cute_charge, "")
        self.assertEqual(result.incident_summary, "요약")


class CardSummaryApiTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_local_response_is_not_cached(self):
        with patch("app.services.card_summary.is_openai_configured", return_value=False):
            response = self.client.post("/api/complaint/card-summary", json={"card": CARD})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.assertEqual(
            response.json(),
            {
                "mode": "local",
                "cute_charge": "",
                "incident_summary": "약속 시간에 연락 없이 한 시간 늦었다",
                "story_intro": "",
            },
        )

    def test_provider_error_is_sanitized(self):
        with patch(
            "app.api.card_summary.generate_card_summary",
            side_effect=RuntimeError("secret provider detail"),
        ):
            response = self.client.post("/api/complaint/card-summary", json={"card": CARD})
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.assertNotIn("secret", response.text)
        self.assertEqual(
            response.json(), {"detail": "Card summary generation failed. Please retry."}
        )

    def test_invalid_input_is_not_echoed(self):
        response = self.client.post(
            "/api/complaint/card-summary",
            json={"card": {"incident_description": {"private": "do not echo"}}},
        )
        self.assertEqual(response.status_code, 422)
        self.assertNotIn("do not echo", response.text)
