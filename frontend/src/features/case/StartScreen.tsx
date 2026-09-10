import { Button } from "@/components/ui";
export function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <>
      <section className="hero">
        <div className="paper doc" aria-hidden="true">
          고소장
        </div>
        <small>
          정말 많은 일이 있었군요.
          <br />
          저에게 편히 다 말해보세요.
        </small>
        <h1>
          밤톨이 당신의
          <br />
          고소를 도와드릴게요.
        </h1>
        <Button onClick={onStart}>시작하기 ↗</Button>
        <small>로그인 없이 시작 · 실제 법률 서비스가 아니에요</small>
      </section>
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
      <p className="notice">
        판결문(결과물)은 7일 후 파기돼요. 지금은 저장·공유되지 않는 와이어프레임
        체험입니다.
      </p>
    </>
  );
}
