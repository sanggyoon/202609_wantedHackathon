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
    understood: "",
    admitted: "",
    body: "",
    promise: "",
  });
  const [preview, setPreview] = useState(false);
  return (
    <>
      <Heading
        label="화해 시도 · 사과 및 합의"
        title="당신의 말로, 마음을 전해볼까요?"
      >
        완벽한 문장보다 진심이 담긴 한마디면 충분해요. 제가 곁에서 도울게요.
      </Heading>
      <Notice>신청인이 접수한 사건: {summary}</Notice>
      {preview ? (
        <div className="panel">
          <span className="badge">🤝 화해 및 합의서</span>
          {value.understood && (
            <>
              <h3>내가 이해한 상대의 마음</h3>
              <p>{value.understood}</p>
            </>
          )}
          {value.admitted && (
            <>
              <h3>내가 인정하는 부분</h3>
              <p>{value.admitted}</p>
            </>
          )}
          <h3>상대에게 전하는 사과</h3>
          <p>{value.body}</p>
          {value.promise && (
            <>
              <h3>다음에는 이렇게 할게</h3>
              <p>{value.promise}</p>
            </>
          )}
        </div>
      ) : (
        <div className="panel">
          {(
            [
              [
                "understood",
                "내가 이해한 상대의 마음 (선택)",
                "이번 일에서 상대가 왜 속상했는지, 어떤 부분이 가장 서운했을지 적어주세요.",
              ],
              [
                "admitted",
                "내가 인정하는 부분 (선택)",
                "상대의 이야기를 읽고 ‘이건 내가 잘못했구나’ 싶은 부분이 있다면 적어주세요.",
              ],
              [
                "body",
                "상대에게 전하는 사과 (필수)",
                "변명보다 마음을 먼저 전해볼까요? 상대에게 직접 이야기하듯 적어주세요.",
              ],
              [
                "promise",
                "다음에는 이렇게 할게 (선택)",
                "비슷한 상황이 다시 생긴다면 어떻게 하고 싶은지 적어주세요.",
              ],
            ] as const
          ).map(([key, label, ph]) => (
            <label className="field" key={key}>
              {label}
              <textarea
                rows={key === "body" ? 5 : 2}
                value={value[key]}
                onChange={(e) => setValue({ ...value, [key]: e.target.value })}
                placeholder={ph}
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
          화해 신청하기
        </Button>
      </div>
    </>
  );
}
