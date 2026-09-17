# 링크 흐름 완성 (P2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 실제 사건 링크(`/case/[token]`)에서 A 접수 → B 사과 또는 맞고소 → 양쪽 결과 확인까지 끝까지 동작하게 하고, PR #19 화면 디자인을 체험판과 함께 쓴다.

**Architecture:** 체험판 `CaseController`에 섞인 화면을 props 전용 컴포넌트(`features/case/screens/`)로 뽑는다. `lib/api/cases.ts`에 저장 API와 B 제출 순서(`respond`)를 더하고, 작성 권한을 localStorage로 옮긴다. `LinkedCaseScreen`은 순수 함수 `caseStage`로 단계를 정해 흐름 컴포넌트(`ADraftFlow`, `BResponseFlow`)나 결과 화면을 렌더링하고, 제출 실패는 `failureAction`으로 분기한다.

**Tech Stack:** Next.js 16, React 19, TypeScript, framer-motion / `node --test` + TypeScript transpile / FastAPI 백엔드(변경 없음) / 로컬 Supabase(`supabase start`, Docker)

**Spec:** `docs/superpowers/specs/2026-09-17-case-link-flow-design.md`

## Global Constraints

- 작업 브랜치: `feat/case-link-flow`
- 백엔드 코드는 바꾸지 않는다.
- POST는 자동 재시도하지 않는다. 모든 사건 요청은 `cache: "no-store"`, `referrerPolicy: "no-referrer"`.
- `writer_token`은 `X-Writer-Token` 헤더로만, A의 `statement` 제출에만 보낸다. URL·본문 금지.
- 타임아웃: B `statement` 60000ms, 그 외 사건 요청 15000ms.
- 카드 전송 시 `sourceMode` 제외. 사과문 선택 항목의 빈 값은 `null`.
- 오류 문구: 403 `작성 권한을 확인하지 못했어요.` / 404 `사건을 찾을 수 없어요.` / 409 `이미 제출된 사건이에요.` / 410 `보관 기간이 끝난 사건이에요.` / 422 `입력을 확인해주세요.` / 502 `밤톨이 정리하지 못했어요. 다시 시도해주세요.` / 503 `저장 서버를 사용할 수 없어요. 잠시 후 다시 확인해주세요.` / 0 `연결이 끊겼거나 응답이 늦어지고 있어요.` / 그 외 `사건 서버에 연결하지 못했어요.`
- 작성 권한 키 `bamtol:writer:<public_token>`, 값 `{token, expires}`, 저장소 localStorage (sessionStorage에서 1회 이전)
- 화면 컴포넌트는 서버 호출·화면 이동·Toast·개발 패널을 모른다.
- 체험판(`/wireframe`)의 화면 8개는 추출 전후 DOM이 같아야 한다.
- 대화·카드 초안·사과 원문은 브라우저 저장소에 저장하지 않는다.
- CI와 같은 확인: `cd frontend && npx tsc --noEmit && npm run lint && npm run build && npm test` (lint 에러 0, 기존 `<img>` 경고 3건 허용)
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

## File Structure

| 파일 | 작업 | 책임 |
| --- | --- | --- |
| `frontend/src/features/report/MediationReport.tsx` | 생성 | `MediationPanel`(겉 패널), `MediationReport`(리포트 표시 전용) |
| `frontend/src/features/report/MediationSummary.tsx` | 수정 | AI 요청 후 위 둘을 사용 |
| `frontend/src/features/case/screens/SummonsSentScreen.tsx` | 생성 | 소환장/맞고소장 발송 |
| `frontend/src/features/case/screens/SummonsArrivedScreen.tsx` | 생성 | 소환장 도착 |
| `frontend/src/features/case/screens/WaitingScreen.tsx` | 생성 | 심리 대기 |
| `frontend/src/features/case/screens/CounterclaimResult.tsx` | 생성 | 양측 대질 결과 |
| `frontend/src/features/case/screens/ApologyResult.tsx` | 생성 | 화해 성립 결과 |
| `frontend/src/features/case/screens/CaseGoneScreen.tsx` | 생성 | 기록 파기 / 사건 없음 |
| `frontend/src/features/case/StartScreen.tsx` | 수정 | `notice` prop |
| `frontend/src/features/case/CaseController.tsx` | 수정 | 추출한 화면 조립 (동작 불변) |
| `frontend/src/lib/api/cases.ts` | 수정 | 저장 API, 오류 문구, `respond`, `canResumeAfterConflict` |
| `frontend/src/features/case/writerSession.ts` | 수정 | localStorage + 이전 |
| `frontend/src/features/case/CreateCaseButton.tsx` | 수정 | 안내 문구 |
| `frontend/src/features/case/caseStage.ts` | 생성 | `caseStage`, `failureAction` |
| `frontend/src/features/report/PreviewScreen.tsx` | 수정 | `busy`, `submitLabel`, `notice` / `submitDisabled` 제거 |
| `frontend/src/features/report/ApologyScreen.tsx` | 수정 | `busy`, `submitLabel`, `notice`, `demo` |
| `frontend/src/features/case/ShareCaseLink.tsx` | 생성 | 실제 링크 복사·공유 (LinkedCaseScreen에서 이동) |
| `frontend/src/features/case/ADraftFlow.tsx` | 생성 | A 작성 → 접수 |
| `frontend/src/features/case/BResponseFlow.tsx` | 생성 | B 소환장 → 사과/맞고소 → 제출 |
| `frontend/src/features/case/LinkedCaseScreen.tsx` | 교체 | 조회·단계 분기·제출 처리 |
| `frontend/tests/cases.test.mjs` | 수정 | 저장 API·respond·writerSession 테스트 |
| `frontend/tests/caseStage.test.mjs` | 생성 | 단계·실패 판정 테스트 |
| `docs/Case_Link_Integration.md`, `docs/API_Design.md`, `docs/progress/2026-09-17.md` | 수정 | 구현 상태 반영 |

---

### Task 1: 체험판 화면 기준값 기록과 중재 리포트 분리

**Files:**
- Create: `frontend/src/features/report/MediationReport.tsx`
- Modify: `frontend/src/features/report/MediationSummary.tsx`

**Interfaces:**
- Consumes: `MediationResult` 타입 (`@/lib/api/mediation`), `Notice` (`@/components/ui`)
- Produces:
  - `MediationPanel({ children }: { children: ReactNode })`
  - `MediationReport({ report, notice }: { report: MediationResult["report"]; notice: string })`

UI 테스트 도구가 없으므로 **체험판 화면 DOM 해시 비교**로 회귀를 막는다. 이 태스크 첫 단계에서 기준값을 기록하고 Task 1·2 끝에서 비교한다.

- [ ] **Step 1: 개발 서버 실행**

터미널 1: `cd backend && CONVERSATION_USE_LOCAL=true uv run uvicorn app.main:app --port 8000`
터미널 2: `cd frontend && npm run dev`

- [ ] **Step 2: 기준 해시 기록 (변경 전)**

브라우저에서 `http://localhost:3000/wireframe`을 열고 콘솔(또는 브라우저 자동화의 JS 실행)에서 실행한다.

```js
const screens = ["소환장 발송", "맞고소장 발송", "소환장 도착", "심리 대기", "양측 대질", "화해 성립", "기록 파기", "사건 없음"];
const select = document.querySelector("#screen");
const setValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
const hash = async (text) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))]
  .slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
const out = {};
for (const name of screens) {
  setValue.call(select, name);
  select.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 400));
  out[name] = await hash(document.querySelector(".screen").outerHTML);
}
JSON.stringify(out);
```

결과 JSON을 `docs/superpowers/plans/`가 아닌 **대화/작업 메모**에 보관한다(커밋하지 않음). 8개 모두 16자리 해시여야 한다.

- [ ] **Step 3: `MediationReport.tsx` 생성**

```tsx
import type { ReactNode } from "react";
import { Notice } from "@/components/ui";
import type { MediationResult } from "@/lib/api/mediation";

// 중재 정리를 감싸는 패널. 체험판(AI 요청)과 링크 화면(저장된 리포트)이 함께 쓴다.
export function MediationPanel({ children }: { children: ReactNode }) {
  return (
    <section className="panel">
      <span className="badge">중재자의 정리 (판결 아님)</span>
      <h2 className="text-primary">두 사람을 위한, 중재자의 정리</h2>
      {children}
    </section>
  );
}

// 리포트를 보여주기만 한다. 요청·저장은 하지 않는다.
export function MediationReport({
  report,
  notice,
}: {
  report: MediationResult["report"];
  notice: string;
}) {
  return (
    <>
      <Notice>{notice}</Notice>
      {(
        [
          [
            "함께 인정하는 내용",
            report.common_ground,
            "두 카드에서 공통으로 확인된 내용은 아직 없어요.",
          ],
          [
            "각자가 설명한 상황 (공유 내용 그대로)",
            report.different_views,
            "명시적으로 확인된 차이는 없어요.",
          ],
          ["신청인(A)의 마음", report.hurt_points_a, "공유된 감정이 없어요."],
          ["상대방(B)의 마음", report.hurt_points_b, "공유된 감정이 없어요."],
        ] as const
      ).map(([title, items, empty]) => (
        <div key={title}>
          <h3>{title}</h3>
          {items.length ? (
            <ul>
              {items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>{empty}</p>
          )}
        </div>
      ))}
      <h3>오해가 생겼을 가능성</h3>
      <p>
        {report.possible_misunderstanding ||
          "지금 내용만으로는 판단하기 어려워요."}
      </p>
      <h3 className="recommend-title text-primary">다음 대화의 시작 문장</h3>
      <p className="recommend-desc">{report.conversation_starter}</p>
    </>
  );
}
```

- [ ] **Step 4: `MediationSummary.tsx`에서 사용**

import에 추가한다.

```tsx
import { MediationPanel, MediationReport } from "./MediationReport";
```

`return (` 이하 전체를 다음으로 바꾼다.

```tsx
  return (
    <MediationPanel>
      {!result && (
        <>
          <Notice>
            선택해 공유한 A/B 카드만 AI에게 전달해 공통점과 다른 관점을
            정리해요. 대화 원문은 보내지 않아요.
          </Notice>
          <Button disabled={pending} onClick={() => void generate()}>
            {pending
              ? "두 관점을 살펴보고 있어요…"
              : error
                ? "다시 시도하기"
                : "밤톨의 정리 보기"}
          </Button>
        </>
      )}
      {pending && <p role="status">두 카드는 그대로 두고 정리하고 있어요.</p>}
      {error && <p role="alert">{error}</p>}
      {result && (
        <MediationReport
          report={result.report}
          notice={
            result.mode === "openai"
              ? "AI의 참고 요약입니다. 누가 옳은지 판결하지 않아요."
              : "AI 미연결: 각자의 입력만 표시하며 공통점이나 오해를 추론하지 않았어요."
          }
        />
      )}
      <Notice>
        결과는 현재 화면에서만 유지됩니다. 실제 공유 링크·DB 저장은 아직
        연결되지 않았어요.
      </Notice>
    </MediationPanel>
  );
}
```

