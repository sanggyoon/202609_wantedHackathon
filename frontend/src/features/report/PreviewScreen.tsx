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
      <Heading label="내용 확인" title="이 마음, 맞나요?">
        내 의도와 다른 부분은 직접 고칠 수 있어요.
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
          disabled={Object.values(value).some((v) => !v.trim())}
          onClick={() => onConfirm(value)}
        >
          {side === "A" ? "고소장 확정" : "맞고소 제출"}
        </Button>
      </div>
    </>
  );
}
