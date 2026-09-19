"use client";
import { useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Button, Heading, Notice } from "@/components/ui";
import { LinkedCaseScreen } from "@/features/case/LinkedCaseScreen";
import { StartScreen } from "@/features/case/StartScreen";
import { StatementSummary } from "@/features/report/StatementSummary";
import {
  createDemoCaseApi,
  DEMO_TOKEN,
  demoA,
  demoScenes,
  demoSeed,
  type DemoScene,
} from "./demoCaseApi";

// 실제 사건 흐름에는 없고, 화면 구성만 보려는 예시 화면.
const extras = {
  start1: "시작화면 1 · A 최초 진입",
  "clerk-error": "서기 오류",
  recess: "휴정 안내",
  preparing: "심리 준비",
} as const;
type Extra = keyof typeof extras;
type View = DemoScene | Extra;

const starts: { label: string; sub: string; view: View }[] = [
  { label: "시작화면 1", sub: "A 최초 진입", view: "start1" },
  { label: "시작화면 2", sub: "B 소환장 링크 진입", view: "b-respond" },
  { label: "시작화면 3", sub: "완료 후 재진입", view: "result-apology" },
];

function ExtraScreen({ kind, go }: { kind: Extra; go: (v: View) => void }) {
  switch (kind) {
    case "start1":
      return (
        <StartScreen
          entryMode="new"
          notice={
            <>
              판결문(결과물)은 <strong>7일 후 파기</strong>돼요.
            </>
          }
          onStart={() => go("a-draft")}
        />
      );
    case "clerk-error":
      return (
        <>
          <Heading label="서기 오류 예시" title="앗, 잠깐 연결이 끊겼어요.">
            적어주신 내용은 그대로 남아 있으니 걱정 말아요. 다시 시도해봐요.
          </Heading>
          <StatementSummary data={demoA} demo={false} />
          <Button onClick={() => go("a-review")}>다시 시도하기</Button>
        </>
      );
    case "recess":
      return (
        <>
          <Heading
            label="안내 문구 초안 · 정책 미정"
            title="잠깐, 당신의 안전이 먼저예요."
          >
            혹시 위협이나 폭력과 관련된 일이라면, 이건 장난스러운 고소장으로
            가볍게 다룰 수 없어요. 당신이 안전한 게 저에겐 무엇보다
            중요하거든요.
          </Heading>
          <Notice>
            위험 내용 감지 기능은 연결되지 않았습니다. 휴정 안내 화면의 구성
            예시입니다.
          </Notice>
          <Button onClick={() => go("a-draft")}>접수 창구로 돌아가기</Button>
        </>
      );
    case "preparing":
      return (
        <>
          <Heading
            label="화면 상태 예시"
            title="찬찬히 사건을 살펴보고 있어요."
          />
          <div
            className="panel skeleton"
            role="status"
            aria-label="불러오는 중"
          >
            <div />
            <div />
            <div />
          </div>
          <Button secondary onClick={() => go("b-respond")}>
            심리 시작 화면 보기
          </Button>
        </>
      );
  }
}

// 실제 사건 화면(LinkedCaseScreen)을 가짜 서버로 띄운다. 화면을 고치면 여기에도 그대로 반영된다.
export function Wireframe() {
  const [view, setView] = useState<View>("start1");
  // 같은 화면을 처음부터 다시 볼 때마다 새 가짜 서버를 만든다.
  const [run, setRun] = useState(0);
  const go = (v: View) => {
    setView(v);
    setRun((n) => n + 1);
  };
  const scene = view in demoScenes ? (view as DemoScene) : null;
  const api = useMemo(
    () => createDemoCaseApi(scene ?? "a-draft"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scene, run],
  );
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const panel = (
    <div className="dev-dock">
      <aside className="review">
        <label>시작화면 바로가기 (개발용)</label>
        <div className="actions">
          {starts.map((s) => (
            <Button
              key={s.label}
              secondary={view !== s.view}
              onClick={() => go(s.view)}
            >
              {s.label}
              <br />
              {s.sub}
            </Button>
          ))}
        </div>
        <label htmlFor="screen">사건 기록 열람</label>
        <select
          id="screen"
          value={view}
          onChange={(e) => go(e.target.value as View)}
        >
          <optgroup label="실제 사건 화면">
            {(Object.keys(demoScenes) as DemoScene[]).map((k) => (
              <option key={k} value={k}>
                {demoScenes[k].label}
              </option>
            ))}
          </optgroup>
          <optgroup label="화면 구성 예시 (실제 흐름에 없음)">
            {(Object.keys(extras) as Extra[]).map((k) => (
              <option key={k} value={k}>
                {extras[k]}
              </option>
            ))}
          </optgroup>
        </select>
        <small>
          실제 사건 화면 · 대화 AI만 연결 · 링크·DB 저장은 가짜 서버
        </small>
      </aside>
    </div>
  );
  return (
    <>
      {scene ? (
        <LinkedCaseScreen
          key={`${scene}:${run}`}
          token={DEMO_TOKEN}
          api={api}
          seed={demoSeed(scene)}
        />
      ) : (
        <div key={`${view}:${run}`} className="screen">
          <ExtraScreen kind={view as Extra} go={go} />
        </div>
      )}
      {mounted && createPortal(panel, document.body)}
    </>
  );
}
