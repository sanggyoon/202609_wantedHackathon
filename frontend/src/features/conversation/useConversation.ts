"use client";
import { useEffect, useRef, useState } from "react";
import { sendConversation } from "@/lib/api/conversation";
import type { ConversationResponse, ConversationState } from "./types";
import type { Statement } from "@/features/report/types";
type Turn = {
  text: string;
  response: ConversationResponse;
  before: ConversationState | null;
};
export function useConversation(
  side: "A" | "B" = "A",
  sharedStatement?: Statement,
) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [pendingTurn, setPendingTurn] = useState<{ text: string } | null>(
    null,
  );
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      active.current?.abort();
    },
    [],
  );
  const latest = turns.at(-1)?.response;
  async function send() {
    if (
      !input.trim() ||
      active.current ||
      (latest?.state.readyToGenerate && editing === null)
    )
      return;
    const text = input.trim();
    const editingIndex = editing;
    const controller = new AbortController();
    active.current = controller;
    const timeout = setTimeout(() => controller.abort(), 65000);
    setPendingTurn({ text });
    setInput("");
    setPending(true);
    setError("");
    const before =
      editingIndex === null ? (latest?.state ?? null) : turns[editingIndex].before;
    try {
      const response = await sendConversation(
        text,
        before,
        controller.signal,
        side,
        sharedStatement,
      );
      if (controller.signal.aborted) return;
      setTurns([
        ...(editingIndex === null ? turns : turns.slice(0, editingIndex)),
        { text, before, response },
      ]);
      setEditing(null);
    } catch (failure) {
      setInput(text);
      setError(
        controller.signal.aborted
          ? "응답 대기 시간이 길어졌어요. 입력은 남아 있으니 다시 시도해주세요."
          : failure instanceof Error
            ? failure.message
            : "다시 시도해주세요.",
      );
    } finally {
      clearTimeout(timeout);
      active.current = null;
      setPending(false);
      setPendingTurn(null);
    }
  }
  return {
    turns,
    input,
    setInput,
    editing,
    pending,
    pendingTurn,
    error,
    latest,
    send,
    edit: (index: number) => {
      setInput(turns[index].text);
      setEditing(index);
      setError("");
    },
    cancelEdit: () => {
      setInput("");
      setEditing(null);
    },
  };
}
