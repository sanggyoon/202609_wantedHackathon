"use client";
import { Button, Heading, Notice } from "@/components/ui";
import type { Statement } from "@/features/report/types";
import { useConversation } from "./useConversation";
export function LiveConversationScreen({
  onComplete,
}: {
  onComplete: (value: Statement) => void;
}) {
  const chat = useConversation();
  const state = chat.latest?.state;
  return (
    <>
      <Heading
        label="신청인 진술 · 대화 엔진 연결"
        title="무슨 일을 고소하고 싶으신가요?"
      >
        그날의 이야기, 저에게 편히 들려주세요.
      </Heading>
      <Notice>
        {chat.latest?.mode === "local"
          ? "로컬 규칙 기반 응답입니다. OpenAI API는 사용하지 않았어요."
          : chat.latest?.mode === "openai"
            ? "OpenAI로 대화하고 있어요. 입력과 정리된 상태가 AI 제공자에게 전달됩니다."
            : "백엔드에 API 키가 설정돼 있으면 OpenAI로, 없으면 로컬 규칙으로 대화합니다."}{" "}
        대화는 앱 DB에 저장하지 않으며, 이탈·새로고침 시 사라집니다.
      </Notice>
      <div className="chat">
        <p className="assistant">
          🌰　자, 무슨 일이 있었던 걸까요? 떠오르는 대로 편하게 들려주세요.
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
        <details className="panel">
          <summary>밤톨이 이해한 내용</summary>
          <h3>사건</h3>
          <p>{state.incident.description || "이야기를 더 들려주세요."}</p>
          <h3>서운했던 지점</h3>
          <p>{state.hurtPoint || "아직 확인하지 못했어요."}</p>
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
      <form
        className="composer"
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
      {state?.readyToGenerate && (
        <Button
          disabled={
            chat.pending || chat.editing !== null || !!chat.input.trim()
          }
          onClick={() =>
            onComplete({
              incident:
                state.incident.description || state.incident.facts.join(" "),
              feeling: [
                state.hurtPoint,
                state.emotion.emotions.join(", "),
                state.emotion.reason,
              ]
                .filter(Boolean)
                .join("\n"),
              wish: state.desiredOutcome || "",
              expectation: state.expectedBehavior || "",
              guess: state.incident.assumptions.join("\n"),
              sourceMode: chat.latest?.mode,
            })
          }
        >
          고소장 초안 확인하기 →
        </Button>
      )}
    </>
  );
}
