# 링크 흐름 완성 설계 (P2)

- 날짜: 2026-09-17
- 상태: 설계 확정, 구현 전
- 선행: P1 카드 요약 필드 생성 (`2026-09-17-card-summary-design.md`, main 반영됨)
- 관련: `docs/API_Design.md` §6, §7 / `docs/PRD.md` §9, §14, §20-3 / `docs/Case_Link_Integration.md` / `docs/progress/2026-09-17.md`

---

## 1. 배경

백엔드에는 사건 저장 API가 모두 있다 (`statement`, `response-type`, `apology`, 서버가 `available_actions` 제공).
프론트 실제 링크 화면(`/case/[token]`, `LinkedCaseScreen`)은 생성·조회만 연결돼 있다.

- A: 대화 → 공유 선택 → 검토까지 가능, **접수 버튼이 막혀 있음**
- B: "준비 중" 안내뿐
- PR #19에서 다듬은 화면(소환장 발송·도착, 양측 대질, 화해 성립 등)은 체험용 `/wireframe`의
  `CaseController` 안에만 있고, 링크 화면은 스타일이 거의 없는 기본 마크업이다.

결과적으로 **실제 링크로는 고소장 저장 → 상대 답변 → 종결을 끝까지 할 수 없다.**

## 2. 범위

**포함**

- 저장 API 3개 프론트 연결 (A 접수, B 사과 제출, B 맞고소 제출)
- 작성 권한(`writer_token`)을 sessionStorage → localStorage로 이동
- PR #19 화면을 공통 컴포넌트로 추출해 체험판과 링크 화면이 함께 사용
- 링크 화면의 단계 판정, 작성 내용 보존, 제출 오류 처리
- "준비 중" 안내 문구 정리

**제외**

- `different_viewpoint` 생성 (다음 할 일)
- `CASE #0241` 고정값을 실제 사건 번호로 바꾸기
- 새로고침 시 작성 중 내용 복구 (원문 비저장 원칙, PRD §14 미정)
- 다른 기기에서 A 권한 복구
- 체험판 전용 예시 화면(서기 오류, 이미 종결, 휴정 안내, 심리 준비) 추출

## 3. 결정

| # | 결정 | 이유 |
| --- | --- | --- |
| D1 | 링크 화면은 PR #19 디자인을 **재사용**한다 | 디자인을 두 벌로 두지 않는다 |
| D2 | 작성 권한을 **localStorage**에 둔다 | sessionStorage는 탭 단위라 A가 자기 링크를 새 탭에서 열면 B로 판정되고, 저장 API가 붙으면 **자기 사건에 되돌릴 수 없는 답변**을 할 수 있다 |
| D3 | B의 사과/맞고소 선택은 **최종 제출 때** 서버에 확정한다 | 작성 중 마음이 바뀌면 되돌아갈 수 있다. A는 B가 제출할 때까지 "기다리는 중"을 본다 |
| D4 | 화면은 **props만 받는 컴포넌트로 추출**하고 체험판·링크 화면이 각자 조립한다 | 대안 B(하나의 컨트롤러가 두 모드 처리)는 체험용 기능과 서버 상태 규칙이 한 파일에 얽힌다. 대안 C(마크업 복사)는 디자인이 두 벌이 된다 |
| D5 | 검증은 **로컬 Supabase**로 한다 | 운영 DB에 시험 데이터를 넣지 않는다. Docker Desktop이 켜져 있어야 한다 |

## 4. 데이터 계층

### 4.1 저장 API — `frontend/src/lib/api/cases.ts`

모두 응답을 기존 `parseCaseView`로 검사해 `CaseView`를 반환한다.

| 함수 | 요청 | 타임아웃 | 비고 |
| --- | --- | --- | --- |
| `submitStatement(token, "A", card, writer)` | `POST /api/cases/{token}/statement` `{side, card}` | 15초 | `X-Writer-Token` 헤더로만 권한 전달, URL 금지 |
| `submitStatement(token, "B", card, null)` | 같음 | **60초** | 서버가 중재 리포트 생성 (AI 25초 + 저장) |
| `chooseResponseType(token, type)` | `POST …/response-type` `{response_type}` | 15초 | `type`: `"APOLOGY"` \| `"COUNTER"` |
| `submitApology(token, apology)` | `POST …/apology` | 15초 | 빈 선택 항목은 `null` |

