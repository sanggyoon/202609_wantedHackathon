"use client";
import { useState } from "react";
import { Button, Notice } from "@/components/ui";
import {
  feelingText,
  NOT_SHARED,
  type Statement,
} from "@/features/report/types";
export function ShareSelectScreen({
  side,
  data,
  onComplete,
}: {
  side: "A" | "B";
  data: Statement;
  onComplete: (data: Statement) => void;
}) {
  const doc = side === "A" ? "고소장" : "맞고소장";
  const first = data.incident_description.split(/[.!?。\n]/)[0];
  // 토글 하나가 여러 필드를 함께 덮는다. "감정"은 emotions·emotion_reason·
  // hurt_point 셋을 한 묶음으로 공유한다 — 사용자에게는 한 항목으로 보인다.
  const items = [
    { key: "incident", label: "사건 내용", value: first },
    { key: "feeling", label: "그때 느낀 감정", value: feelingText(data) },
    { key: "wish", label: "상대에게 바라는 점", value: data.desired_outcome },
    {
      key: "expectation",
      label: "내가 기대했던 것",
      value: data.expected_behavior || "",
    },
    {
      key: "guess",
      label: "내 추측 (사실이 아닐 수도 있어요)",
      value: data.assumption || "",
    },
  ].filter((item) => item.value);
  const [selected, setSelected] = useState<Record<string, boolean>>(
    Object.fromEntries(items.map((i) => [i.key, true])),
  );
  const count = Object.values(selected).filter(Boolean).length;
  return (
    <>
      <div className="heading">
        <h1>자, 이제</h1>
        <p>밤톨이 정리한 내용을 골라, {doc}에 담아볼까요?</p>
      </div>
      <div className="panel">
        <span className="badge">밤톨이 정리한 내용</span>
        <h2>
          {doc}에 담아 공유하고 싶은 것만
          <br />
          선택해주세요.
        </h2>
        <ul className="select-list">
          {items.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                className={`select-row ${selected[item.key] ? "on" : ""}`}
                aria-pressed={selected[item.key]}
                onClick={() =>
                  setSelected((s) => ({ ...s, [item.key]: !s[item.key] }))
                }
              >
                <span className="check" aria-hidden="true" />
                <span className="select-text">
                  <b>{item.label}</b>
                  {item.value}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <Notice>
          {data.sourceMode
            ? "대화에서 정리한 내용입니다. 선택하지 않은 내용은 다음 초안에 포함하지 않아요."
            : "가상 사건의 항목입니다. 실제 링크 공유는 아직 연결되지 않았어요."}
        </Notice>
      </div>
      <div className="cta-float-spacer" aria-hidden="true" />
      <div className="cta-float">
        <div className="cta-float-inner">
          <Button
            disabled={count === 0}
            onClick={() =>
              onComplete({
                ...data,
                incident_description: selected.incident
                  ? data.incident_description
                  : NOT_SHARED,
                emotions: selected.feeling ? data.emotions : [],
                emotion_scores: selected.feeling ? data.emotion_scores : null,
                emotion_reason: selected.feeling
                  ? data.emotion_reason
                  : NOT_SHARED,
                hurt_point: selected.feeling ? data.hurt_point : "",
                desired_outcome: selected.wish
                  ? data.desired_outcome
                  : NOT_SHARED,
                expected_behavior: selected.expectation
                  ? data.expected_behavior
                  : "",
                assumption: selected.guess ? data.assumption : "",
              })
            }
          >
            선택한 내용으로 {doc} 만들기 → ({count})
          </Button>
        </div>
      </div>
    </>
  );
}
