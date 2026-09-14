# API 설계

> 프로젝트: 문철빵 · 작성일: 2026-09-14 · 상태: Draft
>
> 근거 문서: `docs/PRD.md` §8(입력 데이터)·§10(기능 요구사항)·§14(오류 처리),
> `docs/Data_Flow.md` v0.2 (이하 **DFD**), `docs/Supabase_Schema_Design.md`,
> `docs/Frontend_Architecture.md` §9(API 연결 경계)

---

## 1. 목적과 범위

프론트엔드(Next.js)와 백엔드(FastAPI) 사이의 HTTP 계약을 확정한다.
`Frontend_Architecture.md` §9가 "필요한 계약"으로 나열한 7개 항목에 실제 경로·요청·응답·
오류 코드를 부여하는 것이 이 문서의 일이다.

**범위에 포함:** 엔드포인트, 요청·응답 스키마, 인증·권한 모델, 오류 규약,
원문 비저장을 코드에서 보장하는 지점.

**범위에서 제외:** LLM 프롬프트 내용, FastAPI 내부 모듈 구조, 프론트 상태 관리,
배포 설정. DB 스키마는 `Supabase_Schema_Design.md`가 기준이며 이 문서는 그 위에 선다.

---

## 2. 설계 결정

| # | 결정 | 근거 |
| --- | --- | --- |
| A-1 | AI 대화는 **완전 무상태** — 클라이언트가 매 요청에 대화 전체를 재전송 | 서버가 원문을 보관할 곳 자체를 없애 DFD §2-2를 구조적으로 충족. 컨테이너를 여러 개 띄워도 세션이 깨지지 않음 |
| A-2 | 리포트 생성은 **동기** — 완성될 때까지 기다렸다 한 번에 응답 | 상태가 하나뿐이라 버그 여지가 적음. `GENERATING` 상태와 폴링·복구 로직을 3주 일정에 얹지 않음 |
| A-3 | A의 쓰기 권한은 **별도 `writer_token`** 으로 보장 | 링크만으로는 제3자가 A의 초안을 확정시킬 수 있음 |
| A-4 | AI 응답은 **비스트리밍**(일반 JSON) | AI가 한 번에 질문 하나씩만 던지므로(PRD §8) 응답이 짧아 SSE 복잡도를 정당화하지 못함 |
| A-5 | 상태 전이 가능 여부는 **서버가 계산해 `available_actions`로 전달** | 전이 규칙이 프론트·백에 이중으로 흩어지는 것을 막음 |

### 이 문서가 해소하는 미결 항목

`Frontend_Architecture.md` §13이 "API 연결 전 확정"으로 남긴 것 중 다음이 여기서 정해진다.

- 최초 작성자·응답 작성자의 권한 부여 → §3 (A-3)
- 답변 수정 가능 여부, 중복·동시 제출 정책 → §6 (409 규약)
- 리포트 생성 중 상태와 생성 실패 시 복구 → §2 (A-2, 생성 중 상태를 두지 않음)
- 스트림 형식 → §2 (A-4)

---

## 3. 인증·권한 모델

로그인이 없으므로 권한 판단의 입력은 토큰뿐이다(DFD §2-4). 토큰 두 종류를 쓴다.

| 토큰 | 발급 | 저장 위치 | 용도 |
| --- | --- | --- | --- |
| `public_token` | 사건 생성 시 | A→B 공유 링크, 양쪽 브라우저 | 모든 조회·쓰기의 열쇠 |
| `writer_token` | 사건 생성 시 (A에게만) | **A 브라우저에만** | 고소장 확정 권한 |

서버는 둘 다 **SHA-256 hex 해시만** 저장하고 원문은 보관하지 않는다.

### B에게는 토큰을 주지 않는다

"링크를 가진 사람이 B"라는 것이 설계 전제다(DFD §2-4). B의 응답에 별도 토큰을 요구하면
링크 하나로 전달이 끝나는 구조가 깨진다. 중복·동시 제출은 토큰이 아니라 **DB의 PK·UNIQUE
제약**이 막는다(`Supabase_Schema_Design.md` D-3).

남는 위험은 "링크를 입수한 제3자가 B인 척 응답한다"인데, 이는 링크 기반 설계의 본질적
한계이며 PRD §7 "로그인 없는 단일 링크의 한계"가 이미 수용한 것이다.

### 전달 방식

| 토큰 | 전달 | 이유 |
| --- | --- | --- |
| `public_token` | URL 경로 (`/api/cases/{token}`) | 링크 자체이므로 경로가 자연스러움 |
| `writer_token` | `X-Writer-Token` 헤더 | 쿼리스트링·경로에 넣으면 접근 로그에 남음 |

