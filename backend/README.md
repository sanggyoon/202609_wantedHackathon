# mediation-backend

문철빵(갈등 중재 웹서비스) 백엔드. FastAPI + async. 결정 배경은 `../docs/Tech_ADR.md` §2 참고.

## 로컬 실행

```bash
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

- Swagger UI: http://localhost:8000/docs
- Health check: http://localhost:8000/health

## Lint

```bash
uv run ruff check .
```
