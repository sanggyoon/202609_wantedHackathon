"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Notice } from "@/components/ui";
import { CaseApiError, casePath, readCase, type CaseView } from "@/lib/api/cases";
import { ConversationScreen } from "@/features/conversation/ConversationScreen";
import { StatementCard } from "@/features/report/StatementCard";
import { PreviewScreen } from "@/features/report/PreviewScreen";
import type { Statement } from "@/features/report/types";
import { ShareSelectScreen } from "./ShareSelectScreen";
import { forgetWriter, getWriter } from "./writerSession";

export function LinkedCaseScreen({ token }: { token: string }) {
  const [view, setView] = useState<CaseView | null>(null);
  const [error, setError] = useState<CaseApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const active = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const load = useCallback((controller: AbortController) => {
    return readCase(token, getWriter(token), controller.signal).then(result => {
      if (!controller.signal.aborted) setView(result);
    }).catch(e => {
      if (controller.signal.aborted) return;
      const failure = e instanceof CaseApiError ? e : new CaseApiError(0, "사건을 불러오지 못했어요.");
      if ([404, 410].includes(failure.status)) setView(null);
      setError(failure);
      if ([404, 410].includes(failure.status)) forgetWriter(token);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
  }, [token]);
  const refresh = useCallback(() => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    setError(null);
    void load(controller);
  }, [load]);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    active.current = controller;
    void load(controller);
    const focus = () => { if (mounted.current) void refresh(); };
    window.addEventListener("focus", focus);
    window.addEventListener("pageshow", focus);
    return () => { mounted.current = false; active.current?.abort(); window.removeEventListener("focus", focus); window.removeEventListener("pageshow", focus); };
  }, [refresh, load]);
  useEffect(() => {
    if (!view) return;
    // Hide content at the server-provided deadline even if the page stays open.
    const timer = setTimeout(() => {
      setView(null);
      setError(new CaseApiError(410, "보관 기간이 끝난 사건이에요."));
      forgetWriter(token);
    }, Math.max(0, Math.min(Date.parse(view.expires_at) - Date.now(), 2147483647)));
    return () => clearTimeout(timer);
  }, [view, token]);
  if (loading && !view) return <p role="status">사건을 확인하고 있어요…</p>;
  if (error && !view) return <section className="screen">
    <h1>{error.status === 410 ? "이 사건의 보관 기간이 끝났어요." : error.status === 404 ? "사건을 찾을 수 없어요." : "잠깐, 연결을 확인해주세요."}</h1>
    <p role="alert">{error.message}</p>
    {![404, 410].includes(error.status) && <Button onClick={() => void refresh()}>다시 확인하기</Button>}
    <Link href="/">처음으로</Link>
  </section>;
  if (!view) return null;
  return <div className="screen" aria-busy={loading}>
    {error && <p role="alert">{error.message} 작성 중 내용은 그대로 두었어요. 아래에서 다시 확인해주세요.</p>}
    <Notice>보관 기한: {new Date(view.expires_at).toLocaleString("ko-KR")} · {view.viewer_role === "A" ? "작성자" : "링크 열람자"}</Notice>
    {loading && <p role="status">최신 상태를 확인하고 있어요…</p>}
    {view.status === "DRAFT" ? view.viewer_role === "A" && view.available_actions.includes("converse")
      ? <DraftCase />
      : <Notice>아직 고소장이 확정되지 않았어요. 작성자가 같은 탭에서 접수해야 해요. 다른 탭·기기에서는 작성 권한을 확인하지 못할 수 있어요.</Notice>
      : <SavedCase view={view} token={token} />}
    <Button secondary disabled={loading} onClick={() => void refresh()}>사건 상태 새로 확인하기</Button>
    <Notice>새로고침하거나 이 화면을 떠나면 작성 중 대화·초안은 사라져요.</Notice>
  </div>;
}
function DraftCase() {
  const [draft, setDraft] = useState<Statement | null>(null);
  const [selected, setSelected] = useState<Statement | null>(null);
  return <>
    <Notice>사건은 생성됐지만 고소장 저장 기능은 아직 연결되지 않았어요. 초안 검토까지 가능하며 상대에게 공유할 수는 없어요.</Notice>
    {!draft ? <ConversationScreen side="A" onComplete={setDraft} />
      : !selected ? <ShareSelectScreen side="A" data={draft} onComplete={setSelected} />
      : <PreviewScreen side="A" initial={selected} onConfirm={() => {}} submitDisabled />}
  </>;
}
function SavedCase({ view, token }: { view: CaseView; token: string }) {
  const content = view.content;
  const report = content?.report;
  return <>
    <h1>{view.status.endsWith("COMPLETED") ? "두 사람의 이야기가 도착했어요." : "사건의 진행 상황이에요."}</h1>
    {content?.cards.A && <StatementCard side="A" data={content.cards.A} saved />}
    {content?.cards.B && <StatementCard side="B" data={content.cards.B} saved />}
    {view.viewer_role === "A" && content?.cards.A && <ShareCaseLink token={token} />}
    {view.available_actions.includes("choose_response_type") && <Notice>사과·맞고소 선택을 저장하는 기능은 준비 중이에요.</Notice>}
    {(view.status === "COUNTER_DRAFT" || view.status === "APOLOGY_DRAFT") && <Notice>상대방 답변 작성·제출 연결은 준비 중이에요. 현재 저장된 내용만 표시합니다.</Notice>}
    {report && <section className="panel">
      <h2>중재자의 정리 (판결 아님)</h2>
      {([["함께 인정하는 내용", report.common_ground], ["각자의 설명", report.different_views], ["A의 마음", report.hurt_points_a], ["B의 마음", report.hurt_points_b]] as const).map(([title, items]) =>
        <div key={title}><h3>{title}</h3><ul>{items.map((s, i) => <li key={i}>{s}</li>)}</ul></div>)}
      <h3>오해가 생겼을 가능성</h3><p>{report.possible_misunderstanding || "지금 내용만으로는 판단하기 어려워요."}</p>
      <h3>다음 대화의 시작 문장</h3><p>{report.conversation_starter}</p>
    </section>}
    {content?.apology && <section className="card"><h2>사과문</h2>
      {content.apology.understood_point && <p>이해한 마음: {content.apology.understood_point}</p>}
      {content.apology.admitted_point && <p>인정하는 점: {content.apology.admitted_point}</p>}
      <p>{content.apology.body}</p>
      {content.apology.future_commitment && <p>앞으로의 약속: {content.apology.future_commitment}</p>}
    </section>}
    {view.status === "AWAITING_RESPONSE" && view.viewer_role === "A" && <Notice>상대방의 답변을 기다리고 있어요.</Notice>}
  </>;
}
function ShareCaseLink({ token }: { token: string }) {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  function link() { return window.location.origin + casePath(token); }
  async function copy() {
    const value = link();
    setUrl(value);
    try { await navigator.clipboard.writeText(value); setMessage("링크를 복사했어요."); }
    catch { setMessage("아래 링크를 직접 선택해서 복사해주세요."); }
  }
  async function share() {
    if (!navigator.share) { await copy(); return; }
    try { await navigator.share({ title: "밤톨에게 전한 마음", url: link() }); }
    catch (e) { if (!(e instanceof DOMException && e.name === "AbortError")) await copy(); }
  }
  return <section className="panel">
    <Notice>링크를 가진 사람은 사건을 열람할 수 있어요. 상대에게만 전달해주세요.</Notice>
    <div className="actions"><Button onClick={() => void copy()}>링크 복사</Button><Button secondary onClick={() => void share()}>공유하기</Button></div>
    {message && <p role="status">{message}</p>}
    {url && <label>공유 링크<input readOnly value={url} onFocus={e => e.currentTarget.select()} /></label>}
  </section>;
}
