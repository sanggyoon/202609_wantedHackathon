import type { ReactNode } from "react";
import { Button } from "@/components/ui";
import type { EntryMode } from "@/features/report/types";

const copy: Record<
  EntryMode,
  { label: string; title: ReactNode; desc: ReactNode; cta: string }
> = {
  new: {
    label: "정말 많은 일이 있었군요.\n저에게 편히 다 말해보세요.",
    title: (
      <>
        밤톨이 당신의
        <br />
        고소를 도와드릴게요.
      </>
    ),
    desc: "로그인 없이 시작 · 실제 법률 서비스가 아니에요",
    cta: "시작하기 ↗",
  },
  invited: {
    label: "상대가 당신에게\n고소장을 보냈어요.",
    title: (
      <>
        당신에게 소환장이
        <br />
        도착했어요.
      </>
    ),
    desc: "먼저 상대의 이야기를 읽고, 당신의 마음도 들려주면 돼요.",
    cta: "이야기 확인하기 ↗",
  },
  result: {
    label: "두 분의 이야기가\n모두 도착했어요.",
    title: (
      <>
        심리가 끝났어요.
        <br />
        결과를 함께 볼까요?
      </>
    ),
    desc: "판결문(결과물)은 7일간 보관돼요.",
    cta: "결과 보기 ↗",
  },
};

export function StartScreen({
  entryMode = "new",
  onStart,
}: {
  entryMode?: EntryMode;
  onStart: () => void;
}) {
  const c = copy[entryMode];
  return (
    <>
      <section className="hero">
        <div className="paper doc" aria-hidden="true">
          고소장
        </div>
        <small>
          {c.label.split("\n").map((line, i) => (
            <span key={i}>
              {i > 0 && <br />}
              {line}
            </span>
          ))}
        </small>
        <h1>{c.title}</h1>
        <Button onClick={onStart}>{c.cta}</Button>
        <small>{c.desc}</small>
      </section>
      {entryMode === "new" && (
        <div className="steps">
          <p>
            <b>01 진술하기</b>사건, 감정, 바라는 점을 정리해요.
          </p>
          <p>
            <b>02 소환하기</b>고소장 한 장을 링크로 전해요.
          </p>
          <p>
            <b>03 선고받기</b>사과 또는 맞고소로 마음을 나눠요.
          </p>
        </div>
      )}
      <p className="notice">
        판결문(결과물)은 7일 후 파기돼요. 지금은 저장·공유되지 않는 와이어프레임
        체험입니다.
      </p>
    </>
  );
}
