import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { LinkedCaseScreen } from "@/features/case/LinkedCaseScreen";
export const metadata: Metadata = { referrer: "no-referrer", robots: { index: false, follow: false } };
export default async function CasePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <AppShell><LinkedCaseScreen key={token} token={token} /></AppShell>;
}
