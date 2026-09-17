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
