import unittest
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import cv2
import numpy as np
from fastapi.testclient import TestClient

from app.core.tokens import hash_token, new_token, token_matches
from app.db import DatabaseNotConfigured
from app.main import app
from app.repositories.cases import CaseRow
from app.schemas.emotion_warp import EmotionProfile
from app.schemas.mediation import MediationReport
from app.services.emotion_warp import PREVIEW_SIZE, render_emotion_preview_png

client = TestClient(app)

PUBLIC = "public-token-abc"
WRITER = "writer-token-xyz"


def make_case(status="AWAITING_RESPONSE", expires_in_days=7, with_writer=True):
    now = datetime.now(UTC)
    return CaseRow(
        id="11111111-1111-1111-1111-111111111111",
        status=status,
        response_type=None,
        created_at=now,
        answered_at=None,
        expires_at=now + timedelta(days=expires_in_days),
        writer_token_hash=hash_token(WRITER) if with_writer else None,
    )


EMPTY_CONTENT = {"cards": {}, "report": None, "apology": None}

PROFILE = {
    "representative_emotion": "서운함",
    "image": "sadness.png",
    "scores": [],
    "axes": {"화남": 0.2, "질투": 0.0, "슬픔": 0.8, "포기": 0.1, "황당": 0.0, "서운함": 0.9},
    "resolved_by": "ai",
}


class TokenTest(unittest.TestCase):
    def test_hash_is_deterministic_and_not_the_token(self):
        self.assertEqual(hash_token("x"), hash_token("x"))
        self.assertNotIn("x", hash_token("x"))
        self.assertEqual(len(hash_token("x")), 64)

    def test_tokens_are_unique(self):
        self.assertNotEqual(new_token(), new_token())

    def test_matching_is_by_hash(self):
        self.assertTrue(token_matches(WRITER, hash_token(WRITER)))
        self.assertFalse(token_matches("other", hash_token(WRITER)))


class CreateCaseTest(unittest.TestCase):
    def test_returns_two_distinct_tokens_and_stores_only_hashes(self):
        with patch("app.api.cases.repo.create_case", return_value=make_case("DRAFT")) as create:
            response = client.post("/api/cases")
        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertNotEqual(body["public_token"], body["writer_token"])
        # 저장소에는 해시만 넘어가야 한다. 원문이 넘어가면 DB에 원문이 남는다.
        stored_public, stored_writer = create.call_args.args
        self.assertEqual(stored_public, hash_token(body["public_token"]))
        self.assertEqual(stored_writer, hash_token(body["writer_token"]))
        self.assertNotIn(body["public_token"], (stored_public, stored_writer))

    def test_response_is_not_cached(self):
        with patch("app.api.cases.repo.create_case", return_value=make_case("DRAFT")):
            response = client.post("/api/cases")
        self.assertEqual(response.headers["Cache-Control"], "no-store")

    def test_missing_database_url_is_503_without_details(self):
        broken = DatabaseNotConfigured("DATABASE_URL is not set")
        with patch("app.api.cases.repo.create_case", side_effect=broken):
            response = client.post("/api/cases")
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("DATABASE_URL", response.text)


