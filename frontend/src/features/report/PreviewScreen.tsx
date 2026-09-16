"use client";
import { useState } from "react";
import { Button, Heading } from "@/components/ui";
import { StatementCard } from "./StatementCard";
import type { Statement } from "./types";
export function PreviewScreen({
  side,
  initial,
  onConfirm,
  submitDisabled = false,
}: {
  side: "A" | "B";
  initial: Statement;
  onConfirm: (value: Statement) => void;
  submitDisabled?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [edit, setEdit] = useState(false);
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
              ["incident_description", "사건 내용"],
              ["emotion_reason", "감정의 이유"],
              ["desired_outcome", "바라는 점"],
            ] as const
          ).map(([key, label]) => (
            <label className="field" key={key}>
              {label}
              <textarea
                rows={3}
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
        <StatementCard side={side} data={value} />
      )}
      <div className="actions">
        <Button secondary onClick={() => setEdit(!edit)}>
          {edit ? "미리보기" : "내용 수정"}
        </Button>
        <Button
          disabled={submitDisabled || [value.incident_description, value.desired_outcome].some(
            (v) => !v.trim(),
          )}
          onClick={() => onConfirm(value)}
        >
          {submitDisabled ? "고소장 저장 기능 준비 중" : side === "A" ? "고소장 접수하기" : "맞고소장 제출하기"}
        </Button>
      </div>
    </>
  );
}
