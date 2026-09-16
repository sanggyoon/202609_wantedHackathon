from datetime import UTC, datetime

from fastapi import APIRouter, Header, HTTPException, Response

from app.core.tokens import hash_token, new_token, token_matches
from app.db import DatabaseNotConfigured
from app.repositories import cases as repo
from app.schemas.case import CaseContent, CaseCreated, CaseView, available_actions

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
