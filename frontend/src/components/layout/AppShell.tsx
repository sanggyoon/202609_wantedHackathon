import Link from "next/link";
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <header>
        <Link href="/">
          ⚖️ 애정 지방법원 <small>가칭</small>
        </Link>
        <span className="badge">제1호 법정</span>
      </header>
      <main>{children}</main>
      <footer>
        실제 법적 효력이 없는, 마음 전달용 콘텐츠예요.
        <br />
        중재자의 정리는 판결이 아니라, 두 사람의 대화를 돕기 위한 참고 의견입니다.
      </footer>
    </div>
  );
}
