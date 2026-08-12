// 홈페이지 메인화면 설정 (관리자 화면에서 고칠 수 있는 값들)
//
// 코드를 고치지 않고도 사장님이 관리자 화면에서:
//   · 메인 첫 화면 문구와 색
//   · 섹션 순서 / 켜고 끄기 / 제목 / 몇 개 보여줄지
//   · 상단 공지 띠
//   · 회사 정보(푸터)
// 를 바꿀 수 있게 한다.
//
// 저장 위치: Redis key `site:config` (JSON 한 덩이)
// 값이 없거나 Redis가 잠깐 안 되면 아래 기본값으로 그대로 돈다 → 화면이 절대 비지 않는다.

import { unstable_cache } from "next/cache";
import { kvGet, kvSet } from "@/lib/store";

export const SITE_CONFIG_KEY = "site:config";
export const SITE_CONFIG_TAG = "sitecfg";

export type SectionType =
  | "featured" // 대표글 + 인기글 랭킹
  | "latest" // 최신 이슈
  | "categories" // 카테고리별 묶음
  | "channel-oddsbag" // 오즈백 소식
  | "channel-music" // 뮤직 소식
  | "services" // 서비스(앱) 카드
  | "ad" // 광고
  | "subscribe"; // 뉴스레터 구독

export interface HomeSection {
  id: string;
  type: SectionType;
  title: string;
  subtitle?: string;
  enabled: boolean;
  limit: number; // 몇 개 보여줄지
  moreHref?: string; // '더보기' 주소
}

export interface ServiceCard {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  href?: string;
  badge?: string; // 예: "출시 준비 중"
  enabled: boolean;
}

export interface SiteConfig {
  hero: {
    enabled: boolean;
    kicker: string;
    title: string;
    subtitle: string;
    ctaLabel: string;
    ctaHref: string;
    /** brand = 퍼플 배경 큰 인사말 / slim = 얇은 한 줄 / off는 enabled로 */
    style: "brand" | "slim";
    bgFrom: string;
    bgTo: string;
  };
  /** /oddsbag 페이지 — 오즈백 브랜드 소식 게시판의 안내 문구 */
  oddsbag: { lead: string };
  notice: { enabled: boolean; text: string; href: string };
  layout: {
    /** wide = 최대 1152px, narrow = 최대 896px */
    width: "wide" | "narrow";
    /** 카드 그리드 한 줄에 몇 개 (큰 화면 기준) */
    columns: 3 | 4;
  };
  sections: HomeSection[];
  services: ServiceCard[];
  footer: {
    tagline: string;
    company: string;
    ceo: string;
    email: string;
    address: string;
    bizNo: string;
    phone: string; // 고객센터 번호
    kakao: string; // 카카오채널 이름
    intro: string;
    instagram: string;
    facebook: string;
    youtube: string;
  };
  contact: {
    email: string;
    lead: string;
    /** 문의 폼을 화면에 띄울지 */
    formEnabled: boolean;
    /** 접수 후 보여줄 문구 */
    thanks: string;
  };
  updatedAt?: string;
}

