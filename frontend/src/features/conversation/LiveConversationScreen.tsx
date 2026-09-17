"use client";
import { useEffect, useRef } from "react";
import { Button, Heading, Notice } from "@/components/ui";
import type { Statement } from "@/features/report/types";
import { useConversation } from "./useConversation";
export function LiveConversationScreen({
  side = "A",
  sharedStatement,
  onComplete,
}: {
  side?: "A" | "B";
  sharedStatement?: Statement;
  onComplete: (value: Statement) => void;
}) {
  const chat = useConversation(side, sharedStatement);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = parseFloat(getComputedStyle(el).maxHeight);
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
    el.style.height = `${el.scrollHeight}px`;
  }, [chat.input]);
  const state = chat.latest?.state;
  return (
    <>
      <Heading
        label={`${side === "A" ? "신청인" : "상대방"} 진술 · 대화 엔진 연결`}
        title={
          side === "A"
            ? "무슨 일 있었어요?"
            : "이번엔 어떤 일이 있었는지 들려줄래요?"
        }
      >
        편하게 얘기해요. 제가 들어볼게요.
      </Heading>
      <Notice>
        {chat.latest?.mode === "local"
          ? "로컬 규칙 기반 응답입니다. OpenAI API는 사용하지 않았어요."
          : chat.latest?.mode === "openai"
            ? "OpenAI로 대화하고 있어요. 입력과 정리된 상태가 AI 제공자에게 전달됩니다."
            : "백엔드에 API 키가 설정돼 있으면 OpenAI로, 없으면 로컬 규칙으로 대화합니다."}{" "}
        대화는 앱 DB에 저장하지 않으며, 이탈·새로고침 시 사라집니다.
      </Notice>
      {side === "B" && (
        <Notice>
          위 고소장은 신청인의 관점이에요. 동의하지 않아도 괜찮아요. 공유된
          고소장과 지금 답변만 AI에게 전달하며, 신청인의 비공개 대화는 전달하지
          않아요.
        </Notice>
      )}
      <div className="chat">
        <p className="assistant">
          🌰　
          {side === "A"
            ? "무슨 일 있었어요? 정리 안 된 채로 얘기해도 괜찮아요."
            : "그날은 어땠어요? 다르게 기억하는 부분이 있어도 편하게 얘기해요."}
        </p>
        {chat.turns.map((turn, i) => (
          <div key={i}>
            <div className="reply">
              <p>{turn.text}</p>
              <button disabled={chat.pending} onClick={() => chat.edit(i)}>
                진술 수정
              </button>
            </div>
            <p className="assistant">🌰　{turn.response.assistantMessage}</p>
          </div>
        ))}
      </div>
      {state && (
        <details className="panel" open={state.readyToGenerate || undefined}>
          <summary>밤톨이 이해한 내용</summary>
          <h3>사건</h3>
          <p>{state.incident.description || "이야기를 더 들려주세요."}</p>
          <h3>감정과 이유</h3>
          <p>
            {state.emotion.emotions.join(", ")} {state.emotion.reason}
          </p>
          {state.incident.assumptions.length > 0 && (
            <>
              <h3>사실로 확인되지 않은 추측</h3>
              <p>{state.incident.assumptions.join("\n")}</p>
            </>
          )}
          <h3>바라는 점</h3>
          <p>{state.desiredOutcome || "아직 확인하지 못했어요."}</p>
        </details>
      )}
      {chat.pending && (
        <p role="status" className="notice">
          🌰　말씀해주신 마음을 정리하고 있어요…
        </p>
      )}
      {chat.error && (
        <p role="alert" className="notice">
          {chat.error}
        </p>
      )}
      {(!state?.readyToGenerate || chat.editing !== null) && (
        <form
          className="composer live-composer"
          onSubmit={(e) => {
            e.preventDefault();
            void chat.send();
          }}
        >
          <label htmlFor="live-answer">
            {chat.editing === null ? "내 진술" : "이전 진술 수정"}
          </label>
          {chat.editing !== null && (
            <Notice>수정한 답변 이후의 대화는 다시 이어갑니다.</Notice>
          )}
          <textarea
            ref={textareaRef}
            id="live-answer"
            rows={3}
            maxLength={8000}
            value={chat.input}
            disabled={chat.pending}
            onChange={(e) => chat.setInput(e.target.value)}
            placeholder="중재자 밤톨에게 편하게 말해보세요."
          />
          <Button type="submit" disabled={chat.pending || !chat.input.trim()}>
            {chat.error ? "다시 시도하기" : "진술하기 ↑"}
          </Button>
          {chat.editing !== null && (
            <Button secondary disabled={chat.pending} onClick={chat.cancelEdit}>
              수정 취소
            </Button>
          )}
        </form>
      )}
      {state?.readyToGenerate && chat.editing === null && (
        <Notice>
          필요한 내용이 모였어요. 초안을 확인하거나 위의 ‘진술 수정’으로 내용을
          고칠 수 있어요.
        </Notice>
      )}
      {state?.readyToGenerate && (
        <Button
          disabled={
            chat.pending || chat.editing !== null || !!chat.input.trim()
          }
          onClick={() =>
            onComplete({
              // 대화 상태의 구조를 그대로 옮긴다. 예전에는 감정 셋을 한 덩어리
              // 텍스트로 합치면서 emotions[]가 통째로 버려졌다.
              incident_description:
                state.incident.description || state.incident.facts.join(" "),
              emotions: state.emotion.emotions,
              emotion_reason: state.emotion.reason || "",
              hurt_point: state.hurtPoint || "",
              desired_outcome: state.desiredOutcome || "",
              expected_behavior: state.expectedBehavior || "",
              assumption: state.incident.assumptions.join("\n"),
              sourceMode: chat.latest?.mode,
            })
          }
        >
          {side === "A" ? "고소장" : "맞고소장"} 초안 확인하기 →
        </Button>
      )}
    </>
  );
}
