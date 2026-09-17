import { CaseController } from "@/features/case/CaseController";
export function Wireframe() {
  return (
    <CaseController
      initialA={{
        incident_description:
          "같이 저녁 먹기로 했는데 연락 없이 한 시간 늦었어.",
        emotions: ["걱정", "서운함"],
        emotion_reason: "내 시간이 중요하지 않은 것 같아서.",
        hurt_point: "기다린 한 시간",
        desired_outcome: "늦어질 때는 짧게라도 먼저 알려줬으면 좋겠어.",
      }}
      initialB={{
        incident_description: "일이 갑자기 길어져서 휴대폰을 확인하지 못했어.",
        emotions: ["미안함"],
        emotion_reason: "기다리게 해서.",
        hurt_point: "내 상황도 들어줬으면 했던 점",
        desired_outcome: "서로 상황을 먼저 물어보면 좋겠어.",
      }}
      initialApology={{
        body: "연락 없이 기다리게 해서 미안해. 다음엔 먼저 연락할게.",
        understood_point: "기다리는 동안 많이 걱정했을 것 같아.",
        admitted_point:
          "약속 시간에 늦으면서 미리 말하지 않은 건 내 잘못이야.",
        future_commitment: "늦어질 것 같으면 짧게라도 먼저 연락하기",
      }}
    />
  );
}
