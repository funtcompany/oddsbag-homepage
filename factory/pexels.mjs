// Pexels 무료 영상뱅크 연동 — 세로 릴스 배경(B-roll) 검색·다운로드.
//  · 라이선스: 상업 이용 OK, 출처표기 불필요(단, 오즈백은 예의상 표기함).
//  · 키: PEXELS_API_KEY (.env.local / GitHub Secret)
import fs from "node:fs";

const KEY = process.env.PEXELS_API_KEY;

// 카테고리 → 배경영상 검색어 후보(영어가 결과가 풍부). 앞쪽 우선 시도.
export const BROLL_QUERIES = {
  경제: ["stock market ticker", "counting money", "city business skyline", "financial charts", "korean won cash"],
  사회: ["city crowd people", "seoul street", "community people", "hospital corridor", "public transport crowd"],
  "문화·연예": ["cinema theater", "concert crowd lights", "movie film reel", "neon city night", "music studio"],
  "IT·테크": ["data center servers", "circuit board macro", "artificial intelligence abstract", "coding screen", "robot technology"],
  스포츠: ["stadium crowd", "running track", "soccer ball field", "basketball court"],
  트렌드: ["neon lights abstract", "social media phone", "fast city timelapse", "trendy youth"],
};

// 검색 → 세로(1080x1920)에 가장 알맞은 영상 1개 고르기
export async function findBroll(query, { minSec = 4, maxSec = 40 } = {}) {
  if (!KEY) throw new Error("PEXELS_API_KEY 없음");
  const r = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&size=medium&per_page=20`, {
    headers: { Authorization: KEY },
    signal: AbortSignal.timeout(30000),
  });
  const j = await r.json();
  const vids = (j.videos || []).filter((v) => v.duration >= minSec && v.duration <= maxSec);
  for (const v of vids) {
    // 세로 파일 중 폭 720~1440, mp4 우선으로 1080x1920에 가까운 것
    const files = (v.video_files || []).filter((f) => f.file_type === "video/mp4" && f.height >= f.width);
    files.sort((a, b) => Math.abs((a.width || 0) - 1080) - Math.abs((b.width || 0) - 1080));
    const pick = files[0];
    if (pick) return { link: pick.link, width: pick.width, height: pick.height, duration: v.duration, author: v.user?.name || "Pexels", authorUrl: v.user?.url || "", pageUrl: v.url, id: v.id };
  }
  return null;
}

// 여러 검색어를 순서대로 시도해 첫 성공을 반환
export async function findBrollForCategory(category, extraQuery) {
  const queries = [...(extraQuery ? [extraQuery] : []), ...(BROLL_QUERIES[category] || BROLL_QUERIES["트렌드"])];
  for (const q of queries) {
    try { const hit = await findBroll(q); if (hit) return { ...hit, query: q }; } catch (e) { /* 다음 검색어 */ }
  }
  return null; // 못 찾으면 호출부에서 타이포(폴백)로
}

export async function downloadBroll(link, outPath) {
  const r = await fetch(link, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error("B-roll 다운로드 실패: " + r.status);
  fs.writeFileSync(outPath, Buffer.from(await r.arrayBuffer()));
  return outPath;
}

// 출처 표기 문구 (화면 자막 / 설명 / 태그용)
export function brollCredit(b) {
  return { caption: `영상: ${b.author} / Pexels`, tag: "#Pexels", url: b.pageUrl };
}
