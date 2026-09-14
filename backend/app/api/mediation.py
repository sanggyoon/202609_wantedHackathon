from fastapi import APIRouter, HTTPException, Response

from app.schemas.mediation import MediationRequest, MediationResponse
from app.services.mediation import generate_mediation

router = APIRouter(prefix="/mediation", tags=["mediation"])


@router.post("/report", response_model=MediationResponse)
def report(request: MediationRequest, response: Response):
    response.headers["Cache-Control"] = "no-store"
    try:
        return generate_mediation(request)
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Report generation failed. Please retry.",
            headers={"Cache-Control": "no-store"},
        ) from None
