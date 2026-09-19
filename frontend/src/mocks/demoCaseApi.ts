import type { Apology, Statement } from "@/features/report/types";
import { CaseApiError, type CaseApi, type CaseView } from "@/lib/api/cases";
import type { CaseSeed } from "@/features/case/LinkedCaseScreen";

// 시안(/wireframe)용 가짜 사건 서버. 실제 사건 화면(LinkedCaseScreen)에 그대로 꽂아 쓴다.
// 화면 문구·구성은 실제 화면 코드를 따르고, 여기에는 서버가 줄 데이터만 둔다.
export const DEMO_TOKEN = "demo_case_token_demo_case_token_demo_ca";

export const demoA: Statement = {
  cute_charge: "약속 시간 무단 지각죄",
  incident_summary: "같이 저녁 먹기로 했는데 연락 없이 한 시간 늦었어요.",
  incident_description: "같이 저녁 먹기로 했는데 연락 없이 한 시간 늦었어.",
  emotions: ["걱정", "서운함"],
  emotion_reason: "내 시간이 중요하지 않은 것 같아서.",
  hurt_point: "기다린 한 시간",
  desired_outcome: "늦어질 때는 짧게라도 먼저 알려줬으면 좋겠어.",
};
export const demoB: Statement = {
  cute_charge: "상황 설명 기회 박탈죄",
  incident_summary: "일이 갑자기 길어져서 휴대폰을 확인하지 못했어요.",
  incident_description: "일이 갑자기 길어져서 휴대폰을 확인하지 못했어.",
  emotions: ["미안함"],
  emotion_reason: "기다리게 해서.",
  hurt_point: "내 상황도 들어줬으면 했던 점",
  desired_outcome: "서로 상황을 먼저 물어보면 좋겠어.",
};
const demoApology: Apology = {
  body: "연락 없이 기다리게 해서 미안해. 다음엔 먼저 연락할게.",
  understood_point: "기다리는 동안 많이 걱정했을 것 같아.",
  admitted_point: "약속 시간에 늦으면서 미리 말하지 않은 건 내 잘못이야.",
  future_commitment: "늦어질 것 같으면 짧게라도 먼저 연락하기",
};
const demoReport = {
  common_ground: ["서로 약속을 소중하게 생각해요.", "상대를 아끼는 마음이 있어요."],
  different_views: ["A는 연락이 없던 점, B는 연락할 수 없던 상황을 먼저 말했어요."],
  hurt_points_a: ["기다린 한 시간"],
  hurt_points_b: ["내 상황도 들어줬으면 했던 점"],
  possible_misunderstanding: "B가 일부러 연락하지 않았다고 느꼈을 수 있어요.",
  conversation_starter: "늦어질 때 서로 어떻게 알려주면 좋을지 먼저 이야기해볼까요?",
};

type Snapshot = Pick<CaseView, "status" | "viewer_role" | "available_actions"> & {
  cards?: NonNullable<CaseView["content"]>["cards"];
  report?: boolean;
  apology?: boolean;
  seed?: CaseSeed;
};
const A_DRAFT: Snapshot = { status: "DRAFT", viewer_role: "A", available_actions: ["converse", "submit_statement"] };
const B_RESPOND: Snapshot = { status: "AWAITING_RESPONSE", viewer_role: "B", available_actions: ["choose_response_type"], cards: { A: demoA } };
const B_COUNTER: Snapshot = { status: "COUNTER_DRAFT", viewer_role: "B", available_actions: ["submit_statement"], cards: { A: demoA } };

