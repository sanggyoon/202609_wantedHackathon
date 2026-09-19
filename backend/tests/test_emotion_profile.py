import json
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.schemas.emotion_warp import EmotionProfile
from app.services.emotion_profile import generate_emotion_profile, resolve_emotion_profile


class EmotionProfileTest(unittest.TestCase):
    def test_openai_scores_choose_count_before_strength(self):
        reply = json.dumps(
            {
                "emotions": [
                    {"label": "화남", "mention_count": 2, "score": 60},
                    {"label": "서운함", "mention_count": 1, "score": 100},
                ]
            }
        )
        with (
            patch("app.services.emotion_profile.is_openai_configured", return_value=True),
            patch("app.services.emotion_profile.call_openai_json_chat", return_value=reply),
        ):
            result = generate_emotion_profile(["너무 화났어", "또 화가 났어"], ["화남"])
        self.assertEqual(result.profile.representative_emotion, "화남")
        self.assertEqual(result.profile.image, "anger.png")
        self.assertEqual(result.profile.axes["화남"], 0.6)
        self.assertEqual(result.mode, "openai")

    def test_exact_tie_requires_user_choice(self):
        with patch("app.services.emotion_profile.is_openai_configured", return_value=False):
            result = generate_emotion_profile(["둘 다 커"], ["화남", "서운함"])
        self.assertTrue(result.needs_clarification)
        self.assertEqual(result.candidates, ["화남", "서운함"])
        resolved = resolve_emotion_profile(result.profile, "서운함")
        self.assertEqual(resolved.representative_emotion, "서운함")
        self.assertEqual(resolved.image, "hurt.png")
        self.assertEqual(resolved.resolved_by, "user")

    def test_no_emotion_uses_unwarped_fallback(self):
        with patch("app.services.emotion_profile.is_openai_configured", return_value=False):
            result = generate_emotion_profile(["그냥 그랬어"], [])
        self.assertEqual(result.profile.image, "asset1.png")
        self.assertFalse(result.needs_clarification)


class EmotionProfileApiTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_profile_does_not_cache_or_echo_invalid_input(self):
        response = self.client.post(
            "/api/complaint/emotion-profile",
            json={"messages": [{"private": "do not echo"}], "emotions": []},
        )
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.assertNotIn("do not echo", response.text)

    def test_warp_returns_png(self):
        profile = EmotionProfile(
            representative_emotion="화남",
            image="anger.png",
            scores=[{"label": "화남", "mention_count": 1, "score": 80}],
            axes={
                "화남": 0.8,
                "질투": 0.05,
                "슬픔": 0.05,
                "포기": 0.05,
                "황당": 0.05,
                "서운함": 0.05,
            },
            resolved_by="ai",
        )
        response = self.client.post(
            "/api/complaint/emotion-warp", json={"profile": profile.model_dump()}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["content-type"], "image/png")
        self.assertEqual(response.content[:8], b"\x89PNG\r\n\x1a\n")


if __name__ == "__main__":
    unittest.main()
