import unittest
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.core.tokens import hash_token, new_token, token_matches
from app.db import DatabaseNotConfigured
from app.main import app
from app.repositories.cases import CaseRow

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
