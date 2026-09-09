"use client";
import { useState } from "react";
import { StartScreen } from "./StartScreen";
import { StatementSummary } from "@/features/report/StatementSummary";
import { Button, Heading, Notice } from "@/components/ui";
import { ConversationScreen } from "@/features/conversation/ConversationScreen";
import { StatementCard } from "@/features/report/StatementCard";
import { PreviewScreen } from "@/features/report/PreviewScreen";
import { ApologyScreen } from "@/features/report/ApologyScreen";
import type { Statement, Apology } from "@/features/report/types";
const screens = [
  "시작하기",
  "A 대화",
  "A 미리보기",
  "공유·대기",
  "B 열람",
  "B 대화",
  "B 미리보기",
  "맞고소 결과",
  "사과 작성",
  "사과 결과",
  "만료",
  "오류",
  "로딩",
  "응답 작성 중",
  "생성 실패",
  "중복 제출",
  "안전 안내",
] as const;
type Screen = (typeof screens)[number];
export function CaseController({
  initialA,
  initialB,
  initialApology,
  questions,
}: {
  initialA: Statement;
  initialB: Statement;
  initialApology: Apology;
  questions: Record<"A" | "B", string[]>;
}) {
  const [screen, setScreen] = useState<Screen>("시작하기");
  const [a, setA] = useState(initialA);
  const [b, setB] = useState(initialB);
  const [apology, setApology] = useState(initialApology);
  let content;
  switch (screen) {
    case "시작하기":
      content = (
        <StartScreen
          onStart={() => {
            setA(initialA);
            setB(initialB);
            setApology(initialApology);
            setScreen("A 대화");
          }}
        />
      );
      break;
    case "A 대화":
    case "B 대화": {
      const side = screen === "A 대화" ? "A" : "B";
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
              setScreen(side === "A" ? "A 미리보기" : "B 미리보기");
            }}
          />
        </>
      );
      break;
    }
    case "A 미리보기":
    case "B 미리보기": {
      const side = screen === "A 미리보기" ? "A" : "B";
      content = (
        <PreviewScreen
          key={side}
          side={side}
          initial={side === "A" ? a : b}
          onConfirm={(v) => {
            if (side === "A") setA(v);
            else setB(v);
            setScreen(side === "A" ? "공유·대기" : "맞고소 결과");
          }}
        />
      );
      break;
    }
    case "공유·대기":
      content = (
        <>
          <Heading
            label="마음 전달 준비 완료"
            title="상대의 이야기를 기다려요."
          >
            같은 링크에서 서로의 답변을 함께 보게 돼요.
          </Heading>
          <StatementCard side="A" data={a} />
          <div className="panel">
            <h2>하나의 사건, 하나의 링크</h2>
            <p className="placeholder">/case/〈사건 링크가 표시될 자리〉</p>
            <Notice>실제 링크 발급·공유는 API 연결 후 제공됩니다.</Notice>
            <div className="actions">
              <Button disabled>링크 복사</Button>
              <Button secondary disabled>
                공유하기
              </Button>
            </div>
            <Notice>
              답변 대기 중 · 결과물 보관 기간 7일 (기준 시각 미정)
            </Notice>
            <Button onClick={() => setScreen("B 열람")}>
              상대가 받는 화면 체험하기 →
            </Button>
          </div>
        </>
      );
      break;
    case "B 열람":
      content = (
        <>
          <Heading label="당신에게 도착한 마음" title="조금 서운했대요.">
            먼저 마음을 읽고, 당신의 이야기도 전해주세요.
          </Heading>
          <StatementSummary data={a} />
          <div className="actions">
            <Button onClick={() => setScreen("사과 작성")}>사과하기 ♡</Button>
            <Button secondary onClick={() => setScreen("B 대화")}>
              맞고소하기 ↗
            </Button>
          </div>
          <Notice>어떤 답변을 선택해도 누가 옳은지 판결하지 않아요.</Notice>
        </>
      );
      break;
    case "맞고소 결과":
      content = (
        <>
          <Heading label="두 사람의 이야기" title="다른 마음을, 나란히.">
            서로 무엇을 바랐는지 살펴봐요.
          </Heading>
          <div className="report-grid">
            <StatementCard side="A" data={a} />
            <StatementCard side="B" data={b} />
          </div>
          <div className="panel">
            <span className="badge">중재 요약 영역</span>
            <h2>우리의 다음 대화를 위해</h2>
            <Notice>
              AI 미연결 상태입니다. 아래 분석 영역은 자리 표시자입니다.
            </Notice>
            <h3>함께 인정하는 내용</h3>
            <p>두 답변에서 확인한 공통 내용이 표시될 자리</p>
            <h3>다르게 생각하는 내용</h3>
            <p>기억과 기대의 차이가 표시될 자리</p>
            <h3>각자가 서운했던 점</h3>
            <p>A: {a.feeling}</p>
            <p>B: {b.feeling}</p>
            <h3>오해가 생긴 지점</h3>
            <p>단정하지 않은 오해 가능성이 표시될 자리</p>
            <h3>다음 대화의 시작 문장 (예시)</h3>
            <p>“그때 네가 바랐던 걸 조금 더 들려줄래?”</p>
          </div>
        </>
      );
      break;
    case "사과 작성":
      content = (
        <ApologyScreen
          summary={a.incident}
          onSubmit={(v) => {
            setApology(v);
            setScreen("사과 결과");
          }}
        />
      );
      break;
    case "사과 결과":
      content = (
        <>
          <Heading label="답변 완료 · 종결" title="미안한 마음이 도착했어요.">
            서로의 이야기를 천천히 읽어보세요.
          </Heading>
          <Notice>A의 이야기: {a.incident}</Notice>
          <article className="card side-B">
            <span className="badge">B가 직접 쓴 사과문</span>
            <h2>마음을 담아 보내요.</h2>
            <p>{apology.body}</p>
            {apology.understood && (
              <>
                <h3>이해했다고 표현한 부분</h3>
                <p>{apology.understood}</p>
              </>
            )}
            {apology.promise && (
              <>
                <h3>직접 적은 약속</h3>
                <p>{apology.promise}</p>
              </>
            )}
          </article>
          <section className="panel">
            <h2>종결된 내용 요약</h2>
            <h3>사과한 행동 또는 상황</h3>
            <p>AI 연결 후 사과문에 직접 표현된 내용만 요약할 자리입니다.</p>
            <h3>추가 전달 내용</h3>
            <p>
              사과문에 담긴 추가 내용이 있다면 표시합니다. 현재는 자동 추출하지
              않습니다.
            </p>
          </section>
          <Notice>
            종결은 답변 작성 완료를 뜻하며, 사과의 수락을 의미하지 않아요.
          </Notice>
        </>
      );
      break;
    case "응답 작성 중":
      content = (
        <>
          <Heading
            label="답변 기다리는 중"
            title="상대가 마음을 정리하고 있어요."
          >
            완료되면 같은 사건 링크에서 결과를 확인할 수 있어요.
          </Heading>
          <Notice>다른 사람의 작성 중 대화는 표시하지 않습니다.</Notice>
          <Button secondary onClick={() => setScreen("맞고소 결과")}>
            완료 화면 체험
          </Button>
        </>
      );
      break;
    case "생성 실패":
      content = (
        <>
          <Heading label="생성 오류 예시" title="잠시 연결이 끊겼어요.">
            입력한 내용은 현재 화면에 남아 있어요. 다시 시도해주세요.
          </Heading>
          <StatementSummary data={a} />
          <Button onClick={() => setScreen("A 미리보기")}>
            다시 시도하기 (체험)
          </Button>
        </>
      );
      break;
    case "중복 제출":
      content = (
        <>
          <Heading
            label="이미 답변이 있어요"
            title="이 사건의 답변이 완료됐어요."
          >
            추가로 제출하지 않고 완료된 리포트를 확인해주세요.
          </Heading>
          <Button onClick={() => setScreen("맞고소 결과")}>
            최종 리포트 보기
          </Button>
        </>
      );
      break;
    case "안전 안내":
      content = (
        <>
          <Heading
            label="안내 문구 초안 · 정책 미정"
            title="잠시, 안전을 먼저 살펴봐요."
          >
            위협이나 폭력에 관한 내용은 장난스러운 고소장으로 만들지 않는 방향을
            검토하고 있어요.
          </Heading>
          <Notice>
            위험 내용 감지 기능은 연결되지 않았습니다. 안전 안내 화면의 구성
            예시입니다.
          </Notice>
          <Button onClick={() => setScreen("시작하기")}>시작 화면으로</Button>
        </>
      );
      break;
    case "로딩":
      content = (
        <>
          <Heading label="화면 상태 예시" title="마음을 정리하고 있어요." />
          <div
            className="panel skeleton"
            role="status"
            aria-label="불러오는 중"
          >
            <div />
            <div />
            <div />
          </div>
          <Button secondary onClick={() => setScreen("B 열람")}>
            로딩 완료 화면 보기
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
              screen === "만료"
                ? "이 사건의 보관 기간이 끝났어요."
                : "이 링크를 찾을 수 없어요."
            }
          >
            {screen === "만료"
              ? "만료된 사건 내용은 다시 볼 수 없어요."
              : "링크가 올바른지 확인해주세요."}
          </Heading>
          <div className="empty">{screen === "만료" ? "⌛" : "?"}</div>
          <Button onClick={() => setScreen("시작하기")}>
            새 사건 시작하기
          </Button>
        </>
      );
  }
  return (
    <>
      <aside className="review">
        <label htmlFor="screen">화면 둘러보기</label>
        <select
          id="screen"
          value={screen}
          onChange={(e) => setScreen(e.target.value as Screen)}
        >
          {screens.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <small>가상 데이터 · 저장되지 않음</small>
      </aside>
      <div key={screen} className="screen">
        {content}
      </div>
    </>
  );
}