class ReadCaseTest(unittest.TestCase):
    def get(self, case, headers=None, content=None):
        with (
            patch("app.api.cases.repo.find_by_public_token_hash", return_value=case),
            patch("app.api.cases.repo.load_content", return_value=content or EMPTY_CONTENT),
        ):
            return client.get(f"/api/cases/{PUBLIC}", headers=headers or {})

    def test_unknown_token_is_404(self):
        response = self.get(None)
        self.assertEqual(response.status_code, 404)

    def test_no_writer_token_reads_as_b(self):
        response = self.get(make_case())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["viewer_role"], "B")

    def test_writer_token_reads_as_a(self):
        response = self.get(make_case(), headers={"X-Writer-Token": WRITER})
        self.assertEqual(response.json()["viewer_role"], "A")

    def test_wrong_writer_token_is_not_an_error(self):
        # B는 이 토큰을 갖지 않는다. 불일치를 403으로 만들면 정상 경로가 막힌다.
        response = self.get(make_case(), headers={"X-Writer-Token": "wrong"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["viewer_role"], "B")

    def test_expired_by_time_is_410_without_content(self):
        response = self.get(make_case(expires_in_days=-1))
        self.assertEqual(response.status_code, 410)
        self.assertNotIn("cards", response.text)

    def test_expired_by_status_is_410(self):
        response = self.get(make_case(status="EXPIRED"))
        self.assertEqual(response.status_code, 410)

    def test_draft_has_no_content(self):
        response = self.get(make_case(status="DRAFT"), headers={"X-Writer-Token": WRITER})
        self.assertIsNone(response.json()["content"])

    def test_content_is_loaded_for_non_draft(self):
        card = {
            "incident_description": "연락 없이 늦었다",
            "emotions": ["서운함"],
            "emotion_reason": "기다려서",
            "desired_outcome": "먼저 연락해주기",
        }
        response = self.get(
            make_case(),
            content={"cards": {"A": card}, "report": None, "apology": None},
        )
        body = response.json()
        self.assertEqual(body["content"]["cards"]["A"]["emotions"], ["서운함"])
        self.assertIsNone(body["content"]["report"])

    def test_response_is_not_cached(self):
        response = self.get(make_case())
        self.assertEqual(response.headers["Cache-Control"], "no-store")

    def test_nullable_columns_come_back_as_empty_strings(self):
        # hurt_point·expected_behavior·assumption 컬럼은 nullable이다.
        # 저장된 카드를 읽으면 None이 오는데, 그대로 두면 조회가 500으로 깨진다.
        card = {
            "cute_charge": None,
            "incident_summary": None,
            "story_intro": None,
            "incident_description": "늦었다",
            "emotions": ["서운함"],
            "emotion_reason": None,
            "hurt_point": None,
            "different_viewpoint": None,
            "desired_outcome": "연락",
            "expected_behavior": None,
            "assumption": None,
        }
        response = self.get(
            make_case(),
            content={"cards": {"A": card}, "report": None, "apology": None},
        )
        self.assertEqual(response.status_code, 200)
        got = response.json()["content"]["cards"]["A"]
        for key in ("cute_charge", "story_intro", "emotion_reason", "hurt_point",
                    "expected_behavior", "assumption"):
            self.assertEqual(got[key], "", key)
        # different_viewpoint만은 null을 유지한다 — "아직 없음"과 "빈 값"이 다르다.
        self.assertIsNone(got["different_viewpoint"])


class AvailableActionsTest(unittest.TestCase):
    def get_actions(self, status, as_writer):
        headers = {"X-Writer-Token": WRITER} if as_writer else {}
        with (
            patch("app.api.cases.repo.find_by_public_token_hash", return_value=make_case(status)),
            patch("app.api.cases.repo.load_content", return_value=EMPTY_CONTENT),
        ):
            return client.get(f"/api/cases/{PUBLIC}", headers=headers).json()["available_actions"]

    def test_draft_lets_only_a_write(self):
        self.assertIn("submit_statement", self.get_actions("DRAFT", as_writer=True))
        self.assertEqual(self.get_actions("DRAFT", as_writer=False), [])

    def test_awaiting_response_lets_only_b_choose(self):
        self.assertEqual(self.get_actions("AWAITING_RESPONSE", as_writer=True), [])
        self.assertEqual(
            self.get_actions("AWAITING_RESPONSE", as_writer=False), ["choose_response_type"]
        )

    def test_completed_is_read_only_for_both(self):
        self.assertEqual(self.get_actions("COUNTER_COMPLETED", as_writer=True), [])
        self.assertEqual(self.get_actions("COUNTER_COMPLETED", as_writer=False), [])


if __name__ == "__main__":
    unittest.main()


CARD = {
    "incident_description": "연락 없이 늦었다",
    "emotions": ["서운함"],
    "emotion_reason": "기다려서",
    "desired_outcome": "먼저 연락해주기",
}

REPORT = {
    "common_ground": [],
    "different_views": ["A: …", "B: …"],
    "hurt_points_a": ["서운함"],
    "hurt_points_b": ["미안함"],
    "possible_misunderstanding": None,
    "conversation_starter": "얘기해볼까요?",
}


def content_with_a_card():
    return {"cards": {"A": CARD}, "report": None, "apology": None}


class SubmitStatementTest(unittest.TestCase):
    def post(self, case, body, headers=None, saved=True, content=None):
        with (
            patch("app.api.cases.repo.find_by_public_token_hash", return_value=case),
            patch("app.api.cases.repo.load_content", return_value=content or EMPTY_CONTENT),
            patch("app.api.cases.repo.submit_statement_a", return_value=saved),
        ):
            return client.post(
                f"/api/cases/{PUBLIC}/statement", json=body, headers=headers or {}
            )

    def test_a_requires_writer_token(self):
        response = self.post(make_case("DRAFT"), {"side": "A", "card": CARD})
        self.assertEqual(response.status_code, 403)

    def test_a_with_writer_token_saves(self):
        response = self.post(
            make_case("DRAFT"), {"side": "A", "card": CARD}, headers={"X-Writer-Token": WRITER}
        )
        self.assertEqual(response.status_code, 200)

    def test_a_second_submission_is_409(self):
        # 조건부 UPDATE가 0행을 반환하면 이미 제출된 것이다.
        response = self.post(
            make_case("DRAFT"),
            {"side": "A", "card": CARD},
            headers={"X-Writer-Token": WRITER},
            saved=False,
        )
        self.assertEqual(response.status_code, 409)

    def test_expired_case_rejects_writes(self):
        response = self.post(
            make_case("DRAFT", expires_in_days=-1),
            {"side": "A", "card": CARD},
            headers={"X-Writer-Token": WRITER},
        )
        self.assertEqual(response.status_code, 410)

    def test_b_needs_counter_draft_status(self):
        with (
            patch("app.api.cases.repo.find_by_public_token_hash",
                  return_value=make_case("AWAITING_RESPONSE")),
            patch("app.api.cases.repo.load_content", return_value=content_with_a_card()),
        ):
            response = client.post(f"/api/cases/{PUBLIC}/statement",
                                   json={"side": "B", "card": CARD})
        self.assertEqual(response.status_code, 409)

    def test_b_does_not_need_writer_token(self):
        # B는 링크만 가지고 응답한다. 토큰을 요구하면 정상 경로가 막힌다.
        with (
            patch("app.api.cases.repo.find_by_public_token_hash",
                  return_value=make_case("COUNTER_DRAFT")),
            patch("app.api.cases.repo.load_content", return_value=content_with_a_card()),
            patch("app.api.cases.generate_mediation") as gen,
            patch("app.api.cases.repo.complete_counter", return_value=True),
        ):
            gen.return_value.report = MediationReport.model_validate(REPORT)
            response = client.post(f"/api/cases/{PUBLIC}/statement",
                                   json={"side": "B", "card": CARD})
        self.assertEqual(response.status_code, 200)

    def test_b_report_failure_does_not_save_the_card(self):
        with (
            patch("app.api.cases.repo.find_by_public_token_hash",
                  return_value=make_case("COUNTER_DRAFT")),
            patch("app.api.cases.repo.load_content", return_value=content_with_a_card()),
            patch("app.api.cases.generate_mediation", side_effect=RuntimeError("openai down")),
            patch("app.api.cases.repo.complete_counter") as save,
        ):
            response = client.post(f"/api/cases/{PUBLIC}/statement",
                                   json={"side": "B", "card": CARD})
        self.assertEqual(response.status_code, 502)
        save.assert_not_called()
        self.assertNotIn("openai down", response.text)

    def test_b_without_a_card_is_409(self):
        with (
            patch("app.api.cases.repo.find_by_public_token_hash",
                  return_value=make_case("COUNTER_DRAFT")),
            patch("app.api.cases.repo.load_content", return_value=EMPTY_CONTENT),
        ):
            response = client.post(f"/api/cases/{PUBLIC}/statement",
                                   json={"side": "B", "card": CARD})
        self.assertEqual(response.status_code, 409)


class ResponseTypeTest(unittest.TestCase):
    def post(self, case, value, chosen=True):
        with (
            patch("app.api.cases.repo.find_by_public_token_hash", return_value=case),
            patch("app.api.cases.repo.load_content", return_value=content_with_a_card()),
            patch("app.api.cases.repo.choose_response_type", return_value=chosen),
        ):
            return client.post(
                f"/api/cases/{PUBLIC}/response-type", json={"response_type": value}
            )

    def test_choosing_counter(self):
        self.assertEqual(self.post(make_case(), "COUNTER").status_code, 200)

    def test_choosing_twice_is_409(self):
        self.assertEqual(self.post(make_case(), "APOLOGY", chosen=False).status_code, 409)

    def test_unknown_value_is_422(self):
        response = self.post(make_case(), "MAYBE")
        self.assertEqual(response.status_code, 422)


class ApologyTest(unittest.TestCase):
    def post(self, case, body, saved=True):
        with (
            patch("app.api.cases.repo.find_by_public_token_hash", return_value=case),
            patch("app.api.cases.repo.load_content", return_value=content_with_a_card()),
            patch("app.api.cases.repo.complete_apology", return_value=saved),
        ):
            return client.post(f"/api/cases/{PUBLIC}/apology", json=body)

    def test_body_is_required(self):
        response = self.post(make_case("APOLOGY_DRAFT"), {"body": "  "})
        self.assertEqual(response.status_code, 422)

    def test_submits_with_body_only(self):
        response = self.post(make_case("APOLOGY_DRAFT"), {"body": "미안해"})
        self.assertEqual(response.status_code, 200)

    def test_second_submission_is_409(self):
        response = self.post(make_case("APOLOGY_DRAFT"), {"body": "미안해"}, saved=False)
        self.assertEqual(response.status_code, 409)


class EmotionImageTest(unittest.TestCase):
    def get(self, case, cards):
        content = {"cards": cards, "report": None, "apology": None}
        with (
            patch("app.api.cases.repo.find_by_public_token_hash", return_value=case),
            patch("app.api.cases.repo.load_content", return_value=content),
        ):
            return client.get(f"/api/cases/{PUBLIC}/emotion-image")

    def test_returns_png_without_writer_token(self):
        response = self.get(make_case(), {"A": {"emotion_scores": PROFILE}})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["content-type"], "image/png")
        self.assertTrue(response.content.startswith(b"\x89PNG"))
        # 카톡 크롤러가 다시 받아가도 같은 그림이 나오도록 캐시를 허용한다.
        self.assertIn("max-age", response.headers["Cache-Control"])

    def test_image_matches_what_the_recipient_sees(self):
        # 미리보기와 B가 고소장에서 보는 이미지는 같은 렌더러의 같은 결과여야 한다.
        served = self.get(make_case(), {"A": {"emotion_scores": PROFILE}}).content
        self.assertEqual(
            served, render_emotion_preview_png(EmotionProfile.model_validate(PROFILE))
        )

    def test_preview_is_opaque_and_wide(self):
        # 카톡은 알파를 살리지 못한다. 투명한 채로 나가면 배경이 검게 찍힌다.
        served = self.get(make_case(), {"A": {"emotion_scores": PROFILE}}).content
        image = cv2.imdecode(np.frombuffer(served, np.uint8), cv2.IMREAD_UNCHANGED)
        self.assertEqual((image.shape[1], image.shape[0]), PREVIEW_SIZE)
        self.assertEqual(image.shape[2], 3)

    def test_case_without_shared_emotion_has_no_image(self):
        self.assertEqual(self.get(make_case(), {"A": {"emotion_scores": None}}).status_code, 404)

    def test_draft_and_expired_cases_are_not_served(self):
        self.assertEqual(self.get(make_case("DRAFT"), {}).status_code, 404)
        self.assertEqual(self.get(make_case(expires_in_days=-1), {}).status_code, 410)