> **⚠️ 미결 — 접근 로그에 `public_token`이 남는다.** 경로에 토큰이 있으면 Nginx 접근
> 로그에 원문이 그대로 쌓인다. DB는 해시만 저장해도 로그에서 새면 의미가 없다.
> 로그를 읽을 수 있는 사람은 임의의 사건을 열람할 수 있다.
>
> 권장안은 **경로를 유지하고 Nginx `log_format`에서 `/api/cases/` 뒤를 마스킹**하는 것이다.
> REST 관례를 지키면서 실제 유출 지점을 막는다. 대안은 토큰도 헤더로 옮기는 것이나, 경로가
> `/api/cases/current` 식이 되어 어색하다.
>
> 프론트 URL(`/case/{token}`)의 토큰은 링크 자체라 피할 수 없다. 막을 수 있는 것은 API
> 로그뿐이며, 실제로 새는 지점도 거기다. §9-1 참고.

---

## 4. 엔드포인트

기준 경로는 `/api`다. Nginx가 `/api`를 `backend:8000`으로 넘긴다(`Tech_ADR.md` CI/CD 그림).

| # | Method | Path | 상태 전이 |
| --- | --- | --- | --- |
| 1 | `POST` | `/api/cases` | → `DRAFT` |
| 2 | `GET` | `/api/cases/{token}` | — |
| 3 | `POST` | `/api/cases/{token}/conversation` | — |
| 4 | `POST` | `/api/cases/{token}/statement` | `DRAFT`→`AWAITING_RESPONSE` 또는 `COUNTER_DRAFT`→`COUNTER_COMPLETED` |
| 5 | `POST` | `/api/cases/{token}/response-type` | `AWAITING_RESPONSE`→`COUNTER_DRAFT` 또는 `APOLOGY_DRAFT` |
| 6 | `POST` | `/api/cases/{token}/apology` | `APOLOGY_DRAFT`→`APOLOGY_COMPLETED` |

### 4.0 공통 응답 봉투

상태를 바꾸는 엔드포인트(4.4~4.6)는 **조회(§5)와 동일한 봉투**를 반환한다. 프론트는 파서를
하나만 두고 모든 응답을 같은 방식으로 처리한다.

```jsonc
{
  "status": "...",
  "viewer_role": "A" | "B",
  "expires_at": "...",
  "available_actions": [...],
  "content": { ... } | null
}
```

아래 예시들은 지면을 위해 달라지는 필드만 보이지만, 실제 응답은 항상 이 다섯 키를 갖는다.
사건 생성(4.1)만 예외다 — 토큰 원문을 돌려주는 유일한 응답이기 때문이다.

### 4.1 사건 생성

```
POST /api/cases
```

요청 본문 없음. FR-01(로그인 없이 시작)을 만족한다.

```jsonc
// 201 Created
{
  "public_token": "8f3a...",      // 이후 URL에 사용. 서버는 해시만 보관
  "writer_token": "c91b...",      // A 브라우저에만 저장할 것
  "status": "DRAFT",
  "expires_at": "2026-09-21T04:12:00Z"
}
```

토큰 원문은 **이 응답에서만** 반환된다. 이후 어떤 조회로도 다시 얻을 수 없다.

`expires_at`은 생성 시 `created_at + 7일`로 초기화된다. B의 최종 답변 시 갱신된다
(`Supabase_Schema_Design.md` D-1).

### 4.2 사건 조회

```
GET /api/cases/{token}
X-Writer-Token: <있으면>          // 선택. viewer_role 판정에만 사용
```

응답 구조는 §5에서 다룬다.

`writer_token`이 유효하면 `viewer_role: "A"`, 없거나 불일치하면 `"B"`다. **불일치를 오류로
처리하지 않는다** — B는 애초에 이 토큰이 없으며, 토큰 없는 접근이 정상 경로다.

### 4.3 AI 대화 (무상태)

```
POST /api/cases/{token}/conversation
```

```jsonc
// 요청
{
  "side": "A",                    // A | B
  "messages": [
    {"role": "user",      "content": "어제 답장을 안 했어"},
    {"role": "assistant", "content": "그때 어떤 기분이었어?"},
    {"role": "user",      "content": "좀 서운했지"}
  ]
}
```

