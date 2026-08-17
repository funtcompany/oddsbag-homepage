// 홈 맨 위 큰 띠에 걸리는 «주요 소식» — 브랜드·프로젝트마다 한 칸씩 (2026-08-18 리뉴얼)
//
// ★여기 적힌 것은 전부 2026-08-18 브랜드 폴더에서 실제로 확인한 사실이다.
//   확인 못 한 것은 아예 쓰지 않았다 (오즈백 절대원칙 1 — 지어내지 않는다).
//
// ★가격을 적지 않는다 (회사 공통 규칙). 값은 판매 페이지에서만 말한다.
//
// ★배경 사진은 public/showcase/ 에 복사해 둔 사본을 쓴다.
//   원본은 각 브랜드 폴더에 그대로 있고 하나도 건드리지 않았다.
//   사진이 없는 칸은 image 를 비워 두면 화면이 브랜드 색 + 큰 이모지로 알아서 채운다.

export interface Showcase {
  key: string;
  /** 어느 브랜드·프로젝트인가 */
  name: string;
  emoji: string;
  /** 왼쪽 위 노란 알약 — 지금 상태 */
  badge: string;
  /** 그 옆 영문 작은 글씨 */
  kicker: string;
  headline: string;
  blurb: string;
  cta: { label: string; href: string; external?: boolean };
  cta2?: { label: string; href: string; external?: boolean };
  /** public 기준 경로. 없으면 색+이모지로 그린다 */
  image?: string;
  bgFrom: string;
  bgTo: string;
}

export const showcase: Showcase[] = [
  {
    key: "wpms",
    name: "WPMS",
    emoji: "🎤",
    badge: "출시",
    kicker: "WPMS · ver.26",
    headline: "무대에 올라가 노트를 넘겨주지 않아도 됩니다",
    // 「무선 발표 관리 시스템」이 정식 이름이다 (무선중계관리시스템 아님 — 2026-08-18 확인)
    blurb:
      "발표 노트북에 설치하면 같은 공유기에 붙은 태블릿이 발표자 노트와 남은 시간을 함께 봅니다. 무선 발표 관리 시스템 WPMS, 스마트스토어에서 판매 중입니다.",
    cta: { label: "제품 보기", href: "/oddsbag/service/wpms" },
    cta2: {
      label: "스마트스토어",
      href: "https://smartstore.naver.com/funt_store/products/13717822182",
      external: true,
    },
    image: "/showcase/wpms-hall.jpg",
    bgFrom: "#0f172a",
    bgTo: "#4c1d95",
  },
  {
    key: "music",
    name: "오즈백 뮤직",
    emoji: "🎵",
    badge: "신규 앨범",
    kicker: "ODDSBAG MUSIC",
    headline: "「볕 드는 날」이 나왔습니다",
    blurb:
      "볕 잘 드는 집에서 보내는 하루를 담은 어쿠스틱 BGM 앨범. 24시간 라이브도 계속 돌아갑니다.",
    cta: { label: "앨범 들으러 가기", href: "/music" },
    cta2: {
      label: "유튜브 채널",
      href: "https://www.youtube.com/@ODDSBAGMUSIC",
      external: true,
    },
    image: "/showcase/music-sunny.jpg",
    bgFrom: "#b45309",
    bgTo: "#f59e0b",
  },
  {
    key: "starflow",
    name: "별의 결",
    emoji: "🌙",
    badge: "운영 중",
    kicker: "STARFLOW",
    headline: "오늘의 나를, 별의 결로 읽다",
    blurb:
      "사주·오늘의 운세·타로·궁합·MBTI·이름풀이를 한곳에서. 오늘의 운세는 매일 한 번 무료로 보실 수 있습니다.",
    cta: { label: "별의 결 소개", href: "/oddsbag/service/starflow" },
    cta2: {
      label: "바로 보러 가기",
      href: "https://starflow.today",
      external: true,
    },
    image: "/showcase/starflow.jpg",
    bgFrom: "#1f1147",
    bgTo: "#7b4fb5",
  },
  {
    key: "memonap-studio",
    name: "메모냅 스튜디오",
    emoji: "📷",
    badge: "문의 접수 중",
    kicker: "MEMONAP STUDIO",
    headline: "완공된 공간을, 있는 그대로",
    // 촬영한 곳의 «상호»는 쓰지 않는다 — 지역·업종까지만 (메모냅 스튜디오 표기 규칙)
    blurb:
      "주거·상업·업무·프랜차이즈 완공 공간을 사진과 영상으로 촬영합니다. 서울·경기 중심에 전국 출장이 가능합니다.",
    cta: {
      label: "촬영 문의",
      href: "http://pf.kakao.com/_EDgsn/chat",
      external: true,
    },
    image: "/showcase/studio-shop.jpg",
    bgFrom: "#1c1917",
    bgTo: "#57534e",
  },
  // ── 메모냅 아카이브 ──
  //  사장님 지시 2026-08-18: 「공연·콩쿠르·클래식 영상 기록/촬영」과 「행사 중계 시스템」
  //  두 가지가 메인이니 이쪽으로 홍보한다. 그래서 칸을 둘로 나눴다.
  //  아래 문구는 memonaparchive.kr 에 실제로 적혀 있는 것만 옮겼다 (2026-08-18 확인):
  //    · "학회 및 심포지엄 시스템 운영 — 학술대회·연수강좌·심포지엄의 온·오프라인 중계와 시스템 운영"
  //    · "공연예술(클래식) 영상 — 오케스트라 연주회, 클래식 공연의 영상 촬영과 녹음"
  {
    key: "memonap-archive-stage",
    name: "메모냅 아카이브 · 공연 기록",
    emoji: "🎼",
    badge: "촬영 문의",
    kicker: "MEMONAP ARCHIVE",
    headline: "무대 위 그 연주를, 남는 기록으로",
    blurb:
      "오케스트라 연주회·콩쿠르·클래식 공연을 영상과 녹음으로 기록합니다. 음악을 아는 사람이 찍습니다.",
    cta: {
      label: "포트폴리오 보기",
      href: "https://memonaparchive.kr/",
      external: true,
    },
    // 실제 촬영 결과물 (성악 정기연주회). 글자가 안 박힌 사진만 골랐다 —
    //  다른 후보들은 화면에 자막·주최측 로고가 박혀 있어 제목을 얹으면 겹친다.
    image: "/showcase/archive-concert.jpg",
    bgFrom: "#1c1917",
    bgTo: "#78350f",
  },
  {
    key: "memonap-archive-live",
    name: "메모냅 아카이브 · 행사 중계",
    emoji: "🎬",
    badge: "중계 문의",
    kicker: "MEMONAP ARCHIVE",
    headline: "학회도, 심포지엄도, 끊기지 않게",
    blurb:
      "학술대회·연수강좌·심포지엄의 온·오프라인 중계와 행사 시스템 운영을 맡습니다. 현장과 온라인을 한 팀이 함께 봅니다.",
    cta: {
      label: "중계 문의하기",
      href: "https://memonaparchive.kr/",
      external: true,
    },
    // ★사진을 일부러 안 넣었다. 중계 현장 사진은 장비·셋팅이 드러나는 것뿐이라
    //  공개 소재 기준에 걸린다. 대신 색과 큰 글자로 세운다 (헌법 「사진이 없으면 타이포로 승부」).
    bgFrom: "#0c4a6e",
    bgTo: "#0e7490",
  },
];
