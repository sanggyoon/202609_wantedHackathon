"use client";
import { useState } from "react";
import { Button, Notice } from "@/components/ui";
import type { Statement } from "@/features/report/types";
export function ShareSelectScreen({
  side,
  data,
  onComplete,
}: {
  side: "A" | "B";
  data: Statement;
  onComplete: () => void;
}) {
  const doc = side === "A" ? "고소장" : "맞고소장";
  const first = data.incident.split(/[.!?。\n]/)[0];
  const items = [
    { key: "incident", label: "사건 내용", value: first },
    { key: "feeling", label: "그때 느낀 감정", value: data.feeling },
    { key: "wish", label: "상대에게 바라는 점", value: data.wish },
    {
      key: "expectation",
      label: "내가 기대했던 것",
      value: "연락이 오거나 상황을 알려줄 거라고 기대했어요.",
    },
    {
      key: "guess",
      label: "내 추측 (사실이 아닐 수도 있어요)",
      value: "내 시간이 중요하지 않게 여겨진 것 같았어요.",
    },
  ];
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
        <span className="badge">🌰 밤톨이 정리한 내용</span>
        <h2>{doc}에 담아 공유하고 싶은 것만 선택해주세요.</h2>
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
          AI 미연결 상태예요. 지금은 예시로 정리한 항목이고, 선택은 체험용입니다.
        </Notice>
      </div>
      <Button disabled={count === 0} onClick={onComplete}>
        선택한 내용으로 {doc} 만들기 → ({count})
      </Button>
    </>
  );
}
