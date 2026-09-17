import type { ReactNode } from "react";
import { Heading } from "@/components/ui";
import { StatementCard } from "@/features/report/StatementCard";
import type { Statement } from "@/features/report/types";

// 링크를 보낸 사람의 화면. 공유 방법(체험·실제)은 children으로 받는다.
export function SummonsSentScreen({
  side,
  card,
  children,
}: {
  side: "A" | "B";
  card: Statement;
  children: ReactNode;
}) {
  const doc = side === "A" ? "소환장" : "맞고소장";
  return (
    <>
      <Heading
        label={`${doc}, 준비됐어요`}
        title="이제 상대의 마음을 기다려볼까요?"
      >
        이 링크 하나로, 두 분의 이야기가 나란히 이어질 거예요.
      </Heading>
      <StatementCard side={side} data={card} />
      <div className="panel">
        <h2>{doc}</h2>
        {children}
      </div>
    </>
  );
}
