import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
export default function Home() {
  return (
    <AppShell>
      <section className="hero">
        <div className="paper doc font-point" aria-hidden="true">
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
        <Link className="button" href="/wireframe">
          시작하기 ↗
        </Link>
        <small>와이어프레임 체험 · 가상 사건 기록</small>
      </section>
      <div className="steps">
        <p>
          <b>01 진술하기</b>무슨 일이 있었는지 중재자 밤톨에게 편히 털어놔요.
        </p>
        <p>
          <b>02 소환하기</b>고소장 한 장을 링크로 상대에게 보내요.
        </p>
        <p>
          <b>03 선고받기</b>사과하거나 맞고소하며 서로의 마음을 확인해요.
        </p>
      </div>
    </AppShell>
  );
}
