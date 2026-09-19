"use client";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Button, Notice } from "@/components/ui";
import { MediationPanel, MediationReport } from "@/features/report/MediationReport";
import { CaseApiError, liveCaseApi, type CaseApi, type CaseView } from "@/lib/api/cases";
import { ADraftFlow } from "./ADraftFlow";
import { BResponseFlow, type BStep } from "./BResponseFlow";
import type { Statement } from "@/features/report/types";
import { caseStage, failureAction } from "./caseStage";
import { ShareCaseLink } from "./ShareCaseLink";
import { StartScreen } from "./StartScreen";
import { ApologyResult } from "./screens/ApologyResult";
import { CaseGoneScreen } from "./screens/CaseGoneScreen";
import { CounterclaimResult } from "./screens/CounterclaimResult";
import { SummonsSentScreen } from "./screens/SummonsSentScreen";
import { WaitingScreen } from "./screens/WaitingScreen";
import { forgetWriter, getWriter } from "./writerSession";

export type Submit = (run: () => Promise<CaseView>) => Promise<void>;

const KEEP_DRAFT = " 작성한 내용은 그대로 있어요.";
const FORBIDDEN =
  "이 브라우저에서 작성 권한을 확인하지 못했어요. 사건을 만든 브라우저에서 접수해주세요.";

// 시안(/wireframe)이 작성 중간 화면을 바로 열어볼 때만 쓴다.
export type CaseSeed = { aDraft?: Statement; bStep?: BStep; bDraft?: Statement };

