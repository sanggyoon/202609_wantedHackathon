from fastapi import APIRouter, HTTPException, Response

from app.schemas.complaint import ComplaintConversationRequest, ComplaintConversationResponse
from app.services.complaint_engine import handle_complaint_message
from app.services.openai_gateway import is_openai_configured

router = APIRouter(prefix="/complaint/conversation", tags=["conversation"])


@router.post("/message", response_model=ComplaintConversationResponse)
def message(request: ComplaintConversationRequest, response: Response):
    # Sync route runs blocking provider calls in FastAPI's thread pool.
    response.headers["Cache-Control"] = "no-store"
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message must not be blank")
    try:
        result = handle_complaint_message(request)
        result.mode = "openai" if is_openai_configured() else "local"
        return result
    except Exception:
        # Do not disclose provider exceptions or conversation data.
        raise HTTPException(
            status_code=502,
            detail="Conversation processing failed. Please retry.",
            headers={"Cache-Control": "no-store"},
        ) from None
