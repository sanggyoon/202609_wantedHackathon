# API 설계

> 프로젝트: 문철빵 · 최초 작성: 2026-09-14 · 최종 수정: 2026-09-14 · 상태: 구현 반영
>
> 카드 형태는 **DB 기준으로 통일**하기로 결정됨 (§8-1).
>
> 근거 문서: `docs/PRD.md` §8·§10·§14, `docs/Data_Flow.md` v0.2 (이하 **DFD**),
> `docs/Supabase_Schema_Design.md`, `docs/Frontend_Architecture.md` §9
>
> **이 문서는 `backend/app/` 실제 구현을 기준으로 한다.** 아직 코드가 없는 부분은
> §6에 "미구현"으로 분리해 설계만 남겼다.

---

## 1. 목적과 범위

프론트엔드(Next.js)와 백엔드(FastAPI) 사이의 HTTP 계약을 기록한다.

**범위에 포함:** 엔드포인트, 요청·응답 스키마, 오류 규약, 원문 비저장을 코드가 보장하는 지점,
설계와 구현 사이의 불일치.

**범위에서 제외:** LLM 프롬프트 내용, 프론트 상태 관리, 배포 설정.

절마다 다음 표기를 단다.

| 표기 | 뜻 |
| --- | --- |
| **구현됨** | `backend/app/`에 코드가 있고 이 문서가 그것을 기술함 |
| **미구현** | 설계만 존재. 코드 없음 |

---

## 2. 현재 구현 상태

```
backend/app/
  main.py                      FastAPI 앱, CORS, 422 핸들러
  api/health.py                GET  /api/health
  api/conversation.py          POST /api/complaint/conversation/message
  api/mediation.py             POST /api/mediation/report
  schemas/complaint.py         대화 상태·요청·응답 모델
  schemas/mediation.py         리포트 모델
  services/complaint_engine.py 대화 처리 (1,125줄)
  services/mediation.py        리포트 생성
  services/openai_gateway.py   OpenAI 호출
  services/bamtol_voice.py     페르소나 문구
  services/emotion_evidence.py 감정 근거 추출
```

| 기능 (`Frontend_Architecture.md` §9) | 상태 |
| --- | --- |
| AI 대화 | **구현됨** — §4 |
| 맞고소 리포트 생성 | **구현됨** — §5 |
| 사건 작성 시작 / 조회 | **미구현** — §6 |
| 고소장 확정 (영속 저장) | **미구현** — §6 |
| 응답 방식 선택 | **미구현** — §6 |
| 사과 제출 | **미구현** — §6 |

**백엔드에 DB 접근 코드가 전혀 없다.** `config.py`에 `database_url`·`supabase_*` 값이
선언돼 있으나 어떤 모듈도 사용하지 않는다. 적용된 Supabase 스키마는 아직 백엔드와
연결되지 않았고, 현재 API는 **사건을 식별하지도 저장하지도 않는다.**

프론트는 이미 두 엔드포인트에 연결돼 있다. `Frontend_Architecture.md` §9가 요구한
어댑터 계층이 `frontend/src/lib/api/{conversation,mediation}.ts`로 존재하고,
`useConversation.ts`와 `MediationSummary.tsx`가 이를 통해 호출한다. 화면 컴포넌트가
직접 `fetch`를 쓰지 않는다는 규칙이 지켜지고 있다.

---

## 3. 설계 결정

| # | 결정 | 상태 | 비고 |
| --- | --- | --- | --- |
| A-1 | AI 대화는 **무상태** — 서버가 대화를 보관하지 않음 | **구현됨** | 구현은 설계보다 강한 방식을 택함. 아래 참고 |
| A-2 | 리포트 생성은 **동기** | **구현됨** | 라우트를 `def`(동기)로 선언해 스레드풀에서 블로킹 호출 |
| A-3 | A의 쓰기 권한은 별도 `writer_token` | **미구현** | §6 |
| A-4 | AI 응답은 **비스트리밍**(일반 JSON) | **구현됨** | |
| A-5 | 전이 가능 여부를 서버가 `available_actions`로 전달 | **미구현** | §6 |

### A-1 — 구현이 설계보다 강하다

설계 단계에서는 "클라이언트가 대화 원문 전체를 매 요청에 재전송"을 택했다. 실제 구현은
다르다. 클라이언트가 보내는 것은 **최신 메시지 한 개(`message`)와 누적된 구조화 상태
(`state`)** 뿐이고, 서버는 갱신된 `state`를 돌려준다.

