import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
export default function Home() {
  return (
    <AppShell>
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
          말하기 어려웠던 그 일을 정리하고,
          <br />
          서로의 마음을 한 장씩 펼쳐보세요.
        </p>
        <Link className="button" href="/wireframe">
          귀엽게 고소장 만들기 ↗
        </Link>
        <small>와이어프레임 체험 · 가상 데이터</small>
      </section>
      <div className="steps">
        <p>
          <b>01 이야기하기</b>서운했던 일과 마음을 정리해요.
        </p>
        <p>
          <b>02 마음 전하기</b>고소장으로 내 생각을 전달해요.
        </p>
        <p>
          <b>03 함께 읽기</b>사과하거나 서로의 관점을 나눠요.
        </p>
      </div>
    </AppShell>
  );
}
