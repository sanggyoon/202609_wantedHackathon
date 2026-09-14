"use client";
import { useState } from "react";
import { Button, Heading } from "@/components/ui";
import { StatementCard } from "./StatementCard";
import type { Statement } from "./types";
export function PreviewScreen({
  side,
  initial,
  onConfirm,
}: {
  side: "A" | "B";
  initial: Statement;
  onConfirm: (value: Statement) => void;
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
              ["incident", "사건 내용"],
              ["feeling", "감정과 이유"],
              ["wish", "바라는 점"],
            ] as const
          ).map(([key, label]) => (
            <label className="field" key={key}>
              {label}
              <textarea
                rows={3}
                value={value[key]}
                onChange={(e) => setValue({ ...value, [key]: e.target.value })}
              />
            </label>
          ))}
        </div>
      ) : (
        <StatementCard side={side} data={value} />
      )}
      <div className="actions">
        <Button secondary onClick={() => setEdit(!edit)}>
          {edit ? "미리보기" : "내용 수정"}
        </Button>
        <Button
          disabled={[value.incident, value.feeling, value.wish].some(
            (v) => !v.trim(),
          )}
          onClick={() => onConfirm(value)}
        >
          {side === "A" ? "고소장 접수하기" : "맞고소장 제출하기"}
        </Button>
      </div>
    </>
  );
}
