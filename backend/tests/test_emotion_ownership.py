import unittest
from unittest.mock import patch

from app.schemas.complaint import (
    ComplaintAIExtracted,
    ComplaintConversationRequest,
    ComplaintConversationState,
    ComplaintEmotion,
    ComplaintIncident,
)
from app.schemas.mediation import MediationReport, MediationRequest
from app.services.complaint_engine import ComplaintTurnExtraction, handle_complaint_message
from app.services.emotion_evidence import NO_EMOTION, has_no_emotion_statement
from app.services.mediation import ground_report


class EmotionOwnershipTest(unittest.TestCase):
    def send(self, message, state=None):
        with patch("app.services.complaint_engine.is_openai_configured", return_value=False):
            return handle_complaint_message(
                ComplaintConversationRequest(
                    side="B",
                    message=message,
                    state=state,
                )
            )

    def test_no_emotion_is_valid_and_other_wish_does_not_add_anger(self):
        first = self.send("남자친구가 자서 따로 치킨을 먹었어.")
        second = self.send("아무 감정 없었어.", first.state)
        self.assertEqual(second.state.emotion.emotions, [NO_EMOTION])
        self.assertNotIn("emotion_reason", second.missing_fields)
        third = self.send("화 좀 풀었으면 좋겠어", second.state)
        self.assertEqual(third.state.emotion.emotions, [NO_EMOTION])
        self.assertIsNone(third.state.emotion.reason)
        self.assertTrue(third.ready_to_generate)

    def test_provider_misattributed_anger_is_blocked(self):
        state = ComplaintConversationState(
            incident=ComplaintIncident(description="치킨을 따로 먹음"),
            emotion=ComplaintEmotion(emotions=[NO_EMOTION]),
            confirmedFields=["incident", "emotion"],
        )
        turn = ComplaintTurnExtraction(
            extracted=ComplaintAIExtracted(
                emotions=ComplaintEmotion(emotions=["화남"], reason="화가 풀렸으면 좋겠어서"),
                desiredOutcome="상대가 화를 풀었으면 좋겠다",
            ),
            confirmedFields=["emotion", "emotion_reason", "desired_outcome"],
        )
        with patch("app.services.complaint_engine.extract_complaint_info", return_value=turn):
            result = handle_complaint_message(
                ComplaintConversationRequest(
                    side="B",
                    message="화 좀 풀었으면 좋겠어",
                    state=state,
                )
            )
        self.assertEqual(result.state.emotion.emotions, [NO_EMOTION])
        self.assertIsNone(result.state.emotion.reason)
        self.assertTrue(result.ready_to_generate)

    def test_no_emotion_replaces_previous_labels(self):
        state = ComplaintConversationState(
            emotion=ComplaintEmotion(emotions=["화남"], reason="이전 이유"),
            confirmedFields=["emotion", "emotion_reason"],
        )
        result = self.send("나는 아무 감정 없었어", state)
        self.assertEqual(result.state.emotion.emotions, [NO_EMOTION])
        self.assertIsNone(result.state.emotion.reason)

    def test_later_own_emotion_removes_none(self):
        state = ComplaintConversationState(
            emotion=ComplaintEmotion(emotions=[NO_EMOTION]), confirmedFields=["emotion"]
        )
        result = self.send("나는 화났어", state)
        self.assertIn("화남", result.state.emotion.emotions)
        self.assertNotIn(NO_EMOTION, result.state.emotion.emotions)
        self.assertIn("emotion_reason", result.missing_fields)

    def test_none_about_partner_is_not_speaker_none(self):
        self.assertFalse(has_no_emotion_statement("상대는 아무 감정 없었어"))

    def test_phone_is_not_anger_keyword(self):
        result = self.send("남자친구가 전화를 했어")
        self.assertNotIn("화남", result.state.emotion.emotions)

    def test_mediation_preserves_subjects_and_exact_emotions(self):
        request = MediationRequest(
            a=dict(
                incident="여자친구가 나 빼고 치킨시켜먹음", feeling="기분 나쁨", wish="나도 시켜줘"
            ),
            b=dict(
                incident="남자친구가 자서 여자가 따로 치킨을 먹었다",
                feeling=NO_EMOTION,
                wish="화 좀 풀었으면 좋겠어",
            ),
        )
        report = MediationReport(
            common_ground=[],
            different_views=["B가 자고 있었다"],
            hurt_points_a=["서운함"],
            hurt_points_b=["화남"],
            possible_misunderstanding=None,
            conversation_starter="얘기해봐요",
        )
        result = ground_report(report, request)
        report.possible_misunderstanding = "B가 자고 있어서 오해했다"
        result = ground_report(report, request)
        self.assertIsNone(result.possible_misunderstanding)
        self.assertEqual(result.hurt_points_b, [NO_EMOTION])
        self.assertEqual(result.hurt_points_a, ["기분 나쁨"])
        self.assertIn(request.b.incident, result.different_views[1])
        self.assertNotIn("몰래", " ".join(result.different_views))