export function LinkedCaseScreen({
  token,
  api = liveCaseApi,
  seed,
}: {
  token: string;
  api?: CaseApi;
  seed?: CaseSeed;
}) {
  const [view, setView] = useState<CaseView | null>(null);
  const [error, setError] = useState<CaseApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const submitting = useRef(false);
  const gone = useCallback(
    (failure: CaseApiError) => {
      forgetWriter(token);
      setView(null);
      setError(failure);
    },
    [token],
  );
  const load = useCallback(
    (controller: AbortController) => {
      return api.readCase(token, getWriter(token), controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) setView(result);
        })
        .catch((e) => {
          if (controller.signal.aborted) return;
          const failure = e instanceof CaseApiError ? e : new CaseApiError(0, "사건을 불러오지 못했어요.");
          if (failureAction(failure.status) === "gone") gone(failure);
          else setError(failure);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    },
    [token, api, gone],
  );
  const refresh = useCallback(() => {
    // 제출 중에는 화면이 바뀌지 않게 재조회하지 않는다.
    if (submitting.current) return;
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
    const focus = () => {
      if (mounted.current) refresh();
    };
    window.addEventListener("focus", focus);
    window.addEventListener("pageshow", focus);
    return () => {
      mounted.current = false;
      active.current?.abort();
      window.removeEventListener("focus", focus);
      window.removeEventListener("pageshow", focus);
    };
  }, [refresh, load]);
  useEffect(() => {
    if (!view) return;
    // 페이지를 열어둔 채 보관 기한이 지나도 내용을 내린다.
    const timer = setTimeout(
      () => gone(new CaseApiError(410, "보관 기간이 끝난 사건이에요.")),
      Math.max(0, Math.min(Date.parse(view.expires_at) - Date.now(), 2147483647)),
    );
    return () => clearTimeout(timer);
  }, [view, gone]);
  const submit = useCallback<Submit>(
    async (run) => {
      if (submitting.current || !view) return;
      submitting.current = true;
      // 진행 중인 조회는 취소한다. 취소된 조회는 loading을 내리지 않으므로 여기서 내린다.
      active.current?.abort();
      setLoading(false);
      setBusy(true);
      setSubmitError(null);
      setNotice(null);
      const before = caseStage(view);
      try {
        setView(await run());
      } catch (e) {
        const failure = e instanceof CaseApiError ? e : new CaseApiError(0, "연결이 끊겼거나 응답이 늦어지고 있어요.");
        const action = failureAction(failure.status);
        if (action === "gone") gone(failure);
        else if (action === "keep")
          setSubmitError((failure.status === 403 ? FORBIDDEN : failure.message) + KEEP_DRAFT);
        else {
          // 저장됐는지 모른다. 서버에 물어보고 단계가 바뀌었으면 그 결과를 따른다.
          try {
            const latest = await api.readCase(token, getWriter(token));
            setView(latest);
            if (caseStage(latest) !== before)
              setNotice(
                failure.status === 409
                  ? "이미 제출된 사건이에요. 최신 상태를 보여드릴게요."
                  : "제출이 확인됐어요.",
              );
            else setSubmitError(failure.message + KEEP_DRAFT + " 다시 제출해주세요.");
          } catch (again) {
            if (again instanceof CaseApiError && failureAction(again.status) === "gone") gone(again);
            else setSubmitError(failure.message + KEEP_DRAFT + " 다시 제출해주세요.");
          }
        }
      } finally {
        submitting.current = false;
        setBusy(false);
      }
    },
    [token, api, view, gone],
  );

  if (loading && !view) return <p role="status">사건을 확인하고 있어요…</p>;
  if (error && !view) {
    if (failureAction(error.status) === "gone")
      return (
        <section className="screen">
          <CaseGoneScreen kind={error.status === 410 ? "expired" : "missing"}>
            <Link className="button" href="/">
              새 사건 접수하기
            </Link>
          </CaseGoneScreen>
        </section>
      );
    return (
      <section className="screen">
        <h1>잠깐, 연결을 확인해주세요.</h1>
        <p role="alert">{error.message}</p>
        <Button onClick={refresh}>다시 확인하기</Button>
        <Link href="/">처음으로</Link>
      </section>
    );
  }
  if (!view) return null;

  const stage = caseStage(view);
  const cards = view.content?.cards ?? {};
  const until = new Date(view.expires_at).toLocaleString("ko-KR");
  const refreshButton = (
    <Button secondary disabled={loading || busy} onClick={refresh}>
      새로고침
    </Button>
  );
  const destroyNotice = (
    <>
      판결문(결과물)은 <strong>{until}</strong>에 파기돼요.
    </>
  );
  function apologyResult() {
    if (!cards.A || !view?.content?.apology) return null;
    return (
      <>
        <StartScreen entryMode="result" resultTab="apology" notice={destroyNotice} onStart={() => {}} />
        <ApologyResult complaint={cards.A} apology={view.content.apology}>
          <p>
            B의 사과문이 저장됐어요. 위 카드에는 직접 적은 내용만 담았고, AI가
            사과나 약속을 추가하지 않았어요.
          </p>
        </ApologyResult>
      </>
    );
  }
  function counterResult() {
    if (!cards.A || !cards.B || !view?.content?.report) return null;
    return (
      <>
        <StartScreen
          entryMode="result"
          resultTab="counterclaim"
          emotionA={cards.A.emotion_scores}
          emotionB={cards.B.emotion_scores}
          notice={destroyNotice}
          onStart={() => {}}
        />
        <CounterclaimResult
          a={cards.A}
          b={cards.B}
          mine={view.viewer_role}
          report={
            <MediationPanel>
              <MediationReport
                report={view.content.report}
                notice="저장된 중재 정리예요. 누가 옳은지 판결하지 않아요."
              />
            </MediationPanel>
          }
        />
      </>
    );
  }
  function waiting(title?: string, label?: string) {
    return (
      <WaitingScreen title={title} label={label}>
        {refreshButton}
      </WaitingScreen>
    );
  }
  function body() {
    switch (stage) {
      case "a-draft":
        return <ADraftFlow token={token} api={api} seed={seed?.aDraft} busy={busy} error={submitError} submit={submit} />;
      case "not-ready":
        return waiting("아직 고소장이 접수되지 않았어요.", "심리 준비 중");
      case "a-sent":
        return cards.A ? (
          <SummonsSentScreen side="A" card={cards.A}>
            <ShareCaseLink token={token} />
            <Notice>상대의 답변을 기다리는 중 · {until}까지 보관돼요</Notice>
            {refreshButton}
          </SummonsSentScreen>
        ) : (
          waiting()
        );
      case "a-waiting":
        return waiting();
      case "b-respond":
      case "b-apology":
      case "b-counter":
        return cards.A ? (
          <BResponseFlow
            token={token}
            api={api}
            seed={{ step: seed?.bStep, draft: seed?.bDraft }}
            complaint={cards.A}
            stage={stage}
            busy={busy}
            error={submitError}
            submit={submit}
          />
        ) : (
          waiting()
        );
      case "result-apology":
        return apologyResult() ?? waiting();
      case "result-counter":
        return counterResult() ?? waiting();
      case "read-only":
        return apologyResult() ?? counterResult() ?? waiting();
    }
  }
  // B의 세 단계는 같은 흐름이다. 선택만 확정되고 제출이 실패해 단계가 바뀌어도 작성 중 내용을 지키려고 key를 같게 둔다.
  const flowKey = stage.startsWith("b-") ? "b" : stage;
  return (
    <div className="screen" aria-busy={loading || busy}>
      {notice && <Notice>{notice}</Notice>}
      {error && <p role="alert">{error.message} 작성 중 내용은 그대로 두었어요.</p>}
      <Fragment key={flowKey}>{body()}</Fragment>
    </div>
  );
}
