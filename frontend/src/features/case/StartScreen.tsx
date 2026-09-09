import { Button } from "@/components/ui";
export function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <>
      <section className="hero">
        <small>마음을 전하는 작은 사건</small>
        <div className="paper" aria-hidden="true">
          ♡
        </div>
        <h1>
          서운한 마음,
          <br />
          귀엽게 접수할게요.
        </h1>
        <p>
          AI와 이야기하며 마음을 정리하고,
          <br />
          귀여운 고소장으로 상대에게 전해보세요.
        </p>
        <Button onClick={onStart}>귀엽게 고소장 만들기 ↗</Button>
        <small>로그인 없이 시작 · 실제 법률 서비스가 아니에요</small>
      </section>
      <div className="steps">
        <p>
          <b>01 이야기하기</b>사건, 감정, 바라는 점을 정리해요.
        </p>
        <p>
          <b>02 마음 전하기</b>하나의 링크로 고소장을 전해요.
        </p>
        <p>
          <b>03 함께 읽기</b>사과 또는 맞고소로 마음을 나눠요.
        </p>
      </div>
      <p className="notice">
        결과물은 7일 후 만료돼요. 지금은 저장·공유되지 않는 와이어프레임
        체험입니다.
      </p>
    </>
  );
}
