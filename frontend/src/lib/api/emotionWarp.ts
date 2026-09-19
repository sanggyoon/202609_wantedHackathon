import type {
  EmotionLabel,
  EmotionProfile,
} from "@/features/report/types";

export type EmotionProfileResult = {
  profile: EmotionProfile;
  needs_clarification: boolean;
  candidates: EmotionLabel[];
  mode: "openai" | "local";
};

const labels = [
  "화남",
  "빡침",
  "짜증",
  "억울함",
  "무시당한 느낌",
  "서운함",
  "섭섭함",
  "상처받음",
  "답답함",
  "속상함",
  "불안",
  "걱정",
  "외로움",
] as const;

const isLabel = (value: unknown): value is EmotionLabel =>
  typeof value === "string" && labels.includes(value as EmotionLabel);

function parseResult(value: unknown): EmotionProfileResult {
  if (!value || typeof value !== "object") throw new Error("감정 분석 결과를 확인하지 못했어요.");
  const result = value as Record<string, unknown>;
  if (
    !result.profile ||
    typeof result.profile !== "object" ||
    typeof result.needs_clarification !== "boolean" ||
    !Array.isArray(result.candidates) ||
    !result.candidates.every(isLabel) ||
    !["openai", "local"].includes(result.mode as string)
  ) {
    throw new Error("감정 분석 결과를 확인하지 못했어요.");
  }
  return result as EmotionProfileResult;
}

async function jsonRequest(path: string, body: unknown, signal?: AbortSignal) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    referrerPolicy: "no-referrer",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
      : AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error("감정 이미지를 준비하지 못했어요.");
  return parseResult(await response.json());
}

export function requestEmotionProfile(
  messages: string[],
  emotions: string[],
  signal?: AbortSignal,
) {
  return jsonRequest("/api/complaint/emotion-profile", { messages, emotions }, signal);
}

export function resolveEmotionProfile(
  profile: EmotionProfile,
  selectedEmotion: EmotionLabel,
  signal?: AbortSignal,
) {
  return jsonRequest(
    "/api/complaint/emotion-profile/resolve",
    { profile, selected_emotion: selectedEmotion },
    signal,
  );
}

export async function requestEmotionWarp(
  profile: EmotionProfile,
  signal?: AbortSignal,
): Promise<Blob> {
  const response = await fetch("/api/complaint/emotion-warp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile }),
    cache: "no-store",
    referrerPolicy: "no-referrer",
    signal,
  });
  if (!response.ok) throw new Error("감정 이미지를 만들지 못했어요.");
  return response.blob();
}

