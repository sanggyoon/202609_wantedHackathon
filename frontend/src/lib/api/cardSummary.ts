import type { Statement } from "@/features/report/types";

export type CardSummaryResult = {
  mode: "openai" | "local";
  cute_charge: string;
  incident_summary: string;
};

export const CARD_SUMMARY_FAILED =
  "밤톨이 죄명을 짓지 못했어요. 다시 시도하거나 직접 적어주세요.";

export class CardSummaryError extends Error {
  constructor() {
    super(CARD_SUMMARY_FAILED);
  }
}

export function parseCardSummary(v: unknown): CardSummaryResult {
  if (!v || typeof v !== "object") throw new CardSummaryError();
  const r = v as Record<string, unknown>;
  if (
    (r.mode !== "openai" && r.mode !== "local") ||
    typeof r.cute_charge !== "string" ||
    typeof r.incident_summary !== "string"
  )
    throw new CardSummaryError();
  return { mode: r.mode, cute_charge: r.cute_charge, incident_summary: r.incident_summary };
}

export async function requestCardSummary(
  card: Statement,
  signal: AbortSignal,
): Promise<CardSummaryResult> {
  // 화면 표시용 필드는 서버로 보내지 않는다.
  const shared: Statement = { ...card };
  delete shared.sourceMode;
  let response: Response;
  try {
    response = await fetch("/api/complaint/card-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ card: shared }),
      // AI 호출 제한 25초에 여유를 둔다.
      signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
    });
  } catch (e) {
    if (signal.aborted) throw e;
    throw new CardSummaryError();
  }
  if (!response.ok) throw new CardSummaryError();
  return parseCardSummary(await response.json().catch(() => null));
}
