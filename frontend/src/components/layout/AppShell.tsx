import Link from "next/link";

const BRAND_TITLE = "애정 지방법원";
const BRAND_COLORS = ["#5c9678", "#b06f96", "#c66467", "#5c85a8", "#bfae5f", "#7c76a8", "#c99a5f"];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <header>
        <Link href="/">
          <span className="font-kkubulim font-kkubulim-lg brand-title">
            {BRAND_TITLE.split("").map((char, i) =>
              char === " " ? (
                " "
              ) : (
                <span key={i} style={{ color: BRAND_COLORS[i % BRAND_COLORS.length] }}>
                  {char}
                </span>
              ),
            )}
          </span>
        </Link>
        <div className="header-right">
          <span id="dev-tabs-slot" />
          <span className="badge">제1호 법정</span>
        </div>
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