export const defaultConfig: SiteConfig = {
  hero: {
    enabled: true,
    kicker: "ODDSBAG",
    title: "이상하게 필요한 것들, 오즈백에 다 있어",
    subtitle:
      "매일의 이슈부터 이색 도구·음악까지. 필요할 때 딱 꺼내 쓰는 잡동사니 가방.",
    ctaLabel: "매거진 보러가기",
    ctaHref: "/magazine",
    // 뉴스 매거진의 첫 화면 임무는 '우리가 누구다'가 아니라 '오늘 이거 읽어봐'다.
    //  큰 퍼플 인사말 띠(brand)가 세로 340px을 먹어서 첫 화면에 기사 제목이 하나도 안 보였다.
    //  얇은 한 줄(slim)로 내리면 브랜드는 로고와 컬러가 이미 말해준다.
    style: "slim", // ← 저장된 설정(Redis)이 있으면 그쪽이 이긴다. 관리자 화면에서도 바꿔야 한다.
    bgFrom: "#4c1d95",
    bgTo: "#7b4fb5",
  },
  // /oddsbag 은 '매거진 소개'가 아니라 오즈백 브랜드 소식 게시판이다.
  //  (지시 2026-08-12 — 매거진 설명을 빼고 브랜드 소식 게시판으로 리뉴얼)
  oddsbag: {
    lead: "오즈백 브랜드의 새 소식을 전하는 곳입니다. 새로 나온 서비스, 달라진 점, 알려드릴 일을 여기에 올립니다.",
  },
  notice: { enabled: false, text: "", href: "" },
  layout: { width: "wide", columns: 4 },
  sections: [
    {
      id: "featured",
      type: "featured",
      title: "오늘의 이슈",
      enabled: true,
      limit: 5,
    },
    {
      id: "latest",
      type: "latest",
      title: "최신 이슈",
      enabled: true,
      limit: 8,
      moreHref: "/magazine",
    },
    {
      id: "oddsbag",
      type: "channel-oddsbag",
      title: "오즈백 소식",
      subtitle: "우리가 만드는 것들",
      enabled: true,
      limit: 4,
      moreHref: "/oddsbag",
    },
    {
      id: "services",
      type: "services",
      title: "오즈백 서비스",
      subtitle: "필요할 때 딱 쓰는 도구들",
      enabled: true,
      limit: 8,
      moreHref: "/services",
    },
    {
      id: "music",
      type: "channel-music",
      title: "오즈백 뮤직",
      subtitle: "직접 만드는 음악",
      enabled: true,
      limit: 4,
      moreHref: "/music",
    },
    { id: "ad", type: "ad", title: "", enabled: true, limit: 0 },
    {
      id: "categories",
      type: "categories",
      title: "분야별로 보기",
      enabled: true,
      limit: 4,
      moreHref: "/magazine",
    },
    {
      id: "subscribe",
      type: "subscribe",
      title: "뉴스레터",
      enabled: true,
      limit: 0,
    },
  ],
  // 실제로 돌아가는 것만 띄운다 (지시 2026-08-12).
  //  아직 준비도 안 된 것을 올려두면 사람이 눌러보고 빈손으로 나간다.
  //  내릴 것은 지우지 않고 enabled: false 로만 꺼둔다 — 준비되면 다시 켜면 된다.
  services: [
    {
      id: "starflow",
      emoji: "🌙",
      title: "별의 결",
      desc: "사주·오늘의 운세·타로·궁합·MBTI·이름풀이를 한 곳에서. 결과는 이미지 카드로 저장·공유.",
      href: "https://starflow.today",
      enabled: true,
    },
    {
      id: "magazine",
      emoji: "📰",
      title: "오즈백 매거진",
      desc: "매일의 사회·경제·테크 이슈를 오즈백 시선으로 정리합니다.",
      href: "/magazine",
      enabled: true,
    },
    {
      id: "music",
      emoji: "🎵",
      title: "오즈백 뮤직",
      desc: "직접 만든 음악을 영상으로 올립니다. 유튜브에서 바로 들으실 수 있습니다.",
      // 유튜브 영상을 홈페이지로 끌어오는 작업 전까지는 채널로 바로 보낸다.
      //  (/music 은 아직 글이 0편이라 누르면 빈 화면이다)
      href: "https://www.youtube.com/@ODDSBAGMUSIC",
      enabled: true,
    },
    {
      id: "tales",
      emoji: "📖",
      title: "오즈백 테일즈",
      desc: "끝까지 보게 되는 짧은 이야기 영상. 유튜브에서 바로 보실 수 있습니다.",
      href: "https://www.youtube.com/@oddsbag_tales",
      enabled: true,
    },
    // ↓ 준비되면 다시 켤 것
    {
      id: "apps",
      emoji: "📱",
      title: "오즈백 앱",
      desc: "이색 계산기·생성기 10종을 한 앱에. 안드로이드 출시 준비 중.",
      href: "/services",
      badge: "출시 준비 중",
      enabled: false,
    },
    {
      id: "newsletter",
      emoji: "✉️",
      title: "뉴스레터",
      desc: "그날의 이슈를 한 통으로 정리해 메일로 보내드립니다.",
      href: "/#subscribe",
      enabled: false,
    },
  ],
  footer: {
    tagline: "이상하게 필요한 것들, 오즈백에 다 있어",
    company: "펀트컴퍼니",
    ceo: "김성관",
    email: "oddsbag_official@gmail.com",
    address: "",
    bizNo: "610-28-51770",
    phone: "070-7954-1454",
    kakao: "오즈백",
    intro:
      "오즈백은 매일의 이슈를 쉽게 정리해 전하고, 필요할 때 꺼내 쓰는 이색 도구와 음악을 만드는 1인 미디어 스튜디오입니다.",
    instagram: "https://instagram.com/oddsbag_official",
    facebook: "https://www.facebook.com/profile.php?id=61586029697990",
    youtube: "",
  },
  contact: {
    email: "oddsbag_official@gmail.com",
    lead: "제보, 정정 요청, 제휴 무엇이든 편하게 보내주세요.",
    formEnabled: true,
    thanks: "문의가 접수되었습니다. 영업일 기준 2~3일 안에 답변드릴게요.",
  },
};

