import type { ReactNode } from "react";
import { Heading, Notice } from "@/components/ui";

export function WaitingScreen({
  label = "심리 대기 중",
  title = "상대가 지금 마음을 정리하고 있어요.",
  children,
}: {
  label?: string;
  title?: string;
  children?: ReactNode;
}) {
  return (
    <>
      <Heading label={label} title={title}>
        준비가 되면 같은 사건 링크에서 결과를 함께 확인할 수 있어요.
      </Heading>
      <Notice>다른 사람의 작성 중 진술은 표시하지 않습니다.</Notice>
      {children}
    </>
  );
}
