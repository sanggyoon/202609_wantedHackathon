import Link from "next/link";
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <header>
        <Link href="/">
          ♡ 마음 접수처 <small>가칭</small>
        </Link>
        <span className="badge">WIREFRAME 01</span>
      </header>
      <main>{children}</main>
      <footer>
        실제 법적 효력이 없는 감정 전달 콘텐츠입니다.
        <br />
        AI의 정리는 판결이 아니라 대화를 돕기 위한 요약입니다.
      </footer>
    </div>
  );
}
