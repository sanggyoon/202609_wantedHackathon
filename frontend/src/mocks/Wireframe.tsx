import { CaseController } from "@/features/case/CaseController";
export function Wireframe() {
  return (
    <CaseController
      initialA={{
        incident: "같이 저녁 먹기로 했는데 연락 없이 한 시간 늦었어.",
        feeling:
          "기다리면서 걱정됐고, 내 시간이 중요하지 않은 것 같아 서운했어.",
        wish: "늦어질 때는 짧게라도 먼저 알려줬으면 좋겠어.",
      }}
      initialB={{
        incident: "일이 갑자기 길어져서 휴대폰을 확인하지 못했어.",
        feeling: "기다리게 해서 미안했고 내 상황도 들어줬으면 했어.",
        wish: "서로 상황을 먼저 물어보면 좋겠어.",
      }}
      initialApology={{
        body: "연락 없이 기다리게 해서 미안해. 다음엔 먼저 연락할게.",
        understood: "기다리는 동안 많이 걱정했을 것 같아.",
        promise: "늦어지면 먼저 연락하기",
      }}
      questions={{
        A: [
          "어떤 일이 있었나요? 편하게 들려주세요.",
          "그때 어떤 마음이었나요? 그렇게 느낀 이유도 알려주세요.",
          "상대에게 어떤 말이나 행동을 바라나요?",
        ],
        B: [
          "당신이 기억하는 그날은 어땠나요?",
          "그때 어떤 마음이었고 왜 그렇게 느꼈나요?",
          "상대에게 바라는 점은 무엇인가요?",
        ],
      }}
    />
  );
}
