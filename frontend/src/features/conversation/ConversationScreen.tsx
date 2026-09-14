"use client";
import type { Statement } from "@/features/report/types";
import { LiveConversationScreen } from "./LiveConversationScreen";

export function ConversationScreen({
  side,
  sharedStatement,
  onComplete,
}: {
  side: "A" | "B";
  sharedStatement?: Statement;
  onComplete: (value: Statement) => void;
}) {
  return (
    <LiveConversationScreen
      side={side}
      sharedStatement={sharedStatement}
      onComplete={onComplete}
    />
  );
}
