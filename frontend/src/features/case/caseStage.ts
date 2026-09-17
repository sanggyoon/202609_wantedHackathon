import type { CaseView } from "@/lib/api/cases";

export type CaseStage =
  | "a-draft"
  | "not-ready"
  | "a-sent"
  | "a-waiting"
  | "b-respond"
  | "b-apology"
  | "b-counter"
  | "result-apology"
  | "result-counter"
  | "read-only";

// 서버가 준 status·viewer_role·available_actions만 보고 정한다.
// 쓰기 단계는 서버가 그 행동을 허락했을 때만 연다. 전이 규칙을 프론트에 다시 두지 않는다.
export function caseStage(
  view: Pick<CaseView, "status" | "viewer_role" | "available_actions">,
): CaseStage {
  const can = (action: string) => view.available_actions.includes(action);
  const writer = view.viewer_role === "A";
  switch (view.status) {
    case "DRAFT":
      return writer ? (can("submit_statement") ? "a-draft" : "read-only") : "not-ready";
    case "AWAITING_RESPONSE":
      return writer ? "a-sent" : can("choose_response_type") ? "b-respond" : "read-only";
    case "APOLOGY_DRAFT":
      return writer ? "a-waiting" : can("submit_apology") ? "b-apology" : "read-only";
    case "COUNTER_DRAFT":
      return writer ? "a-waiting" : can("submit_statement") ? "b-counter" : "read-only";
    case "APOLOGY_COMPLETED":
      return "result-apology";
    case "COUNTER_COMPLETED":
      return "result-counter";
    default:
      return "read-only";
  }
}

// 제출 실패 후 할 일. POST는 응답 전에 끊겨도 저장됐을 수 있어서, 확실히 저장되지 않은
// 경우(권한·입력 오류)가 아니면 서버에 다시 물어본다.
export function failureAction(status: number): "gone" | "keep" | "reconcile" {
  if (status === 404 || status === 410) return "gone";
  if (status === 403 || status === 422) return "keep";
  return "reconcile";
}
