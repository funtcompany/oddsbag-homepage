// 유튜브 인기영상 수집 (YouTube Data API v3, 무료 키)
// 국가별 트렌딩 = 한국인이 지금 많이 보는 영상 / 관심 국가 트렌드 파악.

const KEY = process.env.YOUTUBE_API_KEY;

export async function collectYouTube(regionCode = "KR", max = 6) {
  // 열쇠가 없으면 조용히 0건을 돌려주고 있었다 — 수집원 5개 중 하나가 몇 달째
  //   아무 말 없이 빈손으로 돌아오는데 아무도 몰랐다. 이제는 말하고 넘어간다.
  //   (고치는 법: 구글 클라우드에서 YouTube Data API v3 키를 발급받아
  //    GitHub 저장소 Secrets 에 YOUTUBE_API_KEY 로 등록. 워크플로 배선은 이미 돼 있다)
  if (!KEY) {
    console.log("  · 유튜브 수집 건너뜀 — YOUTUBE_API_KEY 가 없습니다 (0건)");
    return [];
  }
  const url =
    `https://www.googleapis.com/youtube/v3/videos` +
    `?part=snippet&chart=mostPopular&regionCode=${regionCode}` +
    `&maxResults=${max}&key=${KEY}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`YouTube API ${res.status}`);
  const data = await res.json();

  return (data.items ?? []).map((it) => ({
    source: "youtube",
    title: it.snippet?.title ?? "",
    summary:
      (it.snippet?.description ?? "").slice(0, 200) ||
      `${it.snippet?.channelTitle ?? ""} 채널의 인기 영상`,
    link: `https://www.youtube.com/watch?v=${it.id}`,
    category: "트렌드",
    extra: `유튜브 ${regionCode} 인기영상`,
  }));
}
