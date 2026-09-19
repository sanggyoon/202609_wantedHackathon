from pathlib import Path

import cv2

from app.schemas.emotion_warp import EmotionProfile
from app.services.warp_hexagon import warp_image_hexagon

ASSET_DIR = Path(__file__).resolve().parent.parent / "assets" / "emotions"


def render_emotion_png(profile: EmotionProfile) -> bytes:
    source = cv2.imread(str(ASSET_DIR / profile.image), cv2.IMREAD_UNCHANGED)
    if source is None:
        source = cv2.imread(str(ASSET_DIR / "asset1.png"), cv2.IMREAD_UNCHANGED)
    if source is None:
        raise RuntimeError("emotion image asset is missing")
    rendered = source
    if profile.image != "asset1.png":
        try:
            rendered = warp_image_hexagon(
                source,
                dict(profile.axes),
                max_k=profile.params.max_k,
                neighbor_bleed=profile.params.neighbor_bleed,
                radial_sharpness=profile.params.radial_sharpness,
            )
        except Exception:
            rendered = source
    success, encoded = cv2.imencode(".png", rendered)
    if not success:
        raise RuntimeError("emotion image encoding failed")
    return encoded.tobytes()