차이가 중요하다. 재전송 방식은 원문이 매 요청마다 네트워크를 오가지만, 상태 방식은
**원문이 서버에 도달하는 것이 한 번뿐**이고 이후로는 추출된 구조만 오간다. DFD §2-2
"원문은 흐르되 고이지 않는다"를 더 좁은 통로로 만족시킨다.

문서를 구현에 맞춘다. A-1의 표현은 "무상태"이되 그 수단은 상태 객체 왕복이다.

---

## 4. AI 대화 — **구현됨**

```
POST /api/complaint/conversation/message
```

`backend/app/api/conversation.py`. FR-02(한 번에 하나의 질문)·FR-03(필수 정보 파악)의 구현.

### 4.1 요청

```jsonc
{
  "conversationId": "temp",          // 선택, 기본 "temp"
  "message": "어제 답장을 안 했어",    // 필수, 공백만이면 400
  "side": "A",                        // A | B, 기본 "A"
  "state": { /* 직전 응답의 state를 그대로 */ },   // 선택. 첫 턴엔 생략
  "sharedStatement": { /* 아래 §5.1 */ }           // 선택
}
```

**필드명은 camelCase다.** Pydantic 모델은 `populate_by_name=True`라 snake_case
(`conversation_id`)도 받지만, 응답은 항상 alias(camelCase)로 직렬화된다.

### 4.2 `state` — 대화의 누적 상태

클라이언트가 보관하고 매 턴 왕복시키는 객체다.

```jsonc
{
  "incident": {
    "description": "답장을 세 시간 동안 안 했다",
    "facts": ["오후 3시에 메시지를 보냈다"],      // 사용자가 직접 경험한 사실
    "assumptions": ["일부러 무시한 것 같다"]       // 사용자의 추측
  },
  "hurtPoint": "기다린 시간",
  "emotion": { "emotions": ["서운함", "불안"], "reason": "..." },
  "expectedBehavior": "바로는 아니어도 한마디는 해줄 줄 알았다",
  "desiredOutcome": "바쁠 때 미리 말해주기",
  "optional": {
    "nicknameA": null, "nicknameB": null,
    "date": null, "place": null,
    "quotes": [], "punishmentIdea": null
  },
  "confirmedFields": ["incident"],
  "missingFields": ["emotion_reason", "desired_outcome"],
  "readyToGenerate": false
}
```

`incident`가 **사실(`facts`)과 추측(`assumptions`)을 분리**하는 것은 PRD §8 "사용자가 직접
경험한 사실과 사용자의 추측"을 구조로 옮긴 것이다. PRD §13의 "말하지 않은 상대방의 의도를
사실처럼 단정하지 않는다"가 데이터 모델 차원에서 지켜진다.

`optional` 전체는 PRD §8 "선택 데이터"에 대응한다. 비어 있으면 중립 호칭과 기본 톤을 쓴다.

`missingFields`·`confirmedFields`의 값은 다음 여섯 개다. **이 리터럴만은 snake_case다**
(필드명은 camelCase, 값은 snake_case).

```
incident | hurt_point | emotion | emotion_reason | expected_behavior | desired_outcome
```

### 4.3 응답

```jsonc
// 200
{
  "conversationId": "temp",
  "state": { /* 갱신된 상태. 다음 요청에 그대로 실어 보낼 것 */ },
  "extracted": { /* 이번 턴에 새로 뽑아낸 것만 */ },
  "assistantMessage": "그때 어떤 기분이었어?",
  "missingFields": ["emotion_reason"],
  "readyToGenerate": false,
  "mode": "openai"                   // openai | local
}
```

`assistantMessage`는 질문을 **하나만** 담는다. `complaint_engine.enforce_single_question()`이
이를 강제한다 — FR-02의 구현이 프롬프트 지시에 그치지 않고 후처리로 보장된다.

`readyToGenerate: true`가 되면 카드를 만들 수 있다. 그 뒤에도 대화는 계속할 수 있다.

### 4.4 `mode` — 모델 없이도 동작한다

