"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { requestEmotionWarp } from "@/lib/api/emotionWarp";
import type { EmotionProfile } from "./types";

export function EmotionWarpImage({ profile }: { profile?: EmotionProfile | null }) {
  const [source, setSource] = useState<string | null>(null);
  useEffect(() => {
    if (!profile) return;
    const controller = new AbortController();
    let objectUrl: string | null = null;
    requestEmotionWarp(profile, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      })
      .catch(() => {
        if (!controller.signal.aborted) setSource(`/images/${profile.image}`);
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [profile]);
  if (!profile) return null;
  return (
    <figure className="emotion-warp">
      {source ? (
        <Image
          unoptimized
          src={source}
          width={420}
          height={420}
          alt={`${profile.representative_emotion ?? "감정"}을 표현한 문서 이미지`}
        />
      ) : (
        <div className="emotion-warp-placeholder" role="status">
          감정 이미지를 만들고 있어요…
        </div>
      )}
    </figure>
  );
}