```jsonc
// 200 — 정보가 더 필요한 경우
{ "reply": "혹시 그때 상대가 뭐라고 했는지 기억나?", "ready": false, "draft": null }

// 200 — 카드를 만들 수 있을 만큼 모인 경우
{
  "reply": null,
  "ready": true,
  "draft": {
    "cute_charge": "연락두절죄",
    "incident_summary": "답장을 세 시간 동안 안 했다",
    "incident_description": "...",
    "emotions": ["서운함", "불안"],
    "emotion_reason": "...",
    "different_viewpoint": null,
    "desired_outcome": "바쁠 때 미리 한마디 남겨주기"
  }
}
```

**서버는 응답을 반환한 직후 `messages`를 버린다.** DB에도 로그에도 남지 않는다(§7).

`reply`가 한 번에 질문 하나만 담는 것은 FR-02·PRD §8 "질문은 한 번에 하나씩"의 구현이다.

`ready: true`가 된 뒤에도 클라이언트는 계속 대화를 이어갈 수 있다. `draft`는 제안일 뿐이며
사용자가 수정할 수 있어야 한다(FR-04).

이 엔드포인트는 상태를 바꾸지 않는다. 대화는 몇 번이든 오갈 수 있고, 사건 행에는 아무것도
쓰이지 않는다.

### 4.4 카드 확정

```
POST /api/cases/{token}/statement
X-Writer-Token: <A인 경우 필수>
```

```jsonc
// 요청 — 4.3의 draft를 사용자가 수정한 최종본
{
  "side": "A",
  "card": {
    "cute_charge": "연락두절죄",
    "incident_summary": "...",
    "incident_description": "...",
    "emotions": ["서운함", "불안"],
    "emotion_reason": "...",
    "different_viewpoint": null,
    "desired_outcome": "..."
  }
}
```

A와 B가 같은 엔드포인트를 쓰는 이유는 동작이 "확정된 카드를 저장한다"로 동일하기 때문이다.
차이는 둘뿐이다.

| | A (`side: "A"`) | B (`side: "B"`) |
| --- | --- | --- |
| 권한 | `X-Writer-Token` 필수 | 불필요 |
| 요구 상태 | `DRAFT` | `COUNTER_DRAFT` |
| 부가 처리 | 없음 | **중재 리포트까지 같은 요청에서 생성** |
| 전이 후 | `AWAITING_RESPONSE` | `COUNTER_COMPLETED` |

```jsonc
// 200 — side: "A"
{ "status": "AWAITING_RESPONSE", "expires_at": "..." }

// 200 — side: "B" (리포트 포함)
{
  "status": "COUNTER_COMPLETED",
  "expires_at": "2026-09-21T09:30:00Z",   // 이 시점 + 7일로 갱신됨
  "content": {
    "cards": { "A": {...}, "B": {...} },
    "report": {
      "common_ground": ["둘 다 서로를 신경 쓰고 있었다"],
      "different_views": ["연락 빈도에 대한 기대가 달랐다"],
      "hurt_points_a": ["답장이 없던 세 시간"],
      "hurt_points_b": ["상황을 묻지 않고 화낸 점"],
      "possible_misunderstanding": null,
      "conversation_starter": "다음엔 바쁠 때 미리 한마디 남기는 건 어때?"
    }
  }
}
```

`side: "B"`는 LLM을 **2회** 호출한다(B 카드 구조화 + A·B 카드로부터 중재 리포트 생성).
A-2에 따라 완료될 때까지 응답하지 않는다. §9-2의 타임아웃 확인이 선행되어야 한다.

**저장은 한 트랜잭션이다.** B 카드·리포트 저장과 `cases` 전이(`status`, `answered_at`,
`expires_at`)가 함께 커밋되거나 함께 실패한다. 리포트 생성이 실패하면 B 카드도 저장되지
않으므로 사용자는 온전히 재시도할 수 있다.

### 4.5 응답 방식 선택

```
POST /api/cases/{token}/response-type
```

```jsonc
// 요청
{ "response_type": "COUNTER" }   // COUNTER | APOLOGY

// 200
{ "status": "COUNTER_DRAFT", "available_actions": ["submit_statement"] }
```

FR-07의 구현이다. `AWAITING_RESPONSE`에서만 허용된다.

선택을 되돌리는 것(맞고소 → 사과)은 MVP에서 지원하지 않는다. 이미 `*_DRAFT`인 사건에
다시 호출하면 409 `INVALID_STATE`다.

### 4.6 사과문 제출

```
POST /api/cases/{token}/apology
```

```jsonc
// 요청
{
  "body": "늦어서 미안해",              // 필수
  "understood_point": "기다리는 시간이 길었겠다",
  "future_commitment": "다음엔 미리 연락할게"
}
```

