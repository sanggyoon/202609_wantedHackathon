"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Button, Heading, Notice } from "@/components/ui";
import { CARD_SUMMARY_FAILED, requestCardSummary } from "@/lib/api/cardSummary";
import { StatementCard } from "./StatementCard";
import type { Statement } from "./types";

// 생성 필드 중 하나라도 비어 있으면 요청하되, 아래 병합에서 사용자가 정한 값은 보존한다.
function needsSummary(card: Statement) {
  return !card.cute_charge || !card.incident_summary || !card.story_intro;
}

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
  const [value, setValue] = useState(initial);
  const [edit, setEdit] = useState(false);
  // 0은 진입 시 자동 생성, 이후 값은 "다시 만들기" 요청이다.
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(() => needsSummary(initial));
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (attempt === 0 && !needsSummary(initial)) return;
    const controller = new AbortController();
    requestCardSummary(initial, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        // 기다리는 동안 사용자가 직접 적은 값은 덮어쓰지 않는다.
        setValue((current) => ({
          ...current,
          cute_charge: current.cute_charge || result.cute_charge,
          incident_summary: current.incident_summary || result.incident_summary,
          story_intro: current.story_intro || result.story_intro,
        }));
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setPending(false);
      });
    return () => controller.abort();
  }, [initial, attempt]);
  return (
    <>
      <Heading
        label={side === "A" ? "고소장 검토" : "맞고소장 검토"}
        title="이대로 접수할까요?"
      >
        제가 정리한 내용이 마음과 조금 다르면, 언제든 직접 고쳐도 괜찮아요.
      </Heading>
      {edit ? (
        <div className="panel">
          {(
            [
              ["cute_charge", "죄명"],
              ["incident_summary", "사건 한 줄 요약"],
              ["story_intro", "상대에게 먼저 보일 한마디"],
              ["incident_description", "사건 내용"],
              ["emotion_reason", "감정의 이유"],
              ["desired_outcome", "바라는 점"],
            ] as const
          ).map(([key, label]) => (
            <label className="field" key={key}>
              {label}
              <textarea
                rows={3}
                maxLength={key === "story_intro" ? 300 : undefined}
                value={value[key] ?? ""}
                onChange={(e) => setValue({ ...value, [key]: e.target.value })}
              />
            </label>
          ))}
          {/* 감정은 목록이라 쉼표로 편집한다. 저장은 emotions[]로 간다. */}
          <label className="field">
            감정 (쉼표로 구분)
            <textarea
              rows={2}
              value={value.emotions.join(", ")}
              onChange={(e) =>
                setValue({
                  ...value,
                  emotions: e.target.value
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
        </div>
      ) : (
        <StatementCard side={side} data={value} chargePending={pending} />
      )}
      {failed && <Notice>{CARD_SUMMARY_FAILED}</Notice>}
      {notice}
      <div className="actions">
        <Button secondary onClick={() => setEdit(!edit)}>
          {edit ? "미리보기" : "내용 수정"}
        </Button>
        {failed && (
          <Button
            secondary
            onClick={() => {
              setFailed(false);
              setPending(true);
              setAttempt((n) => n + 1);
            }}
          >
            죄명과 한마디 다시 만들기
          </Button>
        )}
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
      </div>
    </>
  );
}
