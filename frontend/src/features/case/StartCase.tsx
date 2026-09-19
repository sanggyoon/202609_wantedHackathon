"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { casePath, createCase, type CaseCreated } from "@/lib/api/cases";
import { StartScreen } from "./StartScreen";
import { checkWriterStorage, rememberWriter } from "./writerSession";
// 서비스 첫 화면. 화면 구성은 StartScreen(시작화면 1)을 그대로 쓰고, 시작하면 사건을 만든다.
export function StartCase() {
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
      try {
        checkWriterStorage();
      } catch {
        throw new Error(
          "브라우저 저장소를 사용할 수 없어요. 저장소 허용 후 다시 시도해주세요.",
        );
      }
      // Retry storage/navigation with the same issued credentials, not a second case.
      const value = created.current ?? (await createCase(controller.signal));
      created.current = value;
      if (controller.signal.aborted) return;
      try {
        rememberWriter(value);
      } catch {
        throw new Error(
          "작성 권한을 보관하지 못했어요. 이 화면에서 다시 시도해주세요.",
        );
      }
      router.push(casePath(value.public_token));
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "시작하지 못했어요.");
      active.current = null;
      setBusy(false);
    }
  }
  return (
    <StartScreen
      entryMode="new"
      busy={busy}
      notice={
        <>
          판결문(결과물)은 <strong>7일 후 파기</strong>돼요. 작성 권한은 이
          브라우저에 보관돼요. 다른 기기에서는 작성자로 인식되지 않아요. 대화는
          저장하지 않아요.
          {error && (
            <>
              <br />
              <span role="alert">
                {error} 응답을 받기 전에 연결이 끊겼다면 빈 사건이 생성됐을 수
                있어요. 자동으로 재요청하지 않습니다.
              </span>
            </>
          )}
        </>
      }
      onStart={() => void start()}
    />
  );
}
