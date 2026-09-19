import type { Metadata } from "next";
import { headers } from "next/headers";
import { AppShell } from "@/components/layout/AppShell";
import { LinkedCaseScreen } from "@/features/case/LinkedCaseScreen";
import { validToken } from "@/lib/api/cases";

type Props = { params: Promise<{ token: string }> };

// 카톡 등 링크 미리보기용. 크롤러는 JS를 실행하지 않으므로 서버에서 메타 태그를 만든다.
// 이미지는 사건 내용을 읽지 않고 토큰 경로만 가리킨다 (백엔드가 접수 여부·만료를 판단).
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const base: Metadata = { referrer: "no-referrer", robots: { index: false, follow: false } };
  if (!validToken(token)) return base;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return base;
  const proto = h.get("x-forwarded-proto")?.split(",")[0] ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;
  const image = `${origin}/api/cases/${token}/emotion-image`;
  const title = "밤톨에게 전한 마음";
  const description = "상대가 고소장을 보냈어요. 열어서 마음을 확인해보세요.";
  return {
    ...base,
    title,
    description,
    openGraph: { title, description, url: `${origin}/case/${token}`, type: "website", images: [{ url: image, width: 420, height: 420 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function CasePage({ params }: Props) {
  const { token } = await params;
  return <AppShell><LinkedCaseScreen key={token} token={token} /></AppShell>;
}
