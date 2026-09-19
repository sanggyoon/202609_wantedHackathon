"use client";
import { useState } from "react";
import { Button, Notice, Toast } from "@/components/ui";
import { casePath } from "@/lib/api/cases";

// 실제 사건 링크 복사·공유. 클립보드가 막히면 직접 선택할 수 있는 입력칸을 보여준다.
export function ShareCaseLink({ token }: { token: string }) {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  function link() {
    return window.location.origin + casePath(token);
  }
  async function copy() {
    const value = link();
    setUrl(value);
    try {
      await navigator.clipboard.writeText(value);
      setMessage("");
      setToast("복사됨");
      window.setTimeout(() => setToast(null), 1800);
    } catch {
      setMessage("아래 링크를 직접 선택해서 복사해주세요.");
    }
  }
  async function share() {
    if (!navigator.share) {
      await copy();
      return;
    }
    try {
      await navigator.share({ title: "밤톨에게 전한 마음", url: link() });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) await copy();
    }
  }
  return (
    <>
      <p className="placeholder">{link()}</p>
      <Notice>링크를 가진 사람은 사건을 열람할 수 있어요. 상대에게만 전달해주세요.</Notice>
      <div className="actions">
        <Button onClick={() => void copy()}>소환장 링크 복사</Button>
        <Button secondary onClick={() => void share()}>
          공유하기
        </Button>
      </div>
      <Toast message={toast} />
      {message && <p role="status">{message}</p>}
      {url && message.startsWith("아래") && (
        <label className="field">
          공유 링크
          <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
        </label>
      )}
    </>
  );
}