| 값 | 조건 | 동작 |
| --- | --- | --- |
| `openai` | `OPENAI_API_KEY`가 있고 `CONVERSATION_USE_LOCAL`이 꺼짐 | LLM으로 추출·질문 생성 |
| `local` | 그 외 | 키워드 규칙 기반 추출(`extract_with_fallback`)과 정적 질문 |

`local`은 키가 없는 개발 환경에서도 프론트를 붙여볼 수 있게 한다. `mode`를 응답에 담으므로
프론트는 지금 어느 경로로 동작 중인지 알 수 있다.

---

## 5. 중재 리포트 — **구현됨**

```
POST /api/mediation/report
```

`backend/app/api/mediation.py`. FR-09의 구현.

### 5.1 요청

```jsonc
{
  "a": {
    "incident_description": "연락 없이 한 시간 늦었어",   // 필수
    "emotions": ["걱정", "서운함"],
    "emotion_reason": "내 시간이 중요하지 않은 것 같아서",
    "hurt_point": "기다린 한 시간",
    "desired_outcome": "먼저 알려줬으면 좋겠어",          // 필수
    "expected_behavior": "짧게라도 연락",
    "assumption": "일부러 무시한 것 같다",
    "cute_charge": "",            // 생성 주체 없음 — §10-2
    "incident_summary": "",       // 생성 주체 없음 — §10-2
    "different_viewpoint": null   // 생성 주체 없음 — §10-2
  },
  "b": { /* 동일 */ }
}
```

`SharedStatement`는 **공유 선택이 끝난 확정 카드**다. 코드 주석이 명시한다 —
*"Finalized, share-selected card, never private conversation."* 대화 원문이 이 경로로
들어오지 않는다.

**필드명은 DB `statement_cards` 컬럼과 1:1로 대응한다**(§8-1). alias를 두지 않으므로
요청·응답 모두 snake_case다.

`incident_description`·`desired_outcome`만 필수(최소 1자)이고 나머지는 기본값이 있다.
문자열은 최대 8,000자.

공유하지 않기로 고른 항목에는 `"공유하지 않은 내용"` 이 들어간다. 빈 값과 구별해야 하며,
`SharedStatement.shared()`가 둘을 함께 걸러낸다.

### 5.2 응답

```jsonc
{
  "report": {
    "common_ground": ["..."],
    "different_views": ["신청인(A)의 설명: ...", "상대방(B)의 설명: ..."],
    "hurt_points_a": ["..."],
    "hurt_points_b": ["..."],
    "possible_misunderstanding": null,
    "conversation_starter": "그날 서로 어떤 상황이었는지 차례로 이야기해볼까요?"
  },
  "mode": "openai"
}
```

**리포트만 snake_case다.** `complaint` 계열과 달리 alias를 두지 않았다. §8-2 참고.

### 5.3 AI 출력을 코드가 되돌려 놓는다

`mediation.ground_report()`가 LLM 응답을 받은 뒤 세 필드를 **강제로 덮어쓴다.**

| 필드 | 처리 | 이유 |
| --- | --- | --- |
| `different_views` | A·B의 `incident_description`을 화자 표기와 함께 그대로 채움 | LLM이 화자를 뒤바꾸는 것을 원천 차단 |
| `hurt_points_a` / `_b` | 각 측 `emotions[]`를 그대로 사용. 비어 있으면 `emotion_reason`으로 대체하고, 미공유면 `[]` | 감정을 재해석하지 않음 |
| `possible_misunderstanding` | **항상 `null`** | 인과 추론이 A/B를 조용히 뒤집는 사례가 있어 발행을 보류 |

코드 주석: *"Free-form causal inference can silently reverse A/B even with role prompts.
Until source/actor grounding is available, do not publish this speculation."*

PRD §13 "AI가 하지 않아야 하는 일"을 프롬프트가 아니라 **코드로** 강제한 것이다. DB 스키마에
`possible_misunderstanding` 컬럼은 있으나 현재 구현은 절대 채우지 않는다.

`mode: "local"`일 때는 LLM 없이 A·B의 진술을 화자 표기와 함께 나열하고, `common_ground`는
빈 배열로 둔다. 합의점을 추론하는 척하지 않는다.

---

## 6. 사건·링크 계층 — **미구현**

아래는 설계만 존재한다. 코드가 없으므로 구현 시 재검토 대상이다.

### 6.1 인증·권한 모델

