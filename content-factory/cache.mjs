// next/cache 대체 — 콘텐츠 공장은 Vercel 밖(GitHub Actions)에서 도므로 revalidateTag가 없다.
// 대신 홈페이지의 작은 재검증 엔드포인트(/api/revalidate)를 호출해 발행 후 캐시를 무효화한다.
// (실패해도 치명적이지 않다: 홈페이지 목록은 60초 ISR로 곧 갱신됨)
const SITE = process.env.SITE_URL || "https://oddsbag.co.kr";
const SECRET = process.env.CRON_SECRET || "";

// 원본 코드가 `import { revalidateTag } from "next/cache"` 로 쓰던 것을 그대로 대체(호출부 무수정).
export async function revalidateTag(/* ...tags 무시 */) {
  try {
    await fetch(`${SITE}/api/revalidate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SECRET}` },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    /* 캐시 무효화 실패는 무시 */
  }
}

// unstable_cache 대체: 캐싱 없이 원본 함수를 그대로 실행 (공장은 항상 최신 Redis를 읽음)
export function unstable_cache(fn /* , keys, opts */) {
  return fn;
}
