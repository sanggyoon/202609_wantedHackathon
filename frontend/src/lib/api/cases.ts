import type { Statement, Apology } from "@/features/report/types";
import type { MediationResult } from "./mediation";

export const statuses = ["DRAFT", "AWAITING_RESPONSE", "COUNTER_DRAFT", "COUNTER_COMPLETED", "APOLOGY_DRAFT", "APOLOGY_COMPLETED", "EXPIRED"] as const;
export type CaseStatus = (typeof statuses)[number];
export type CaseCreated = { public_token: string; writer_token: string; status: "DRAFT"; expires_at: string };
export type CaseView = {
  status: CaseStatus;
  viewer_role: "A" | "B";
  expires_at: string;
  available_actions: string[];
  content: null | {
    cards: Partial<Record<"A" | "B", Statement>>;
    report: MediationResult["report"] | null;
    apology: (Partial<Apology> & { body: string; submitted_at: string }) | null;
  };
};
export class CaseApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === "string");
const date = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));
export function validToken(v: unknown): v is string { return typeof v === "string" && /^[A-Za-z0-9_-]{43}$/.test(v); }
export function casePath(token: string) {
  if (!validToken(token)) throw new CaseApiError(404, "올바르지 않은 사건 링크예요.");
  return "/case/" + token;
}
function validCard(v: unknown): boolean {
  return object(v) && ["incident_description", "emotion_reason", "desired_outcome"].every(k => typeof v[k] === "string")
    && strings(v.emotions)
    && ["cute_charge", "incident_summary", "hurt_point", "expected_behavior", "assumption"].every(k => v[k] === undefined || typeof v[k] === "string")
    && (v.different_viewpoint == null || typeof v.different_viewpoint === "string");
}
function validReport(v: unknown): boolean {
  return v === null || (object(v) && ["common_ground", "different_views", "hurt_points_a", "hurt_points_b"].every(k => strings(v[k]))
    && typeof v.conversation_starter === "string" && (v.possible_misunderstanding === null || typeof v.possible_misunderstanding === "string"));
}
export function parseCaseView(v: unknown): CaseView {
  if (!object(v) || !statuses.includes(v.status as CaseStatus) || !["A", "B"].includes(v.viewer_role as string)
    || !date(v.expires_at) || !strings(v.available_actions)
    || !v.available_actions.every(a => ["converse", "submit_statement", "choose_response_type", "submit_apology"].includes(a))) {
    throw new CaseApiError(502, "사건 응답을 확인하지 못했어요.");
  }
  if (v.status === "EXPIRED" || Date.parse(v.expires_at) <= Date.now()) throw new CaseApiError(410, "보관 기간이 끝난 사건이에요.");
  const c = v.content;
  if (v.status === "DRAFT") {
    if (c !== null) throw new CaseApiError(502, "초안 응답을 확인하지 못했어요.");
  } else if (!object(c) || !object(c.cards) || !Object.entries(c.cards).every(([k, card]) => ["A", "B"].includes(k) && validCard(card))
    || !validReport(c.report) || !(c.apology === null || (object(c.apology) && typeof c.apology.body === "string" && date(c.apology.submitted_at)
      && ["understood_point", "admitted_point", "future_commitment"].every(k => c.apology && object(c.apology) && (c.apology[k] == null || typeof c.apology[k] === "string"))))) {
    throw new CaseApiError(502, "저장된 내용을 확인하지 못했어요.");
  }
  return v as CaseView;
}
async function request(path: string, init: RequestInit, signal?: AbortSignal): Promise<unknown> {
  const timeout = AbortSignal.timeout(15000);
  try {
    const res = await fetch(path, { ...init, cache: "no-store", referrerPolicy: "no-referrer",
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
    if (!res.ok) {
      const message = res.status === 404 ? "사건을 찾을 수 없어요." : res.status === 410 ? "보관 기간이 끝난 사건이에요."
        : res.status === 503 ? "저장 서버를 사용할 수 없어요. 잠시 후 다시 확인해주세요." : "사건 서버에 연결하지 못했어요.";
      throw new CaseApiError(res.status, message);
    }
    return await res.json();
  } catch (e) {
    if (signal?.aborted) throw e;
    if (e instanceof CaseApiError) throw e;
    throw new CaseApiError(0, "연결이 끊겼거나 응답이 늦어지고 있어요.");
  }
}
export async function createCase(signal?: AbortSignal): Promise<CaseCreated> {
  const v = await request("/api/cases", { method: "POST" }, signal);
  if (!object(v) || !validToken(v.public_token) || !validToken(v.writer_token) || v.public_token === v.writer_token || v.status !== "DRAFT" || !date(v.expires_at))
    throw new CaseApiError(502, "사건 생성 응답을 확인하지 못했어요.");
  return v as CaseCreated;
}
export async function readCase(token: string, writer: string | null, signal?: AbortSignal): Promise<CaseView> {
  casePath(token);
  return parseCaseView(await request("/api/cases/" + token, { headers: writer ? { "X-Writer-Token": writer } : {} }, signal));
}
