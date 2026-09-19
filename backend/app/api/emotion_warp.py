from fastapi import APIRouter, HTTPException, Response

from app.schemas.emotion_warp import (
    EmotionProfileRequest,
    EmotionProfileResolveRequest,
    EmotionProfileResponse,
    EmotionWarpRequest,
)
from app.services.emotion_profile import generate_emotion_profile, resolve_emotion_profile
from app.services.emotion_warp import render_emotion_png

router = APIRouter(prefix="/complaint", tags=["emotion-warp"])
NO_STORE = {"Cache-Control": "no-store"}


@router.post("/emotion-profile", response_model=EmotionProfileResponse)
def profile(payload: EmotionProfileRequest, response: Response) -> EmotionProfileResponse:
    response.headers.update(NO_STORE)
    return generate_emotion_profile(payload.messages, payload.emotions)


@router.post("/emotion-profile/resolve", response_model=EmotionProfileResponse)
def resolve(
    payload: EmotionProfileResolveRequest, response: Response
) -> EmotionProfileResponse:
    response.headers.update(NO_STORE)
    try:
        resolved = resolve_emotion_profile(payload.profile, payload.selected_emotion)
    except ValueError:
        raise HTTPException(
            status_code=422, detail="Invalid emotion selection", headers=NO_STORE
        ) from None
    return EmotionProfileResponse(profile=resolved, mode="local")


@router.post("/emotion-warp")
def warp(payload: EmotionWarpRequest) -> Response:
    try:
        content = render_emotion_png(payload.profile)
    except Exception:
        raise HTTPException(
            status_code=503, detail="Emotion image unavailable", headers=NO_STORE
        ) from None
    return Response(content=content, media_type="image/png", headers=NO_STORE)
