import type { ReactNode } from "react";
import { Heading, Notice } from "@/components/ui";
import type { Statement } from "@/features/report/types";

// 서버에 저장된 사과문은 선택 항목이 null로 올 수 있다.
export type ApologyView = {
  body: string;
  understood_point?: string | null;
  admitted_point?: string | null;
  future_commitment?: string | null;
};

export function ApologyResult({
  complaint,
  apology,
  children,
}: {
  complaint: Statement;
  apology: ApologyView;
  children: ReactNode;
}) {
  return (
    <>
      <Heading label="심리 종결 · 화해 성립" title="미안한 마음이 도착했어요.">
        여기까지 오느라 고생 많았어요. 두 분의 이야기를 천천히 읽어봐요.
      </Heading>
      <Notice>
        신청인(A)의 사건: {complaint.incident_summary || complaint.incident_description}
      </Notice>
      <article className="card side-B">
        <img src="/images/apple.png" alt="" className="apology-icon" />
        <h2 className="doc-title">사 과 문</h2>
        <p className="doc-case">마음을 담아 보내요.</p>
        {apology.understood_point && (
          <>
            <h3>내가 이해한 상대의 마음</h3>
            <p>{apology.understood_point}</p>
          </>
        )}
        {apology.admitted_point && (
          <>
            <h3>내가 인정하는 부분</h3>
            <p>{apology.admitted_point}</p>
          </>
        )}
        <h3>상대에게 전하는 사과</h3>
        <p>{apology.body}</p>
        {apology.future_commitment && (
          <>
            <h3>다음에는 이렇게 할게</h3>
            <p>{apology.future_commitment}</p>
          </>
        )}
      </article>
      <section className="panel">
        <h2>사건 종결</h2>
        {children}
      </section>
      <Notice>
        ‘화해 성립’은 답변이 끝났다는 뜻이에요. 사과를 꼭 받아들여야 한다는
        의미는 아니니, 마음은 두 분의 속도대로 나아가면 돼요.
      </Notice>
    </>
  );
}