| 토큰 | 발급 | 저장 위치 | 용도 |
| --- | --- | --- | --- |
| `public_token` | 사건 생성 시 | 공유 링크, 양쪽 브라우저 | 모든 조회·쓰기의 열쇠 |
| `writer_token` | 사건 생성 시 (A에게만) | A 브라우저에만 | 고소장 확정 권한 (A-3) |

서버는 둘 다 SHA-256 hex 해시만 저장한다. B에게는 토큰을 주지 않는다 — "링크를 가진 사람이
B"가 설계 전제이며(DFD §2-4), 중복 제출은 DB의 PK·UNIQUE가 막는다.

### 6.2 예정 엔드포인트

| Method | Path | 상태 전이 |
| --- | --- | --- |
| `POST` | `/api/cases` | → `DRAFT` |
| `GET` | `/api/cases/{token}` | — |
| `POST` | `/api/cases/{token}/statement` | `DRAFT`→`AWAITING_RESPONSE` / `COUNTER_DRAFT`→`COUNTER_COMPLETED` |
| `POST` | `/api/cases/{token}/response-type` | `AWAITING_RESPONSE`→`*_DRAFT` |
| `POST` | `/api/cases/{token}/apology` | `APOLOGY_DRAFT`→`APOLOGY_COMPLETED` |

대화(§4)와 리포트(§5)는 이미 독립 엔드포인트로 존재하므로, 사건 계층은 이들을 감싸는 것이
아니라 **결과물을 저장하고 상태를 전이시키는 역할**만 맡는다.

### 6.3 조회 응답 (A-5)

```jsonc
{
  "status": "COUNTER_COMPLETED",
  "viewer_role": "B",
  "expires_at": "2026-09-21T09:30:00Z",
  "available_actions": [],
  "content": { "cards": {...}, "report": {...} }
}
```

| 상태 | `content` | `available_actions` (A) | (B) |
| --- | --- | --- | --- |
| `DRAFT` | `null` | `["converse", "submit_statement"]` | `[]` |
| `AWAITING_RESPONSE` | `{cards:{A}}` | `[]` | `["choose_response_type"]` |
| `COUNTER_DRAFT` | `{cards:{A}}` | `[]` | `["converse", "submit_statement"]` |
| `APOLOGY_DRAFT` | `{cards:{A}}` | `[]` | `["submit_apology"]` |
| `COUNTER_COMPLETED` | `{cards:{A,B}, report}` | `[]` | `[]` |
| `APOLOGY_COMPLETED` | `{cards:{A}, apology}` | `[]` | `[]` |

`EXPIRED`는 200으로 나오지 않는다 — 만료 검사가 앞에서 410을 던진다(§7.3).

### 6.4 사과문 제출

B가 입력한 텍스트를 **그대로** 저장한다. AI를 호출하지 않고 파생 필드를 만들지 않는다
(PRD §13, DFD §8.2).

---

## 7. 오류 규약

### 7.1 현재 형식 — **구현됨**

FastAPI 기본 형식을 쓴다.

```jsonc
{ "detail": "Message must not be blank" }
```

| 상황 | HTTP | `detail` | 위치 |
| --- | --- | --- | --- |
| `message`가 공백 | 400 | `Message must not be blank` | `conversation.py` |
| 대화 처리 실패 | 502 | `Conversation processing failed. Please retry.` | `conversation.py` |
| 리포트 생성 실패 | 502 | `Report generation failed. Please retry.` | `mediation.py` |
| 요청 형식 오류 | 422 | `Invalid request` | `main.py` 전역 핸들러 |

502 응답은 **provider 예외를 노출하지 않는다.** `raise ... from None`으로 원인 체인을 끊고
고정 문구만 반환한다. PRD §14 "AI 생성 실패 → 입력을 유지한 채 재시도 안내"에 대응한다.

### 7.2 사건 계층 오류 — **미구현**

사건·토큰이 생기면 다음이 필요하다.

| 상황 (PRD §14) | HTTP | 비고 |
| --- | --- | --- |
| 없는 토큰 | 404 | |
| 만료된 링크 | **410** | PRD §9.9 만료 화면을 오류 화면과 구분하기 위함 |
| `writer_token` 불일치 | 403 | |
| 불가능한 상태 전이 | 409 | 조건부 UPDATE의 영향 행이 0일 때 |
| 중복·동시 제출 | 409 | 프론트는 오류가 아니라 **읽기 전용 리포트로 이동** |

