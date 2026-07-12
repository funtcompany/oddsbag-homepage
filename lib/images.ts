// Pexels 무료 스톡 사진 (상업적 사용 OK, 출처표기 의무 없음)
// 키워드로 관련 사진을 찾아 커버로 사용. 매칭 실패 시 null → 이모지 커버 폴백.

const KEY = process.env.PEXELS_API_KEY;

export const imagesEnabled = Boolean(KEY);

export interface CoverImage {
  url: string; // 이미지 URL
  credit: string; // "사진: 작가명 (Pexels)"
}

// 카테고리 → 영어 폴백 키워드
const CATEGORY_QUERY: Record<string, string> = {
  사회: "korea city people",
  경제: "finance economy money",
  스포츠: "sports stadium",
  "IT·테크": "technology computer",
  "문화·연예": "culture concert",
  트렌드: "lifestyle trend",
};

export async function findCoverImage(
  imageQuery: string,
  categoryLabel: string,
): Promise<CoverImage | null> {
  if (!KEY) return null;
  const query =
    (imageQuery && imageQuery.trim()) ||
    CATEGORY_QUERY[categoryLabel] ||
    "news";

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(
        query,
      )}&per_page=1&orientation=landscape`,
      { headers: { Authorization: KEY }, cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      photos?: {
        src?: { landscape?: string; large?: string };
        photographer?: string;
      }[];
    };
    const photo = data.photos?.[0];
    const url = photo?.src?.landscape || photo?.src?.large;
    if (!url) return null;
    return {
      url,
      credit: `사진: ${photo?.photographer ?? "Pexels"} (Pexels)`,
    };
  } catch {
    return null;
  }
}
