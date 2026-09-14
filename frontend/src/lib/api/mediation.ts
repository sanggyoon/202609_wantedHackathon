import type { Statement } from "@/features/report/types";

export type MediationResult = {
  mode: "openai" | "local";
  report: {
    common_ground: string[];
    different_views: string[];
    hurt_points_a: string[];
    hurt_points_b: string[];
    possible_misunderstanding: string | null;
    conversation_starter: string;
  };
};

export async function requestMediation(
  a: Statement,
  b: Statement,
  signal: AbortSignal,
): Promise<MediationResult> {
  const response = await fetch("/api/mediation/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ a, b }),
    signal,
  });
  if (!response.ok)
    throw new Error(
      "정리를 불러오지 못했어요. 두 카드는 남아 있으니 다시 시도해주세요.",
    );
  const data = await response.json();
  const report = data.report;
  if (
    !report ||
    !["openai", "local"].includes(data.mode) ||
    ![
      "common_ground",
      "different_views",
      "hurt_points_a",
      "hurt_points_b",
    ].every(
      (key) =>
        Array.isArray(report[key]) &&
        report[key].every((value: unknown) => typeof value === "string"),
    ) ||
    typeof report.conversation_starter !== "string" ||
    !(
      report.possible_misunderstanding === null ||
      typeof report.possible_misunderstanding === "string"
    )
  ) {
    throw new Error("정리 응답을 확인하지 못했어요. 다시 시도해주세요.");
  }
  return data;
}