> **미결 — 오류 형식이 갈라져 있다.** 현재 구현은 `{"detail": "..."}`이고 위 표는 기계가
> 분기할 `code`를 전제로 한다. 사건 계층 구현 시 둘 중 하나를 정해야 한다. 기존 두
> 엔드포인트까지 `{code, message}`로 바꾸면 프론트 수정이 따라온다. §8-3 참고.

### 7.3 만료 검사 — **미구현**

사건 엔드포인트는 조회 직후 `expires_at <= now()`를 확인하고 지났으면 410을 반환해야 한다.
DFD §7.3의 **접근 시점 검사(lazy)** 이며, `pg_cron` 배치가 최대 1시간 지연되는 틈을 막는
유일한 수단이다.

---

## 8. 설계와 구현의 불일치

문서를 구현에 맞추는 과정에서 드러난 항목이다. 코드 수정이 필요한 것과 문서만 고치면 되는
것을 구분한다.

### 8-1. 카드 형태 통일 — **DB 기준으로 통일 완료 (2026-09-15)**

API·프론트·DB가 같은 카드를 서로 다른 필드로 표현하고 있었다. **DB 스키마를 기준으로
통일한다.** `statement_cards` 컬럼명이 API 응답과 프론트 타입의 이름이 된다.

DB를 기준으로 삼는 이유는 두 가지다. PRD §11 데이터 구조 초안에서 온 형태라 제품 기획에
가장 가깝고, `cute_charge`(귀여운 죄명)처럼 **제품의 핵심 재미 요소가 DB에만** 있다.

#### 기준 형태

| 필드 | 타입 | 이전 이름 | 비고 |
| --- | --- | --- | --- |
| `incident_description` | string (필수) | `incident` | |
| `emotions` | string[] | — | **유실되던 것을 복구** |
| `emotion_reason` | string | `feeling`의 일부 | |
| `hurt_point` | string | `feeling`의 일부 | DB 컬럼 추가함 |
| `desired_outcome` | string (필수) | `wish` | |
| `expected_behavior` | string | `expectation` | DB 컬럼 추가함 |
| `assumption` | string | `guess` | DB 컬럼 추가함 |
| `cute_charge` | string | — | 항상 `""` — 생성 주체 없음 (§10-2) |
| `incident_summary` | string | — | 항상 `""` — 생성 주체 없음 (§10-2) |
| `different_viewpoint` | string \| null | — | 항상 `null` — 생성 주체 없음 (§10-2) |

#### "DB 기준"이 컬럼 추가를 포함하는 이유

`expectation`·`guess`를 단순히 버릴 수 없다. 프론트의 **공유 항목 선택 화면**
(`ShareSelectScreen.tsx`)이 사용자에게 이 둘을 공유할지 고르게 하고,
`StatementCard.tsx`가 카드에 표시한다. 제품 기능이 이미 붙어 있다.

따라서 DB 기준이란 **"DB가 이름과 구조의 권위를 갖되, 프론트에만 있던 항목은 마이그레이션으로
DB에 흡수한다"** 는 뜻이다. 이름만 바꾸는 작업이 아니다.

#### `feeling`이 두 필드로 갈라진다

대화 상태(`ComplaintConversationState.emotion`)는 이미 `{emotions[], reason}`으로
DB와 정확히 같은 모양이다. 이를 카드로 옮기는 `SharedStatement`가 `feeling` 한 덩어리로
납작하게 만들면서 **감정 목록이 통째로 버려지고 있었다.** 기준 형태로 옮기면 이 유실이
자동으로 해소된다.

#### 사과문도 같은 문제가 있다

| 프론트 `Apology` | DB `apologies` |
| --- | --- |
| `body` | `body` |
| `understood` | `understood_point` |
| `promise` | `future_commitment` |
| `admitted` | **없음 — 컬럼 추가 필요** |

`admitted_point`로 추가한다.

#### 필요한 마이그레이션

`supabase/migrations/20260915101500_align_api_schema.sql`에서 §11의 `writer_token_hash`와
한 파일로 묶어 처리했다.

```sql
alter table cases           add column writer_token_hash text;
alter table statement_cards add column hurt_point        text;
alter table statement_cards add column expected_behavior text;
alter table statement_cards add column assumption        text;
alter table apologies       add column admitted_point    text;
```

