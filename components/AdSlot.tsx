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

  // 애드센스 승인(NEXT_PUBLIC_ADSENSE_CLIENT 설정) 전에는 아무것도 노출하지 않음.
  // 승인 후 게시자 ID를 환경변수에 넣으면 실제 광고가 자동으로 나타남.
  if (!CLIENT) return null;

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
