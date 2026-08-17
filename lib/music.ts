// 오즈백 뮤직 — 유튜브에서 끌어오는 앨범·라이브 (2026-08-18 리뉴얼)
//
// ★열쇠(API 키)가 없어도 화면이 절대 비지 않게 만들었다.
//   유튜브는 «키 없이» 되는 길을 두 개 열어 놨고, 우리는 그 둘만 쓴다.
//
//     1) 라이브    https://www.youtube.com/embed/live_stream?channel=<채널ID>
//                  → 그 채널이 지금 켠 라이브를 유튜브가 알아서 물어다 준다.
//                    방송을 껐다 켜도 우리가 영상 주소를 고칠 일이 없다.
//     2) 앨범 재생  https://www.youtube.com/embed/videoseries?list=<재생목록ID>
//                  → 재생목록을 통째로 재생한다.
//     3) 최신 영상  https://www.youtube.com/feeds/videos.xml?channel_id=<채널ID>
//                  → 열쇠 없이 읽히는 공개 RSS.
//
//   그래서 Vercel 에 유튜브 열쇠를 넣지 않아도 이 화면은 그대로 돈다.
//   (열쇠를 넣어야만 되는 길로 만들었다가 배포 환경에 열쇠가 없어 빈 화면이 나오는 사고를 미리 막는다)
//
// ★아래 앨범 목록은 2026-08-18 실제 유튜브 재생목록 8개를 그대로 읽어 적은 것이다.
//   (재생목록 ID·곡수·발매일 전부 실측값. 지어낸 값이 하나도 없다)
//   앨범 «소개 글»은 오즈백 뮤직 프로젝트에서 넘어오면 intro 칸에 넣는다 — 지금은 비어 있고,
//   비어 있으면 «앨범 이야기» 칸이 통째로 빠진다 (빈 제목만 남지 않는다).
//
// ★표지는 유튜브 썸네일이 아니라 public/albums/ 의 실제 앨범 아트를 쓴다.
//   발매 전 앨범(여름 한 바퀴)은 영상이 아직 비공개라 유튜브 썸네일이 404 다.
//   앨범 아트를 쓰면 발매 전에도 표지가 제대로 나온다. (2026-08-18 실측으로 확인)

export const MUSIC_CHANNEL_ID = "UCjL9aOyi9cE20ygRG_5nZgw";
export const MUSIC_CHANNEL_URL = "https://www.youtube.com/@ODDSBAGMUSIC";
export const MUSIC_CHANNEL_NAME = "ODDSBAG MUSIC ㅣ 오즈백뮤직";

/** 유튜브 썸네일 — 만료되는 서명 주소(i9.ytimg.com?sqp=…) 말고 안 변하는 주소를 쓴다 */
export const thumbOf = (videoId: string) =>
  `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;

/** 라이브 붙박이 — 채널이 켠 방송을 유튜브가 알아서 찾아준다 (열쇠 불필요) */
export const liveEmbedUrl = (autoplay = false) =>
  `https://www.youtube.com/embed/live_stream?channel=${MUSIC_CHANNEL_ID}` +
  `&autoplay=${autoplay ? 1 : 0}&mute=1&rel=0`;

/** 재생목록 붙박이 */
export const playlistEmbedUrl = (playlistId: string) =>
  `https://www.youtube.com/embed/videoseries?list=${playlistId}&rel=0`;

export const playlistWatchUrl = (playlistId: string) =>
  `https://www.youtube.com/playlist?list=${playlistId}`;

export type EditionKind = "inst" | "vocal";

export interface AlbumEdition {
  kind: EditionKind;
  label: string;
  playlistId: string;
  /**
   * ★«정식 트랙» 수다. 재생목록 항목 수가 아니다.
   *  재생목록에는 정식 트랙 말고도 쇼츠·긴 모음집·삭제된 영상이 섞여 있다.
   *  (예: 볕 드는 날 연주 재생목록은 항목이 21개지만 실제 곡은 8곡이다 —
   *   삭제 3 + 쇼츠 8 + 모음집 2 를 빼야 나온다)
   *  항목 수를 그대로 «곡»이라 적으면 방문자에게 없는 곡을 있다고 말하는 셈이다.
   *  2026-08-18 재생목록 8개를 전수로 세어 넣은 값이다.
   */
  trackCount: number;
  /** 대표 영상 (표지·미리듣기) */
  leadVideoId: string;
}