다섯 컬럼 모두 nullable이고 기존 행이 없어 백필이 필요 없다.

`hurt_point`는 착수 후 드러난 항목이다. 프론트가 `feeling` 한 칸에 `hurtPoint`·`emotions`·
`emotion_reason` 셋을 합쳐 넣고 있었는데, DB에 `hurt_point`가 없어 그대로 두면 데이터가
버려진다. `expectation`·`guess`와 같은 성격이라 함께 흡수했다.

#### 아직 만들지 못하는 세 필드

`cute_charge`·`incident_summary`·`different_viewpoint`는 **어디에서도 생성되지 않는다.**
`complaint_engine`이 추출하는 항목에 없다. 카드를 저장하려면 대화 엔진이 이 셋을 만들도록
확장해야 한다. 그때까지는 `cute_charge`·`incident_summary`를 nullable로 두거나 저장
시점에 별도 LLM 호출로 생성하는 방식 중 하나를 택해야 한다 — §10-2.

### 8-2. 네이밍 규칙이 엔드포인트마다 다르다 — **코드 수정 권장**

`complaint` 계열의 대화 상태는 camelCase alias를 쓰고(`conversationId`, `assistantMessage`),
`mediation` 계열과 카드는 snake_case를 쓴다(`common_ground`, `incident_description`).

**카드는 §8-1에서 snake_case로 확정됐다** — DB 컬럼명이 곧 필드명이다. 남은 불일치는
대화 상태(`ComplaintConversationState`) 쪽이며, 이는 DB에 저장되지 않는 임시 구조라
시급도가 낮다.

값 리터럴도 섞여 있다 — `missingFields`(camelCase 필드)의 값은 `hurt_point`(snake_case)다.

### 8-3. 오류 응답 형식 — **결정 필요**

§7.2 참고.

### 8-4. 사건 식별자가 없다 — **구현 대기**

`conversationId`의 기본값이 `"temp"`이고 서버는 이 값을 그대로 되돌려줄 뿐 아무 의미를
부여하지 않는다. 현재 API는 **어느 사건의 대화인지 알지 못한다.** §6이 구현되면
`public_token`이 그 역할을 맡는다.

### 8-5. 문서가 틀렸던 것 — **문서 수정 완료**

이번 개정에서 구현에 맞춰 고친 항목이다.

- 대화 엔드포인트 경로: `/api/cases/{token}/conversation` → `/api/complaint/conversation/message`
- 대화 무상태 방식: 원문 전체 재전송 → **상태 객체 왕복**(§3 A-1)
- 요청·응답 필드명: 전부 snake_case로 적었으나 실제는 camelCase(§4.1)
- 리포트를 `statement` 엔드포인트가 겸한다고 적었으나 실제는 **독립 엔드포인트**(§5)

---

## 9. 원문 비저장 — 구현된 보장 지점

DFD §9의 검수 항목 중 **구현이 책임지는 것**들이다. 상당수가 이미 코드에 들어가 있다.

| 지점 | 상태 | 내용 |
| --- | --- | --- |
| 422 응답이 입력값을 에코 | **구현됨** | `main.py` 전역 핸들러가 `{"detail": "Invalid request"}` 고정 반환 |
| 예외에 원문·프롬프트 노출 | **구현됨** | `raise ... from None`으로 체인 차단, 고정 문구만 |
| 응답 캐싱 | **구현됨** | 대화·리포트 응답에 `Cache-Control: no-store` |
| 외부 AI 제공자 보관 | **구현됨** | OpenAI 호출에 `store=False` — §10 참고 |
| OpenAI 로깅 | **구현됨** | `openai_gateway`가 요청·응답 본문을 로그에 남기지 않음 |
| 서버 영속 저장 | **구현됨(구조적)** | DB 접근 코드 자체가 없음 |
| 접근 로그의 토큰 | **미구현** | §10-1 |
| 분석 이벤트 | **해당 없음** | 분석 도구 미도입 |

### `store=False`가 해소한 것

`openai_gateway.call_openai_json_chat()`은 `store=False`로 호출한다. OpenAI가 요청·응답을
보관하지 않는다는 뜻이며, **DFD §10-2·§10-3("외부 AI 제공자의 요청 보관·학습 정책",
"무보관 옵션 필수 적용 여부")이 코드 차원에서 결정됐다.**

