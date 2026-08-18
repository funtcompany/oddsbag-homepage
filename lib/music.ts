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

// ★「판(editions)」이 무엇인가 — 사장님 확답 2026-08-18
//
//   노래 앨범(가사 있음)은 «연주(inst) 판»이 따로 나온다 → 판이 둘이다.
//     · 장마       노래 6곡 + 연주 6곡
//     · 여름 한 바퀴 노래 8곡 + 연주 8곡
//   연주 앨범(BGM)은 처음부터 연주뿐이라 판이 하나다.
//     · 비 오는 카페 8곡 · 볕 드는 날 8곡
//   그래서 노래 앨범은 두 판의 곡 수가 «같은 것이 정상»이다. 중복이 아니다.
//
// ★앨범 소개 자료(oddsbag-music/02_콘텐츠/앨범소개_*.html)의 「연주 앨범 4장」은
//   «따로 낸 BGM 앨범»만 센 숫자다. 노래 앨범에 붙는 연주 판은 거기 안 들어간다.
//   이걸 «연주 음원 전부»로 읽으면 「여름 한 바퀴 연주판은 없는 앨범」이라는 오진이 난다.
//   (2026-08-18 검수에서 실제로 그렇게 잘못 읽었다. 사장님이 바로잡아 주셨다)
//
// ★대표영상이 비공개(403)라고 데이터가 틀린 것이 아니다 — 발매 전이면 당연히 비공개다.
//   여름 한 바퀴는 노래·연주 «둘 다» 비공개였고, 이유는 2026-08-22 발매 전이기 때문이다.
//   화면은 playableEditions()(301줄)가 공개된 판만 걸러 내보내므로 저절로 맞춰진다.

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
    intro:
      "「장마」의 정반대입니다. 같은 여름인데 이번엔 집을 나섭니다. " +
      "비 그치고 하늘이 개고, 시동을 걸고 도시를 빠져나가고, 휴게소에 들르고, " +
      "바다가 처음 보이고, 노을을 보고, 돌아오는 길까지 — 하루의 시간 순서 그대로입니다.\n\n" +
      "장르는 인디 서프팝인데 캘리포니아가 아니라 한국 여름입니다. " +
      "얼음컵, 호두과자, 하이패스 삑 소리, 대시보드에 올린 발, 백미러에 남은 주황. " +
      "서프 기타에 이 사물들을 얹은 조합은 우리 것입니다.\n\n" +
      "★「장마」와는 별개의 앨범입니다. 곡이 하나도 겹치지 않습니다. " +
      "다만 이 앨범의 첫 곡 제목이 「장마 끝(Rain Ends)」이라, 두 앨범을 잇는 이음매가 됩니다.",
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
    intro:
      "「비 오는 카페」의 짝입니다. 하루의 축은 같은데 날씨가 반대입니다. " +
      "창 열고 볕 들이기 → 커피와 토스트 → 슬리퍼 신고 동네 한 바퀴 → 바닥에 앉은 햇살 → " +
      "소파에서 낮잠 → 햇볕 냄새 나는 빨래 → 노을 지는 골목 → 평상에 누워 별.\n\n" +
      "따뜻한 어쿠스틱 연주입니다. 「비 오는 카페」가 실내에 갇혀 있다면 " +
      "이 앨범은 문이 열려 있습니다. 아침 청소·요리·주말 오전에 틀어 두는 자리를 노렸습니다.",
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
    // 2026-08-18 정정: 08-11 → 08-10.
    //  오즈백뮤직 00_기준문서/발매_링크.json(발매 완료) · 앨범소개_요약.html ·
    //  애플뮤직 앨범 6794910371 셋이 전부 08-10 이다. 08-11 은 캘린더 요약표의 낡은 계획값이었다.
    releaseDate: "2026-08-10",
    blurb:
      "비 오는 날 카페에서 흘러나올 법한 재즈풍 BGM. 공부·작업·독서할 때 틀어두세요.",
    scene: "공부 · 작업 · 독서",
    cover: "/albums/rainy-cafe.jpg",
    bgFrom: "#3f3f46",
    bgTo: "#71717a",
    intro:
      "ODDSBAG의 첫 연주 앨범입니다. 「장마」와 같은 세계관 — " +
      "그 여름 그 동네의 카페 안쪽입니다.\n\n" +
      "아침에 막 비가 시작하고, 창가에서 빗줄기를 보고, 오후에 잠깐 굵어지고, " +
      "젖은 흙 냄새가 나고, 문 옆에 우산이 쌓이고, 손님이 빠지고, " +
      "불 끈 뒤에도 비가 내리고, 그러다 갭니다.\n\n" +
      "드림팝 톤의 카페 재즈입니다. 빗소리와 카페 소음은 배경에만 아주 옅게 깔았습니다 — " +
      "앞으로 튀어나오면 그 곡은 버립니다.",
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
    intro:
      "ODDSBAG의 첫 앨범입니다. 오래된 동네 반지하에 살던 스무 몇 살 한 사람이 화자입니다.\n\n" +
      "장마는 사건이 없는 계절입니다. 비가 와서 못 나가고, 빨래가 안 마르고, " +
      "그러다 스무 날이 지납니다. 이 앨범은 그 스무 날에 " +
      "아무 일도 안 일어났다는 것을 씁니다.\n\n" +
      "곡마다 마지막 줄에서 한 번씩 뒤집힙니다. 「아직 젖어 있어」가 빨래 이야기인 줄 알고 " +
      "듣다가, 마지막에 이게 누구 이야기였는지 알게 됩니다.",
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
        // 2026-08-18 정정: 7 → 6. 재생목록 항목 7개 안에 «모음집»이 섞여 있었다.
        //  (위 52~59줄이 스스로 「항목 수를 곡이라 적지 말라」고 못박아 둔 바로 그 경우)
        //  「장마」는 노래도 연주도 6곡이다 — inst 음원 6개 · 연주 전곡 영상 제목이 「6곡 (17분)」.
        trackCount: 6,
        // 2026-08-18 교체: Q8XHQr3XeTk 은 «쇼츠 한 곡»(우산이 기울어 Inst. #shorts)이었다.
        //  대표 자리에는 연주 전곡 영상을 건다. oEmbed 200 으로 공개 확인함.
        leadVideoId: "e_0ja_rHs6k",
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

