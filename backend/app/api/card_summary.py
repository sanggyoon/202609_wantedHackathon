from fastapi import APIRouter, HTTPException, Response

from app.schemas.card_summary import CardSummaryRequest, CardSummaryResponse
from app.services.card_summary import generate_card_summary

router = APIRouter(prefix="/complaint", tags=["card-summary"])


@router.post("/card-summary", response_model=CardSummaryResponse)
def card_summary(request: CardSummaryRequest, response: Response):
    # Sync route runs the blocking provider call in FastAPI's thread pool. Nothing is stored.
    response.headers["Cache-Control"] = "no-store"
    try:
        return generate_card_summary(request)
    except Exception:
        # Do not disclose provider exceptions or card data.
        raise HTTPException(
            status_code=502,
            detail="Card summary generation failed. Please retry.",
            headers={"Cache-Control": "no-store"},
        ) from None