- 카드 전송 시 `sourceMode`(화면 표시용)를 뺀다.
- **POST는 자동 재시도하지 않는다.**
- 요청은 기존처럼 `cache: "no-store"`, `referrerPolicy: "no-referrer"`.
- 오류는 기존 `CaseApiError(status, message)`로, 서버 본문을 노출하지 않는다.

| 상태 | 문구 |
| --- | --- |
| 403 | 작성 권한을 확인하지 못했어요. |
| 404 | 사건을 찾을 수 없어요. (기존) |
| 409 | 이미 제출된 사건이에요. |
| 410 | 보관 기간이 끝난 사건이에요. (기존) |
| 422 | 입력을 확인해주세요. |
| 502 | 밤톨이 정리하지 못했어요. 다시 시도해주세요. |
| 503 | 저장 서버를 사용할 수 없어요. 잠시 후 다시 확인해주세요. (기존) |
| 0 | 연결이 끊겼거나 응답이 늦어지고 있어요. (기존) |

### 4.2 B 제출 순서 — `respond`

`respond(token, kind, submit)`: `chooseResponseType` → `submit()`

- 선택 확정이 **409**면 `readCase`로 다시 조회한다.
  - 상태가 같은 쪽 작성 중(`APOLOGY` → `APOLOGY_DRAFT`, `COUNTER` → `COUNTER_DRAFT`)이면 확정을 건너뛰고 `submit()`을 이어간다.
  - 그 외(반대쪽 선택, 이미 완료)면 409를 그대로 던진다.
- 이미 `*_DRAFT` 단계에서 시작한 경우(§5.1 `b-apology`/`b-counter`)는 선택 확정 없이 `submit()`만 호출한다.
- 409 이후 판정은 순수 함수 `canResumeAfterConflict(status, kind): boolean`로 분리해 테스트한다.

### 4.3 작성 권한 — `frontend/src/features/case/writerSession.ts`

- 키 `bamtol:writer:<public_token>`, 값 `{token, expires}`는 유지하고 **저장소만 localStorage로** 바꾼다.
- **이전 호환:** `getWriter`가 localStorage에 없으면 sessionStorage를 읽고, 유효하면 localStorage로 옮긴 뒤 sessionStorage에서 지운다.
- 만료·손상된 값은 지운다. 404·410이면 `forgetWriter`.
- `checkWriterStorage`는 localStorage 사용 가능 여부를 확인한다.
- **한계:** 다른 기기에서 열면 B로 보인다. 공용 기기에서는 만료 전까지 권한이 남는다. `Case_Link_Integration.md`에 기록한다.

## 5. 링크 화면

### 5.1 단계 판정 — `frontend/src/features/case/caseStage.ts`

`caseStage(view: CaseView): CaseStage` 순수 함수. 쓰기 단계는 `available_actions`에 해당 행동이 있을 때만 연다.

| 단계 | 조건 | 화면 |
| --- | --- | --- |
| `a-draft` | `DRAFT` · A · `submit_statement` | 원고 진술 → 공유 항목 선택 → 고소장 검토 → 접수 |
| `not-ready` | `DRAFT` · B | `WaitingScreen` "아직 고소장이 접수되지 않았어요" |
| `a-sent` | `AWAITING_RESPONSE` · A | `SummonsSentScreen` + 링크 공유 + 기다리는 중 |
| `a-waiting` | `APOLOGY_DRAFT`/`COUNTER_DRAFT` · A | `WaitingScreen` "상대가 마음을 정리하고 있어요" |
| `b-respond` | `AWAITING_RESPONSE` · B · `choose_response_type` | 시작화면2 → 소환장 도착 → 사과 또는 맞고소 흐름 (제출 전 되돌아가기 가능) |
| `b-apology` | `APOLOGY_DRAFT` · B · `submit_apology` | 사과문 작성 + "이미 사과로 답하기로 했어요. 이어서 작성해주세요." |
| `b-counter` | `COUNTER_DRAFT` · B · `submit_statement` | 피고 진술부터 + "이미 맞고소로 답하기로 했어요. 이어서 작성해주세요." |
| `result-apology` | `APOLOGY_COMPLETED` | 시작화면3 + `ApologyResult` |
| `result-counter` | `COUNTER_COMPLETED` | 시작화면3 + `CounterclaimResult` (`mine` = `viewer_role`) |
| `read-only` | 위 어느 것에도 해당 없음 | 결과가 있으면 결과, 없으면 `WaitingScreen` |

