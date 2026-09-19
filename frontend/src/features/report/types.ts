// 필드명은 DB `statement_cards`·`apologies` 컬럼과 1:1로 대응한다.
// 근거: docs/API_Design.md §8-1. 백엔드도 alias 없이 같은 snake_case를 쓴다.

export type EmotionLabel =
  | "화남"
  | "빡침"
  | "짜증"
  | "억울함"
  | "무시당한 느낌"
  | "서운함"
  | "섭섭함"
  | "상처받음"
  | "답답함"
  | "속상함"
  | "불안"
  | "걱정"
  | "외로움";

export type EmotionProfile = {
  version: "ai-warp-v1";
  representative_emotion: EmotionLabel | null;
  image:
    | "anger.png"
    | "irritated.png"
    | "wronged.png"
    | "hurt.png"
    | "frustration.png"
    | "sadness.png"
    | "anxiety.png"
    | "loneliness.png"
    | "asset1.png";
  scores: { label: EmotionLabel; mention_count: number; score: number }[];
  axes: Record<"화남" | "질투" | "슬픔" | "포기" | "황당" | "서운함", number>;
  resolved_by: "ai" | "user" | "fallback";
  params: {
    max_k: number;
    neighbor_bleed: number;
    radial_sharpness: number;
    base: number;
  };
};

export type Statement = {
  // 아래 셋은 검토 화면(PreviewScreen)에서 생성하고 사용자가 고칠 수 있다.
  // different_viewpoint는 아직 생성 주체가 없다. docs/API_Design.md §10-2 참고.
  cute_charge?: string;
  incident_summary?: string;
  story_intro?: string;
  different_viewpoint?: string | null;

  incident_description: string;
  emotions: string[];
  emotion_scores?: EmotionProfile | null;
  emotion_reason: string;
  hurt_point?: string;
  desired_outcome: string;
  expected_behavior?: string;
  assumption?: string;

  sourceMode?: "openai" | "local";
};

export type EntryMode = "new" | "invited" | "result";

export type Apology = {
  body: string;
  understood_point: string;
  admitted_point: string;
  future_commitment: string;
};

// 사용자가 공유하지 않기로 고른 항목에 들어가는 값. 빈 값과 구별해야 한다.
export const NOT_SHARED = "공유하지 않은 내용";

// 감정 목록과 이유를 한 덩어리 텍스트로 합친다. 카드·요약 화면 표시용이며
// 저장 형태가 아니다 — 저장은 emotions[]와 emotion_reason으로 나뉘어 간다.
// 감정을 먼저 보이고, 그 뒤에 이유(서운했던 지점·감정의 이유)를 묶어 감정과 이유가
// 뒤섞이지 않게 한다.
export function feelingText(data: Statement): string {
  return [data.emotions.join(", "), data.hurt_point, data.emotion_reason]
    .filter(Boolean)
    .join("\n");
}
