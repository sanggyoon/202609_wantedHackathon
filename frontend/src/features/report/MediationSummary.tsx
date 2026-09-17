"use client";
import { useEffect, useRef, useState } from "react";
import { Button, Notice } from "@/components/ui";
import { requestMediation, type MediationResult } from "@/lib/api/mediation";
import { MediationPanel, MediationReport } from "./MediationReport";
import type { Statement } from "./types";

export function MediationSummary({ a, b }: { a: Statement; b: Statement }) {
  const [result, setResult] = useState<MediationResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      active.current?.abort();
    },
    [],
  );
  async function generate() {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setPending(true);
    setError("");
    const timeout = setTimeout(() => controller.abort(), 35000);
    try {
      const next = await requestMediation(a, b, controller.signal);
      if (!controller.signal.aborted) setResult(next);
    } catch (failure) {
      setError(
        controller.signal.aborted
          ? "응답이 늦어지고 있어요. 다시 시도해주세요."
          : failure instanceof Error
            ? failure.message
            : "다시 시도해주세요.",
      );
    } finally {
      clearTimeout(timeout);
      active.current = null;
      setPending(false);
    }
  }
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
