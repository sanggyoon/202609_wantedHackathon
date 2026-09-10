import type { Statement } from "./types";
export function StatementCard({
  side,
  data,
}: {
  side: "A" | "B";
  data: Statement;
}) {
  return (
    <article className={`card side-${side}`}>
      <span className="badge">
        {side}의 {side === "A" ? "고소장" : "맞고소장"}
      </span>
      <h2>마음알아주길바람죄</h2>
      <small>예시 죄명 · {side}의 관점</small>
      <h3>사건 한 줄 요약</h3>
      <p>{data.incident.split(/[.!?。\n]/)[0]}</p>
      <h3>내가 본 그날의 일</h3>
      <p>{data.incident}</p>
      <h3>그때 내 마음은</h3>
      <p>{data.feeling}</p>
      <h3>너에게 바라는 건</h3>
      <p>{data.wish}</p>
      <h3>내가 기대했던 점</h3>
      <p>
        대화에서 확인된 당시의 기대가 표시될 자리입니다. 현재 바라는 점과 구분해
        정리합니다.
      </p>
      <h3>서로 다르게 생각할 수 있는 지점</h3>
      <p>
        그날의 상황과 기대는 서로 다를 수 있어요. 실제 분석은 AI 연결 후
        제공됩니다.
      </p>
      <details>
        <summary>고소장 전체 보기</summary>
        <p>
          작성자가 말한 경험과 감정입니다. 상대의 의도는 확인하지 않았어요.
          그날의 기대나 기억은 서로 다를 수 있어요.
        </p>
      </details>
    </article>
  );
}