- [ ] **Step 5: 확인**

Run: `cd frontend && npx tsc --noEmit && npm run lint`
Expected: tsc 성공, lint 에러 0

`/wireframe`을 새로고침하고 Step 2 스크립트를 다시 실행한다.
Expected: 8개 해시 모두 기준값과 같음. `양측 대질`에서 "밤톨의 정리 보기"를 눌러 리포트가 표시되는지 눈으로 확인한다.

- [ ] **Step 6: 커밋**

```bash
git add frontend/src/features/report/MediationReport.tsx frontend/src/features/report/MediationSummary.tsx
git commit -m "refactor(frontend): 중재 리포트 표시를 MediationReport로 분리" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: 체험판 화면을 공통 컴포넌트로 추출

**Files:**
- Create: `frontend/src/features/case/screens/SummonsSentScreen.tsx`
- Create: `frontend/src/features/case/screens/SummonsArrivedScreen.tsx`
- Create: `frontend/src/features/case/screens/WaitingScreen.tsx`
- Create: `frontend/src/features/case/screens/CounterclaimResult.tsx`
- Create: `frontend/src/features/case/screens/ApologyResult.tsx`
- Create: `frontend/src/features/case/screens/CaseGoneScreen.tsx`
- Modify: `frontend/src/features/case/StartScreen.tsx`
- Modify: `frontend/src/features/case/CaseController.tsx`

**Interfaces:**
- Consumes: `MediationSummary` (Task 1), `StatementCard`, `StatementSummary`, `Heading`, `Notice`, `Button`
- Produces:
  - `SummonsSentScreen({ side: "A" | "B"; card: Statement; children: ReactNode })`
  - `SummonsArrivedScreen({ complaint: Statement; onApologize: () => void; onCounter: () => void })`
  - `WaitingScreen({ label?: string; title?: string; children?: ReactNode })`
  - `CounterclaimResult({ a: Statement; b: Statement; mine: "A" | "B"; report: ReactNode })`
  - `ApologyResult({ complaint: Statement; apology: ApologyView; children: ReactNode })`, `type ApologyView = { body: string; understood_point?: string | null; admitted_point?: string | null; future_commitment?: string | null }`
  - `CaseGoneScreen({ kind: "expired" | "missing"; children: ReactNode })`
  - `StartScreen`에 `notice?: ReactNode`

- [ ] **Step 1: `SummonsSentScreen.tsx`**

```tsx
import type { ReactNode } from "react";
import { Heading } from "@/components/ui";
import { StatementCard } from "@/features/report/StatementCard";
import type { Statement } from "@/features/report/types";

// 링크를 보낸 사람의 화면. 공유 방법(체험·실제)은 children으로 받는다.
export function SummonsSentScreen({
  side,
  card,
  children,
}: {
  side: "A" | "B";
  card: Statement;
  children: ReactNode;
}) {
  const doc = side === "A" ? "소환장" : "맞고소장";
  return (
    <>
      <Heading
        label={`${doc}, 준비됐어요`}
        title="이제 상대의 마음을 기다려볼까요?"
      >
        이 링크 하나로, 두 분의 이야기가 나란히 이어질 거예요.
      </Heading>
      <StatementCard side={side} data={card} />
      <div className="panel">
        <h2>{doc}</h2>
        {children}
      </div>
    </>
  );
}
```

- [ ] **Step 2: `SummonsArrivedScreen.tsx`**

```tsx
import { Button, Heading, Notice } from "@/components/ui";
import { StatementSummary } from "@/features/report/StatementSummary";
import type { Statement } from "@/features/report/types";

// 링크를 받은 사람이 고소장을 읽고 답하는 방식을 고르는 화면. 고르기만 하고 확정하지 않는다.
export function SummonsArrivedScreen({
  complaint,
  onApologize,
  onCounter,
}: {
  complaint: Statement;
  onApologize: () => void;
  onCounter: () => void;
}) {
  return (
    <>
      <Heading label="당신에게 소환장이 도착했어요" title="조금 서운했대요.">
        너무 걱정 말아요. 먼저 마음을 읽어보고,{"\n"}당신의 이야기도 들려주면 돼요.
      </Heading>
      <StatementSummary data={complaint} />
      <div className="actions">
        <Button className="action-minor font-kkubulim" onClick={onApologize}>
          내가 미안
        </Button>
        <Button
          secondary
          className="action-major font-kkubulim font-kkubulim-lg"
          onClick={onCounter}
        >
          나도 할 말 있음
        </Button>
      </div>
      <Notice>
        어떤 걸 선택해도 괜찮아요. 저는 누가 옳은지 가리려는 게 아니라, 두
        분이 다시 이야기 나누길 바랄 뿐이에요.
      </Notice>
    </>
  );
}
```

- [ ] **Step 3: `WaitingScreen.tsx`**

```tsx
import type { ReactNode } from "react";
import { Heading, Notice } from "@/components/ui";

export function WaitingScreen({
  label = "심리 대기 중",
  title = "상대가 지금 마음을 정리하고 있어요.",
  children,
}: {
  label?: string;
  title?: string;
  children?: ReactNode;
}) {
  return (
    <>
      <Heading label={label} title={title}>
        준비가 되면 같은 사건 링크에서 결과를 함께 확인할 수 있어요.
      </Heading>
      <Notice>다른 사람의 작성 중 진술은 표시하지 않습니다.</Notice>
      {children}
    </>
  );
}
```

- [ ] **Step 4: `CounterclaimResult.tsx`**

```tsx
import type { ReactNode } from "react";
import { Heading } from "@/components/ui";
import { StatementCard } from "@/features/report/StatementCard";
import type { Statement } from "@/features/report/types";

// 양측 카드와 중재 정리. 정리를 새로 만들지(체험) 저장된 것을 보여줄지(링크)는 report로 받는다.
export function CounterclaimResult({
  a,
  b,
  mine,
  report,
}: {
  a: Statement;
  b: Statement;
  mine: "A" | "B";
  report: ReactNode;
}) {
  return (
    <>
      <Heading label="양측 진술 대질" title="다른 마음을, 나란히.">
        두 분이 각자 무엇을 바랐는지, 제가 곁에서 함께 짚어드릴게요.
      </Heading>
      <div className="report-grid">
        <StatementCard side="A" data={a} mine={mine === "A"} />
        <StatementCard side="B" data={b} mine={mine === "B"} />
      </div>
      {report}
    </>
  );
}
```

- [ ] **Step 5: `ApologyResult.tsx`**

```tsx
import type { ReactNode } from "react";
import { Heading, Notice } from "@/components/ui";
import type { Statement } from "@/features/report/types";

// 서버에 저장된 사과문은 선택 항목이 null로 올 수 있다.
export type ApologyView = {
  body: string;
  understood_point?: string | null;
  admitted_point?: string | null;
  future_commitment?: string | null;
};

export function ApologyResult({
  complaint,
  apology,
  children,
}: {
  complaint: Statement;
  apology: ApologyView;
  children: ReactNode;
}) {
  return (
    <>
      <Heading label="심리 종결 · 화해 성립" title="미안한 마음이 도착했어요.">
        여기까지 오느라 고생 많았어요. 두 분의 이야기를 천천히 읽어봐요.
      </Heading>
      <Notice>
        신청인(A)의 사건: {complaint.incident_summary || complaint.incident_description}
      </Notice>
      <article className="card side-B">
        <img src="/images/apple.png" alt="" className="apology-icon" />
        <h2 className="doc-title">사 과 문</h2>
        <p className="doc-case">마음을 담아 보내요.</p>
        {apology.understood_point && (
          <>
            <h3>내가 이해한 상대의 마음</h3>
            <p>{apology.understood_point}</p>
          </>
        )}
        {apology.admitted_point && (
          <>
            <h3>내가 인정하는 부분</h3>
            <p>{apology.admitted_point}</p>
          </>
        )}
        <h3>상대에게 전하는 사과</h3>
        <p>{apology.body}</p>
        {apology.future_commitment && (
          <>
            <h3>다음에는 이렇게 할게</h3>
            <p>{apology.future_commitment}</p>
          </>
        )}
      </article>
      <section className="panel">
        <h2>사건 종결</h2>
        {children}
      </section>
      <Notice>
        ‘화해 성립’은 답변이 끝났다는 뜻이에요. 사과를 꼭 받아들여야 한다는
        의미는 아니니, 마음은 두 분의 속도대로 나아가면 돼요.
      </Notice>
    </>
  );
}
```

- [ ] **Step 6: `CaseGoneScreen.tsx`**

```tsx
import type { ReactNode } from "react";
import { Heading } from "@/components/ui";

