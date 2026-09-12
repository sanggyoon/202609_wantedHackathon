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
        label={`${side === "A" ? "원고 진술" : "피고 진술"} · ${Math.min(
          answers.length + 1,
          3,
        )} / 3`}
        title={
          side === "A"
            ? "무슨 일을 고소하고 싶으신가요?"
            : "이번엔 당신의 이야기를 들려주세요."
        }
      >
        그날의 이야기, 저에게 편히 들려주세요.
      </Heading>
      <div className="chat">
        {questions.slice(0, Math.min(answers.length + 1, 3)).map((q, i) => (
          <div key={q}>
            <p className="assistant">🌰　{q}</p>
            {answers[i] && (
              <div className="reply">
                <p>{answers[i]}</p>
                <button
                  onClick={() => {
                    setEdit(i);
                    setInput(answers[i]);
                  }}
                >
                  진술 수정
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
          <label htmlFor="answer">{edit === null ? "내 진술" : "진술 수정"}</label>
          <textarea
            id="answer"
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="중재자 밤톨에게 편하게 말해보세요."
          />
          <Button type="submit" disabled={!input.trim()}>
            진술하기 ↑
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
          {side === "A" ? "고소장 초안 확인하기 →" : "맞고소장 초안 확인하기 →"}
        </Button>
      )}
      <Notice>
        지금은 가상 진술이에요. 화면을 나가거나 새로고침하면 진술이 사라집니다.
      </Notice>
    </>
  );
}
