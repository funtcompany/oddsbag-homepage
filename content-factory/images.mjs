// 커버 사진 (Pexels 무료 스톡 — 상업적 사용 OK, 출처표기 의무 없음)
// 후보 여러 장을 받아 AI(비전)가 기사에 맞는 걸 고른다. 맞는 게 없으면 null → 생성형 디자인 폴백.

import { pickBestPhoto } from "./ai.mjs";
import { smembers, sadd } from "./store.mjs";

const KEY = process.env.PEXELS_API_KEY;
export const imagesEnabled = Boolean(KEY);

// 이미 커버로 쓴 사진 ID를 모아두는 집합 (중복/유사 반복 방지)
const USED_KEY = "images:used";

const CATEGORY_QUERY = {
  사회: "korea city people daily life",
  경제: "finance economy money chart",
  스포츠: "sports stadium athlete",
  "IT·테크": "technology computer digital",
  "문화·연예": "culture concert entertainment",
  트렌드: "lifestyle trend young people",
};

// 후보를 넉넉히(기본 30장) + 매번 다른 페이지(1~3)에서 가져와 다양성을 확보한다.
async function search(query, n = 30) {
  if (!KEY || !query.trim()) return [];
  try {
    const page = 1 + Math.floor(Math.random() * 3); // 1~3 페이지 랜덤 → 매번 다른 후보
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${n}&page=${page}&orientation=landscape`,
      { headers: { Authorization: KEY }, cache: "no-store" },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.photos ?? [])
      .map((p) => ({
        id: String(p.id ?? ""),
        url: p.src?.landscape || p.src?.large || "",
        small: p.src?.medium || p.src?.landscape || "",
        credit: `사진: ${p.photographer ?? "Pexels"} (Pexels)`,
      }))
      .filter((c) => c.id && c.url && c.small);
  } catch {
    return [];
  }
}

// 배열 섞기 (같은 후보군이어도 매번 순서를 바꿔 반복을 줄인다)
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 기사에 맞는 커버 사진을 찾는다. (중복/유사 사진 반복 방지)
 * 1) AI 검색어로 후보 30장을 넉넉히 받고 → 이미 쓴 사진은 제외
 * 2) 안 쓴 후보를 섞어 6장만 AI(비전)에게 보여 기사에 맞는 걸 선택
 * 3) 고른 사진 ID를 '사용함'으로 기록 → 다음 글부터 안 뽑힘
 * 4) 검색어를 바꿔가며 재시도, 그래도 없으면 null (생성형 디자인)
 */
export async function findCoverImage(
  imageQuery,
  imageQueryAlt,
  categoryLabel,
  title,
  summary,
) {
  if (!KEY) return null;

  const queries = [
    imageQuery,
    imageQueryAlt,
    CATEGORY_QUERY[categoryLabel] ?? "",
  ].filter(Boolean);

  // 지금까지 커버로 쓴 사진 ID들 (한 번만 불러와 메모리에서 대조)
  let used;
  try {
    used = new Set(await smembers(USED_KEY));
  } catch {
    used = new Set();
  }

  for (const q of queries) {
    const candidates = await search(q);
    if (candidates.length === 0) continue;

    // 안 쓴 사진 우선. 전부 썼으면(후보가 다 소진) 어쩔 수 없이 전체에서 고른다.
    const fresh = candidates.filter((c) => !used.has(c.id));
    const pool = shuffle(fresh.length ? fresh : candidates).slice(0, 6);

    const idx = await pickBestPhoto(
      title,
      summary,
      pool.map((c) => ({ url: c.small })),
    );
    if (idx !== null && pool[idx]) {
      const chosen = pool[idx];
      try {
        await sadd(USED_KEY, chosen.id); // 다음부터 이 사진은 제외
      } catch {
        /* 기록 실패가 발행을 막지는 않는다 */
      }
      return { url: chosen.url, credit: chosen.credit };
    }
    // AI가 "none" → 다음 검색어로
  }
  return null; // 적합한 사진 없음 → 생성형 디자인
}
