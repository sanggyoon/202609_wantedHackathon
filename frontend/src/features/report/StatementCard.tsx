import { feelingText, type Statement } from "./types";
export function StatementCard({
  side,
  data,
  mine = false,
  chargePending = false,
}: {
  side: "A" | "B";
  data: Statement;
  mine?: boolean;
  saved?: boolean;
  chargePending?: boolean;
}) {
  const other = side === "A" ? "B" : "A";
  const title =
    data.incident_summary || data.incident_description.split(/[.!?。\n]/)[0];
  return (
    <article className={`card side-${side}${mine ? " card-mine" : ""}`}>
      {mine && <span className="badge card-mine-badge">내가 쓴 고소장</span>}
      <h2 className="doc-title font-point">고 소 장</h2>
      <p className="doc-case">CASE #0241</p>
      {chargePending ? (
        <p className="cute-charge" role="status">
          밤톨이 죄명을 짓고 있어요…
        </p>
      ) : (
        data.cute_charge && (
          <p className="cute-charge font-point">「{data.cute_charge}」</p>
        )
      )}
      <h3>사건명</h3>
      <h2>「{title}」</h2>
      <h3>신청인 · 상대방</h3>
      <p>
        신청인 {side} · 상대방 {other}
      </p>
      <h3>사건 개요</h3>
      <p>{data.incident_description}</p>
      <h3>신청인이 느낀 것</h3>
      <p>{feelingText(data)}</p>
      <p className="notice">
        작성자의 관점을 담은 내용이며, 상대방의 동의나 사실 확인을 뜻하지
        않아요.
      </p>
      <h3>원하는 것</h3>
      <p>{data.desired_outcome}</p>
      {data.expected_behavior && (
        <>
          <h3>그때 기대했던 점</h3>
          <p>{data.expected_behavior}</p>
        </>
      )}
      {data.assumption && (
        <>
          <h3>사실로 확인되지 않은 추측</h3>
          <p>{data.assumption}</p>
        </>
      )}
    </article>
  );
}
