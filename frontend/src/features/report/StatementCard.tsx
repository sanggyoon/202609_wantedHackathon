import type { Statement } from "./types";
export function StatementCard({
  side,
  data,
}: {
  side: "A" | "B";
  data: Statement;
}) {
  const other = side === "A" ? "B" : "A";
  const title = data.incident.split(/[.!?。\n]/)[0];
  return (
    <article className={`card side-${side}`}>
      <h2 className="doc-title">고 소 장</h2>
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
      {data.expectation && (
        <>
          <h3>그때 기대했던 점</h3>
          <p>{data.expectation}</p>
        </>
      )}
      {data.guess && (
        <>
          <h3>사실로 확인되지 않은 추측</h3>
          <p>{data.guess}</p>
        </>
      )}
    </article>
  );
}