// 저장된 값이 일부만 있어도 기본값과 합쳐서 항상 완전한 모양으로 만든다.
// (설정 항목을 나중에 추가해도 예전 저장값 때문에 화면이 깨지지 않는다)
function merge(saved: Partial<SiteConfig> | null): SiteConfig {
  if (!saved) return defaultConfig;
  return {
    hero: { ...defaultConfig.hero, ...(saved.hero ?? {}) },
    oddsbag: { ...defaultConfig.oddsbag, ...(saved.oddsbag ?? {}) },
    notice: { ...defaultConfig.notice, ...(saved.notice ?? {}) },
    layout: { ...defaultConfig.layout, ...(saved.layout ?? {}) },
    sections:
      Array.isArray(saved.sections) && saved.sections.length
        ? saved.sections
        : defaultConfig.sections,
    services: Array.isArray(saved.services)
      ? saved.services
      : defaultConfig.services,
    footer: { ...defaultConfig.footer, ...(saved.footer ?? {}) },
    contact: { ...defaultConfig.contact, ...(saved.contact ?? {}) },
    updatedAt: saved.updatedAt,
  };
}

async function loadConfig(): Promise<SiteConfig> {
  try {
    const raw = await kvGet(SITE_CONFIG_KEY);
    return merge(raw ? (JSON.parse(raw) as Partial<SiteConfig>) : null);
  } catch (e) {
    console.warn("사이트 설정 읽기 실패, 기본값 사용:", (e as Error).message);
    return defaultConfig;
  }
}

/** 화면에서 쓰는 설정 (60초 캐시 — 저장하면 곧바로 갱신된다) */
export const getSiteConfig = unstable_cache(loadConfig, ["oddsbag-sitecfg"], {
  revalidate: 60,
  tags: [SITE_CONFIG_TAG],
});

/** 관리자 화면용 — 캐시 없이 바로 읽기 */
export async function getSiteConfigFresh(): Promise<SiteConfig> {
  return loadConfig();
}

export async function saveSiteConfig(next: Partial<SiteConfig>): Promise<SiteConfig> {
  const merged = merge({ ...next, updatedAt: new Date().toISOString() });
  await kvSet(SITE_CONFIG_KEY, JSON.stringify(merged));
  return merged;
}

// ---- 화면에서 쓰는 작은 도우미 ----
export const maxWidthClass = (w: SiteConfig["layout"]["width"]) =>
  w === "narrow" ? "max-w-4xl" : "max-w-6xl";

export const gridClass = (cols: SiteConfig["layout"]["columns"]) =>
  cols === 3
    ? "grid grid-cols-2 gap-3 sm:grid-cols-3"
    : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4";