```jsonc
// 200
{
  "status": "APOLOGY_COMPLETED",
  "expires_at": "...",
  "content": { "cards": { "A": {...} }, "apology": {...} }
}
```

**B가 입력한 텍스트를 그대로 저장한다.** AI를 호출하지 않으며 파생 필드를 만들지 않는다
(PRD §13, DFD §8.2). MVP는 AI가 사과문을 대신 쓰는 기능을 제외한다(PRD §15).

`APOLOGY_DRAFT`에서만 허용된다.

---

## 5. 조회 응답 구조

상태에 따라 내용이 갈리지만 껍데기는 하나다. 프론트는 `status`로 화면을 고른다.

```jsonc
{
  "status": "COUNTER_COMPLETED",
  "viewer_role": "B",                    // A | B
  "expires_at": "2026-09-21T09:30:00Z",
  "available_actions": [],
  "content": { /* 아래 표 */ }
}
```

| 상태 | `content` | `available_actions` (A) | `available_actions` (B) |
| --- | --- | --- | --- |
| `DRAFT` | `null` | `["converse", "submit_statement"]` | `[]` |
| `AWAITING_RESPONSE` | `{cards: {A}}` | `[]` | `["choose_response_type"]` |
| `COUNTER_DRAFT` | `{cards: {A}}` | `[]` | `["converse", "submit_statement"]` |
| `APOLOGY_DRAFT` | `{cards: {A}}` | `[]` | `["submit_apology"]` |
| `COUNTER_COMPLETED` | `{cards: {A,B}, report}` | `[]` | `[]` |
| `APOLOGY_COMPLETED` | `{cards: {A}, apology}` | `[]` | `[]` |
| `EXPIRED` | `null` | `[]` | `[]` |

`DRAFT` 상태에서 `viewer_role: "B"`는 아직 링크가 전달되지 않았어야 할 상황이다.
`content: null`과 빈 `available_actions`를 돌려주고 프론트는 안내 화면을 띄운다
(DFD §7.2 역할 판정 흐름의 `GUARD` 분기).

**`EXPIRED`는 200 응답으로 나오지 않는다.** 만료 검사(§6)가 앞에서 410을 던지므로 이 상태의
사건은 조회에 성공하지 못한다. 표에 남긴 것은 상태 열거의 완전성을 위한 것이며, 프론트는
만료 화면을 200 응답이 아니라 **410 응답에서** 띄운다.

---

## 6. 오류 규약

```jsonc
{ "code": "CASE_EXPIRED", "message": "만료된 사건입니다." }
```

| 상황 (PRD §14) | HTTP | `code` |
| --- | --- | --- |
| 없는 토큰 | 404 | `CASE_NOT_FOUND` |
| 만료된 링크 | **410** | `CASE_EXPIRED` |
| `writer_token` 없음/불일치 | 403 | `WRITER_TOKEN_INVALID` |
| 현재 상태에서 불가능한 행동 | 409 | `INVALID_STATE` |
| 중복·동시 제출 | 409 | `ALREADY_SUBMITTED` |
| AI 생성 실패 | 502 | `AI_GENERATION_FAILED` |
| 위험 내용 감지 | 422 | `SAFETY_BLOCKED` |
| 입력 형식 오류 | 400 | `INVALID_REQUEST` |

### 410을 쓰는 이유

만료를 404와 구분한다. PRD §9.9의 만료 화면이 일반 오류 화면과 별개로 존재하므로 프론트가
둘을 구별할 수 있어야 한다. 어느 쪽이든 **사건 내용은 반환하지 않는다**(PRD §14).

### 409 — 중복 제출은 오류가 아니라 정상 경로다

DFD §7.2의 조건부 UPDATE에서 영향 행이 0이면 409를 던진다.

```sql
update cases set status = 'COUNTER_COMPLETED', ...
 where id = $1 and status = 'COUNTER_DRAFT';
```

프론트는 409 `ALREADY_SUBMITTED`를 받으면 오류 화면이 아니라 **읽기 전용 리포트로
이동**시킨다(PRD §14 "최종 상태에서 재제출 → 읽기 전용 리포트로 이동"). 사용자 입장에서는
이미 제출이 끝난 것이므로 실패가 아니다.

### 만료 검사는 모든 사건 엔드포인트에서

조회 직후 `expires_at <= now()`를 확인하고 지났으면 즉시 410을 반환한다. 이것이 DFD §7.3이
말하는 **접근 시점 검사(lazy)** 이며, `pg_cron` 배치가 최대 1시간 지연되는 틈을 막는 유일한
수단이다. 배치만으로는 그 사이 만료된 내용이 노출된다.

