// 커버 사진 (Pexels 무료 스톡 — 상업적 사용 OK, 출처표기 의무 없음)
// 후보 여러 장을 받아 AI(비전)가 기사에 맞는 걸 고른다. 맞는 게 없으면 null → 생성형 디자인 폴백.

import { pickBestPhoto } from "@/lib/ai";

const KEY = process.env.PEXELS_API_KEY;
export const imagesEnabled = Boolean(KEY);

export interface CoverImage {
  url: string;
  credit: string;
}

const CATEGORY_QUERY: Record<string, string> = {
  사회: "korea city people daily life",
  경제: "finance economy money chart",
  스포츠: "sports stadium athlete",
  "IT·테크": "technology computer digital",
  "문화·연예": "culture concert entertainment",
  트렌드: "lifestyle trend young people",
};

interface Candidate {
  url: string; // 실제 커버로 쓸 큰 이미지
  small: string; // AI 판별용 작은 이미지 (토큰 절약)
  credit: string;
}

async function search(query: string, n: number): Promise<Candidate[]> {
  if (!KEY || !query.trim()) return [];
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${n}&orientation=landscape`,
      { headers: { Authorization: KEY }, cache: "no-store" },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      photos?: {
        src?: { landscape?: string; large?: string; medium?: string };
        photographer?: string;
      }[];
    };
    return (data.photos ?? [])
      .map((p) => ({
        url: p.src?.landscape || p.src?.large || "",
        small: p.src?.medium || p.src?.landscape || "",
        credit: `사진: ${p.photographer ?? "Pexels"} (Pexels)`,
      }))
      .filter((c) => c.url && c.small);
  } catch {
    return [];
  }
}

/**
 * 기사에 맞는 커버 사진을 찾는다.
 * 1) AI가 뽑은 정확한 검색어로 후보 4장 → AI가 눈으로 보고 선택
 * 2) 못 고르면 백업 검색어로 재시도
 * 3) 그래도 없으면 null (생성형 디자인 사용) — 엉뚱한 사진보다 낫다
 */
export async function findCoverImage(
  imageQuery: string,
  imageQueryAlt: string,
  categoryLabel: string,
  title: string,
  summary: string,
): Promise<CoverImage | null> {
  if (!KEY) return null;

  const queries = [
    imageQuery,
    imageQueryAlt,
    CATEGORY_QUERY[categoryLabel] ?? "",
  ].filter(Boolean);

  for (const q of queries) {
    const candidates = await search(q, 4);
    if (candidates.length === 0) continue;
    const idx = await pickBestPhoto(
      title,
      summary,
      candidates.map((c) => ({ url: c.small })),
    );
    if (idx !== null && candidates[idx]) {
      return { url: candidates[idx].url, credit: candidates[idx].credit };
    }
    // AI가 "none" → 다음 검색어로
  }
  return null; // 적합한 사진 없음 → 생성형 디자인
}
