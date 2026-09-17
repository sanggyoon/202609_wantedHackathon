"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui";
import { feelingText, type Statement } from "./types";
import { StatementCard } from "./StatementCard";
export function StatementSummary({ data }: { data: Statement }) {
  const [open, setOpen] = useState(false);
  const title =
    data.incident_summary || data.incident_description.split(/[.!?。\n]/)[0];
  return (
    <section className="panel">
      <span className="badge">고소장 요약 · 신청인의 관점</span>
      {!data.sourceMode && (
        <p className="notice">현재는 화면 체험용 예시 사건입니다.</p>
      )}
      <h3>사건 요약</h3>
      <p>{title}</p>
      <h3>신청인이 느낀 것</h3>
      <p>{feelingText(data)}</p>
      <h3>원하는 것</h3>
      <p>{data.desired_outcome}</p>
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
