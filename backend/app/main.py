from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.card_summary import router as card_summary_router
from app.api.cases import router as cases_router
from app.api.conversation import router as conversation_router
from app.api.health import router as health_router
from app.api.mediation import router as mediation_router
from app.core.config import settings

app = FastAPI(
    title="mediation-backend",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api")
app.include_router(cases_router, prefix="/api")
app.include_router(card_summary_router, prefix="/api")
app.include_router(conversation_router, prefix="/api")
app.include_router(mediation_router, prefix="/api")


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request, exc):
    # Default validation responses can echo raw user input.
    return JSONResponse(
        status_code=422,
        content={"detail": "Invalid request"},
        headers={"Cache-Control": "no-store"},
    )
