"use client";

import { useEffect } from "react";

// 구글 애드센스 광고 슬롯
// NEXT_PUBLIC_ADSENSE_CLIENT (ca-pub-XXXX) 가 설정되면 실제 광고를 노출하고,
// 없으면 자리표시(placeholder)를 보여준다. (애드센스 승인 전 개발용)

const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export default function AdSlot({
  slot,
  className = "",
}: {
  slot?: string;
  className?: string;
}) {
  useEffect(() => {
    if (!CLIENT) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* noop */
    }
  }, []);

  if (!CLIENT) {
    return (
      <div
        className={`flex min-h-[90px] items-center justify-center rounded-xl border border-dashed border-oddsbag-purple/20 bg-oddsbag-light-gray/50 text-xs text-oddsbag-gray/60 ${className}`}
      >
        광고 영역 (애드센스 승인 후 자동 노출)
      </div>
    );
  }

  return (
    <ins
      className={`adsbygoogle block ${className}`}
      style={{ display: "block" }}
      data-ad-client={CLIENT}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
