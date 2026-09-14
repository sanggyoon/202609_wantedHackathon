"use client";
import { useEffect, useState } from "react";
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
  useEffect(() => {
    document.body.classList.add("chat-open");
    return () => document.body.classList.remove("chat-open");
  }, []);
  useEffect(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }, [answers.length, edit]);
  const isEmpty = answers.length === 0 && edit === null;
  return (
    <>
      {isEmpty ? (
        <div className="chat-empty">
          <p className="chat-empty-title">무슨 일이 있었나요?</p>
          <p className="chat-empty-desc">떠오르는 대로 편하게 들려주세요</p>
        </div>
      ) : (
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
                {i > 0 && <p className="assistant">{q}</p>}
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
        </>
      )}
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
          <textarea
            id="answer"
            aria-label={edit === null ? "내 진술" : "진술 수정"}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="중재자 밤톨에게 편하게 말해보세요."
          />
          <button
            type="submit"
            className="send"
            disabled={!input.trim()}
            aria-label="진술하기"
          >
            ↑
          </button>
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
