from pathlib import Path

import cv2
import numpy as np

from app.schemas.emotion_warp import EmotionProfile
from app.services.warp_hexagon import warp_image_hexagon

ASSET_DIR = Path(__file__).resolve().parent.parent / "assets" / "emotions"

# 카톡·트위터 링크 미리보기 규격. 가로형이라야 말풍선 폭을 쓰는 큰 썸네일로 뜬다.
PREVIEW_SIZE = (800, 400)
PREVIEW_PADDING = 32
# 앱 히어로와 같은 세로 그라데이션(#fafafa → #f0efee). OpenCV라 BGR 순서다.
PREVIEW_TOP = (250, 250, 250)
PREVIEW_BOTTOM = (238, 239, 240)


def render_emotion_png(profile: EmotionProfile) -> bytes:
    return _encode(_render(profile))


def render_emotion_preview_png(profile: EmotionProfile) -> bytes:
    """링크 미리보기용. 같은 그림을 불투명 가로 캔버스에 얹는다.

    감정 PNG는 픽셀의 60%가 투명하다. 카톡 썸네일은 알파를 살리지 못해 그대로
    넘기면 투명한 곳이 검게 나오므로, 여기서 배경을 깔아 합성해둔다.
    """
    return _encode(_compose_preview(_render(profile)))


def _encode(image: "np.ndarray") -> bytes:
    success, encoded = cv2.imencode(".png", image)
    if not success:
        raise RuntimeError("emotion image encoding failed")
    return encoded.tobytes()


def _compose_preview(rendered: "np.ndarray") -> "np.ndarray":
    width, height = PREVIEW_SIZE
    ramp = np.linspace(0, 1, height, dtype=np.float32)[:, None]
    canvas = np.empty((height, width, 3), dtype=np.float32)
    for channel in range(3):
        canvas[:, :, channel] = PREVIEW_TOP[channel] + ramp * (
            PREVIEW_BOTTOM[channel] - PREVIEW_TOP[channel]
        )

    box = height - 2 * PREVIEW_PADDING
    scale = min(box / rendered.shape[0], box / rendered.shape[1])
    resized = cv2.resize(
        rendered,
        (max(1, round(rendered.shape[1] * scale)), max(1, round(rendered.shape[0] * scale))),
        interpolation=cv2.INTER_AREA,
    )
    top = (height - resized.shape[0]) // 2
    left = (width - resized.shape[1]) // 2
    patch = canvas[top : top + resized.shape[0], left : left + resized.shape[1]]

    if resized.ndim == 3 and resized.shape[2] == 4:
        alpha = resized[:, :, 3:4].astype(np.float32) / 255.0
        patch[:] = resized[:, :, :3].astype(np.float32) * alpha + patch * (1 - alpha)
    else:
        patch[:] = cv2.cvtColor(resized, cv2.COLOR_GRAY2BGR) if resized.ndim == 2 else resized
    return np.clip(canvas, 0, 255).astype(np.uint8)


def _render(profile: EmotionProfile) -> "np.ndarray":
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
    return rendered

