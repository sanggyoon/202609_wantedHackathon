"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { StartScreen } from "./StartScreen";
import { ShareSelectScreen } from "./ShareSelectScreen";
import { StatementSummary } from "@/features/report/StatementSummary";
import { Button, Heading, Notice, Toast } from "@/components/ui";
import { ConversationScreen } from "@/features/conversation/ConversationScreen";
import { StatementCard } from "@/features/report/StatementCard";
import { PreviewScreen } from "@/features/report/PreviewScreen";
import { ApologyScreen } from "@/features/report/ApologyScreen";
import type { Statement, Apology, EntryMode } from "@/features/report/types";
const entryModes = ["new", "invited", "result"] as const;
const screens = [
  "사건 접수",
  "원고 진술",
  "공유 항목 선택",
  "고소장 검토",
  "소환장 발송",
  "소환장 도착",
  "피고 진술",
  "맞고소 항목 선택",
  "맞고소장 검토",
  "맞고소장 발송",
  "양측 대질",
  "사과문 작성",
  "화해 성립",
  "기록 파기",
  "사건 없음",
  "심리 준비",
  "심리 대기",
  "서기 오류",
  "이미 종결",
  "휴정 안내",
] as const;
type Screen = (typeof screens)[number];
export function CaseController({
  initialA,
  initialB,
  initialApology,
  questions,
  initialEntryMode = "new",
}: {
  initialA: Statement;
  initialB: Statement;
  initialApology: Apology;
  questions: Record<"A" | "B", string[]>;
  initialEntryMode?: EntryMode;
}) {
  const [screen, setScreen] = useState<Screen>("사건 접수");
  const [entryMode, setEntryMode] = useState<EntryMode>(initialEntryMode);
  const [a, setA] = useState(initialA);
  const [b, setB] = useState(initialB);
  const [apology, setApology] = useState(initialApology);
  const [mounted, setMounted] = useState(false);
  const [resultTab, setResultTab] = useState<"apology" | "counterclaim">(
    "apology",
  );
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number>(0);
  useEffect(() => {
    setMounted(true);
  }, []);
  const showToast = (message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2000);
  };
  const counterclaimResultContent = (
    <>
      <Heading label="양측 진술 대질" title="다른 마음을, 나란히.">
        두 분이 각자 무엇을 바랐는지, 제가 곁에서 함께 짚어드릴게요.
      </Heading>
      <div className="report-grid">
        <StatementCard side="A" data={a} />
        <StatementCard side="B" data={b} mine />
      </div>
      <div className="panel">
        <span className="badge">중재자의 정리 (판결 아님)</span>
        <h2 className="text-primary">두 사람을 위한, 중재자의 정리</h2>
        <Notice>
          중재자(밤톨) 미연결 상태예요. 아래 정리 영역은 자리 표시자입니다.
        </Notice>
        <h3>함께 인정하는 내용</h3>
        <p>두 이야기에서 확인한 공통점이 표시될 자리</p>
        <h3>다르게 생각하는 내용</h3>
        <p>기억과 기대의 차이가 표시될 자리</p>
        <h3>각자가 서운했던 점</h3>
        <p>신청인(A): {a.feeling}</p>
        <p>상대방(B): {b.feeling}</p>
        <h3>오해가 생긴 지점</h3>
        <p>단정하지 않은 오해 가능성이 표시될 자리</p>
        <h3 className="recommend-title text-primary">중재자의 추천 방안</h3>
        <p className="recommend-desc">
          중재자(밤톨)가 연결되면, 두 사람이 다시 가까워질 수 있는 작은
          해결책을 여기에 제안해드릴게요.
        </p>
      </div>
    </>
  );
  const apologyResultContent = (
    <>
      <Heading label="심리 종결 · 화해 성립" title="미안한 마음이 도착했어요.">
        여기까지 오느라 고생 많았어요. 두 분의 이야기를 천천히 읽어봐요.
      </Heading>
      <Notice>신청인(A)의 사건: {a.incident}</Notice>
      <article className="card side-B">
        <img src="/images/apple.png" alt="" className="apology-icon" />
        <h2 className="doc-title">사 과 문</h2>
        <p className="doc-case">마음을 담아 보내요.</p>
        {apology.understood && (
          <>
            <h3>내가 이해한 상대의 마음</h3>
            <p>{apology.understood}</p>
          </>
        )}
        {apology.admitted && (
          <>
            <h3>내가 인정하는 부분</h3>
            <p>{apology.admitted}</p>
          </>
        )}
        <h3>상대에게 전하는 사과</h3>
        <p>{apology.body}</p>
        {apology.promise && (
          <>
            <h3>다음에는 이렇게 할게</h3>
            <p>{apology.promise}</p>
          </>
        )}
      </article>
      <section className="panel">
        <h2>사건 종결</h2>
        <h3>사과한 행동 또는 상황</h3>
        <p>중재자(밤톨) 연결 후, 화해서에 직접 담긴 내용만 요약해드릴 자리예요.</p>
        <h3>사과를 받은 당신에게 · 밤톨의 추천</h3>
        <p>
          중재자(밤톨)가 연결되면, 사과를 받은 지금 어떤 말이나 행동을 건네면
          두 사람이 더 편안해질지 살며시 추천해드릴게요.
        </p>
      </section>
      <Notice>
        ‘화해 성립’은 답변이 끝났다는 뜻이에요. 사과를 꼭 받아들여야 한다는
        의미는 아니니, 마음은 두 분의 속도대로 나아가면 돼요.
      </Notice>
    </>
  );
  let content;
  switch (screen) {
    case "사건 접수":
      content = (
        <>
          <StartScreen
            entryMode={entryMode}
            resultTab={resultTab}
            onStart={(ending) => {
              setA(initialA);
              setB(initialB);
              setApology(initialApology);
              if (entryMode === "new") setScreen("원고 진술");
              else if (entryMode === "invited") setScreen("소환장 도착");
              else setScreen(ending === "counterclaim" ? "양측 대질" : "화해 성립");
            }}
          />
          {entryMode === "result" &&
            (resultTab === "counterclaim"
              ? counterclaimResultContent
              : apologyResultContent)}
        </>
      );
      break;
    case "원고 진술":
    case "피고 진술": {
      const side = screen === "원고 진술" ? "A" : "B";
      content = (
        <>
          <>{side === "B" && <StatementSummary data={a} />}</>
          <ConversationScreen
            key={side}
            side={side}
            questions={questions[side]}
            onComplete={(v) => {
              if (side === "A") setA(v);
              else setB(v);
              setScreen(side === "A" ? "공유 항목 선택" : "맞고소 항목 선택");
            }}
          />
        </>
      );
      break;
    }
    case "공유 항목 선택":
      content = (
        <ShareSelectScreen
          side="A"
          data={a}
          onComplete={() => setScreen("고소장 검토")}
        />
      );
      break;
    case "맞고소 항목 선택":
      content = (
        <ShareSelectScreen
          side="B"
          data={b}
          onComplete={() => setScreen("맞고소장 검토")}
        />
      );
      break;
    case "고소장 검토":
    case "맞고소장 검토": {
      const side = screen === "고소장 검토" ? "A" : "B";
      content = (
        <PreviewScreen
          key={side}
          side={side}
          initial={side === "A" ? a : b}
          onConfirm={(v) => {
            if (side === "A") setA(v);
            else setB(v);
            setScreen(side === "A" ? "소환장 발송" : "맞고소장 발송");
          }}
        />
      );
      break;
    }
    case "소환장 발송":
      content = (
        <>
          <Heading
            label="소환장, 준비됐어요"
            title="이제 상대의 마음을 기다려볼까요?"
          >
            이 링크 하나로, 두 분의 이야기가 나란히 이어질 거예요.
          </Heading>
          <StatementCard side="A" data={a} />
          <div className="panel">
            <h2>소환장</h2>
            <p className="placeholder">/case/〈사건 링크가 표시될 자리〉</p>
            <Notice>실제 링크 발급·공유는 API 연결 후 제공됩니다.</Notice>
            <div className="actions">
              <Button onClick={() => showToast("링크 복사됨")}>
                소환장 링크 복사
              </Button>
              <Button secondary disabled>
                공유하기
              </Button>
            </div>
            <Notice>
              상대의 답변을 기다리는 중 · 판결문은 7일간 보관돼요 (기준 시각 미정)
            </Notice>
            <Button onClick={() => setScreen("소환장 도착")}>
              피고가 받는 화면 체험하기 →
            </Button>
          </div>
        </>
      );
      break;
    case "맞고소장 발송":
      content = (
        <>
          <Heading
            label="맞고소장, 준비됐어요"
            title="이제 상대의 마음을 기다려볼까요?"
          >
            이 링크 하나로, 두 분의 이야기가 나란히 이어질 거예요.
          </Heading>
          <StatementCard side="B" data={b} />
          <div className="panel">
            <h2>맞고소장</h2>
            <p className="placeholder">/case/〈사건 링크가 표시될 자리〉</p>
            <Notice>실제 링크 발급·공유는 API 연결 후 제공됩니다.</Notice>
            <div className="actions">
              <Button onClick={() => showToast("링크 복사됨")}>
                맞고소장 링크 복사
              </Button>
              <Button secondary disabled>
                공유하기
              </Button>
            </div>
            <Notice>
              상대의 답변을 기다리는 중 · 판결문은 7일간 보관돼요 (기준 시각 미정)
            </Notice>
            <Button
              onClick={() => {
                setEntryMode("result");
                setScreen("사건 접수");
              }}
            >
              원고가 받는 화면 체험하기 →
            </Button>
          </div>
        </>
      );
      break;
    case "소환장 도착":
      content = (
        <>
          <Heading label="당신에게 소환장이 도착했어요" title="조금 서운했대요.">
            너무 걱정 말아요. 먼저 마음을 읽어보고,{"\n"}당신의 이야기도 들려주면 돼요.
          </Heading>
          <StatementSummary data={a} />
          <div className="actions">
            <Button
              className="action-minor font-kkubulim"
              onClick={() => setScreen("사과문 작성")}
            >
              내가 미안
            </Button>
            <Button
              secondary
              className="action-major font-kkubulim font-kkubulim-lg"
              onClick={() => setScreen("피고 진술")}
            >
              나도 할 말 있음
            </Button>
          </div>
          <Notice>
            어떤 걸 선택해도 괜찮아요. 저는 누가 옳은지 가리려는 게 아니라, 두 분이
            다시 이야기 나누길 바랄 뿐이에요.
          </Notice>
        </>
      );
      break;
    case "양측 대질":
      content = counterclaimResultContent;
      break;
    case "사과문 작성":
      content = (
        <ApologyScreen
          summary={a.incident}
          onSubmit={(v) => {
            setApology(v);
            setScreen("화해 성립");
          }}
        />
      );
      break;
    case "화해 성립":
      content = apologyResultContent;
      break;
    case "심리 대기":
      content = (
        <>
          <Heading
            label="심리 대기 중"
            title="상대가 지금 마음을 정리하고 있어요."
          >
            준비가 되면 같은 사건 링크에서 결과를 함께 확인할 수 있어요.
          </Heading>
          <Notice>다른 사람의 작성 중 진술은 표시하지 않습니다.</Notice>
          <Button secondary onClick={() => setScreen("양측 대질")}>
            종결 화면 체험
          </Button>
        </>
      );
      break;
    case "서기 오류":
      content = (
        <>
          <Heading label="서기 오류 예시" title="앗, 잠깐 연결이 끊겼어요.">
            적어주신 내용은 그대로 남아 있으니 걱정 말아요. 다시 시도해봐요.
          </Heading>
          <StatementSummary data={a} />
          <Button onClick={() => setScreen("고소장 검토")}>
            다시 시도하기 (체험)
          </Button>
        </>
      );
      break;
    case "이미 종결":
      content = (
        <>
          <Heading
            label="이미 판결이 있어요"
            title="이 사건은 이미 종결됐어요."
          >
            새로 제출하지 않아도 괜찮아요. 완료된 판결문을 함께 확인해볼까요?
          </Heading>
          <Button onClick={() => setScreen("양측 대질")}>
            최종 판결문 보기
          </Button>
        </>
      );
      break;
    case "휴정 안내":
      content = (
        <>
          <Heading
            label="안내 문구 초안 · 정책 미정"
            title="잠깐, 당신의 안전이 먼저예요."
          >
            혹시 위협이나 폭력과 관련된 일이라면, 이건 장난스러운 고소장으로
            가볍게 다룰 수 없어요. 당신이 안전한 게 저에겐 무엇보다 중요하거든요.
          </Heading>
          <Notice>
            위험 내용 감지 기능은 연결되지 않았습니다. 휴정 안내 화면의 구성
            예시입니다.
          </Notice>
          <Button onClick={() => setScreen("사건 접수")}>접수 창구로 돌아가기</Button>
        </>
      );
      break;
    case "심리 준비":
      content = (
        <>
          <Heading label="화면 상태 예시" title="찬찬히 사건을 살펴보고 있어요." />
          <div
            className="panel skeleton"
            role="status"
            aria-label="불러오는 중"
          >
            <div />
            <div />
            <div />
          </div>
          <Button secondary onClick={() => setScreen("소환장 도착")}>
            심리 시작 화면 보기
          </Button>
        </>
      );
      break;
    default:
      content = (
        <>
          <Heading
            label="링크 안내"
            title={
              screen === "기록 파기"
                ? "이 사건의 보관 기간이 끝났어요."
                : "이 사건을 찾을 수 없어요."
            }
          >
            {screen === "기록 파기"
              ? "아쉽지만 파기된 사건 내용은 다시 볼 수 없어요. 그래도 그 마음은 잘 전해졌을 거예요."
              : "혹시 링크가 올바른지 한 번만 더 확인해 줄래요?"}
          </Heading>
          <div className="empty">{screen === "기록 파기" ? "" : "?"}</div>
          <Button onClick={() => setScreen("사건 접수")}>
            새 사건 접수하기
          </Button>
        </>
      );
  }
  const isChatScreen = screen === "원고 진술" || screen === "피고 진술";
  useEffect(() => {
    if (!isChatScreen) window.scrollTo(0, 0);
  }, [screen, isChatScreen]);
  const devPanel = (
    <aside className="review">
      <label>시작화면 바로가기 (개발용)</label>
      <div className="actions">
        {entryModes.map((m, i) => (
          <Button
            key={m}
            secondary={entryMode !== m}
            onClick={() => {
              setEntryMode(m);
              setScreen("사건 접수");
            }}
          >
            {`시작화면 ${i + 1}`}
            <br />
            {{ new: "A 최초 진입", invited: "B 소환장 링크 진입", result: "완료 후 재진입" }[m]}
          </Button>
        ))}
      </div>
      <label htmlFor="screen">사건 기록 열람</label>
      <select
        id="screen"
        value={screen}
        onChange={(e) => setScreen(e.target.value as Screen)}
      >
        {screens.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      <small>가상 사건 · 저장되지 않음</small>
    </aside>
  );
  const devTabs = (
    <div
      className="dev-tabs-group"
      title="개발용 · 스크롤로 이어질 결과 미리보기"
    >
      <small>개발용</small>
      <div className="dev-tabs">
        <button
          type="button"
          className={resultTab === "apology" ? "active" : ""}
          onClick={() => setResultTab("apology")}
        >
          사과문 탭
        </button>
        <button
          type="button"
          className={resultTab === "counterclaim" ? "active" : ""}
          onClick={() => setResultTab("counterclaim")}
        >
          맞고소 탭
        </button>
      </div>
    </div>
  );
  const showDevTabs = screen === "사건 접수" && entryMode === "result";
  const devTabsSlot =
    mounted && typeof document !== "undefined"
      ? document.getElementById("dev-tabs-slot")
      : null;
  return (
    <>
      <div key={screen} className="screen">
        {content}
      </div>
      {devTabsSlot && showDevTabs && createPortal(devTabs, devTabsSlot)}
      {mounted && !isChatScreen && createPortal(devPanel, document.body)}
      {mounted && createPortal(<Toast message={toast} />, document.body)}
    </>
  );
}
