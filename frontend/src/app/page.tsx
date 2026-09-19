import { StartCase } from "@/features/case/StartCase";
import { AppShell } from "@/components/layout/AppShell";
export default function Home() {
  return (
    <AppShell>
      <StartCase />
    </AppShell>
  );
}
