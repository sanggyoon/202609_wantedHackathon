import type {
  ConversationResponse,
  ConversationState,
} from "@/features/conversation/types";
export async function sendConversation(
  message: string,
  state: ConversationState | null,
  signal: AbortSignal,
): Promise<ConversationResponse> {
  const response = await fetch("/api/complaint/conversation/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ message, state }),
    signal,
  });
  if (!response.ok)
    throw new Error(
      response.status === 422 || response.status === 400
        ? "입력 내용을 확인해주세요."
        : "대화에 연결하지 못했어요. 백엔드 실행과 API 설정을 확인한 뒤 다시 시도해주세요.",
    );
  const data = await response.json();
  if (
    typeof data.assistantMessage !== "string" ||
    !data.state?.incident ||
    !data.state?.emotion ||
    typeof data.readyToGenerate !== "boolean"
  )
    throw new Error("응답 형식을 확인하지 못했어요. 다시 시도해주세요.");
  return data;
}