### 5.2 흐름 컴포넌트

| 컴포넌트 | 단계 | 내부 순서 |
| --- | --- | --- |
| `ADraftFlow` | `a-draft` | `ConversationScreen(A)` → `ShareSelectScreen(A)` → `PreviewScreen(A)` → `submitStatement(A)` |
| `BResponseFlow` | `b-respond`, `b-apology`, `b-counter` | intro(`StartScreen invited`) → `SummonsArrivedScreen` → 사과: `ApologyScreen` → `respond(APOLOGY, submitApology)` / 맞고소: `StatementSummary` + `ConversationScreen(B)` → `ShareSelectScreen(B)` → `PreviewScreen(B)` → `respond(COUNTER, submitStatement B)` |

- `b-apology`/`b-counter`는 intro·도착 화면을 건너뛰고, 다시 고르기를 제공하지 않는다.
- `b-respond`에서는 사과·맞고소 작성 화면에 "다시 고르기"(도착 화면으로)를 둔다.

### 5.3 작성 내용 보존

- 흐름 컴포넌트는 **단계 이름을 `key`로** 렌더링한다. 포커스 복귀로 재조회해도 단계가 같으면 다시 마운트되지 않는다.
- 단계가 바뀌면(상대가 완료, 만료) 흐름이 내려가고 새 단계 화면이 뜬다.
- 제출 중에는 포커스/`pageshow` 재조회를 멈춘다.
- 새로고침·탭 종료 시 작성 중 내용은 사라진다 (안내만 한다).

### 5.4 제출 오류 처리

`LinkedCaseScreen`이 `submit(run: () => Promise<CaseView>)`을 흐름 컴포넌트에 내려준다. 성공하면 받은 `CaseView`로 교체한다.

| 결과 | 처리 | 작성 내용 |
| --- | --- | --- |
| 409 | 재조회 후 최신 상태 + "이미 제출된 사건이에요" | 단계가 바뀌면 버림 (PRD §14) |
| 410 / 404 | `CaseGoneScreen`, `forgetWriter` | 버림 |
| 403 | "이 브라우저에서 작성 권한을 확인하지 못했어요. 사건을 만든 브라우저에서 접수해주세요." | 유지 |
| 422 / 502 | 안내 + 같은 버튼으로 재제출 | 유지 |
| 503 / 0 | **재조회로 확인.** 단계가 바뀌었으면 새 상태 + "제출이 확인됐어요", 그대로면 안내 + 재제출 | 저장 안 됐을 때만 유지 |

503/0에서 재조회하는 이유: POST는 응답 전에 연결이 끊겨도 서버에는 저장됐을 수 있다. 확인 없이 재제출하면 409가 나거나 B의 중재 요청이 중복된다.

## 6. 화면 컴포넌트 추출

위치: `frontend/src/features/case/screens/`. **props만 받고** 서버 호출·화면 이동·체험 기능(Toast, 개발 패널)을 모른다. 체험판과 실제 화면에서 다른 부분은 `children`으로 받는다.

| 컴포넌트 | 원래 (`CaseController`) | props | 체험판 | 링크 화면 |
| --- | --- | --- | --- | --- |
| `SummonsSentScreen` | 소환장 발송 / 맞고소장 발송 | `side`, `card`, `children` | 링크 자리표시자, Toast 복사, "피고가 받는 화면 체험하기" | 실제 링크 복사·공유, 기다리는 중 |
| `SummonsArrivedScreen` | 소환장 도착 | `complaint`, `onApologize`, `onCounter` | 화면 이동 | 화면 이동 |
| `WaitingScreen` | 심리 대기 | `label?`, `title?`, `children` | "종결 화면 체험" | "사건 상태 새로 확인하기" |
| `CounterclaimResult` | 양측 대질 | `a`, `b`, `mine`, `report` | `mine="B"`, `MediationSummary` | `viewer_role`, `MediationReport` |
| `ApologyResult` | 화해 성립 | `complaint`, `apology`, `children` | 체험 결과 안내 | 저장·보관 기한 안내 |
| `CaseGoneScreen` | 기록 파기 / 사건 없음 | `kind`, `children` | "새 사건 접수하기" | 홈 링크 |

