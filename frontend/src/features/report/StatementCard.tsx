import type { Statement } from "./types";
export function StatementCard({
  side,
  data,
  mine = false,
}: {
  side: "A" | "B";
  data: Statement;
  mine?: boolean;
}) {
  const other = side === "A" ? "B" : "A";
  const title = data.incident.split(/[.!?。\n]/)[0];
  return (
    <article className={`card side-${side}${mine ? " card-mine" : ""}`}>
      {mine && <span className="badge card-mine-badge">내가 쓴 고소장</span>}
      <h2 className="doc-title font-point">고 소 장</h2>
      <p className="doc-case">CASE #0241</p>
      <h3>사건명</h3>
      <h2>「{title}」</h2>
      <h3>신청인 · 상대방</h3>
      <p>
        신청인 {side} · 상대방 {other}
      </p>
      <h3>사건 개요</h3>
      <p>{data.incident}</p>
      <h3>신청인이 느낀 것</h3>
      <p>{data.feeling}</p>
      <h3>현재 확인된 핵심 쟁점</h3>
      <p>
        중재자(밤톨)가 연결되면, 두 사람이 진짜로 부딪힌 지점을 여기에
        정리해드릴게요.
      </p>
      <h3>원하는 것</h3>
      <p>{data.wish}</p>
    </article>
  );
}
