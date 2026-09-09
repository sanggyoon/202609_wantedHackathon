import type { Statement } from "./types";
import { StatementCard } from "./StatementCard";
export function StatementSummary({ data }: { data: Statement }) {
  return (
    <section className="panel">
      <span className="badge">고소장 핵심 요약 · A의 관점</span>
      <h2>마음알아주길바람죄</h2>
      <h3>사건 한 줄 요약</h3>
      <p>{data.incident}</p>
      <h3>가장 서운했던 지점과 핵심 감정</h3>
      <p>{data.feeling}</p>
      <h3>당신에게 바라는 점</h3>
      <p>{data.wish}</p>
      <details>
        <summary>고소장 전체 보기</summary>
        <StatementCard side="A" data={data} />
      </details>
    </section>
  );
}