/** 날짜상 아직 안 나온 앨범인가 */
export const isUpcoming = (a: Album): boolean =>
  a.releaseDate > new Date().toISOString().slice(0, 10);

export const totalTracks = (a: Album): number =>
  a.editions.reduce((n, e) => n + e.trackCount, 0);

// ─────────────────────────────────────────────────────────────
// 지금 «방문자가» 들을 수 있는가
//
// ★2026-08-18 하마터면 크게 틀릴 뻔한 것 — 반드시 읽을 것.
//   재생목록의 곡 수를 우리 채널 계정으로 로그인한 채 셌다. 그랬더니 21곡이 보였다.
//   그런데 **로그인 안 한 방문자에게는 20개가 «사용할 수 없는 동영상»으로 숨는다.**
//   업로드 크론이 매일 조금씩 푸는 중이라 아직 공개 안 된 것이다.
//   그대로 뒀으면 「8곡」이라 써 붙이고 재생기에서는 1곡만 나왔다.
//   → **우리 계정으로 본 것을 방문자가 보는 것이라고 믿으면 안 된다.**
//
// 그래서 화면에 재생기를 걸기 전에 «대표 영상이 정말 공개인가»를 물어본다.
// oEmbed 는 열쇠가 필요 없고, 비공개·미등록 영상에는 실패를 준다.
// ─────────────────────────────────────────────────────────────

async function probePublic(videoId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { next: { revalidate: 1800 } },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * 이 앨범을 지금 홈페이지에서 재생할 수 있나.
 * 판(연주/노래)마다 대표 영상이 공개인지 물어본다.
 * 통신이 실패하면 «재생 가능»으로 본다 — 잠깐의 네트워크 문제로
 * 멀쩡한 앨범이 「곧 공개」로 뒤집히는 게 더 나쁘기 때문이다.
 */
export async function playableEditions(a: Album): Promise<Set<string>> {
  const results = await Promise.all(
    a.editions.map(async (e) => [e.playlistId, await probePublic(e.leadVideoId)] as const),
  );
  return new Set(results.filter(([, ok]) => ok).map(([id]) => id));
}

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
