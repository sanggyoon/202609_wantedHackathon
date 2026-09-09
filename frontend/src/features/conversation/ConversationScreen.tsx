"use client";
import { useState } from "react";
import { Button, Heading, Notice } from "@/components/ui";
import type { Statement } from "@/features/report/types";
export function ConversationScreen({
  side,
  questions,
  onComplete,
}: {
  side: "A" | "B";
  questions: string[];
  onComplete: (value: Statement) => void;
}) {
  const [answers, setAnswers] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [edit, setEdit] = useState<number | null>(null);
  return (
    <>
      <Heading
        label={`${side}의 이야기 · ${Math.min(answers.length + 1, 3)} / 3`}
        title={
          side === "A" ? "어떤 일이 서운했나요?" : "당신의 이야기도 들려주세요."
        }
      >
        그때의 마음을 한 가지씩 정리해요.
      </Heading>
      <div className="progress">
        {questions.map((q, i) => (
          <span key={q} className={i < answers.length ? "filled" : ""} />
        ))}
      </div>
      <details className="panel">
        <summary>현재 파악한 내용 · {answers.length}/3</summary>
        {["사건 내용", "감정과 이유", "바라는 점"].map((label, i) => (
          <div key={label}>
            <h3>{label}</h3>
            <p>{answers[i] || "아직 듣지 못했어요."}</p>
          </div>
        ))}
      </details>
      <div className="chat">
        {questions.slice(0, Math.min(answers.length + 1, 3)).map((q, i) => (
          <div key={q}>
            <p className="assistant">♡　{q}</p>
            {answers[i] && (
              <div className="reply">
                <p>{answers[i]}</p>
                <button
                  onClick={() => {
                    setEdit(i);
                    setInput(answers[i]);
                  }}
                >
                  답변 수정
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {answers.length < 3 || edit !== null ? (
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            if (!input.trim()) return;
            setAnswers((old) =>
              edit === null
                ? [...old, input.trim()]
                : old.map((v, i) => (i === edit ? input.trim() : v)),
            );
            setInput("");
            setEdit(null);
          }}
        >
          <label htmlFor="answer">
            {edit === null ? "내 이야기" : "답변 수정"}
          </label>
          <textarea
            id="answer"
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="편하게 적어주세요."
          />
          <Button type="submit" disabled={!input.trim()}>
            답변 보내기 ↑
          </Button>
        </form>
      ) : (
        <Button
          onClick={() =>
            onComplete({
              incident: answers[0],
              feeling: answers[1],
              wish: answers[2],
            })
          }
        >
          정리한 내용 확인하기 →
        </Button>
      )}
      <Notice>
        가상 대화로 정해진 질문을 보여드립니다. 화면을 나가거나 새로고침하면
        대화가 사라집니다.
      </Notice>
    </>
  );
}
