import cv2
import numpy as np

VERTEX_ANGLES_DEG = {
    "화남": -120,
    "질투": -60,
    "슬픔": 0,
    "포기": 60,
    "황당": 120,
    "서운함": 180,
}


def _local_strength(
    theta_deg: np.ndarray, emotions: dict[str, float], neighbor_bleed: float = 0.15
) -> np.ndarray:
    names = sorted(emotions, key=lambda name: VERTEX_ANGLES_DEG[name])
    angles = np.array([VERTEX_ANGLES_DEG[name] for name in names], dtype=np.float32)
    values = np.array([emotions[name] for name in names], dtype=np.float32)
    if neighbor_bleed > 0:
        values = np.clip(
            values + neighbor_bleed * (np.roll(values, 1) + np.roll(values, -1)), 0, 1
        )
    strength = np.zeros_like(theta_deg)
    for index, start in enumerate(angles):
        end = angles[(index + 1) % len(names)]
        current_theta = theta_deg.copy()
        if index == len(names) - 1:
            end += 360
            current_theta = np.where(current_theta < start, current_theta + 360, current_theta)
        mask = (current_theta >= start) & (current_theta <= end)
        ratio = (current_theta[mask] - start) / (end - start)
        strength[mask] = values[index] * (1 - ratio) + values[(index + 1) % len(names)] * ratio
    return strength


def warp_image_hexagon(
    image: np.ndarray,
    emotions: dict[str, float],
    max_k: float = 2.5,
    neighbor_bleed: float = 0.15,
    radial_sharpness: float = 2.0,
) -> np.ndarray:
    height, width = image.shape[:2]
    center_x, center_y = width / 2, height / 2
    map_x, map_y = np.meshgrid(
        np.arange(width, dtype=np.float32), np.arange(height, dtype=np.float32)
    )
    norm_x = (map_x - center_x) / center_x
    norm_y = (map_y - center_y) / center_y
    radius = np.clip(np.sqrt(norm_x**2 + norm_y**2), 1e-6, None)
    theta = np.arctan2(norm_y, norm_x)
    strength = _local_strength(np.degrees(theta), emotions, neighbor_bleed)
    distorted_radius = radius ** (1 + strength * max_k * (radius**radial_sharpness))
    source_x = np.clip(center_x + np.cos(theta) * distorted_radius * center_x, 0, width - 1)
    source_y = np.clip(center_y + np.sin(theta) * distorted_radius * center_y, 0, height - 1)
    return cv2.remap(
        image, source_x, source_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT
    )

