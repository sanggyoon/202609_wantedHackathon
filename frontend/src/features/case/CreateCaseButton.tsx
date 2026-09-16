"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Notice } from "@/components/ui";
import { casePath, createCase, type CaseCreated } from "@/lib/api/cases";
import { checkWriterStorage, rememberWriter } from "./writerSession";
export function CreateCaseButton() {
  const router = useRouter();
  const active = useRef<AbortController | null>(null);
  const created = useRef<CaseCreated | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => active.current?.abort(), []);
  async function start() {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    try {
      try { checkWriterStorage(); } catch { throw new Error("브라우저의 탭 저장소를 사용할 수 없어요. 저장소 허용 후 다시 시도해주세요."); }
      // Retry storage/navigation with the same issued credentials, not a second case.
      const value = created.current ?? await createCase(controller.signal);
      created.current = value;
      if (controller.signal.aborted) return;
      try { rememberWriter(value); } catch { throw new Error("작성 권한을 보관하지 못했어요. 이 화면에서 다시 시도해주세요."); }
      router.push(casePath(value.public_token));
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "시작하지 못했어요.");
      active.current = null;
      setBusy(false);
    }
  }
  return <>
    <Button disabled={busy} onClick={() => void start()}>{busy ? "사건을 준비하고 있어요…" : "시작하기 ↗"}</Button>
    {error && <p role="alert">{error} 응답을 받기 전에 연결이 끊겼다면 빈 사건이 생성됐을 수 있어요. 자동으로 재요청하지 않습니다.</p>}
    <Notice>사건 번호와 작성 권한만 발급됩니다. 고소장 저장·전송은 아직 준비 중이에요.</Notice>
    <Notice>작성 권한은 이 탭에 보관돼요. 새로고침에는 유지되지만 탭을 닫거나 다른 기기로 이동하면 복구되지 않을 수 있어요. 대화는 저장하지 않아요.</Notice>
  </>;
}
