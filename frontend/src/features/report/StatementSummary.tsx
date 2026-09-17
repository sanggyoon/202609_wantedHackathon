"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui";
import { feelingText, type Statement } from "./types";
import { StatementCard } from "./StatementCard";
// 저장된 카드에는 sourceMode가 없으므로, 실제 사건 화면은 demo={false}를 넘긴다.
export function StatementSummary({
  data,
  demo = !data.sourceMode,
}: {
  data: Statement;
  demo?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const title =
    data.incident_summary || data.incident_description.split(/[.!?。\n]/)[0];
  return (
    <section className="panel">
      <span className="badge">고소장 요약 · 신청인의 관점</span>
      {data.cute_charge && (
        <p className="cute-charge font-point">「{data.cute_charge}」</p>
      )}
      {demo && (
        <p className="notice">현재는 화면 체험용 예시 사건입니다.</p>
      )}
      {data.story_intro ? (
        <>
          <h3>내 얘기 좀 들어봐</h3>
          <p className="story-intro font-point">{data.story_intro}</p>
        </>
      ) : (
        <>
          <h3>사건 요약</h3>
          <p>{title}</p>
          <h3>신청인이 느낀 것</h3>
          <p>{feelingText(data)}</p>
          <h3>원하는 것</h3>
          <p>{data.desired_outcome}</p>
        </>
      )}
      <div className="toggle-row">
        <Button secondary onClick={() => setOpen((v) => !v)}>
          {open ? "고소장 접기" : "고소장 보기"}
        </Button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ marginTop: 16 }}>
              <StatementCard side="A" data={data} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
