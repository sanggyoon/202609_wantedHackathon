import { feelingText, type Statement } from "./types";
import { StatementCard } from "./StatementCard";
export function StatementSummary({ data }: { data: Statement }) {
  const title =
    data.incident_summary || data.incident_description.split(/[.!?。\n]/)[0];
  return (
    <section className="panel">
      <span className="badge">고소장 요약 · 신청인의 관점</span>
      {!data.sourceMode && (
        <p className="notice">현재는 화면 체험용 예시 사건입니다.</p>
      )}
      <h3>사건 요약</h3>
      <p>{title}</p>
      <h3>신청인이 느낀 것</h3>
      <p>{feelingText(data)}</p>
      <h3>원하는 것</h3>
      <p>{data.desired_outcome}</p>
      <details>
        <summary>신청서 전체 보기</summary>
        <StatementCard side="A" data={data} />
      </details>
    </section>
  );
}
