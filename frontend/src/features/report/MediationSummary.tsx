"use client";
import { useEffect, useRef, useState } from "react";
import { Button, Notice } from "@/components/ui";
import { requestMediation, type MediationResult } from "@/lib/api/mediation";
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
    <section className="panel">
      <span className="badge">🌰 중재자의 정리 (판결 아님)</span>
      <h2>두 사람을 위한, 중재자의 정리</h2>
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
        <>
          <Notice>
            {result.mode === "openai"
              ? "AI의 참고 요약입니다. 누가 옳은지 판결하지 않아요."
              : "AI 미연결: 각자의 입력만 표시하며 공통점이나 오해를 추론하지 않았어요."}
          </Notice>
          {(
            [
              [
                "함께 인정하는 내용",
                result.report.common_ground,
                "두 카드에서 공통으로 확인된 내용은 아직 없어요.",
              ],
              [
            "각자가 설명한 상황 (공유 내용 그대로)",
                result.report.different_views,
                "명시적으로 확인된 차이는 없어요.",
              ],
              [
                "신청인(A)의 마음",
                result.report.hurt_points_a,
                "공유된 감정이 없어요.",
              ],
              [
                "상대방(B)의 마음",
                result.report.hurt_points_b,
                "공유된 감정이 없어요.",
              ],
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
            {result.report.possible_misunderstanding ||
              "지금 내용만으로는 판단하기 어려워요."}
          </p>
          <h3>다음 대화의 시작 문장</h3>
          <p>{result.report.conversation_starter}</p>
        </>
      )}
      <Notice>
        결과는 현재 화면에서만 유지됩니다. 실제 공유 링크·DB 저장은 아직
        연결되지 않았어요.
      </Notice>
    </section>
  );
}