export interface Album {
  slug: string;
  title: string;
  titleEn: string;
  emoji: string;
  /** 음원 발매일 (YYYY-MM-DD). 오늘보다 뒤면 화면에 «발매 예정»으로 뜬다 */
  releaseDate: string;
  /** 한 줄 소개 — 유튜브 재생목록 설명에서 가져온 실제 문구 */
  blurb: string;
  /** 어떤 때 듣기 좋은지 */
  scene: string;
  cover: string;
  bgFrom: string;
  bgTo: string;
  editions: AlbumEdition[];
  /**
   * 앨범 소개 본문 — 오즈백 뮤직 프로젝트에서 넘어오면 여기에 넣는다.
   * 비어 있으면 화면이 blurb 와 트랙 목록으로 대신 채운다.
   */
  intro?: string;
}

export const albums: Album[] = [
  {
    slug: "summer-loop",
    title: "여름 한 바퀴",
    titleEn: "Summer Loop",
    emoji: "🌊",
    releaseDate: "2026-08-22",
    blurb:
      "여름 드라이브와 바다로 떠나는 하루. 창문 내리고 달릴 때 듣는 여름 인디·서프팝.",
    scene: "운전 · 바다 가는 길 · 여름 작업",
    cover: "/albums/summer-loop.jpg",
    bgFrom: "#0e7490",
    bgTo: "#0891b2",
    editions: [
      {
        kind: "vocal",
        label: "노래",
        playlistId: "PLaEIZBRZqN3U",
        trackCount: 8,
        leadVideoId: "zTNcvEMMRro",
      },
      {
        kind: "inst",
        label: "연주 BGM",
        playlistId: "PLaxqoUKPnMuU",
        trackCount: 8,
        leadVideoId: "0fTi8Vf4NFE",
      },
    ],
  },
  {
    slug: "sunny-day",
    title: "볕 드는 날",
    titleEn: "Sunny Day",
    emoji: "☀️",
    releaseDate: "2026-08-17",
    blurb:
      "볕 잘 드는 집에서 보내는 하루. 아침에 눈 뜰 때·브런치·집안일·낮잠에 어울리는 따뜻한 어쿠스틱.",
    scene: "아침 · 브런치 · 집안일 · 낮잠",
    cover: "/albums/sunny-day.jpg",
    bgFrom: "#b45309",
    bgTo: "#f59e0b",
    editions: [
      {
        kind: "inst",
        label: "연주 BGM",
        playlistId: "PLJtsHzhCuCzU",
        trackCount: 8,
        leadVideoId: "RTnR0oZIBPs",
      },
    ],
  },
  {
    slug: "rainy-cafe",
    title: "비 오는 카페",
    titleEn: "Rainy Cafe",
    emoji: "☕",
    releaseDate: "2026-08-11",
    blurb:
      "비 오는 날 카페에서 흘러나올 법한 재즈풍 BGM. 공부·작업·독서할 때 틀어두세요.",
    scene: "공부 · 작업 · 독서",
    cover: "/albums/rainy-cafe.jpg",
    bgFrom: "#3f3f46",
    bgTo: "#71717a",
    editions: [
      {
        kind: "inst",
        label: "연주 BGM",
        playlistId: "PLJbN51u--z28",
        trackCount: 8,
        leadVideoId: "Z0UiwYsh3Rg",
      },
    ],
  },
  {
    slug: "monsoon",
    title: "장마",
    titleEn: "Monsoon",
    emoji: "🌧️",
    releaseDate: "2026-08-01",
    blurb:
      "장마철 비 오는 날, 창밖을 보며 듣기 좋은 한국 드림팝. 밤 산책·혼자 있는 시간에.",
    scene: "밤 산책 · 혼자 있는 시간",
    cover: "/albums/monsoon.jpg",
    bgFrom: "#1e3a5f",
    bgTo: "#3b5f8a",
    editions: [
      {
        kind: "vocal",
        label: "노래",
        playlistId: "PLfVhCpUsBDM0",
        trackCount: 6,
        leadVideoId: "HZekGMzY00g",
      },
      {
        kind: "inst",
        label: "연주 BGM",
        playlistId: "PLXZ-k7LmA7fI",
        trackCount: 7,
        leadVideoId: "Q8XHQr3XeTk",
      },
    ],
  },
];

