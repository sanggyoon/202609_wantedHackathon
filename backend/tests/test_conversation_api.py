import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app


class ConversationApiTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_stateless_flow_and_cache_policy(self):
        with (
            patch("app.services.complaint_engine.is_openai_configured", return_value=False),
            patch("app.api.conversation.is_openai_configured", return_value=False),
        ):
            response = self.client.post(
                "/api/complaint/conversation/message", json={"message": "남친이 거짓말함"}
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.assertEqual(response.json()["mode"], "local")
        self.assertFalse(response.json()["readyToGenerate"])

    def test_invalid_input_is_not_echoed(self):
        response = self.client.post(
            "/api/complaint/conversation/message", json={"message": {"private": "do not echo"}}
        )
        self.assertEqual(response.status_code, 422)
        self.assertNotIn("do not echo", response.text)

    def test_provider_error_is_sanitized(self):
        with patch(
            "app.api.conversation.handle_complaint_message", side_effect=RuntimeError("secret")
        ):
            response = self.client.post(
                "/api/complaint/conversation/message", json={"message": "hello"}
            )
        self.assertEqual(response.status_code, 502)
        self.assertNotIn("secret", response.text)

    def test_blank_message(self):
        self.assertEqual(
            self.client.post(
                "/api/complaint/conversation/message", json={"message": "  "}
            ).status_code,
            400,
        )