타임아웃 25초, 재시도 0회로 설정돼 있다. 재시도를 끄면 실패가 빨리 드러나고 원문이
불필요하게 재전송되지 않는다.

---

## 10. 남은 미결 사항

| # | 항목 | 정해야 할 시점 |
| --- | --- | --- |
| 1 | 접근 로그의 `public_token` 마스킹 (Nginx `log_format`) | §6 구현 후 배포 전 |
| 2 | `cute_charge`·`incident_summary`·`different_viewpoint`를 누가 생성할지 (§8-1) | 카드 저장 구현 전 |
| 3 | 오류 응답 형식 통일 (§8-3) | §6 착수 전 |
| 4 | 대화 상태의 네이밍 규칙 (§8-2) — 카드는 해소됨 | 낮음 (DB 미저장 구조) |
| 5 | 동기 응답이 Nginx·브라우저 타임아웃 안에 드는지 실측 | 맞고소 경로 연결 시 |
| 6 | 위험 내용 감지 기준과 응답 (PRD §14) | 안전 검증 단계 |
| 7 | 사건당 대화 턴 수 상한 (LLM 비용 방어) | 비용 추이를 보고 |
| 8 | 백엔드 DB 접근 계층 선택 | §6 착수 시 |
| 9 | 배포 환경변수 배선 — `docker-compose.yml`에 `DATABASE_URL`·`OPENAI_API_KEY`가 없음 | §6 배포 전 |

**해소됨.** 카드 형태 통일 방향 → DB 기준 (§8-1, 2026-09-14).

9번은 이번 조사에서 드러난 것이다. 배포된 백엔드에 `OPENAI_API_KEY`가 전달되지 않아
**운영 환경의 AI 대화가 규칙 기반 폴백(`mode: "local"`)으로 동작하고 있다.** DB 접속 코드를
추가해도 `DATABASE_URL`이 없으면 같은 문제를 겪는다.

5번은 A-2(동기)의 유일한 실질 위험이다. OpenAI 타임아웃이 25초이고 맞고소 경로는 호출이
2회이므로 최악 50초가 나올 수 있다. Nginx 기본 `proxy_read_timeout`은 60초라 아슬아슬하다.

### 해소된 항목

- ~~LLM 제공자 선정~~ → **OpenAI, `gpt-4.1-mini`** (`core/config.py`). `Tech_ADR.md`
  미해결 항목에서 내려야 한다.
- ~~스트림 형식~~ → 비스트리밍 (A-4)
- ~~외부 AI 제공자 보관 정책~~ → `store=False` (§9)

---

## 11. 구현 순서

PRD §18에 맞춘다. 2·4단계는 이미 끝났고, 남은 것은 사건 계층이다.

| 단계 | 내용 | 상태 |
| --- | --- | --- |
| 2 | A의 고소장 생성 대화 | **구현됨** (§4) |
| 4 | 맞고소 중재 리포트 | **구현됨** (§5) |
| 0 | **카드 형태 통일** — 마이그레이션, `SharedStatement` 재정의, 프론트 타입·화면 수정 | **완료** (§8-1) |
| 1 | 사건·단일 링크 기반 — `POST /api/cases`, `GET /api/cases/{token}`, 만료 lazy 검사 | 미구현 |
| 3 | B의 응답 분기 — `response-type` | 미구현 |
| 5 | 사과 종결 — `apology` | 미구현 |
| 6 | 안전·품질 검증 | 부분 (§9) |

0단계를 1단계보다 먼저 한 이유는, 프론트가 이미 두 엔드포인트에 연결돼 있어
(`lib/api/`) 나중에 바꾸면 저장 계층·API·프론트를 동시에 고쳐야 하기 때문이다.

1단계에서 만료 lazy 검사(§7.3)를 함께 넣는다. 나중에 붙이면 모든 조회 경로를 다시 훑어야
한다.

### 선행 마이그레이션 — 작성됨

A-3(쓰기 토큰)과 §8-1(카드 형태 통일)에 필요한 컬럼 다섯 개를
`supabase/migrations/20260915101500_align_api_schema.sql`에 묶었다. 내용은 §8-1 참고.

**적용은 별도 작업이다.** 머지만으로는 반영되지 않으며 `supabase db push`가 필요하다
(`Tech_ADR.md` §10, `Supabase_Schema_Design.md` §8).
