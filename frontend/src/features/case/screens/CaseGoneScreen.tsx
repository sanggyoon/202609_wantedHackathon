import type { ReactNode } from "react";
import { Heading } from "@/components/ui";

export function CaseGoneScreen({
  kind,
  children,
}: {
  kind: "expired" | "missing";
  children: ReactNode;
}) {
  const expired = kind === "expired";
  return (
    <>
      <Heading
        label="링크 안내"
        title={expired ? "이 사건의 보관 기간이 끝났어요." : "이 사건을 찾을 수 없어요."}
      >
        {expired
          ? "아쉽지만 파기된 사건 내용은 다시 볼 수 없어요. 그래도 그 마음은 잘 전해졌을 거예요."
          : "혹시 링크가 올바른지 한 번만 더 확인해 줄래요?"}
      </Heading>
      <div className="empty">{expired ? "" : "?"}</div>
      {children}
    </>
  );
}
