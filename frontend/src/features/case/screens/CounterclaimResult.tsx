import type { ReactNode } from "react";
import { Heading } from "@/components/ui";
import { StatementCard } from "@/features/report/StatementCard";
import type { Statement } from "@/features/report/types";

// 양측 카드와 중재 정리. 정리를 새로 만들지(체험) 저장된 것을 보여줄지(링크)는 report로 받는다.
export function CounterclaimResult({
  a,
  b,
  mine,
  report,
}: {
  a: Statement;
  b: Statement;
  mine: "A" | "B";
  report: ReactNode;
}) {
  return (
    <>
      <Heading label="양측 진술 대질" title="다른 마음을, 나란히.">
        두 분이 각자 무엇을 바랐는지, 제가 곁에서 함께 짚어드릴게요.
      </Heading>
      {/* 임시 결과 이미지: 감정 이미지 8종 중 하나씩. 실제 결과 이미지가 생기면 교체한다. */}
      <div className="result-image-pair">
        <img src="/images/anger.png" alt="A 측 결과 이미지(임시)" />
        <img src="/images/sadness.png" alt="B 측 결과 이미지(임시)" />
      </div>
      <div className="report-grid">
        <StatementCard side="A" data={a} mine={mine === "A"} />
        <StatementCard side="B" data={b} mine={mine === "B"} />
      </div>
      {report}
    </>
  );
}
