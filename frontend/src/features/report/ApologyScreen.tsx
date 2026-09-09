"use client";
import { useState } from "react";
import { Button, Heading, Notice } from "@/components/ui";
import type { Apology } from "./types";
export function ApologyScreen({
  summary,
  onSubmit,
}: {
  summary: string;
  onSubmit: (value: Apology) => void;
}) {
  const [value, setValue] = useState<Apology>({
    body: "",
    understood: "",
    promise: "",
  });
  const [preview, setPreview] = useState(false);
  return (
    <>
      <Heading label="B의 답변 · 사과하기" title="당신의 말로 전해주세요.">
        완벽한 문장보다 진심이 담긴 한마디면 충분해요.
      </Heading>
      <Notice>상대가 전한 이야기: {summary}</Notice>
      {preview ? (
        <div className="panel">
          <h2>사과문 미리보기</h2>
          <p>{value.body}</p>
          {value.understood && <p>이해한 내용: {value.understood}</p>}
          {value.promise && <p>약속: {value.promise}</p>}
        </div>
      ) : (
        <div className="panel">
          {(
            [
              ["body", "사과문 (필수)"],
              ["understood", "내가 이해한 내용 (선택)"],
              ["promise", "앞으로 지키고 싶은 내용 (선택)"],
            ] as const
          ).map(([key, label]) => (
            <label className="field" key={key}>
              {label}
              <textarea
                rows={key === "body" ? 5 : 2}
                value={value[key]}
                onChange={(e) => setValue({ ...value, [key]: e.target.value })}
              />
            </label>
          ))}
        </div>
      )}
      <div className="actions">
        <Button secondary onClick={() => setPreview(!preview)}>
          {preview ? "수정하기" : "미리보기"}
        </Button>
        <Button disabled={!value.body.trim()} onClick={() => onSubmit(value)}>
          사과문 보내기
        </Button>
      </div>
    </>
  );
}
