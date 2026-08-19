// ─────────────────────────────────────────────────────────────
//  출처 «링크» 걸러내기 — «출처»라는 말이 거짓이 되지 않게
//
//  ★이름 주의 — lib/sources.ts 는 «이슈 수집기»(구글 트렌드·구글 뉴스)로 전혀 다른 파일이다.
//     여기는 글에 붙는 출처 링크를 «보여줄지 말지» 판정하는 곳이다.
// ─────────────────────────────────────────────────────────────
//
//  ★2026-08-20 발견. 글 43편의 «출처» 칸이 oddsbag.co.kr — 우리 사이트를 가리키고 있었다.
//     화면에는 「출처: 원문 보기」 로 떠서, 읽는 사람은 «바깥 어딘가에 원문이 있다»고 읽는다.
//     눌러 보면 우리 홈이다. 특히 「AI가 알려준 링크 가짜인지 확인하는 법」 이라는 글이
//     그러고 있었다.
//
//  왜 생겼나 — 가이드(꿀팁)는 밖에서 긁어온 기사가 아니라 우리가 직접 검증해 넣은
//     근거(facts)로 쓴다. 그래서 «원문 주소»가 없는데, 파이프라인이 빈자리를 우리 홈으로
//     메웠다. 지어낸 것은 아니지만 «출처»라는 이름표가 사실이 아니게 됐다.
//
//  고치는 자리 — 만드는 쪽(pipeline)과 «보여주는 쪽» 둘 다.
//     보여주는 쪽을 고쳐야 이미 나가 있는 43편이 «지금» 바로잡힌다.
//     만드는 쪽만 고치면 앞으로 것만 낫고 이미 나간 것은 그대로다.
//
//  ※우리 서비스를 소개하는 글(WPMS·HTML 링크 생성기 홍보 10편)이 자기 서비스 주소를
//    가리키는 것은 «틀린 것이 아니다». 다만 그것은 «출처»가 아니라 «가는 길»이라
//    출처 칸에서 빼고 ServiceBand·본문 링크가 맡는다 (2026-08-20 커밋에서 본문 주소가
//    눌리게 됐다).

export interface SourceLink {
  title: string;
  url: string;
}

/** 우리 것인가 — 서브도메인까지 본다 (oddsbag.co.kr · www.oddsbag.co.kr) */
export function isOwnUrl(url: string): boolean {
  try {
    const h = new URL(url, "https://oddsbag.co.kr").hostname.toLowerCase();
    return h === "oddsbag.co.kr" || h.endsWith(".oddsbag.co.kr");
  } catch {
    return false;
  }
}

/**
 * «출처» 칸에 실제로 내보낼 것만 남긴다.
 *  · 주소가 없는 것 → 뺀다
 *  · 우리 사이트를 가리키는 것 → 뺀다 (그건 출처가 아니다)
 *  하나도 안 남으면 빈 배열 → 화면은 출처 칸 자체를 그리지 않는다.
 */
export function externalSources(sources?: SourceLink[] | null): SourceLink[] {
  if (!sources?.length) return [];
  const seen = new Set<string>();
  return sources.filter((s) => {
    const u = (s?.url || "").trim();
    if (!u || isOwnUrl(u)) return false;
    if (seen.has(u)) return false; // 같은 주소가 두 번 실린 것도 정리한다
    seen.add(u);
    return true;
  });
}