함께 바꾸는 것:

- `MediationSummary` → `MediationReport`(표시 전용) + `MediationSummary`(AI 요청 후 `MediationReport` 사용). 링크 화면은 저장된 리포트를 보여주기만 한다.
- `ApologyResult`는 서버에서 `null`로 오는 선택 항목을 숨긴다.
- `StartScreen`에 `notice` prop. 기본값은 지금 문구, 링크 화면은 "판결문은 7일 후 파기돼요".
- `PreviewScreen`·`ApologyScreen`에 `busy`, `submitLabel` prop. 기본값은 지금 체험판 문구. `PreviewScreen`의 `submitDisabled`는 제거한다.
- B 맞고소 제출 중 문구: "밤톨이 두 분의 이야기를 정리하고 있어요… (최대 1분)".

**추출은 동작을 바꾸지 않는 리팩터링으로 먼저 커밋한다.** 체험판 화면 8개(소환장 발송, 맞고소장 발송, 소환장 도착, 심리 대기, 양측 대질, 화해 성립, 기록 파기, 사건 없음)를 추출 전후로 캡처해 비교한다.

## 7. 문구 정리

| 위치 | 변경 |
| --- | --- |
| `LinkedCaseScreen` "고소장 저장 기능은 아직 연결되지 않았어요" 외 2곳 | 삭제 |
| `CreateCaseButton` "고소장 저장·전송은 아직 준비 중이에요" | 삭제 |
| `CreateCaseButton` "작성 권한은 이 탭에 보관돼요…" | "작성 권한은 이 브라우저에 보관돼요. 다른 기기에서는 작성자로 인식되지 않아요." |
| `ApologyScreen` "실제 전송·저장은 아직 연결되지 않았어요" | 링크 화면에서는 표시하지 않음 (prop) |

## 8. 테스트와 검증

**단위 테스트 (`node --test`)**

- `cases.test.mjs`: 저장 함수별 경로·메서드·헤더·본문, A 제출에만 권한 헤더, `sourceMode` 제외, B 제출 60초·나머지 15초, 오류 코드별 문구와 본문 비노출, 재시도 없음, `canResumeAfterConflict` 전체 조합, `respond`의 409 재조회 경로
- `cases.test.mjs`의 `writerSession` 테스트를 localStorage로 갱신 + sessionStorage 이전, 만료·손상 제거, 저장소 사용 불가
- `caseStage.test.mjs`: 상태 × 역할 × 행동 조합 전체

**정적 검사:** `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm test`

**체험판 회귀:** §6의 화면 8개 캡처 비교

**로컬 Supabase 전체 흐름** (`supabase start` + 마이그레이션, 백엔드 local AI 모드, A는 일반 창·B는 시크릿 창)

1. A 접수 → A `a-sent`, B `b-respond`
2. B 사과 제출 → 양쪽 `result-apology`
3. 새 사건, B 맞고소 제출 → 양쪽 `result-counter` (저장된 리포트 표시, AI 재호출 없음)
4. B가 사과 선택 → 다시 고르기 → 맞고소로 제출
5. A가 같은 브라우저 새 탭에서 열어도 A
6. 제출 중 백엔드 중단 → 작성 내용 유지, 재조회 후 재제출
7. 완료된 사건을 다른 창에서 재제출 → 409 처리

## 9. 문서 갱신

- `docs/Case_Link_Integration.md`: 저장 연결 완료, 작성 권한 저장소 변경과 한계, 검증 결과
- `docs/API_Design.md` §2: 프론트 사건 계층 연결 상태
- `docs/progress/2026-09-17.md`: 남은 것 갱신

## 10. 위험

- **맞고소 제출 지연:** 중재 리포트 생성이 길어지면 60초에 가까워진다. Nginx 기본 `proxy_read_timeout`도 60초다. 운영 실측은 남은 일 ⑤에서 한다.
- **선택 확정 후 제출 실패:** `*_DRAFT`에 머문다. `b-apology`/`b-counter` 단계로 이어서 작성하게 하고, 다른 쪽으로는 바꿀 수 없다.
- **localStorage 공용 기기:** 만료 전까지 작성 권한이 남는다. A 권한은 `DRAFT`에서 접수할 때만 의미가 있어 접수 후 위험은 낮다.
- **추출 리팩터링 회귀:** 캡처 비교로 막는다.
