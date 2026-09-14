import json
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.schemas.complaint import ComplaintConversationRequest, SharedStatement
from app.services.complaint_engine import (
    ComplaintTurnExtraction,
    handle_complaint_message,
)

CARD = {
    "incident_description": "연락 없이 늦었다",
    "emotions": ["서운함"],
    "emotion_reason": "기다린 시간이 길어서",
    "desired_outcome": "먼저 연락해주기",
}


class RespondentTest(unittest.TestCase):
    def test_a_card_does_not_complete_b_fields(self):
        with patch("app.services.complaint_engine.is_openai_configured", return_value=False):
            response = handle_complaint_message(
                ComplaintConversationRequest(
                    side="B",
                    message="모르겠어",
                    sharedStatement=SharedStatement(**CARD),
                )
            )
        self.assertFalse(response.ready_to_generate)
        self.assertIsNone(response.state.incident.description)
        self.assertIsNone(response.state.desired_outcome)

    def test_b_role_reaches_both_models(self):
        with (
            patch("app.services.complaint_engine.is_openai_configured", return_value=True),
            patch(
                "app.services.complaint_engine.extract_with_openai",
                return_value=ComplaintTurnExtraction(),
            ) as extract,
            patch(
                "app.services.complaint_engine.generate_persona_assistant_message",
                return_value="당신이 기억하는 일은 어땠나요?",
            ) as speak,
        ):
            handle_complaint_message(
                ComplaintConversationRequest(
                    side="B",
                    message="내 기억은 달라",
                    sharedStatement=SharedStatement(**CARD),
                )
            )
        self.assertIn("respondent B", extract.call_args.args[2])
        self.assertIn("NOT established truth", speak.call_args.args[3])
        self.assertIn(CARD["incident_description"], extract.call_args.args[2])

    def test_b_can_complete_without_agreeing_or_apologizing(self):
        with patch("app.services.complaint_engine.is_openai_configured", return_value=False):
            response = handle_complaint_message(
                ComplaintConversationRequest(
                    side="B",
                    sharedStatement=SharedStatement(**CARD),
                    message=(
                        "어제 약속 시간을 다르게 말해서 화났어. "
                        "앞으로 시간을 같이 확인했으면 좋겠어."
                    ),
                )
            )
        self.assertTrue(response.ready_to_generate)
        self.assertIn("맞고소장 초안", response.assistant_message)

    def test_invalid_side_rejected(self):
        response = TestClient(app).post(
            "/api/complaint/conversation/message", json={"side": "admin", "message": "hello"}
        )
        self.assertEqual(response.status_code, 422)

    def test_local_report_does_not_invent_agreement(self):
        with patch("app.services.mediation.is_openai_configured", return_value=False):
            response = TestClient(app).post("/api/mediation/report", json={"a": CARD, "b": CARD})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.assertEqual(response.json()["mode"], "local")
        self.assertEqual(response.json()["report"]["common_ground"], [])

    def test_report_uses_only_shared_cards_and_voice_policy(self):
        expected = dict(
            common_ground=[],
            different_views=["A와 B가 시간을 다르게 기억해요."],
            hurt_points_a=["서운함"],
            hurt_points_b=["억울함"],
            possible_misunderstanding=None,
            conversation_starter="시간을 같이 확인해볼까요?",
        )
        with (
            patch("app.services.mediation.is_openai_configured", return_value=True),
            patch(
                "app.services.mediation.call_openai_json_chat", return_value=json.dumps(expected)
            ) as model,
        ):
            response = TestClient(app).post("/api/mediation/report", json={"a": CARD, "b": CARD})
        self.assertEqual(response.status_code, 200)
        self.assertIn("밤톨", model.call_args.kwargs["messages"][0]["content"])
        self.assertEqual(
            set(json.loads(model.call_args.kwargs["messages"][1]["content"])), {"a", "b"}
        )

    def test_report_failure_does_not_leak_provider_error(self):
        with patch(
            "app.api.mediation.generate_mediation", side_effect=RuntimeError("private-secret")
        ):
            response = TestClient(app).post("/api/mediation/report", json={"a": CARD, "b": CARD})
        self.assertEqual(response.status_code, 502)
        self.assertNotIn("private-secret", response.text)
        self.assertEqual(response.headers["cache-control"], "no-store")

    def test_report_requires_both_cards(self):
        response = TestClient(app).post("/api/mediation/report", json={"a": CARD})
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