/** 앨범이 아니라 «전부 모아 듣기» 묶음 두 개 */
export interface Collection {
  label: string;
  desc: string;
  emoji: string;
  playlistId: string;
  trackCount: number;
  cover: string;
}

export const collections: Collection[] = [
  {
    label: "연주 BGM 모음",
    desc: "가사 없는 연주곡만. 공부·작업·수면에.",
    emoji: "🎧",
    playlistId: "PLbOZG3SHOZms",
    trackCount: 18,
    cover: "/albums/rainy-cafe.jpg",
  },
  {
    label: "노래 모음",
    desc: "사람이 부르는 곡만. 한국적 정서 × 드림팝.",
    emoji: "🎤",
    playlistId: "PLWPEolvS_0yI",
    trackCount: 6,
    cover: "/albums/monsoon.jpg",
  },
];

export const albumOf = (slug: string): Album | undefined =>
  albums.find((a) => a.slug === slug);

/** 아직 안 나온 앨범인가 */
export const isUpcoming = (a: Album): boolean =>
  a.releaseDate > new Date().toISOString().slice(0, 10);

export const totalTracks = (a: Album): number =>
  a.editions.reduce((n, e) => n + e.trackCount, 0);

// ─────────────────────────────────────────────────────────────
// 최신 영상 — 공개 RSS (열쇠 불필요)
// ─────────────────────────────────────────────────────────────

export interface ChannelVideo {
  videoId: string;
  title: string;
  publishedAt: string;
  thumb: string;
}

/**
 * 채널 최신 영상 — 유튜브 공개 RSS 를 읽는다.
 * 실패해도 던지지 않고 빈 배열을 준다 → 이 줄 하나 때문에 화면 전체가 죽지 않는다.
 */
export async function getLatestVideos(limit = 8): Promise<ChannelVideo[]> {
  try {
    const res = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${MUSIC_CHANNEL_ID}`,
      { next: { revalidate: 1800 } }, // 30분마다 새로 읽는다
    );
    if (!res.ok) return [];
    const xml = await res.text();

    const out: ChannelVideo[] = [];
    // <entry> 한 덩이씩 끊어 필요한 것만 뽑는다 (XML 파서를 새로 들이지 않는다)
    for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
      const e = m[1];
      const videoId = /<yt:videoId>(.*?)<\/yt:videoId>/.exec(e)?.[1];
      const title = /<media:title>([\s\S]*?)<\/media:title>/.exec(e)?.[1];
      const publishedAt = /<published>(.*?)<\/published>/.exec(e)?.[1];
      // 썸네일 주소는 지어내지 않고 RSS 가 준 것을 그대로 쓴다.
      //  maxresdefault.jpg 를 조립하면 그 크기가 없는 영상에서 404 가 난다 (실제로 겪음).
      //  피드가 주는 주소는 반드시 존재한다.
      const feedThumb = /<media:thumbnail[^>]*url="([^"]+)"/.exec(e)?.[1];
      if (!videoId || !title) continue;
      out.push({
        videoId,
        title: decodeXml(title),
        publishedAt: (publishedAt ?? "").slice(0, 10),
        thumb: feedThumb ? decodeXml(feedThumb) : thumbOf(videoId),
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}
