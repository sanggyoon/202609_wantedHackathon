"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Button, Notice } from "@/components/ui";
import { ConversationScreen } from "@/features/conversation/ConversationScreen";
import { ApologyScreen } from "@/features/report/ApologyScreen";
import { PreviewScreen } from "@/features/report/PreviewScreen";
import { StatementSummary } from "@/features/report/StatementSummary";
import type { Statement } from "@/features/report/types";
import {
  type CaseApi,
  type CaseView,
  type ResponseKind,
} from "@/lib/api/cases";
import type { CaseStage } from "./caseStage";
import type { Submit } from "./LinkedCaseScreen";
import { SummonsArrivedScreen } from "./screens/SummonsArrivedScreen";
import { StartScreen } from "./StartScreen";

export type BStep = "intro" | "arrived" | "apology" | "counter-talk" | "counter-preview";

// B: 소환장 → 사과 또는 맞고소 작성 → 제출. 선택은 제출할 때 서버에 확정한다.
export function BResponseFlow({
  token,
  api,
  seed,
  complaint,
  stage,
  busy,
  error,
  submit,
}: {
  token: string;
  api: CaseApi;
  seed?: { step?: BStep; draft?: Statement };
  complaint: Statement;
  stage: CaseStage;
  busy: boolean;
  error: string | null;
  submit: Submit;
}) {
  // 서버에 이미 확정된 선택. 이 경우 다른 쪽으로 바꿀 수 없다.
  const locked: ResponseKind | null =
    stage === "b-apology" ? "APOLOGY" : stage === "b-counter" ? "COUNTER" : null;
  const [step, setStep] = useState<BStep>(
    seed?.step ?? (locked === "APOLOGY" ? "apology" : locked === "COUNTER" ? "counter-talk" : "intro"),
  );
  const [draft, setDraft] = useState<Statement | null>(seed?.draft ?? null);
  useEffect(() => {
    // 채팅 화면은 대화창이 스스로 하단으로 스크롤한다.
    if (step !== "counter-talk") window.scrollTo(0, 0);
  }, [step]);
  // 다른 창에서 선택이 확정됐다면 그쪽 흐름으로 보낸다.
  const chosen: ResponseKind | null =
    step === "apology" ? "APOLOGY" : step.startsWith("counter") ? "COUNTER" : null;
  const current: BStep =
    locked && chosen !== locked ? (locked === "APOLOGY" ? "apology" : "counter-talk") : step;
  const send = (kind: ResponseKind, run: () => Promise<CaseView>) =>
    void submit(() => (locked ? run() : api.respond(token, kind, run)));
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
          emotion={complaint.emotion_scores}
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
          demo={false}
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
              send("APOLOGY", () => api.submitApology(token, apology))
            }
          />
        </>
      );
    case "counter-talk":
      return (
        <>
          {header}
          <StatementSummary data={complaint} demo={false} />
          <ConversationScreen
            side="B"
            sharedStatement={complaint}
            onComplete={(value) => {
              setDraft(value);
              setStep("counter-preview");
            }}
          />
        </>
      );
    case "counter-preview":
      return draft ? (
        <PreviewScreen
          side="B"
          initial={draft}
          busy={busy}
          submitLabel={
            busy ? "밤톨이 두 분의 이야기를 정리하고 있어요… (최대 1분)" : undefined
          }
          notice={errorNotice}
          onConfirm={(card) =>
            send("COUNTER", () => api.submitStatement(token, "B", card, null))
          }
        />
      ) : null;
  }
}
