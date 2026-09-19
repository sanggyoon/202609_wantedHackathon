"use client";
import { useEffect, useRef, useState } from "react";
import { Button, Notice } from "@/components/ui";
import type { Statement } from "@/features/report/types";
import { useConversation } from "./useConversation";
import {
  requestEmotionProfile,
  resolveEmotionProfile,
  type EmotionProfileResult,
} from "@/lib/api/emotionWarp";
import type { EmotionLabel, EmotionProfile } from "@/features/report/types";
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
  const [profilePending, setProfilePending] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [clarification, setClarification] = useState<EmotionProfileResult | null>(null);
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

  function complete(profile?: EmotionProfile) {
    if (!state) return;
    onComplete({
      incident_description: state.incident.description || state.incident.facts.join(" "),
      emotions: state.emotion.emotions,
      emotion_scores: profile,
      emotion_reason: state.emotion.reason || "",
      hurt_point: state.hurtPoint || "",
      desired_outcome: state.desiredOutcome || "",
      expected_behavior: state.expectedBehavior || "",
      assumption: state.incident.assumptions.join("\n"),
      sourceMode: chat.latest?.mode,
    });
  }

  async function prepareDocument() {
    if (!state || profilePending) return;
    const controller = new AbortController();
    setProfilePending(true);
    setProfileError("");
    try {
      const result = await requestEmotionProfile(
        chat.turns.map((turn) => turn.text),
        state.emotion.emotions,
        controller.signal,
      );
      if (result.needs_clarification) setClarification(result);
      else complete(result.profile);
    } catch {
      setProfileError("감정 이미지는 나중에 준비할게요. 고소장 내용은 그대로 확인할 수 있어요.");
      complete();
    } finally {
      setProfilePending(false);
    }
  }

  async function chooseEmotion(label: EmotionLabel) {
    if (!clarification || profilePending) return;
    setProfilePending(true);
    try {
      const result = await resolveEmotionProfile(clarification.profile, label);
      complete(result.profile);
    } catch {
      setProfileError("감정을 고르지 못했어요. 다시 선택해주세요.");
    } finally {
      setProfilePending(false);
    }
  }
  useEffect(() => {
    window.scrollTo({ top: document.body.scrollHeight });
  }, [chat.turns.length, chat.pending, chat.pendingTurn, chat.error, state]);
  useEffect(() => {
    document.body.classList.add("chat-open");
    return () => document.body.classList.remove("chat-open");
  }, []);
  return (
    <>
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
        {chat.turns.length === 0 && !chat.pendingTurn && (
          <div className="assistant-intro">
            <span className="assistant-label">중재자</span>
            <div className="heading">
              <h1>
                {side === "A"
                  ? "무슨 일 있었어요?"
                  : "이번엔 어떤 일이 있었는지 들려줄래요?"}
              </h1>
              <p>편하게 얘기해요. 제가 들어볼게요.</p>
            </div>
          </div>
        )}
        {chat.turns.map((turn, i) => (
          <div key={i}>
            <div className="reply">
              <p>{turn.text}</p>
              <button
                disabled={chat.pending}
                onClick={() => {
                  setClarification(null);
                  chat.edit(i);
                }}
              >
                진술 수정
              </button>
            </div>
            <p className="assistant">
              <span className="assistant-label">중재자</span>
              {turn.response.assistantMessage}
            </p>
          </div>
        ))}
        {chat.pendingTurn && (
          <div>
            <div className="reply">
              <p>{chat.pendingTurn.text}</p>
            </div>
            <p role="status" className="notice typing-notice">
              말씀해주신 마음을 정리하고 있어요
              <span className="typing-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </p>
          </div>
        )}
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
          {chat.editing !== null && (
            <Notice>수정한 답변 이후의 대화는 다시 이어갑니다.</Notice>
          )}
          <div className="composer-row">
            <textarea
              ref={textareaRef}
              id="live-answer"
              aria-label={chat.editing === null ? "내 진술" : "이전 진술 수정"}
              rows={1}
              maxLength={8000}
              value={chat.input}
              disabled={chat.pending}
              onChange={(e) => chat.setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
                if (!window.matchMedia("(pointer: fine)").matches) return;
                if (e.shiftKey) return;
                e.preventDefault();
                if (e.ctrlKey || e.metaKey) {
                  const el = e.currentTarget;
                  el.setRangeText("\n", el.selectionStart, el.selectionEnd, "end");
                  chat.setInput(el.value);
                } else if (!chat.pending && chat.input.trim()) {
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="중재자 밤톨에게 편하게 말해보세요."
            />
            <button
              type="submit"
              className="send"
              disabled={chat.pending || !chat.input.trim()}
              aria-label={chat.error ? "다시 시도하기" : "진술하기"}
            >
              {chat.error ? "↻" : "↑"}
            </button>
          </div>
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
      {clarification && (
        <section className="panel emotion-choice">
          <h3>지금 마음에서 가장 크게 남은 감정은 무엇인가요?</h3>
          <p>고소장에 들어갈 표정을 고르는 데만 사용할게요.</p>
          <div className="actions">
            {clarification.candidates.map((label) => (
              <Button
                key={label}
                secondary
                disabled={profilePending}
                onClick={() => void chooseEmotion(label)}
              >
                {label}
              </Button>
            ))}
          </div>
        </section>
      )}
      {profileError && <Notice>{profileError}</Notice>}
      {state?.readyToGenerate && (
        <Button
          disabled={
            chat.pending ||
            profilePending ||
            clarification !== null ||
            chat.editing !== null ||
            !!chat.input.trim()
          }
          onClick={() => void prepareDocument()}
        >
          {profilePending
            ? "감정 이미지를 준비하고 있어요…"
            : `${side === "A" ? "고소장" : "맞고소장"} 초안 확인하기 →`}
        </Button>
      )}
    </>
  );
}