---

## 7. 원문 비저장을 코드에서 보장하는 지점

DFD §9의 검수 항목 중 **스키마가 보장하지 못하고 구현이 책임지는 것**들이다.
스키마에는 원문 컬럼이 아예 없으므로 DB 유출은 구조적으로 불가능하지만, 로그와 분석은
코드가 막아야 한다.

| 지점 | 조치 |
| --- | --- |
| FastAPI 422 기본 응답 | **입력값을 그대로 에코한다.** `RequestValidationError` 핸들러를 커스텀해 `messages`·`card`·`body` 필드를 마스킹 |
| 예외 로그 | 전역 예외 핸들러에서 request body를 로그에 남기지 않음 |
| Pydantic 모델 | `messages`를 담는 모델 필드에 `repr=False` |
| AI 호출 실패 | 로그에 프롬프트·원문 미포함 (PRD §14 명시 요구) |
| 분석 이벤트 | "카드 생성됨" 같은 사실만 기록, 내용 미포함 (DFD §7.1) |
| 접근 로그 | §3의 토큰 마스킹 (미결) |

**첫 줄이 가장 놓치기 쉽다.** FastAPI는 검증 실패 시 422 응답 본문에 어떤 값이 잘못됐는지를
입력값과 함께 담아 돌려준다. 기본 동작을 그대로 두면 대화 원문이 응답과 로그 양쪽에 실린다.
커스텀 핸들러는 선택이 아니라 필수다.

---

## 8. 선행 작업 — 스키마 변경

`cases` 테이블에 `writer_token_hash` 컬럼이 없다. A-3을 구현하려면 마이그레이션이 하나
필요하다.

```sql
-- supabase/migrations/<타임스탬프>_add_writer_token.sql
alter table cases add column writer_token_hash text;
```

파일명 타임스탬프는 생성 시점에 확정한다. 기존 `20260912113100`보다 커야 순서가 보장된다.

기존 행이 없으므로 nullable로 추가하면 되고 백필도 필요 없다. 적용은
`Supabase_Schema_Design.md` §8 절차를 따른다 — **머지만으로는 반영되지 않으며
`supabase db push`가 필요하다**(`Tech_ADR.md` §10).

백엔드에는 아직 DB 라이브러리가 없다(`backend/pyproject.toml`에 fastapi·uvicorn·
pydantic-settings뿐). 접근 계층 선택은 이 문서 범위 밖이며 구현 착수 시 정한다.

---

## 9. 남은 미결 사항

| # | 항목 | 정해야 할 시점 |
| --- | --- | --- |
| 1 | 접근 로그의 `public_token` 마스킹 방식 (§3) | 배포 전 |
| 2 | 동기 응답(§4.4)이 Nginx·브라우저 타임아웃 안에 드는지 확인 | 맞고소 경로 구현 시 |
| 3 | LLM 제공자 선정 (`Tech_ADR.md` 미해결) | AI 대화 구현 전 |
| 4 | 위험 내용 감지 기준과 `SAFETY_BLOCKED` 응답 문구 (PRD §14) | 안전 검증 단계 |
| 5 | 사건당 대화 턴 수 상한 (LLM 비용 방어) | 비용 추이를 보고 |
| 6 | 백엔드 DB 접근 계층 선택 | 구현 착수 시 |

2번이 A-2의 유일한 실질 위험이다. LLM 2회 호출이 수십 초로 늘어나면 동기 방식이 깨지고
비동기로 재설계해야 한다. 구현 초기에 실측할 것.

---

## 10. 구현 순서

PRD §18 구현 단계에 맞춘다. 각 단계는 앞 단계의 엔드포인트를 전제로 한다.

| 단계 | 엔드포인트 | PRD §18 대응 |
| --- | --- | --- |
| 1 | §8 마이그레이션, `POST /api/cases`, `GET /api/cases/{token}` | 1단계 — 사건 및 단일 링크 기반 |
| 2 | `POST .../conversation`, `POST .../statement` (A) | 2단계 — A의 고소장 생성 |
| 3 | `POST .../response-type` | 3단계 — B의 응답 분기 |
| 4 | `POST .../statement` (B, 리포트 포함) | 4단계 — 맞고소 리포트 |
| 5 | `POST .../apology` | 5단계 — 사과 종결 |
| 6 | §7 전 항목 점검, §6 만료 검사 검증 | 6단계 — 안전·품질 검증 |

1단계에서 만료 lazy 검사(§6)를 함께 넣는다. 나중에 붙이면 이미 구현된 모든 조회 경로를
다시 훑어야 한다.
