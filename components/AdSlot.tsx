"use client";

import { useEffect } from "react";

// 구글 애드센스 광고 슬롯
// 게시자 ID와 켜짐/꺼짐은 lib/adsense.ts 한 곳에서만 정한다 (값이 두 군데 있으면
// 한쪽만 고쳐서 조용히 어긋난다). 승인 전에는 ADS_ENABLED 가 false 라
// 이 컴포넌트는 아무것도 그리지 않고, 화면은 지금과 똑같다.

import { ADSENSE_PUB, ADS_ENABLED } from "@/lib/adsense";

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
    if (!ADS_ENABLED) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* noop */
    }
  }, []);

  // 애드센스 승인 전에는 아무것도 노출하지 않음 (사장님 결정 2026-08-19).
  // 승인 후 Vercel 환경변수 NEXT_PUBLIC_ADSENSE_ON=1 을 넣고 재배포하면 켜진다.
  if (!ADS_ENABLED) return null;

  // 광고가 들어올 자리를 미리 잡아둔다.
  //  안 잡아두면 광고가 뜨는 순간 본문이 아래로 확 밀린다 —
  //  독자는 읽던 줄을 놓치고, 구글은 이 '화면 튐'을 순위에 직접 반영한다.
  return (
    <div style={{ minHeight: 280 }} className="flex items-center justify-center">
      <ins
        className={`adsbygoogle block w-full ${className}`}
        style={{ display: "block", minHeight: 280 }}
        data-ad-client={ADSENSE_PUB}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