// 화면 미리보기 목록. 사건 상태(서버가 주는 값)와, 필요하면 작성 중간 화면 시드를 함께 둔다.
export const demoScenes = {
  "a-draft": { label: "A · 진술(대화)", snapshot: A_DRAFT },
  "a-review": { label: "A · 고소장 검토", snapshot: { ...A_DRAFT, seed: { aDraft: demoA } } },
  "a-sent": { label: "A · 소환장 발송", snapshot: { status: "AWAITING_RESPONSE", viewer_role: "A", available_actions: [], cards: { A: demoA } } },
  "a-waiting": { label: "A · 답변 대기", snapshot: { status: "APOLOGY_DRAFT", viewer_role: "A", available_actions: [], cards: { A: demoA } } },
  "not-ready": { label: "B · 고소장 접수 전", snapshot: { status: "DRAFT", viewer_role: "B", available_actions: [] } },
  "b-respond": { label: "B · 소환장 링크 진입", snapshot: B_RESPOND },
  "b-arrived": { label: "B · 소환장 도착", snapshot: { ...B_RESPOND, seed: { bStep: "arrived" } } },
  "b-apology": { label: "B · 사과문 작성", snapshot: { status: "APOLOGY_DRAFT", viewer_role: "B", available_actions: ["submit_apology"], cards: { A: demoA } } },
  "b-counter": { label: "B · 맞고소 진술(대화)", snapshot: B_COUNTER },
  "b-counter-review": { label: "B · 맞고소장 검토", snapshot: { ...B_COUNTER, seed: { bStep: "counter-preview", bDraft: demoB } } },
  "result-apology": { label: "결과 · 화해 성립", snapshot: { status: "APOLOGY_COMPLETED", viewer_role: "A", available_actions: [], cards: { A: demoA }, apology: true } },
  "result-counter": { label: "결과 · 양측 대질", snapshot: { status: "COUNTER_COMPLETED", viewer_role: "A", available_actions: [], cards: { A: demoA, B: demoB }, report: true } },
  expired: { label: "기록 파기", gone: 410 },
  missing: { label: "사건 없음", gone: 404 },
} satisfies Record<string, { label: string; snapshot?: Snapshot; gone?: number }>;
export type DemoScene = keyof typeof demoScenes;

function toView(s: Snapshot, expires_at: string): CaseView {
  const head = { status: s.status, viewer_role: s.viewer_role, available_actions: s.available_actions, expires_at };
  if (s.status === "DRAFT") return { ...head, content: null };
  return {
    ...head,
    content: {
      cards: s.cards ?? {},
      report: s.report ? demoReport : null,
      apology: s.apology ? { ...demoApology, submitted_at: new Date().toISOString() } : null,
    },
  };
}

export function demoSeed(scene: DemoScene): CaseSeed | undefined {
  const entry = demoScenes[scene] as { snapshot?: Snapshot };
  return entry.snapshot?.seed;
}

// 요청할 때마다 현재 상태를 돌려주고, 제출하면 실제 서버처럼 다음 상태로 넘어간다.
export function createDemoCaseApi(scene: DemoScene): CaseApi {
  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const entry = demoScenes[scene] as { snapshot?: Snapshot; gone?: number };
  let view: CaseView | null = entry.snapshot ? toView(entry.snapshot, expires_at) : null;
  const wait = () => new Promise<void>((resolve) => setTimeout(resolve, 400));
  const current = () => {
    if (view) return view;
    throw new CaseApiError(entry.gone ?? 404, entry.gone === 410 ? "보관 기간이 끝난 사건이에요." : "사건을 찾을 수 없어요.");
  };
  return {
    async readCase() {
      return current();
    },
    async submitStatement(_token, side, card) {
      await wait();
      const cards = { ...current().content?.cards, [side]: card };
      view =
        side === "A"
          ? toView({ status: "AWAITING_RESPONSE", viewer_role: "A", available_actions: [], cards }, expires_at)
          : toView({ status: "COUNTER_COMPLETED", viewer_role: "B", available_actions: [], cards, report: true }, expires_at);
      return view;
    },
    async submitApology(_token, apology) {
      await wait();
      const next = toView({ status: "APOLOGY_COMPLETED", viewer_role: "B", available_actions: [], cards: current().content?.cards, apology: true }, expires_at);
      if (next.content) next.content.apology = { ...apology, submitted_at: new Date().toISOString() };
      view = next;
      return view;
    },
    async respond(_token, _kind, submit) {
      return submit();
    },
  };
}
