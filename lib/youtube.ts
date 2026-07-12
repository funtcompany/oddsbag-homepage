// 유튜브 인기영상 수집 (YouTube Data API v3, 무료 키)
// 국가별 트렌딩 = 한국인이 지금 많이 보는 영상 / 관심 국가 트렌드 파악.

import type { RawIssue } from "@/lib/sources";

const KEY = process.env.YOUTUBE_API_KEY;

export async function collectYouTube(
  regionCode = "KR",
  max = 6,
): Promise<RawIssue[]> {
  if (!KEY) return [];
  const url =
    `https://www.googleapis.com/youtube/v3/videos` +
    `?part=snippet&chart=mostPopular&regionCode=${regionCode}` +
    `&maxResults=${max}&key=${KEY}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`YouTube API ${res.status}`);
  const data = (await res.json()) as {
    items?: {
      id: string;
      snippet?: { title?: string; description?: string; channelTitle?: string };
    }[];
  };

  return (data.items ?? []).map((it) => ({
    source: "youtube" as const,
    title: it.snippet?.title ?? "",
    summary:
      (it.snippet?.description ?? "").slice(0, 200) ||
      `${it.snippet?.channelTitle ?? ""} 채널의 인기 영상`,
    link: `https://www.youtube.com/watch?v=${it.id}`,
    category: "트렌드",
    extra: `유튜브 ${regionCode} 인기영상`,
  }));
}