export function CaseGoneScreen({
  kind,
  children,
}: {
  kind: "expired" | "missing";
  children: ReactNode;
}) {
  const expired = kind === "expired";
  return (
    <>
      <Heading
        label="링크 안내"
        title={expired ? "이 사건의 보관 기간이 끝났어요." : "이 사건을 찾을 수 없어요."}
      >
        {expired
          ? "아쉽지만 파기된 사건 내용은 다시 볼 수 없어요. 그래도 그 마음은 잘 전해졌을 거예요."
          : "혹시 링크가 올바른지 한 번만 더 확인해 줄래요?"}
      </Heading>
      <div className="empty">{expired ? "" : "?"}</div>
      {children}
    </>
  );
}
```

- [ ] **Step 7: `StartScreen`에 `notice` prop**

props 부분을 다음으로 바꾼다.

```tsx
export function StartScreen({
  entryMode = "new",
  resultTab = "apology",
  notice = (
    <>
      판결문(결과물)은 <strong>7일 후 파기</strong>돼요. 지금은 저장·공유되지
      않는 와이어프레임 체험입니다.
    </>
  ),
  onStart,
}: {
  entryMode?: EntryMode;
  resultTab?: ResultEnding;
  notice?: ReactNode;
  onStart: (ending?: ResultEnding) => void;
}) {
```

본문의

```tsx
      <p className="notice">
        판결문(결과물)은 <strong>7일 후 파기</strong>돼요. 지금은 저장·공유되지
        않는 와이어프레임 체험입니다.
      </p>
```

를 다음으로 바꾼다.

```tsx
      <p className="notice">{notice}</p>
```

- [ ] **Step 8: `CaseController`에서 추출한 화면 사용**

import 블록에 추가한다(기존 import는 유지하고, 더 이상 쓰지 않는 것은 Step 9에서 정리).

```tsx
import { ApologyResult } from "./screens/ApologyResult";
import { CaseGoneScreen } from "./screens/CaseGoneScreen";
import { CounterclaimResult } from "./screens/CounterclaimResult";
import { SummonsArrivedScreen } from "./screens/SummonsArrivedScreen";
import { SummonsSentScreen } from "./screens/SummonsSentScreen";
import { WaitingScreen } from "./screens/WaitingScreen";
```

`const counterclaimResultContent = ( ... );` 전체를 다음으로 바꾼다.

```tsx
  const counterclaimResultContent = (
    <CounterclaimResult
      a={a}
      b={b}
      mine="B"
      report={<MediationSummary a={a} b={b} />}
    />
  );
```

`const apologyResultContent = ( ... );` 전체를 다음으로 바꾼다.

```tsx
  const apologyResultContent = (
    <ApologyResult complaint={a} apology={apology}>
      <p>
        B의 사과문 작성이 끝났어요. 위 카드에는 직접 적은 내용만 담았고,
        AI가 사과나 약속을 추가하지 않았어요.
      </p>
      <Notice>
        현재 브라우저 안의 체험 결과예요. 실제 상대에게 전송되거나 DB에
        저장되지는 않았어요.
      </Notice>
    </ApologyResult>
  );
```

`case "소환장 발송":` 블록의 `content = ( ... );`를 다음으로 바꾼다.

```tsx
      content = (
        <SummonsSentScreen side="A" card={a}>
          <p className="placeholder">/case/〈사건 링크가 표시될 자리〉</p>
          <Notice>실제 링크 발급·공유는 API 연결 후 제공됩니다.</Notice>
          <div className="actions">
            <Button onClick={() => showToast("링크 복사됨")}>
              소환장 링크 복사
            </Button>
            <Button secondary disabled>
              공유하기
            </Button>
          </div>
          <Notice>
            상대의 답변을 기다리는 중 · 판결문은 7일간 보관돼요 (기준 시각
            미정)
          </Notice>
          <Button onClick={() => setScreen("소환장 도착")}>
            피고가 받는 화면 체험하기 →
          </Button>
        </SummonsSentScreen>
      );
```

`case "맞고소장 발송":` 블록의 `content = ( ... );`를 다음으로 바꾼다.

```tsx
      content = (
        <SummonsSentScreen side="B" card={b}>
          <p className="placeholder">/case/〈사건 링크가 표시될 자리〉</p>
          <Notice>실제 링크 발급·공유는 API 연결 후 제공됩니다.</Notice>
          <div className="actions">
            <Button onClick={() => showToast("링크 복사됨")}>
              맞고소장 링크 복사
            </Button>
            <Button secondary disabled>
              공유하기
            </Button>
          </div>
          <Notice>
            상대의 답변을 기다리는 중 · 판결문은 7일간 보관돼요 (기준 시각 미정)
          </Notice>
          <Button
            onClick={() => {
              setEntryMode("result");
              setScreen("사건 접수");
            }}
          >
            원고가 받는 화면 체험하기 →
          </Button>
        </SummonsSentScreen>
      );
```

`case "소환장 도착":` 블록의 `content = ( ... );`를 다음으로 바꾼다.

```tsx
      content = (
        <SummonsArrivedScreen
          complaint={a}
          onApologize={() => setScreen("사과문 작성")}
          onCounter={() => setScreen("피고 진술")}
        />
      );
```

`case "심리 대기":` 블록의 `content = ( ... );`를 다음으로 바꾼다.

```tsx
      content = (
        <WaitingScreen>
          <Button secondary onClick={() => setScreen("양측 대질")}>
            종결 화면 체험
          </Button>
        </WaitingScreen>
      );
```

`default:` 블록의 `content = ( ... );`를 다음으로 바꾼다.

```tsx
      content = (
        <CaseGoneScreen kind={screen === "기록 파기" ? "expired" : "missing"}>
          <Button onClick={() => setScreen("사건 접수")}>
            새 사건 접수하기
          </Button>
        </CaseGoneScreen>
      );
```

- [ ] **Step 9: 쓰지 않게 된 import 정리**

Run: `cd frontend && npm run lint`
lint가 `no-unused-vars` 경고로 알려주는 `CaseController.tsx`의 import(예상: `StatementCard`)만 지운다. 이 경고는 에러가 아니어서 lint가 통과해도 남으므로, 경고 목록에 `<img>` 3건 외에 없는지 본다. `MediationSummary`, `StatementSummary`(피고 진술에서 사용), `Heading`(서기 오류 등에서 사용)은 남는다.

- [ ] **Step 10: 확인**

Run: `cd frontend && npx tsc --noEmit && npm run lint && npm run build`
Expected: 성공, lint 에러 0 (`<img>` 경고 3건 — 사과 아이콘 경고는 `ApologyResult.tsx`로 위치만 바뀜)

`/wireframe`을 새로고침하고 Task 1 Step 2 스크립트를 실행한다.
Expected: 8개 해시가 모두 기준값과 같음. 다르면 해당 화면의 `outerHTML`을 변경 전(`git stash`로 되돌려 실행)과 비교해 원인을 고친다.

추가로 눈으로 확인: 시작화면 1/2/3 버튼, `화해 성립`의 사과 아이콘, `소환장 도착`의 "고소장 보기" 토글.

- [ ] **Step 11: 커밋**

```bash
git add frontend/src/features/case/screens frontend/src/features/case/StartScreen.tsx frontend/src/features/case/CaseController.tsx
git commit -m "refactor(frontend): 체험판 화면을 공통 화면 컴포넌트로 추출" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: 사건 저장 API와 B 제출 순서

**Files:**
- Modify: `frontend/src/lib/api/cases.ts`
- Test: `frontend/tests/cases.test.mjs`

**Interfaces:**
- Consumes: 기존 `CaseApiError`, `casePath`, `parseCaseView`, `readCase`, `request`, `Statement`, `Apology` 타입
- Produces:
  - `type ResponseKind = "APOLOGY" | "COUNTER"`
  - `submitStatement(token: string, side: "A" | "B", card: Statement, writer: string | null, signal?: AbortSignal): Promise<CaseView>`
  - `chooseResponseType(token: string, type: ResponseKind, signal?: AbortSignal): Promise<CaseView>`
  - `submitApology(token: string, apology: Apology, signal?: AbortSignal): Promise<CaseView>`
  - `canResumeAfterConflict(status: CaseStatus, kind: ResponseKind): boolean`
  - `respond(token: string, kind: ResponseKind, submit: () => Promise<CaseView>, signal?: AbortSignal): Promise<CaseView>`

- [ ] **Step 1: 실패하는 테스트 추가**

`frontend/tests/cases.test.mjs` 끝에 추가한다.

```js
const cardA = () => ({ incident_description: "사건", emotions: [], emotion_reason: "", desired_outcome: "바람" });
const report = () => ({ common_ground: [], different_views: [], hurt_points_a: [], hurt_points_b: [], possible_misunderstanding: null, conversation_starter: "대화" });
const view = (status, extra = {}) => ({
  status, viewer_role: "B", expires_at: expires(), available_actions: [],
  content: { cards: { A: cardA() }, report: null, apology: null }, ...extra,
});
const draftCard = () => ({ ...cardA(), emotions: ["서운함"], sourceMode: "local" });
// POST 경로별로 응답을 정하고 호출 순서를 기록한다.
function route(handlers) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const key = (init.method ?? "GET") + " " + url.replace("/api/cases/" + publicToken, "");
    calls.push(key);
    const handler = handlers[key];
    if (!handler) throw new Error("unexpected " + key);
    return handler(init);
  };
  return calls;
}

test("A statement sends the writer only in the header and strips display fields", async () => {
  route({ "POST /statement": init => {
    assert.equal(init.cache, "no-store");
    assert.equal(init.referrerPolicy, "no-referrer");
    assert.equal(init.headers["Content-Type"], "application/json");
    assert.equal(init.headers["X-Writer-Token"], writerToken);
    assert.ok(!init.body.includes(writerToken));
    const body = JSON.parse(init.body);
    assert.equal(body.side, "A");
    assert.equal(body.card.sourceMode, undefined);
    assert.deepEqual(body.card.emotions, ["서운함"]);
    return Response.json(view("AWAITING_RESPONSE", { viewer_role: "A" }));
  } });
  assert.equal((await api.submitStatement(publicToken, "A", draftCard(), writerToken)).status, "AWAITING_RESPONSE");
});
test("B statement never sends a writer header", async () => {
  route({ "POST /statement": init => {
    assert.equal(init.headers["X-Writer-Token"], undefined);
    assert.equal(JSON.parse(init.body).side, "B");
    return Response.json(view("COUNTER_COMPLETED", { content: { cards: { A: cardA(), B: cardA() }, report: report(), apology: null } }));
  } });
  assert.equal((await api.submitStatement(publicToken, "B", draftCard(), writerToken)).status, "COUNTER_COMPLETED");
});
test("B statement waits longer than other writes", async () => {
  const original = AbortSignal.timeout;
  const seen = [];
  AbortSignal.timeout = ms => { seen.push(ms); return original.call(AbortSignal, ms); };
  try {
    route({
      "POST /statement": () => Response.json(view("AWAITING_RESPONSE")),
      "POST /response-type": () => Response.json(view("APOLOGY_DRAFT")),
      "POST /apology": () => Response.json(view("APOLOGY_COMPLETED")),
    });
    await api.submitStatement(publicToken, "B", draftCard(), null);
    await api.submitStatement(publicToken, "A", draftCard(), writerToken);
    await api.chooseResponseType(publicToken, "APOLOGY");
    await api.submitApology(publicToken, { body: "미안해", understood_point: "", admitted_point: "", future_commitment: "" });
  } finally { AbortSignal.timeout = original; }
  assert.deepEqual(seen, [60000, 15000, 15000, 15000]);
});
test("response type and apology bodies", async () => {
  route({
    "POST /response-type": init => { assert.deepEqual(JSON.parse(init.body), { response_type: "COUNTER" }); return Response.json(view("COUNTER_DRAFT")); },
    "POST /apology": init => {
      assert.deepEqual(JSON.parse(init.body), { body: "미안해", understood_point: null, admitted_point: "늦었어", future_commitment: null });
      return Response.json(view("APOLOGY_COMPLETED"));
    },
  });
  assert.equal((await api.chooseResponseType(publicToken, "COUNTER")).status, "COUNTER_DRAFT");
  await api.submitApology(publicToken, { body: "미안해", understood_point: "  ", admitted_point: "늦었어", future_commitment: "" });
});
for (const [status, message] of [[403, "작성 권한을 확인하지 못했어요."], [409, "이미 제출된 사건이에요."], [422, "입력을 확인해주세요."], [502, "밤톨이 정리하지 못했어요. 다시 시도해주세요."]])
  test("write HTTP " + status + " becomes a safe typed error", async () => {
    globalThis.fetch = async () => new Response("secret provider detail", { status });
    await assert.rejects(api.submitStatement(publicToken, "B", draftCard(), null), e => e.status === status && e.message === message);
  });
test("write network failure is not retried", async () => {
  let count = 0;
  globalThis.fetch = async () => { count++; throw new Error("sensitive"); };
  await assert.rejects(api.submitApology(publicToken, { body: "미안해", understood_point: "", admitted_point: "", future_commitment: "" }), e => e.status === 0);
  assert.equal(count, 1);
});
test("writes reject invalid tokens before any request", async () => {
  globalThis.fetch = async () => { throw new Error("must not be called"); };
  await assert.rejects(api.chooseResponseType("../x", "APOLOGY"), e => e.status === 404);
});
test("resume after conflict only for the same pending choice", () => {
  assert.equal(api.canResumeAfterConflict("APOLOGY_DRAFT", "APOLOGY"), true);
  assert.equal(api.canResumeAfterConflict("COUNTER_DRAFT", "COUNTER"), true);
  for (const status of ["COUNTER_DRAFT", "AWAITING_RESPONSE", "APOLOGY_COMPLETED", "COUNTER_COMPLETED", "DRAFT"])
    assert.equal(api.canResumeAfterConflict(status, "APOLOGY"), false);
  assert.equal(api.canResumeAfterConflict("APOLOGY_DRAFT", "COUNTER"), false);
});
test("respond chooses then submits", async () => {
  const calls = route({
    "POST /response-type": () => Response.json(view("APOLOGY_DRAFT")),
    "POST /apology": () => Response.json(view("APOLOGY_COMPLETED")),
  });
  const result = await api.respond(publicToken, "APOLOGY", () => api.submitApology(publicToken, { body: "미안해", understood_point: "", admitted_point: "", future_commitment: "" }));
  assert.equal(result.status, "APOLOGY_COMPLETED");
  assert.deepEqual(calls, ["POST /response-type", "POST /apology"]);
});
test("respond resumes when the same choice was already recorded", async () => {
  const calls = route({
    "POST /response-type": () => new Response("", { status: 409 }),
    "GET ": () => Response.json(view("COUNTER_DRAFT")),
    "POST /statement": () => Response.json(view("COUNTER_COMPLETED", { content: { cards: { A: cardA(), B: cardA() }, report: report(), apology: null } })),
  });
  const result = await api.respond(publicToken, "COUNTER", () => api.submitStatement(publicToken, "B", draftCard(), null));
  assert.equal(result.status, "COUNTER_COMPLETED");
  assert.deepEqual(calls, ["POST /response-type", "GET ", "POST /statement"]);
});
test("respond stops when the other choice was recorded", async () => {
  const calls = route({
    "POST /response-type": () => new Response("", { status: 409 }),
    "GET ": () => Response.json(view("COUNTER_DRAFT")),
  });
  await assert.rejects(api.respond(publicToken, "APOLOGY", async () => { throw new Error("must not submit"); }), e => e.status === 409);
  assert.deepEqual(calls, ["POST /response-type", "GET "]);
});
test("respond does not read or submit after other choice errors", async () => {
  const calls = route({ "POST /response-type": () => new Response("", { status: 503 }) });
  await assert.rejects(api.respond(publicToken, "APOLOGY", async () => { throw new Error("must not submit"); }), e => e.status === 503);
  assert.deepEqual(calls, ["POST /response-type"]);
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && node --test tests/cases.test.mjs`
Expected: 새 테스트 FAIL — `api.submitStatement is not a function` 등. 기존 16개는 PASS.

- [ ] **Step 3: `cases.ts` 구현**

import는 그대로 둔다(이미 `Statement`, `Apology` 타입을 import한다).

`async function request(...)` 함수 전체를 다음으로 바꾼다.

```ts
const messages: Record<number, string> = {
  403: "작성 권한을 확인하지 못했어요.",
  404: "사건을 찾을 수 없어요.",
  409: "이미 제출된 사건이에요.",
  410: "보관 기간이 끝난 사건이에요.",
  422: "입력을 확인해주세요.",
  502: "밤톨이 정리하지 못했어요. 다시 시도해주세요.",
  503: "저장 서버를 사용할 수 없어요. 잠시 후 다시 확인해주세요.",
};
async function request(path: string, init: RequestInit, signal?: AbortSignal, timeoutMs = 15000): Promise<unknown> {
  const timeout = AbortSignal.timeout(timeoutMs);
  try {
    const res = await fetch(path, { ...init, cache: "no-store", referrerPolicy: "no-referrer",
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
    if (!res.ok) throw new CaseApiError(res.status, messages[res.status] ?? "사건 서버에 연결하지 못했어요.");
    return await res.json();
  } catch (e) {
    if (signal?.aborted) throw e;
    if (e instanceof CaseApiError) throw e;
    throw new CaseApiError(0, "연결이 끊겼거나 응답이 늦어지고 있어요.");
  }
}
```

파일 끝에 추가한다.

```ts
export type ResponseKind = "APOLOGY" | "COUNTER";
// async라서 잘못된 토큰(casePath)도 동기 예외가 아니라 거부된 Promise가 된다.
async function post(token: string, action: string, body: unknown, headers: Record<string, string>, signal?: AbortSignal, timeoutMs?: number): Promise<CaseView> {
  casePath(token);
  return request("/api/cases/" + token + "/" + action,
    { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) },
    signal, timeoutMs).then(parseCaseView);
}
export function submitStatement(token: string, side: "A" | "B", card: Statement, writer: string | null, signal?: AbortSignal): Promise<CaseView> {
  // 화면 표시용 필드는 서버로 보내지 않는다.
  const shared: Statement = { ...card };
  delete shared.sourceMode;
  // 작성 권한은 A의 고소장 확정에만 필요하다. B 제출은 서버가 중재 리포트까지 만들어 오래 걸린다.
  return post(token, "statement", { side, card: shared }, side === "A" && writer ? { "X-Writer-Token": writer } : {},
    signal, side === "B" ? 60000 : 15000);
}
export function chooseResponseType(token: string, type: ResponseKind, signal?: AbortSignal): Promise<CaseView> {
  return post(token, "response-type", { response_type: type }, {}, signal);
}
export function submitApology(token: string, apology: Apology, signal?: AbortSignal): Promise<CaseView> {
  const optional = (v?: string | null) => (v && v.trim() ? v : null);
  return post(token, "apology", { body: apology.body, understood_point: optional(apology.understood_point),
    admitted_point: optional(apology.admitted_point), future_commitment: optional(apology.future_commitment) }, {}, signal);
}
export function canResumeAfterConflict(status: CaseStatus, kind: ResponseKind): boolean {
  return status === (kind === "APOLOGY" ? "APOLOGY_DRAFT" : "COUNTER_DRAFT");
}
// B의 선택은 최종 제출 때 확정한다. 선택만 저장되고 제출이 실패했던 경우 같은 선택이면 제출을 이어간다.
export async function respond(token: string, kind: ResponseKind, submit: () => Promise<CaseView>, signal?: AbortSignal): Promise<CaseView> {
  try {
    await chooseResponseType(token, kind, signal);
  } catch (e) {
    if (!(e instanceof CaseApiError) || e.status !== 409) throw e;
    const current = await readCase(token, null, signal);
    if (!canResumeAfterConflict(current.status, kind)) throw e;
  }
  return submit();
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && node --test tests/cases.test.mjs && npx tsc --noEmit`
Expected: 전체 PASS (기존 16 + 신규 15 = 31), tsc 성공

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/lib/api/cases.ts frontend/tests/cases.test.mjs
git commit -m "feat(frontend): 사건 저장 API와 B 제출 순서(respond) 추가" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: 작성 권한을 localStorage로 이동

**Files:**
- Modify: `frontend/src/features/case/writerSession.ts` (전체 교체)
- Modify: `frontend/src/features/case/CreateCaseButton.tsx`
- Test: `frontend/tests/cases.test.mjs`

**Interfaces:**
- Consumes: `validToken`, `CaseCreated` (`@/lib/api/cases`)
- Produces: 기존과 같은 시그니처 — `checkWriterStorage(): void`, `rememberWriter(value: CaseCreated): void`, `getWriter(token: string): string | null`, `forgetWriter(token: string): void`

- [ ] **Step 1: 테스트를 localStorage 기준으로 바꾸기**

`frontend/tests/cases.test.mjs`에서 다음 부분을 바꾼다.

```js
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalStorage) Object.defineProperty(globalThis, "sessionStorage", originalStorage);
  else delete globalThis.sessionStorage;
});
```

→

```js
const originalStorages = Object.fromEntries(["localStorage", "sessionStorage"].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [name, descriptor] of Object.entries(originalStorages)) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
});
```

```js
function storage() {
  const values = new Map();
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k),
  } });
  return values;
}
```

→

```js
function fakeStorage(name) {
  const values = new Map();
  Object.defineProperty(globalThis, name, { configurable: true, value: {
    getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k),
  } });
  return values;
}
function storage() {
  fakeStorage("sessionStorage");
  return fakeStorage("localStorage");
}
```

기존 테스트 `"disabled storage fails preflight but viewing as B remains possible"`를 다음으로 바꾼다.

```js
test("disabled storage fails preflight but viewing as B remains possible", () => {
  for (const name of ["localStorage", "sessionStorage"])
    Object.defineProperty(globalThis, name, { configurable: true, get() { throw new Error("blocked"); } });
  assert.throws(() => session.checkWriterStorage());
  assert.equal(session.getWriter(publicToken), null);
  session.forgetWriter(publicToken);
});
```

파일 끝에 추가한다.

```js
test("writer survives in localStorage, not per tab", () => {
  const local = storage();
  session.rememberWriter(created());
  assert.equal(local.size, 1);
  assert.equal(globalThis.sessionStorage.getItem("bamtol:writer:" + publicToken), null);
  assert.equal(session.getWriter(publicToken), writerToken);
});
test("writer saved by the previous tab-scoped version is moved once", () => {
  const local = storage();
  const key = "bamtol:writer:" + publicToken;
  globalThis.sessionStorage.setItem(key, JSON.stringify({ token: writerToken, expires: expires() }));
  assert.equal(session.getWriter(publicToken), writerToken);
  assert.ok(local.has(key));
  assert.equal(globalThis.sessionStorage.getItem(key), null);
});
test("expired previous-version writer is removed, not moved", () => {
  const local = storage();
  const key = "bamtol:writer:" + publicToken;
  globalThis.sessionStorage.setItem(key, JSON.stringify({ token: writerToken, expires: "2000-01-01" }));
  assert.equal(session.getWriter(publicToken), null);
  assert.equal(local.size, 0);
  assert.equal(globalThis.sessionStorage.getItem(key), null);
});
test("forget clears both storages", () => {
  const local = storage();
  const key = "bamtol:writer:" + publicToken;
  session.rememberWriter(created());
  globalThis.sessionStorage.setItem(key, "x");
  session.forgetWriter(publicToken);
  assert.equal(local.size, 0);
  assert.equal(globalThis.sessionStorage.getItem(key), null);
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && node --test tests/cases.test.mjs`
Expected: `tokens persist…`, `writer survives…`, `writer saved by the previous…`, `forget clears both…` 등 localStorage를 기대하는 테스트가 FAIL (아직 sessionStorage에 저장). 일부 기존 테스트는 우연히 통과할 수 있다.

- [ ] **Step 3: `writerSession.ts` 교체**

```ts
import { validToken, type CaseCreated } from "@/lib/api/cases";
const prefix = "bamtol:writer:";
// 같은 브라우저라면 탭을 새로 열어도 작성자(A)로 인식되도록 localStorage에 둔다.
// 신원 인증 수단은 아니다. 다른 기기에서는 B로 보인다.
export function checkWriterStorage() {
  const key = prefix + "check";
  localStorage.setItem(key, "1");
  localStorage.removeItem(key);
}
export function rememberWriter(value: CaseCreated) {
  localStorage.setItem(prefix + value.public_token, JSON.stringify({ token: value.writer_token, expires: value.expires_at }));
}
// 유효한 원문을 돌려주고, 만료·손상된 값은 그 저장소에서 지운다.
function readValid(storage: Storage, key: string): string | null {
  const raw = storage.getItem(key);
  if (raw === null) return null;
  try {
    const v = JSON.parse(raw);
    if (validToken(v.token) && Number.isFinite(Date.parse(v.expires)) && Date.parse(v.expires) > Date.now()) return raw;
  } catch { /* 손상된 값은 아래에서 지운다. */ }
  storage.removeItem(key);
  return null;
}
export function getWriter(token: string): string | null {
  const key = prefix + token;
  try {
    let raw = readValid(localStorage, key);
    // 이전 버전은 탭 단위(sessionStorage)에 보관했다. 발견하면 한 번 옮긴다.
    if (raw === null) {
      raw = readValid(sessionStorage, key);
      if (raw !== null) {
        localStorage.setItem(key, raw);
        sessionStorage.removeItem(key);
      }
    }
    return raw === null ? null : JSON.parse(raw).token;
  } catch { return null; }
}
export function forgetWriter(token: string) {
  try { localStorage.removeItem(prefix + token); } catch { /* Storage may be disabled. */ }
  try { sessionStorage.removeItem(prefix + token); } catch { /* Storage may be disabled. */ }
}
```

- [ ] **Step 4: `CreateCaseButton` 안내 문구**

다음 두 줄을

```tsx
    <Notice>사건 번호와 작성 권한만 발급됩니다. 고소장 저장·전송은 아직 준비 중이에요.</Notice>
    <Notice>작성 권한은 이 탭에 보관돼요. 새로고침에는 유지되지만 탭을 닫거나 다른 기기로 이동하면 복구되지 않을 수 있어요. 대화는 저장하지 않아요.</Notice>
```

다음 한 줄로 바꾼다.

```tsx
    <Notice>작성 권한은 이 브라우저에 보관돼요. 다른 기기에서는 작성자로 인식되지 않아요. 대화는 저장하지 않아요.</Notice>
```

`catch` 안의 문구 `"브라우저의 탭 저장소를 사용할 수 없어요. 저장소 허용 후 다시 시도해주세요."`를 `"브라우저 저장소를 사용할 수 없어요. 저장소 허용 후 다시 시도해주세요."`로 바꾼다.

- [ ] **Step 5: 통과 확인**

Run: `cd frontend && npm test && npx tsc --noEmit && npm run lint`
Expected: 전체 PASS, tsc 성공, lint 에러 0

- [ ] **Step 6: 커밋**

```bash
git add frontend/src/features/case/writerSession.ts frontend/src/features/case/CreateCaseButton.tsx frontend/tests/cases.test.mjs
git commit -m "feat(frontend): 작성 권한을 localStorage로 옮기고 이전 값 이전" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: 단계 판정과 제출 실패 판정

**Files:**
- Create: `frontend/src/features/case/caseStage.ts`
- Test: `frontend/tests/caseStage.test.mjs`

**Interfaces:**
- Consumes: `CaseView` 타입 (`@/lib/api/cases`)
- Produces:
  - `type CaseStage = "a-draft" | "not-ready" | "a-sent" | "a-waiting" | "b-respond" | "b-apology" | "b-counter" | "result-apology" | "result-counter" | "read-only"`
  - `caseStage(view: Pick<CaseView, "status" | "viewer_role" | "available_actions">): CaseStage`
  - `failureAction(status: number): "gone" | "keep" | "reconcile"`

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/tests/caseStage.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function load(path) {
  const url = new URL(path, import.meta.url);
  const compiled = ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function("exports", "require", compiled)(exports, () => ({}));
  return exports;
}
const { caseStage, failureAction } = load("../src/features/case/caseStage.ts");
const v = (status, viewer_role, available_actions = []) => ({ status, viewer_role, available_actions });

test("stages follow status, role and server actions", () => {
  const cases = [
    [v("DRAFT", "A", ["converse", "submit_statement"]), "a-draft"],
    [v("DRAFT", "A", []), "read-only"],
    [v("DRAFT", "B"), "not-ready"],
    [v("AWAITING_RESPONSE", "A"), "a-sent"],
    [v("AWAITING_RESPONSE", "B", ["choose_response_type"]), "b-respond"],
    [v("AWAITING_RESPONSE", "B", []), "read-only"],
    [v("APOLOGY_DRAFT", "A"), "a-waiting"],
    [v("APOLOGY_DRAFT", "B", ["submit_apology"]), "b-apology"],
    [v("APOLOGY_DRAFT", "B", []), "read-only"],
    [v("COUNTER_DRAFT", "A"), "a-waiting"],
    [v("COUNTER_DRAFT", "B", ["converse", "submit_statement"]), "b-counter"],
    [v("COUNTER_DRAFT", "B", ["converse"]), "read-only"],
    [v("APOLOGY_COMPLETED", "A"), "result-apology"],
    [v("APOLOGY_COMPLETED", "B"), "result-apology"],
    [v("COUNTER_COMPLETED", "A"), "result-counter"],
    [v("COUNTER_COMPLETED", "B"), "result-counter"],
    [v("EXPIRED", "B"), "read-only"],
  ];
  for (const [view, stage] of cases) assert.equal(caseStage(view), stage, JSON.stringify(view));
});
test("B never gets a writing stage from actions meant for another status", () => {
  assert.equal(caseStage(v("AWAITING_RESPONSE", "B", ["submit_apology", "submit_statement"])), "read-only");
  assert.equal(caseStage(v("APOLOGY_DRAFT", "B", ["submit_statement"])), "read-only");
});
test("submit failures: gone, keep draft, or ask the server", () => {
  assert.equal(failureAction(404), "gone");
  assert.equal(failureAction(410), "gone");
  assert.equal(failureAction(403), "keep");
  assert.equal(failureAction(422), "keep");
  for (const status of [0, 409, 500, 502, 503, 504]) assert.equal(failureAction(status), "reconcile");
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && node --test tests/caseStage.test.mjs`
Expected: FAIL — `ENOENT … caseStage.ts`

- [ ] **Step 3: `caseStage.ts` 작성**

```ts
import type { CaseView } from "@/lib/api/cases";

export type CaseStage =
  | "a-draft"
  | "not-ready"
  | "a-sent"
  | "a-waiting"
  | "b-respond"
  | "b-apology"
  | "b-counter"
  | "result-apology"
  | "result-counter"
  | "read-only";

// 서버가 준 status·viewer_role·available_actions만 보고 정한다.
// 쓰기 단계는 서버가 그 행동을 허락했을 때만 연다. 전이 규칙을 프론트에 다시 두지 않는다.
export function caseStage(
  view: Pick<CaseView, "status" | "viewer_role" | "available_actions">,
): CaseStage {
  const can = (action: string) => view.available_actions.includes(action);
  const writer = view.viewer_role === "A";
  switch (view.status) {
    case "DRAFT":
      return writer ? (can("submit_statement") ? "a-draft" : "read-only") : "not-ready";
    case "AWAITING_RESPONSE":
      return writer ? "a-sent" : can("choose_response_type") ? "b-respond" : "read-only";
    case "APOLOGY_DRAFT":
      return writer ? "a-waiting" : can("submit_apology") ? "b-apology" : "read-only";
    case "COUNTER_DRAFT":
      return writer ? "a-waiting" : can("submit_statement") ? "b-counter" : "read-only";
    case "APOLOGY_COMPLETED":
      return "result-apology";
    case "COUNTER_COMPLETED":
      return "result-counter";
    default:
      return "read-only";
  }
}

// 제출 실패 후 할 일. POST는 응답 전에 끊겨도 저장됐을 수 있어서, 확실히 저장되지 않은
// 경우(권한·입력 오류)가 아니면 서버에 다시 물어본다.
export function failureAction(status: number): "gone" | "keep" | "reconcile" {
  if (status === 404 || status === 410) return "gone";
  if (status === 403 || status === 422) return "keep";
  return "reconcile";
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && node --test tests/caseStage.test.mjs && npm test && npx tsc --noEmit`
Expected: 3 tests PASS, 전체 PASS, tsc 성공

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/features/case/caseStage.ts frontend/tests/caseStage.test.mjs
git commit -m "feat(frontend): 링크 화면 단계 판정과 제출 실패 판정" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: 링크 화면 — 단계 분기, 제출 처리, A·B 흐름

**Files:**
- Modify: `frontend/src/features/report/PreviewScreen.tsx`
- Modify: `frontend/src/features/report/ApologyScreen.tsx`
- Create: `frontend/src/features/case/ShareCaseLink.tsx`
- Create: `frontend/src/features/case/ADraftFlow.tsx`
- Create: `frontend/src/features/case/BResponseFlow.tsx`
- Modify: `frontend/src/features/case/LinkedCaseScreen.tsx` (전체 교체)

**Interfaces:**
- Consumes: Task 2 화면 컴포넌트, `MediationPanel`/`MediationReport` (Task 1), `submitStatement`/`submitApology`/`respond`/`readCase`/`CaseApiError`/`casePath`/`CaseView` (Task 3), `getWriter`/`forgetWriter` (Task 4), `caseStage`/`failureAction`/`CaseStage` (Task 5)
- Produces:
  - `type Submit = (run: () => Promise<CaseView>) => Promise<void>` (`LinkedCaseScreen.tsx`에서 export)
  - `PreviewScreen` props: `busy?: boolean`, `submitLabel?: string`, `notice?: ReactNode` (`submitDisabled` 제거)
  - `ApologyScreen` props: `busy?: boolean`, `submitLabel?: string` (기본 `"사과문 보내기 (체험)"`), `notice?: ReactNode`, `demo?: boolean` (기본 `true`)
  - `ShareCaseLink({ token }: { token: string })`
  - `ADraftFlow({ token, busy, error, submit })`
  - `BResponseFlow({ token, complaint, stage, busy, error, submit })`

- [ ] **Step 1: `PreviewScreen` props 변경**

import 첫 줄들을 다음으로 바꾼다.

```tsx
"use client";
import { useEffect, useState, type ReactNode } from "react";
```

props 부분을 다음으로 바꾼다.

```tsx
export function PreviewScreen({
  side,
  initial,
  onConfirm,
  busy = false,
  submitLabel,
  notice,
}: {
  side: "A" | "B";
  initial: Statement;
  onConfirm: (value: Statement) => void;
  busy?: boolean;
  submitLabel?: string;
  notice?: ReactNode;
}) {
```

`{failed && <Notice>{CARD_SUMMARY_FAILED}</Notice>}` 다음 줄에 추가한다.

```tsx
      {notice}
```

접수 버튼을 다음으로 바꾼다.

```tsx
        <Button
          disabled={
            busy ||
            pending ||
            [value.incident_description, value.desired_outcome].some((v) => !v.trim())
          }
          onClick={() => onConfirm(value)}
        >
          {submitLabel ?? (side === "A" ? "고소장 접수하기" : "맞고소장 제출하기")}
        </Button>
```

- [ ] **Step 2: `ApologyScreen` props 변경**

import 첫 줄들을 다음으로 바꾼다.

```tsx
"use client";
import { useState, type ReactNode } from "react";
```

props 부분을 다음으로 바꾼다.

```tsx
export function ApologyScreen({
  summary,
  onSubmit,
  busy = false,
  submitLabel = "사과문 보내기 (체험)",
  notice,
  demo = true,
}: {
  summary: string;
  onSubmit: (value: Apology) => void;
  busy?: boolean;
  submitLabel?: string;
  notice?: ReactNode;
  demo?: boolean;
}) {
```

하단 `<div className="actions">` 블록부터 끝의 `<Notice>`까지를 다음으로 바꾼다.

```tsx
      {notice}
      <div className="actions">
        <Button secondary onClick={() => setPreview(!preview)}>
          {preview ? "수정하기" : "미리보기"}
        </Button>
        <Button disabled={busy || !value.body.trim()} onClick={() => onSubmit(value)}>
          {submitLabel}
        </Button>
      </div>
      <Notice>
        사과문 본문만 필수예요. 제출은 답변 작성의 종료를 뜻하며 상대가 사과를
        받아들였다는 뜻은 아니에요.
        {demo && " 실제 전송·저장은 아직 연결되지 않았어요."}
      </Notice>
    </>
  );
}
```

- [ ] **Step 3: `ShareCaseLink.tsx`**

```tsx
"use client";
import { useState } from "react";
import { Button, Notice } from "@/components/ui";
import { casePath } from "@/lib/api/cases";

// 실제 사건 링크 복사·공유. 클립보드가 막히면 직접 선택할 수 있는 입력칸을 보여준다.
export function ShareCaseLink({ token }: { token: string }) {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  function link() {
    return window.location.origin + casePath(token);
  }
  async function copy() {
    const value = link();
    setUrl(value);
    try {
      await navigator.clipboard.writeText(value);
      setMessage("링크를 복사했어요.");
    } catch {
      setMessage("아래 링크를 직접 선택해서 복사해주세요.");
    }
  }
  async function share() {
    if (!navigator.share) {
      await copy();
      return;
    }
    try {
      await navigator.share({ title: "밤톨에게 전한 마음", url: link() });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) await copy();
    }
  }
  return (
    <>
      <Notice>링크를 가진 사람은 사건을 열람할 수 있어요. 상대에게만 전달해주세요.</Notice>
      <div className="actions">
        <Button onClick={() => void copy()}>소환장 링크 복사</Button>
        <Button secondary onClick={() => void share()}>
          공유하기
        </Button>
      </div>
      {message && <p role="status">{message}</p>}
      {url && (
        <label className="field">
          공유 링크
          <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
        </label>
      )}
    </>
  );
}
```

- [ ] **Step 4: `ADraftFlow.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { Notice } from "@/components/ui";
import { ConversationScreen } from "@/features/conversation/ConversationScreen";
import { PreviewScreen } from "@/features/report/PreviewScreen";
import type { Statement } from "@/features/report/types";
import { submitStatement } from "@/lib/api/cases";
import type { Submit } from "./LinkedCaseScreen";
import { ShareSelectScreen } from "./ShareSelectScreen";
import { getWriter } from "./writerSession";

// A: 대화 → 공유 항목 선택 → 검토 → 접수. 작성 중 내용은 메모리에만 있다.
export function ADraftFlow({
  token,
  busy,
  error,
  submit,
}: {
  token: string;
  busy: boolean;
  error: string | null;
  submit: Submit;
}) {
  const [draft, setDraft] = useState<Statement | null>(null);
  const [selected, setSelected] = useState<Statement | null>(null);
  useEffect(() => {
    if (draft) window.scrollTo(0, 0);
  }, [draft, selected]);
  if (!draft) return <ConversationScreen side="A" onComplete={setDraft} />;
  if (!selected)
    return <ShareSelectScreen side="A" data={draft} onComplete={setSelected} />;
  return (
    <PreviewScreen
      side="A"
      initial={selected}
      busy={busy}
      submitLabel={busy ? "고소장을 접수하고 있어요…" : undefined}
      notice={error && <Notice>{error}</Notice>}
      onConfirm={(card) =>
        void submit(() => submitStatement(token, "A", card, getWriter(token)))
      }
    />
  );
}
```

- [ ] **Step 5: `BResponseFlow.tsx`**

```tsx
"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Button, Notice } from "@/components/ui";
import { ConversationScreen } from "@/features/conversation/ConversationScreen";
import { ApologyScreen } from "@/features/report/ApologyScreen";
import { PreviewScreen } from "@/features/report/PreviewScreen";
import { StatementSummary } from "@/features/report/StatementSummary";
import type { Statement } from "@/features/report/types";
import {
  respond,
  submitApology,
  submitStatement,
  type CaseView,
  type ResponseKind,
} from "@/lib/api/cases";
import type { CaseStage } from "./caseStage";
import type { Submit } from "./LinkedCaseScreen";
import { SummonsArrivedScreen } from "./screens/SummonsArrivedScreen";
import { ShareSelectScreen } from "./ShareSelectScreen";
import { StartScreen } from "./StartScreen";

type Step = "intro" | "arrived" | "apology" | "counter-talk" | "counter-select" | "counter-preview";

// B: 소환장 → 사과 또는 맞고소 작성 → 제출. 선택은 제출할 때 서버에 확정한다.
export function BResponseFlow({
  token,
  complaint,
  stage,
  busy,
  error,
  submit,
}: {
  token: string;
  complaint: Statement;
  stage: CaseStage;
  busy: boolean;
  error: string | null;
  submit: Submit;
}) {
  // 서버에 이미 확정된 선택. 이 경우 다른 쪽으로 바꿀 수 없다.
  const locked: ResponseKind | null =
    stage === "b-apology" ? "APOLOGY" : stage === "b-counter" ? "COUNTER" : null;
  const [step, setStep] = useState<Step>(
    locked === "APOLOGY" ? "apology" : locked === "COUNTER" ? "counter-talk" : "intro",
  );
  const [draft, setDraft] = useState<Statement | null>(null);
  const [selected, setSelected] = useState<Statement | null>(null);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);
  // 다른 창에서 선택이 확정됐다면 그쪽 흐름으로 보낸다.
  const chosen: ResponseKind | null =
    step === "apology" ? "APOLOGY" : step.startsWith("counter") ? "COUNTER" : null;
  const current: Step =
    locked && chosen !== locked ? (locked === "APOLOGY" ? "apology" : "counter-talk") : step;
  const send = (kind: ResponseKind, run: () => Promise<CaseView>) =>
    void submit(() => (locked ? run() : respond(token, kind, run)));
  const errorNotice = error && <Notice>{error}</Notice>;
  const header: ReactNode = locked ? (
    <Notice>
      이미 {locked === "APOLOGY" ? "사과" : "맞고소"}로 답하기로 했어요. 이어서 작성해주세요.
    </Notice>
  ) : (
    <div className="actions">
      <Button secondary disabled={busy} onClick={() => setStep("arrived")}>
        다시 고르기
      </Button>
    </div>
  );
  switch (current) {
    case "intro":
      return (
        <StartScreen
          entryMode="invited"
          notice={
            <>
              판결문(결과물)은 <strong>7일 후 파기</strong>돼요.
            </>
          }
          onStart={() => setStep("arrived")}
        />
      );
    case "arrived":
      return (
        <SummonsArrivedScreen
          complaint={complaint}
          onApologize={() => setStep("apology")}
          onCounter={() => setStep("counter-talk")}
        />
      );
    case "apology":
      return (
        <>
          {header}
          <ApologyScreen
            summary={complaint.incident_summary || complaint.incident_description}
            busy={busy}
            demo={false}
            submitLabel={busy ? "사과문을 보내고 있어요…" : "사과문 보내기"}
            notice={errorNotice}
            onSubmit={(apology) =>
              send("APOLOGY", () => submitApology(token, apology))
            }
          />
        </>
      );
    case "counter-talk":
      return (
        <>
          {header}
          <StatementSummary data={complaint} />
          <ConversationScreen
            side="B"
            sharedStatement={complaint}
            onComplete={(value) => {
              setDraft(value);
              setStep("counter-select");
            }}
          />
        </>
      );
    case "counter-select":
      return draft ? (
        <ShareSelectScreen
          side="B"
          data={draft}
          onComplete={(value) => {
            setSelected(value);
            setStep("counter-preview");
          }}
        />
      ) : null;
    case "counter-preview":
      return selected ? (
        <PreviewScreen
          side="B"
          initial={selected}
          busy={busy}
          submitLabel={
            busy ? "밤톨이 두 분의 이야기를 정리하고 있어요… (최대 1분)" : undefined
          }
          notice={errorNotice}
          onConfirm={(card) =>
            send("COUNTER", () => submitStatement(token, "B", card, null))
          }
        />
      ) : null;
  }
}
```

- [ ] **Step 6: `LinkedCaseScreen.tsx` 교체**

```tsx
"use client";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Button, Notice } from "@/components/ui";
import { MediationPanel, MediationReport } from "@/features/report/MediationReport";
import { CaseApiError, readCase, type CaseView } from "@/lib/api/cases";
import { ADraftFlow } from "./ADraftFlow";
import { BResponseFlow } from "./BResponseFlow";
import { caseStage, failureAction } from "./caseStage";
import { ShareCaseLink } from "./ShareCaseLink";
import { StartScreen } from "./StartScreen";
import { ApologyResult } from "./screens/ApologyResult";
import { CaseGoneScreen } from "./screens/CaseGoneScreen";
import { CounterclaimResult } from "./screens/CounterclaimResult";
import { SummonsSentScreen } from "./screens/SummonsSentScreen";
import { WaitingScreen } from "./screens/WaitingScreen";
import { forgetWriter, getWriter } from "./writerSession";

export type Submit = (run: () => Promise<CaseView>) => Promise<void>;

const KEEP_DRAFT = " 작성한 내용은 그대로 있어요.";
const FORBIDDEN =
  "이 브라우저에서 작성 권한을 확인하지 못했어요. 사건을 만든 브라우저에서 접수해주세요.";

export function LinkedCaseScreen({ token }: { token: string }) {
  const [view, setView] = useState<CaseView | null>(null);
  const [error, setError] = useState<CaseApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const submitting = useRef(false);
  const gone = useCallback(
    (failure: CaseApiError) => {
      forgetWriter(token);
      setView(null);
      setError(failure);
    },
    [token],
  );
  const load = useCallback(
    (controller: AbortController) => {
      return readCase(token, getWriter(token), controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) setView(result);
        })
        .catch((e) => {
          if (controller.signal.aborted) return;
          const failure = e instanceof CaseApiError ? e : new CaseApiError(0, "사건을 불러오지 못했어요.");
          if (failureAction(failure.status) === "gone") gone(failure);
          else setError(failure);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    },
    [token, gone],
  );
  const refresh = useCallback(() => {
    // 제출 중에는 화면이 바뀌지 않게 재조회하지 않는다.
    if (submitting.current) return;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    setError(null);
    void load(controller);
  }, [load]);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    active.current = controller;
    void load(controller);
    const focus = () => {
      if (mounted.current) refresh();
    };
    window.addEventListener("focus", focus);
    window.addEventListener("pageshow", focus);
    return () => {
      mounted.current = false;
      active.current?.abort();
      window.removeEventListener("focus", focus);
      window.removeEventListener("pageshow", focus);
    };
  }, [refresh, load]);
  useEffect(() => {
    if (!view) return;
    // 페이지를 열어둔 채 보관 기한이 지나도 내용을 내린다.
    const timer = setTimeout(
      () => gone(new CaseApiError(410, "보관 기간이 끝난 사건이에요.")),
      Math.max(0, Math.min(Date.parse(view.expires_at) - Date.now(), 2147483647)),
    );
    return () => clearTimeout(timer);
  }, [view, gone]);
  const submit = useCallback<Submit>(
    async (run) => {
      if (submitting.current || !view) return;
      submitting.current = true;
      // 진행 중인 조회는 취소한다. 취소된 조회는 loading을 내리지 않으므로 여기서 내린다.
      active.current?.abort();
      setLoading(false);
      setBusy(true);
      setSubmitError(null);
      setNotice(null);
      const before = caseStage(view);
      try {
        setView(await run());
      } catch (e) {
        const failure = e instanceof CaseApiError ? e : new CaseApiError(0, "연결이 끊겼거나 응답이 늦어지고 있어요.");
        const action = failureAction(failure.status);
        if (action === "gone") gone(failure);
        else if (action === "keep")
          setSubmitError((failure.status === 403 ? FORBIDDEN : failure.message) + KEEP_DRAFT);
        else {
          // 저장됐는지 모른다. 서버에 물어보고 단계가 바뀌었으면 그 결과를 따른다.
          try {
            const latest = await readCase(token, getWriter(token));
            setView(latest);
            if (caseStage(latest) !== before)
              setNotice(
                failure.status === 409
                  ? "이미 제출된 사건이에요. 최신 상태를 보여드릴게요."
                  : "제출이 확인됐어요.",
              );
            else setSubmitError(failure.message + KEEP_DRAFT + " 다시 제출해주세요.");
          } catch (again) {
            if (again instanceof CaseApiError && failureAction(again.status) === "gone") gone(again);
            else setSubmitError(failure.message + KEEP_DRAFT + " 다시 제출해주세요.");
          }
        }
      } finally {
        submitting.current = false;
        setBusy(false);
      }
    },
    [token, view, gone],
  );

  if (loading && !view) return <p role="status">사건을 확인하고 있어요…</p>;
  if (error && !view) {
    if (failureAction(error.status) === "gone")
      return (
        <section className="screen">
          <CaseGoneScreen kind={error.status === 410 ? "expired" : "missing"}>
            <Link className="button" href="/">
              새 사건 접수하기
            </Link>
          </CaseGoneScreen>
        </section>
      );
    return (
      <section className="screen">
        <h1>잠깐, 연결을 확인해주세요.</h1>
        <p role="alert">{error.message}</p>
        <Button onClick={refresh}>다시 확인하기</Button>
        <Link href="/">처음으로</Link>
      </section>
    );
  }
  if (!view) return null;

  const stage = caseStage(view);
  const cards = view.content?.cards ?? {};
  const until = new Date(view.expires_at).toLocaleString("ko-KR");
  const refreshButton = (
    <Button secondary disabled={loading || busy} onClick={refresh}>
      사건 상태 새로 확인하기
    </Button>
  );
  const destroyNotice = (
    <>
      판결문(결과물)은 <strong>{until}</strong>에 파기돼요.
    </>
  );
  function apologyResult() {
    if (!cards.A || !view?.content?.apology) return null;
    return (
      <>
        <StartScreen entryMode="result" resultTab="apology" notice={destroyNotice} onStart={() => {}} />
        <ApologyResult complaint={cards.A} apology={view.content.apology}>
          <p>
            B의 사과문이 저장됐어요. 위 카드에는 직접 적은 내용만 담았고, AI가
            사과나 약속을 추가하지 않았어요.
          </p>
        </ApologyResult>
      </>
    );
  }
  function counterResult() {
    if (!cards.A || !cards.B || !view?.content?.report) return null;
    return (
      <>
        <StartScreen entryMode="result" resultTab="counterclaim" notice={destroyNotice} onStart={() => {}} />
        <CounterclaimResult
          a={cards.A}
          b={cards.B}
          mine={view.viewer_role}
          report={
            <MediationPanel>
              <MediationReport
                report={view.content.report}
                notice="저장된 중재 정리예요. 누가 옳은지 판결하지 않아요."
              />
            </MediationPanel>
          }
        />
      </>
    );
  }
  function waiting(title?: string, label?: string) {
    return (
      <WaitingScreen title={title} label={label}>
        {refreshButton}
      </WaitingScreen>
    );
  }
  function body() {
    switch (stage) {
      case "a-draft":
        return <ADraftFlow token={token} busy={busy} error={submitError} submit={submit} />;
      case "not-ready":
        return waiting("아직 고소장이 접수되지 않았어요.", "심리 준비 중");
      case "a-sent":
        return cards.A ? (
          <SummonsSentScreen side="A" card={cards.A}>
            <ShareCaseLink token={token} />
            <Notice>상대의 답변을 기다리는 중 · {until}까지 보관돼요</Notice>
            {refreshButton}
          </SummonsSentScreen>
        ) : (
          waiting()
        );
      case "a-waiting":
        return waiting();
      case "b-respond":
      case "b-apology":
      case "b-counter":
        return cards.A ? (
          <BResponseFlow
            token={token}
            complaint={cards.A}
            stage={stage}
            busy={busy}
            error={submitError}
            submit={submit}
          />
        ) : (
          waiting()
        );
      case "result-apology":
        return apologyResult() ?? waiting();
      case "result-counter":
        return counterResult() ?? waiting();
      case "read-only":
        return apologyResult() ?? counterResult() ?? waiting();
    }
  }
  // B의 세 단계는 같은 흐름이다. 선택만 확정되고 제출이 실패해 단계가 바뀌어도 작성 중 내용을 지키려고 key를 같게 둔다.
  const flowKey = stage.startsWith("b-") ? "b" : stage;
  return (
    <div className="screen" aria-busy={loading || busy}>
      {notice && <Notice>{notice}</Notice>}
      {error && <p role="alert">{error.message} 작성 중 내용은 그대로 두었어요.</p>}
      <Fragment key={flowKey}>{body()}</Fragment>
    </div>
  );
}
```

- [ ] **Step 7: 정적 확인**

Run: `cd frontend && npx tsc --noEmit && npm run lint && npm run build && npm test`
Expected: tsc 성공, lint 에러 0, build 성공, 테스트 전체 PASS.

자주 나올 수 있는 문제:
- `react-hooks/set-state-in-effect`: effect 안에서 동기 `setState`가 있으면 안 된다. `load`는 promise 콜백에서만 상태를 바꾼다.
- `react-hooks/exhaustive-deps` 경고: 위 코드의 의존성 배열을 그대로 쓴다.
- `BResponseFlow`의 `switch`가 모든 `Step`을 다루므로 반환 누락 오류가 나면 함수 끝에 `return null;`을 추가한다.

- [ ] **Step 8: 체험판 회귀 확인**

`/wireframe`에서 Task 1 Step 2 스크립트를 실행한다.
Expected: 8개 해시 기준값과 같음. `사과문 작성` 화면 하단 안내에 "실제 전송·저장은 아직 연결되지 않았어요."가 그대로 있고, `고소장 검토` 버튼이 "고소장 접수하기"인지 눈으로 확인한다.

- [ ] **Step 9: 커밋**

```bash
git add frontend/src/features/report/PreviewScreen.tsx frontend/src/features/report/ApologyScreen.tsx frontend/src/features/case/ShareCaseLink.tsx frontend/src/features/case/ADraftFlow.tsx frontend/src/features/case/BResponseFlow.tsx frontend/src/features/case/LinkedCaseScreen.tsx
git commit -m "feat(frontend): 링크 화면에서 A 접수와 B 사과·맞고소 제출 연결" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: 로컬 Supabase로 전체 흐름 검증

**Files:** 코드 변경 없음 (발견한 문제는 해당 파일을 고치고 이 태스크 끝에 함께 커밋)

**Interfaces:**
- Consumes: Task 1~6 전체, 백엔드 `/api/cases/*`, `supabase/migrations/*`
- Produces: 검증 결과 (Task 8 문서에 기록)

- [ ] **Step 1: Docker Desktop 실행 확인**

Run: `docker info >/dev/null 2>&1 && echo running || echo stopped`
Expected: `running`. `stopped`면 사용자에게 Docker Desktop을 켜 달라고 요청하고 기다린다.

- [ ] **Step 2: 로컬 Supabase 시작**

Run: `cd /Users/sanggyoon/Documents/Wanted_Championship && supabase start`
Expected: 마지막에 `DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres` 출력. 마이그레이션이 자동 적용된다.

확인: `supabase migration list --local`
Expected: `supabase/migrations/`의 모든 버전이 Local 열에 표시

- [ ] **Step 3: 서버 실행 (운영 DB 아님을 확인)**

터미널 1:
`cd backend && DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres CONVERSATION_USE_LOCAL=true uv run uvicorn app.main:app --port 8000`

터미널 2: `cd frontend && npm run dev`

확인: `curl -s -X POST http://127.0.0.1:8000/api/cases | head -c 80`
Expected: `{"public_token":"…` (201)

- [ ] **Step 4: 두 사용자 준비**

브라우저 저장소는 출처(origin)별로 나뉜다. **A는 `http://localhost:3000`**, **B는 `http://127.0.0.1:3000`**에서 연다. 같은 브라우저라도 B 쪽에는 작성 권한이 없다.

A 대화에서 local 모드가 한 번에 초안을 준비하도록 쓸 문장:
`어제 남자친구가 약속 시간에 연락 없이 한 시간 늦었어. 기다리는 동안 너무 서운하고 걱정됐어. 내 시간이 중요하지 않은 것 같아서 속상했어. 다음엔 늦을 것 같으면 미리 연락해줬으면 좋겠어.`
준비가 안 되면 밤톨의 질문에 짧게 답해 "고소장 초안 확인하기"가 나올 때까지 진행한다.

- [ ] **Step 5: 시나리오 1 — A 접수**

1. `http://localhost:3000` → 시작하기 → 대화 → 공유 항목 선택 → 검토 → "고소장 접수하기"
2. Expected: A 화면이 `소환장, 준비됐어요`로 바뀌고 링크 복사·공유와 "상대의 답변을 기다리는 중"이 보인다.
3. 링크의 `/case/<token>` 부분을 복사해 B용으로 `http://127.0.0.1:3000/case/<token>` 열기
4. Expected: B는 시작화면2("당신에게 소환장이 도착했어요") → "이야기 확인하기" → 소환장 도착(죄명·요약, "내가 미안"/"나도 할 말 있음")

- [ ] **Step 6: 시나리오 5 — A 새 탭**

`http://localhost:3000/case/<token>`을 새 탭에서 연다.
Expected: B 화면이 아니라 A의 `소환장, 준비됐어요`.

- [ ] **Step 7: 시나리오 4 + 2 — 선택 바꾸기 후 사과 제출**

1. B: "나도 할 말 있음" → "다시 고르기" → "내가 미안"
2. B: 사과문 본문 입력 → "사과문 보내기"
3. Expected: B 화면이 시작화면3 + `화해 성립`(사과 아이콘, 입력한 사과문, 파기 시각). 하단 안내에 "아직 연결되지 않았어요" 문구가 없다.
4. A 탭으로 돌아가 포커스 → Expected: 같은 `화해 성립` 결과

- [ ] **Step 8: 시나리오 3 — 맞고소 제출**

1. 새 사건을 A로 만들고 Step 5 1~3을 반복한다.
2. B: "나도 할 말 있음" → 피고 진술(대화) → 맞고소 항목 선택 → 맞고소장 검토 → "맞고소장 제출하기"
3. Expected: 제출 중 버튼 "밤톨이 두 분의 이야기를 정리하고 있어요… (최대 1분)", 완료 후 시작화면3 + `양측 진술 대질` + "저장된 중재 정리예요" 리포트. B 카드에 "내가 쓴 고소장" 뱃지.
4. A 탭 포커스 → Expected: 같은 결과, A 카드에 "내가 쓴 고소장" 뱃지.
5. 백엔드 터미널 로그에서 이 화면들을 여는 동안 `/api/mediation/report` 요청이 **없는지** 확인한다.

- [ ] **Step 9: 시나리오 6 — 제출 중 백엔드 중단**

1. 새 사건, A 접수 후 B로 사과문 작성 화면까지 진행하고 본문을 입력한다.
2. 백엔드 터미널에서 서버를 멈춘다(Ctrl+C).
3. B: "사과문 보내기"
4. Expected: 입력한 사과문이 그대로 있고 "…작성한 내용은 그대로 있어요. 다시 제출해주세요." 안내
5. 백엔드를 Step 3 명령으로 다시 켜고 "사과문 보내기"
6. Expected: `화해 성립`

- [ ] **Step 10: 시나리오 7 — 이미 제출된 사건에 다시 제출**

포커스 복귀 재조회가 먼저 일어나면 409 경로를 볼 수 없으므로, 탭 2의 조회만 잠시 막는다.

1. 새 사건, A 접수 후 B 링크를 `127.0.0.1` **탭 두 개**로 연다(둘 다 B).
2. 두 탭 모두 사과문 작성 화면까지 진행하고 본문을 입력한다.
3. 탭 2 콘솔에서 조회(GET)만 실패하게 만든다.

```js
window.__blockRead = true;
const originalFetch = window.fetch;
window.fetch = (url, init) =>
  window.__blockRead && !init?.method ? Promise.reject(new TypeError("blocked for test")) : originalFetch(url, init);
```

4. 탭 1에서 "사과문 보내기" → `화해 성립`
5. 탭 2로 전환한다. 포커스 재조회가 실패해 연결 안내가 떠도 작성 중인 사과문은 남아 있어야 한다.
6. 탭 2 콘솔에서 `window.__blockRead = false`를 실행하고 "사과문 보내기"를 누른다.
7. Expected: 409 → 재조회 → "이미 제출된 사건이에요. 최신 상태를 보여드릴게요." + `화해 성립`

- [ ] **Step 11: 정리**

서버 두 개를 멈추고 `supabase stop`을 실행한다(데이터는 로컬 볼륨에만 있다).

발견한 문제를 고쳤다면:

Run: `cd frontend && npx tsc --noEmit && npm run lint && npm run build && npm test`

```bash
git add <고친 파일>
git commit -m "fix(frontend): 링크 흐름 로컬 검증에서 발견한 문제 수정" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: 문서 반영

**Files:**
- Modify: `docs/Case_Link_Integration.md`
- Modify: `docs/API_Design.md`
- Modify: `docs/progress/2026-09-17.md`

**Interfaces:**
- Consumes: Task 1~7 결과
- Produces: 없음

- [ ] **Step 1: `Case_Link_Integration.md` 구현 범위**

`- DRAFT의 A는 기존 AI 대화 → 공유 항목 선택 → 초안 검토까지 가능.`부터 `새로운 AI 리포트를 임의로 생성하지 않는다.`까지 세 줄을 다음으로 바꾼다.

```markdown
- 저장 API 연결 (2026-09-17): A 접수(`statement` A), B 사과(`response-type` → `apology`),
  B 맞고소(`response-type` → `statement` B). 단계는 `caseStage`가 status·viewer_role·
  available_actions로 정한다 (`docs/superpowers/specs/2026-09-17-case-link-flow-design.md` §5).
- B의 사과/맞고소 선택은 최종 제출 때 확정한다. 선택만 저장되고 제출이 실패했으면 같은 쪽으로
  이어서 작성한다.
- 제출 실패 시 403·422는 작성 내용을 유지하고, 404·410은 만료/없음 화면, 그 외는 재조회로
  저장 여부를 확인한다. POST는 자동 재시도하지 않는다.
- 완료 사건은 저장된 카드·리포트·사과만 표시한다. 새로운 AI 리포트를 임의로 생성하지 않는다.
- 화면은 체험판(`/wireframe`)과 같은 컴포넌트(`features/case/screens/`)를 쓴다.
```

- [ ] **Step 2: `Case_Link_Integration.md` 작성 권한 보관**

`## 작성 권한 보관`의 첫 세 줄

```markdown
- 사건별 writer_token과 expires_at만 sessionStorage에 보관한다.
- 같은 탭 새로고침 시 유지된다. 다른 탭/기기·탭 종료 후 권한 복구는 보장하지 않는다.
  브라우저가 복제 탭에 sessionStorage를 복사할 수 있으므로 사용자 신원 인증 수단은 아니다.
```

를 다음으로 바꾼다.

```markdown
- 사건별 writer_token과 expires_at만 localStorage에 보관한다 (2026-09-17 변경).
  sessionStorage는 탭 단위라 A가 자기 링크를 새 탭에서 열면 B로 판정돼, 저장 API 연결 후
  자기 사건에 답변을 확정할 위험이 있었다.
- 이전 버전이 sessionStorage에 둔 값은 첫 조회 때 localStorage로 옮긴다.
- 같은 브라우저의 다른 탭에서는 A로 인식된다. 다른 기기에서는 B로 보인다.
  공용 기기에서는 만료 전까지 권한이 남는다. 사용자 신원 인증 수단은 아니다.
```

- [ ] **Step 3: `Case_Link_Integration.md` 남은 연결·검증**

`## 남은 연결` 절 전체를 다음으로 바꾼다.

```markdown
## 남은 연결

- 운영 환경에서 실제 AI로 맞고소 제출 시간 실측 (Nginx `proxy_read_timeout` 60초 대비)
- 접근 로그의 토큰 마스킹 (배포 작업)
- 새로고침 시 작성 중 내용 복구는 하지 않는다 (원문 비저장 원칙, PRD §14 미정)
```

`## 검증 및 실행` 절 끝에 추가한다.

```markdown

### 로컬 Supabase 전체 흐름 검증 (2026-09-17)

`supabase start` + `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres`,
백엔드 local AI 모드. A는 `http://localhost:3000`, B는 `http://127.0.0.1:3000`(저장소 분리).

| 시나리오 | 결과 |
| --- | --- |
| A 접수 → A 소환장 발송, B 소환장 도착 | (Task 7 결과 기록) |
| A가 같은 브라우저 새 탭에서 열기 → A | (기록) |
| B 사과 선택 → 다시 고르기 → 사과 제출 → 양쪽 화해 성립 | (기록) |
| B 맞고소 제출 → 양쪽 양측 대질, 저장된 리포트, 리포트 재요청 없음 | (기록) |
| 제출 중 백엔드 중단 → 작성 내용 유지 → 재제출 성공 | (기록) |
| 이미 제출된 사건에 재제출 → 최신 결과로 이동 | (기록) |
```

`(기록)` 자리는 Task 7에서 실제로 본 결과(통과/발견한 문제와 수정)로 채운다.

- [ ] **Step 4: `API_Design.md` §2**

```
프론트는 아직 AI 두 엔드포인트에만 연결돼 있다. 사건 계층(링크)은 미연결이다.
```

로 시작하는 문장을 다음으로 바꾼다.

```
프론트는 AI 엔드포인트와 사건 계층 전체(생성·조회·`statement`·`response-type`·`apology`)에
연결돼 있다 (2026-09-17, `docs/Case_Link_Integration.md`).
```

- [ ] **Step 5: `progress/2026-09-17.md`**

`## 7. 남은 것` 목록 끝에 추가한다.

```markdown
- 링크 흐름 완성(P2, `feat/case-link-flow`): 저장 API 연결, 작성 권한 localStorage 이동,
  체험판 화면 컴포넌트 추출. 운영에서 실제 AI로 맞고소 제출 시간 실측이 남았다.
```

- [ ] **Step 6: 커밋**

```bash
git add docs/Case_Link_Integration.md docs/API_Design.md docs/progress/2026-09-17.md
git commit -m "docs: 링크 흐름 완성 상태와 로컬 검증 결과 반영" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```
