import type { Statement } from "./types";
import { StatementCard } from "./StatementCard";
export function StatementSummary({ data }: { data: Statement }) {
  const title = data.incident.split(/[.!?。\n]/)[0];
  return (
    <section className="panel">
      <span className="badge">고소장 요약 · CASE #0241</span>
      <h3>사건 요약</h3>
      <p>{title}</p>
      <h3>신청인이 느낀 것</h3>
      <p>{data.feeling}</p>
      <h3>원하는 것</h3>
      <p>{data.wish}</p>
      <details>
        <summary>신청서 전체 보기</summary>
        <StatementCard side="A" data={data} />
      </details>
    </section>
  );
}
