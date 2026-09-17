# mediation-backend

문철빵(갈등 중재 웹서비스) 백엔드. FastAPI + async. 결정 배경은 `../docs/Tech_ADR.md` §2 참고.

## 로컬 실행

```bash
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

- Swagger UI: http://localhost:8000/api/docs
- Health check: http://localhost:8000/api/health

## A 대화 엔진

`POST /api/complaint/conversation/message`는 `message`, `state`를 받아
정리된 상태, `assistantMessage`, `readyToGenerate`, `mode`를 반환한다.
서버 세션이나 JSON 파일, DB에 대화를 저장하지 않는다.

`backend/.env`의 `OPENAI_API_KEY`, `OPENAI_MODEL`로 제공자를 설정한다.
키가 없거나 `CONVERSATION_USE_LOCAL=true`이면 로컬 규칙 엔진을 사용한다.
키가 있는 상태에서 제공자 호출이 실패하면 502를 반환한다.
로컬 응답으로 조용히 전환하지 않으며 클라이언트 입력은 재시도용으로 유지한다.
OpenAI 요청에는 `store=False`를 사용하지만 외부 제공자의 보관 정책 전체를 보장하지 않는다.

프론트는 별도 터미널에서 `frontend` 폴더의 `npm run dev`로 실행한다.
개발 서버가 대화 요청을 `127.0.0.1:8000`으로 프록시하므로 브라우저에 키가 필요 없다.
환경변수 변경 후 백엔드를 재시작한다.

테스트: `uv run python -m unittest discover -s tests`

## Lint

```bash
uv run ruff check .
```
