from datetime import UTC, datetime

from fastapi import APIRouter, Header, HTTPException, Response

from app.core.tokens import hash_token, new_token, token_matches
from app.db import DatabaseNotConfigured
from app.repositories import cases as repo
from app.schemas.case import (
    ApologySubmission,
    CaseContent,
    CaseCreated,
    CaseView,
    ResponseTypeSubmission,
    StatementSubmission,
    available_actions,
)
from app.schemas.complaint import SharedStatement
from app.schemas.mediation import MediationRequest
from app.services.mediation import generate_mediation

router = APIRouter(prefix="/cases", tags=["cases"])

NO_STORE = {"Cache-Control": "no-store"}


@router.post("", response_model=CaseCreated, status_code=201)
def create(response: Response) -> CaseCreated:
    response.headers["Cache-Control"] = "no-store"
    public_token = new_token()
    writer_token = new_token()
    try:
        case = repo.create_case(hash_token(public_token), hash_token(writer_token))
    except DatabaseNotConfigured:
        raise _unavailable() from None
    # 토큰 원문은 이 응답에서만 나간다. 서버는 해시만 들고 있다.
    return CaseCreated(
        public_token=public_token,
        writer_token=writer_token,
        status=case.status,
        expires_at=case.expires_at,
    )


@router.get("/{public_token}", response_model=CaseView)
def read(
    public_token: str,
    response: Response,
    x_writer_token: str | None = Header(default=None),
) -> CaseView:
    response.headers["Cache-Control"] = "no-store"
    case = _load(public_token)

    # 접근 시점 만료 검사. pg_cron 배치는 최대 1시간 지연되므로 이 검사가 없으면
    # 그 사이 만료된 사건의 내용이 그대로 나간다 (DFD §7.3).
    if _expired(case):
        raise HTTPException(status_code=410, detail="Case expired", headers=NO_STORE)

    # 토큰 불일치는 오류가 아니다. B는 애초에 이 토큰을 갖지 않는다.
    role = "A" if _is_writer(case, x_writer_token) else "B"
    content = _content(case)
    return CaseView(
        status=case.status,
        viewer_role=role,
        expires_at=case.expires_at,
        available_actions=available_actions(case.status, role),
        content=content,
    )


def _load(public_token: str) -> repo.CaseRow:
    try:
        case = repo.find_by_public_token_hash(hash_token(public_token))
    except DatabaseNotConfigured:
        raise _unavailable() from None
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found", headers=NO_STORE)
    return case


def _expired(case: repo.CaseRow) -> bool:
    return case.status == "EXPIRED" or case.expires_at <= datetime.now(UTC)


def _is_writer(case: repo.CaseRow, token: str | None) -> bool:
    if not token or not case.writer_token_hash:
        return False
    return token_matches(token, case.writer_token_hash)


def _content(case: repo.CaseRow) -> CaseContent | None:
    # DRAFT에는 아직 확정된 결과물이 없다. 사건 행만 존재한다.
    if case.status == "DRAFT":
        return None
    loaded = repo.load_content(case.id)
    return CaseContent.model_validate(
        {
            "cards": loaded["cards"],
            "report": loaded["report"],
            "apology": loaded["apology"],
        }
    )


def _unavailable() -> HTTPException:
    # 설정 누락을 사용자에게 자세히 알리지 않는다.
    return HTTPException(status_code=503, detail="Storage unavailable", headers=NO_STORE)


# ---------------------------------------------------------------------------
# 쓰기
# ---------------------------------------------------------------------------
#
# 전이 실패(영향 행 0)는 409다. 사용자 입장에서는 오류가 아니라 "이미 제출됨"이므로
# 프론트는 읽기 전용 리포트로 보낸다 (PRD §14).


@router.post("/{public_token}/statement", response_model=CaseView)
def submit_statement(
    public_token: str,
    payload: StatementSubmission,
    response: Response,
    x_writer_token: str | None = Header(default=None),
) -> CaseView:
    response.headers["Cache-Control"] = "no-store"
    case = _active(public_token)

    if payload.side == "A":
        # 고소장 확정은 A만 할 수 있다. 링크를 가진 제3자가 초안을 확정시키면 안 된다.
        if not _is_writer(case, x_writer_token):
            raise HTTPException(status_code=403, detail="Writer token required", headers=NO_STORE)
        if not repo.submit_statement_a(case.id, payload.card):
            raise _already_submitted()
        return _view(public_token, "A")

    if case.status != "COUNTER_DRAFT":
        raise HTTPException(status_code=409, detail="Not accepting a counter statement",
                            headers=NO_STORE)

    # 중재 리포트를 먼저 만든다. 저장 트랜잭션 밖이므로 생성이 실패하면
    # B 카드도 저장되지 않아 사용자가 온전히 재시도할 수 있다.
    cards = repo.load_content(case.id)["cards"]
    if "A" not in cards:
        raise HTTPException(status_code=409, detail="Complaint card is missing", headers=NO_STORE)
    a_card = SharedStatement.model_validate(cards["A"])
    try:
        report = generate_mediation(MediationRequest(a=a_card, b=payload.card)).report
    except Exception:
        raise HTTPException(
            status_code=502, detail="Report generation failed. Please retry.", headers=NO_STORE
        ) from None

    if not repo.complete_counter(case.id, payload.card, report):
        raise _already_submitted()
    return _view(public_token, "B")


@router.post("/{public_token}/response-type", response_model=CaseView)
def choose_response_type(
    public_token: str, payload: ResponseTypeSubmission, response: Response
) -> CaseView:
    response.headers["Cache-Control"] = "no-store"
    case = _active(public_token)
    if not repo.choose_response_type(case.id, payload.response_type):
        raise HTTPException(status_code=409, detail="Response type already chosen",
                            headers=NO_STORE)
    return _view(public_token, "B")


@router.post("/{public_token}/apology", response_model=CaseView)
def submit_apology(
    public_token: str, payload: ApologySubmission, response: Response
) -> CaseView:
    response.headers["Cache-Control"] = "no-store"
    case = _active(public_token)
    if not repo.complete_apology(case.id, payload.model_dump()):
        raise _already_submitted()
    return _view(public_token, "B")


def _active(public_token: str) -> repo.CaseRow:
    """조회 + 만료 검사. 쓰기 경로도 만료를 똑같이 막아야 한다."""
    case = _load(public_token)
    if _expired(case):
        raise HTTPException(status_code=410, detail="Case expired", headers=NO_STORE)
    return case


def _view(public_token: str, role: str) -> CaseView:
    """쓰기 후 갱신된 상태를 조회와 동일한 봉투로 돌려준다 (API_Design §4.0)."""
    case = _load(public_token)
    return CaseView(
        status=case.status,
        viewer_role=role,
        expires_at=case.expires_at,
        available_actions=available_actions(case.status, role),
        content=_content(case),
    )


def _already_submitted() -> HTTPException:
    return HTTPException(status_code=409, detail="Already submitted", headers=NO_STORE)
