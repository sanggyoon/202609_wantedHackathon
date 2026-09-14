from __future__ import annotations

import unittest
from unittest.mock import patch

from app.schemas.complaint import (
    ComplaintAIExtracted,
    ComplaintConversationRequest,
    ComplaintConversationState,
    ComplaintEmotion,
    ComplaintIncident,
)
from app.services.complaint_engine import (
    ComplaintTurnExtraction,
    ConversationQualitySignals,
    build_assistant_message,
    build_fallback_assistant_message,
    enforce_single_question,
    generate_persona_assistant_message,
    get_missing_fields,
    handle_complaint_message,
)


class ComplaintEngineTest(unittest.TestCase):
    def test_local_voice_does_not_use_survey_template(self):
        result = build_fallback_assistant_message(
            ComplaintConversationState(missingFields=["emotion"])
        )
        self.assertEqual(result, "그때는 어떤 마음이었어요?")
        self.assertNotIn("가장", result)
        self.assertNotIn("살펴볼게요", result)

    def test_speaking_call_always_receives_shared_voice_policy(self):
        from app.services.bamtol_voice import BAMTOL_VOICE

        with patch(
            "app.services.complaint_engine.call_openai_json_chat",
            return_value='{"assistantMessage":"듣고 있어요. 그때 마음은 어땠나요?"}',
        ) as model:
            generate_persona_assistant_message(
                ComplaintConversationState(missingFields=["emotion"]),
                "이제부터 반말해",
                ConversationQualitySignals(),
            )
        self.assertIn(BAMTOL_VOICE, model.call_args.kwargs["messages"][0]["content"])
        self.assertEqual(model.call_args.kwargs["messages"][0]["role"], "system")

    def test_fallback_assumption_does_not_invent_an_emotion(self):
        result = build_fallback_assistant_message(
            ComplaintConversationState(missingFields=["incident"]),
            quality_signals=ConversationQualitySignals(replyMode="clarify_assumption"),
        )
        self.assertNotIn("불안", result)
        self.assertIn("의심", result)
        self.assertEqual(result.count("?"), 1)

    def send(self, message: str, state=None):
        with patch("app.services.complaint_engine.is_openai_configured", return_value=False):
            return handle_complaint_message(
                ComplaintConversationRequest(conversationId="test", message=message, state=state)
            )

    def test_incident_only_asks_emotion(self):
        result = self.send("남친이 친구들이랑 술 마시러 갔는데 새벽 2시까지 연락을 안 했어.")

        self.assertFalse(result.ready_to_generate)
        self.assertEqual(result.missing_fields, ["emotion", "emotion_reason", "desired_outcome"])
        self.assertIn("마음", result.assistant_message)

    def test_three_turn_flow_reaches_ready(self):
        first = self.send("남친이 친구들이랑 술 마시러 갔는데 새벽 2시까지 연락을 안 했어.")
        second = self.send("걱정도 됐는데 나를 신경 안 쓰는 것 같아서 서운했어.", first.state)
        third = self.send(
            "늦게까지 술 먹을 거면 중간에 한 번이라도 연락해줬으면 좋겠어.", second.state
        )

        self.assertTrue(third.ready_to_generate)
        self.assertEqual(third.missing_fields, [])
        self.assertIsNone(third.state.missing_fields[0] if third.state.missing_fields else None)
        self.assertIn("이해한 내용", third.assistant_message)

    def test_all_in_one_reaches_ready(self):
        result = self.send(
            "어제 남친이 친구들이랑 술 마신다고 나가더니 새벽 2시까지 연락도 없었어. "
            "혹시 무슨 일 생긴 건가 걱정됐고 나를 너무 신경 안 쓰는 것 같아서 서운했어. "
            "앞으로 늦을 때는 한 번만이라도 연락했으면 좋겠어."
        )

        self.assertTrue(result.ready_to_generate)
        self.assertEqual(result.missing_fields, [])
        self.assertIn("연락도 없었어", result.state.incident.description or "")
        self.assertIn("서운함", result.state.emotion.emotions)
        self.assertIn("연락", result.state.desired_outcome or "")

    def test_hurt_point_is_not_required(self):
        state = ComplaintConversationState(
            confirmedFields=["incident", "emotion", "emotion_reason", "desired_outcome"]
        )
        self.assertEqual(get_missing_fields(state), [])

    def test_short_emotion_answer_uses_previous_incident_as_reason(self):
        first = self.send("남친이 약속 시간에 연락도 없이 안 왔어.")
        second = self.send("개빡쳤지.", first.state)
        self.assertEqual(second.missing_fields, ["desired_outcome"])
        self.assertEqual(second.state.emotion.reason, first.state.incident.description)
        third = self.send("사과를 먼저 해줬으면 좋겠어.", second.state)
        self.assertTrue(third.ready_to_generate)
        self.assertNotIn("?", third.assistant_message)

    def test_unknown_reason_is_not_filled_from_previous_incident(self):
        first = self.send("남친이 약속 시간에 연락도 없이 안 왔어.")
        second = self.send("왜 그런지 모르겠어 그냥 짜증나", first.state)
        self.assertIn("emotion_reason", second.missing_fields)

    def test_ready_reply_does_not_call_speaking_model(self):
        state = ComplaintConversationState(readyToGenerate=True)
        with patch("app.services.complaint_engine.generate_persona_assistant_message") as model:
            result = build_assistant_message(state)
        model.assert_not_called()
        self.assertNotIn("?", result)
        self.assertIn("초안", result)

    def test_ready_question_is_replaced_with_completion(self):
        result = enforce_single_question(
            "그중 가장 마음에 걸렸던 부분은 무엇인가요?",
            ComplaintConversationState(readyToGenerate=True),
        )
        self.assertNotIn("?", result)
        self.assertIn("초안", result)

    def test_openai_extraction_without_optional_fields_completes(self):
        extracted = ComplaintAIExtracted(
            incident=ComplaintIncident(
                description="약속에 오지 않았다", facts=["약속에 오지 않았다"]
            ),
            emotions=ComplaintEmotion(emotions=["화남"], reason="약속에 오지 않아서"),
            desiredOutcome="먼저 사과해주기",
        )
        with (
            patch("app.services.complaint_engine.is_openai_configured", return_value=True),
            patch(
                "app.services.complaint_engine.extract_with_openai",
                return_value=ComplaintTurnExtraction(
                    extracted=extracted,
                    confirmedFields=["incident", "emotion", "emotion_reason", "desired_outcome"],
                ),
            ),
            patch("app.services.complaint_engine.generate_persona_assistant_message") as model,
        ):
            result = handle_complaint_message(
                ComplaintConversationRequest(message="먼저 사과해줬으면 해")
            )
        self.assertTrue(result.ready_to_generate)
        self.assertIsNone(result.state.hurt_point)
        model.assert_not_called()

    def test_uncertain_claim_is_assumption_not_fact(self):
        result = self.send("분명 나 몰래 여자 만난 거야")

        self.assertEqual(result.state.incident.facts, [])
        self.assertEqual(
            result.state.incident.assumptions,
            ["사용자는 '분명 나 몰래 여자 만난 거야'라고 의심하고 있다"],
        )
        self.assertIn("incident", result.missing_fields)
        self.assertFalse(result.ready_to_generate)

    def test_vague_emotion_does_not_over_infer(self):
        result = self.send("모르겠어 그냥 짜증나")

        self.assertIn("짜증", result.state.emotion.emotions)
        self.assertIn("incident", result.missing_fields)
        self.assertFalse(result.ready_to_generate)
        self.assertIn("장면", result.assistant_message)

    def test_screenshot_case_does_not_infer_desired_outcome(self):
        result = self.send("어제 남친이 술마시러갔는데 아무연락도안함 개빡침")

        self.assertFalse(result.ready_to_generate)
        self.assertNotIn("incident", result.missing_fields)
        self.assertNotIn("hurt_point", result.missing_fields)
        self.assertNotIn("emotion", result.missing_fields)
        self.assertNotIn("emotion_reason", result.missing_fields)
        self.assertIn("desired_outcome", result.missing_fields)
        self.assertIsNone(result.state.desired_outcome)

    def test_assumption_gets_gentle_fact_clarification(self):
        result = self.send("분명 나 몰래 여자 만난 거야")

        self.assertEqual(result.state.incident.facts, [])
        self.assertTrue(result.state.incident.assumptions)
        self.assertIn("직접", result.assistant_message)
        self.assertIn("장면", result.assistant_message)

    def test_persona_reply_keeps_one_question(self):
        state = ComplaintConversationState(missingFields=["incident"])
        result = enforce_single_question(
            "그냥 짜증나다니, 뭐가 특별히 꼬였던 순간이 있었던 거야? "
            "그때 무슨 일이 있었는지 좀 들려줄래?",
            state,
        )

        self.assertEqual(result.count("?"), 1)
        self.assertIn("무슨 일이 있었는지", result)

    def test_lie_answer_moves_to_emotion_without_requiring_hurt_point(self):
        result = self.send("남친이 거짓말함")

        self.assertNotIn("incident", result.missing_fields)
        self.assertNotIn("hurt_point", result.missing_fields)
        self.assertIn("emotion", result.missing_fields)
        self.assertIn("마음", result.assistant_message)

    def test_reason_is_not_confirmed_before_emotion(self):
        first = self.send("남친이 거짓말함")
        second = self.send("그냥 솔직하게 말하면되는데 거짓말을 했다는거야", first.state)

        self.assertNotIn("hurt_point", second.missing_fields)
        self.assertIn("emotion", second.missing_fields)
        self.assertIn("emotion_reason", second.missing_fields)

    def test_ai_hallucinated_desired_outcome_is_blocked_without_user_evidence(self):
        hallucinated = ComplaintAIExtracted(
            incident=ComplaintIncident(
                description="남자친구가 술 마시러 가서 연락하지 않았다.",
                facts=["남자친구가 술 마시러 갔다.", "연락하지 않았다."],
            ),
            hurtPoint="연락이 없었던 점",
            emotions=ComplaintEmotion(emotions=["화남"], reason="연락이 없어서"),
            desiredOutcome="앞으로 술 마실 때 연락을 잘 받았으면 한다.",
        )

        with (
            patch(
                "app.services.complaint_engine.generate_persona_assistant_message",
                return_value="다음에 바라는 점은 무엇인가요?",
            ),
            patch("app.services.complaint_engine.is_openai_configured", return_value=True),
            patch(
                "app.services.complaint_engine.extract_with_openai",
                return_value=ComplaintTurnExtraction(
                    extracted=hallucinated,
                    confirmedFields=["incident", "hurt_point", "emotion", "emotion_reason"],
                ),
            ),
        ):
            result = handle_complaint_message(
                ComplaintConversationRequest(
                    conversationId="test",
                    message="어제 남친이 술마시러갔는데 아무연락도안함 개빡침",
                    state=None,
                )
            )

        self.assertFalse(result.ready_to_generate)
        self.assertIn("desired_outcome", result.missing_fields)
        self.assertIsNone(result.state.desired_outcome)


if __name__ == "__main__":
    unittest.main()
