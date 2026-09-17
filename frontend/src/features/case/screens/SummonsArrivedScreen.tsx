import { Button, Heading, Notice } from "@/components/ui";
import { StatementSummary } from "@/features/report/StatementSummary";
import type { Statement } from "@/features/report/types";

// 링크를 받은 사람이 고소장을 읽고 답하는 방식을 고르는 화면. 고르기만 하고 확정하지 않는다.
export function SummonsArrivedScreen({
  complaint,
  onApologize,
  onCounter,
  demo,
}: {
  complaint: Statement;
  onApologize: () => void;
  onCounter: () => void;
  demo?: boolean;
}) {
  return (
    <>
      <Heading label="당신에게 소환장이 도착했어요" title="조금 서운했대요.">
        너무 걱정 말아요. 먼저 마음을 읽어보고,{"\n"}당신의 이야기도 들려주면 돼요.
      </Heading>
      <StatementSummary data={complaint} demo={demo} />
      <div className="actions">
        <Button className="action-minor font-kkubulim" onClick={onApologize}>
          내가 미안
        </Button>
        <Button
          secondary
          className="action-major font-kkubulim font-kkubulim-lg"
          onClick={onCounter}
        >
          나도 할 말 있음
        </Button>
      </div>
      <Notice>
        어떤 걸 선택해도 괜찮아요. 저는 누가 옳은지 가리려는 게 아니라, 두
        분이 다시 이야기 나누길 바랄 뿐이에요.
      </Notice>
    </>
  );
}
