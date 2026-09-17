import type { ReactNode } from "react";
import { Notice } from "@/components/ui";
import type { MediationResult } from "@/lib/api/mediation";

// 중재 정리를 감싸는 패널. 체험판(AI 요청)과 링크 화면(저장된 리포트)이 함께 쓴다.
export function MediationPanel({ children }: { children: ReactNode }) {
  return (
    <section className="panel">
      <span className="badge">중재자의 정리 (판결 아님)</span>
      <h2 className="text-primary">두 사람을 위한, 중재자의 정리</h2>
      {children}
    </section>
  );
}

// 리포트를 보여주기만 한다. 요청·저장은 하지 않는다.
export function MediationReport({
  report,
  notice,
}: {
  report: MediationResult["report"];
  notice: string;
}) {
  return (
    <>
      <Notice>{notice}</Notice>
      {(
        [
          [
            "함께 인정하는 내용",
            report.common_ground,
            "두 카드에서 공통으로 확인된 내용은 아직 없어요.",
          ],
          [
            "각자가 설명한 상황 (공유 내용 그대로)",
            report.different_views,
            "명시적으로 확인된 차이는 없어요.",
          ],
          ["신청인(A)의 마음", report.hurt_points_a, "공유된 감정이 없어요."],
          ["상대방(B)의 마음", report.hurt_points_b, "공유된 감정이 없어요."],
        ] as const
      ).map(([title, items, empty]) => (
        <div key={title}>
          <h3>{title}</h3>
          {items.length ? (
            <ul>
              {items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>{empty}</p>
          )}
        </div>
      ))}
      <h3>오해가 생겼을 가능성</h3>
      <p>
        {report.possible_misunderstanding ||
          "지금 내용만으로는 판단하기 어려워요."}
      </p>
      <h3 className="recommend-title text-primary">다음 대화의 시작 문장</h3>
      <p className="recommend-desc">{report.conversation_starter}</p>
    </>
  );
}
