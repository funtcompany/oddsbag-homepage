// 오즈백이 만드는 것들 — 서비스별 안내 탭 (2026-08-18 리뉴얼)
//
// «만드는 것들» 아래에 서비스마다 탭이 하나씩 생긴다.
//   /oddsbag                    → 브랜드 소식 게시판
//   /oddsbag/service/wpms       → WPMS 안내 + 관련 글 갤러리
//   /oddsbag/service/starflow   → 별의 결 안내 + 관련 글 갤러리
//
// ★여기가 서비스 안내의 단일 원본이다. 서비스를 늘리려면 아래 배열에 한 칸 더 넣으면
//   상단 하위 탭·전체 목록·상세 화면이 한꺼번에 따라온다. 화면 코드는 안 고쳐도 된다.
//
// ★가격을 적지 않는다 (회사 공통 규칙 00-hq/policy.json).
//   파는 값은 판매 페이지에서만 말한다. 여기엔 «어디로 가면 살 수 있는가»만 둔다.

export interface ServiceCTA {
  label: string;
  href: string;
  /** primary = 채운 버튼(주 행동) · ghost = 테두리 버튼(보조) */
  kind: "primary" | "ghost";
  /** 바깥 사이트로 나가는 링크인가 */
  external?: boolean;
}

export interface ServiceDef {
  slug: string;
  /** 하위 탭에 쓰는 짧은 이름 */
  tab: string;
  /** 정식 이름 */
  name: string;
  emoji: string;
  /** 배너 맨 위 작은 글씨 */
  kicker: string;
  /** 배너 큰 제목 */
  headline: string;
  /** 배너 설명 */
  lead: string;
  /** 지금 상태 뱃지 — 사실만 적는다 */
  status: string;
  /** 상태 뱃지 색 (tailwind 클래스) */
  statusTone: string;
  ctas: ServiceCTA[];
  bgFrom: string;
  bgTo: string;
  /** 관련 글을 고를 열쇠말 — 글에 붙은 **태그**와 정확히 맞을 때만 인정한다 */
  keywords: string[];
  /**
   * 제목에 들어 있으면 그 서비스 글로 보는 **고유 이름**.
   * ★흔한 낱말(발표·화면·운세 같은 것)을 여기 넣지 말 것 —
   *   상관없는 기사가 서비스 안내 화면에 딸려 온다.
   */
  brandTerms: string[];
  /** 무엇이 좋은지 3~4칸 */
  highlights: { icon: string; title: string; desc: string }[];
  /** 검색엔진용 한 줄 */
  metaDesc: string;
}

export const services: ServiceDef[] = [
  {
    slug: "wpms",
    tab: "WPMS",
    // ★이름 주의 — 「무선중계관리시스템」이 아니라 「무선 발표 관리 시스템」이다.
    //  (Wireless Presentation Management System · 제조 펀트컴퍼니 · 2026-08-18 실측 확인)
    //  중계 장비가 아니라 발표 진행을 돕는 프로그램이다. 이름을 틀리면 검색도 안 잡힌다.
    name: "WPMS 무선 발표 관리 시스템",
    emoji: "🎤",
    kicker: "WIRELESS PRESENTATION",
    headline: "무대에 올라가지 않아도 됩니다",
    lead: "발표 노트북에 한 번 설치하면, 같은 공유기에 붙은 태블릿과 노트북이 발표자 노트·남은 시간·지금 띄운 화면을 함께 봅니다. 태블릿에는 앱을 깔지 않고 주소만 열면 됩니다.",
    // 스마트스토어 등록 완료 — 2026-08-12 실제 상품 페이지 스크린샷 19장으로 확인.
    //  (wpms/board.md 는 「등록만 남음」으로 낡아 있다. 등록확인 폴더 쪽이 최신이다)
    //  ※ 네이버는 자동 접속을 막아서(429·캡차) 링크 생사는 사람이 눌러 봐야 확인된다.
    status: "판매 중 · ver.26",
    statusTone: "bg-emerald-100 text-emerald-800",
    ctas: [
      {
        label: "스마트스토어에서 보기",
        href: "https://smartstore.naver.com/funt_store/products/13717822182",
        kind: "primary",
        external: true,
      },
      { label: "도입 문의", href: "/contact", kind: "ghost" },
    ],
    bgFrom: "#111827",
    bgTo: "#4c1d95",
    // 태그가 이 중 하나와 정확히 같으면 WPMS 글로 본다.
    //  (WPMS 원고 50편은 tags: ["WPMS","발표","행사운영"] 로 들어온다 — 인계서 기준)
    keywords: ["WPMS", "발표", "행사운영", "발표자노트", "프레젠테이션", "화면공유"],
    brandTerms: ["WPMS", "무선 발표 관리"],
    highlights: [
      {
        icon: "📝",
        title: "발표자 노트를 손 안에",
        desc: "다음에 할 말이 태블릿에 뜹니다. 무대 뒤에서 종이를 넘겨 줄 사람이 없어도 됩니다.",
      },
      {
        icon: "⏱️",
        title: "남은 시간이 보인다",
        desc: "발표자와 운영석이 같은 타이머를 봅니다. 손짓으로 시간을 알리지 않아도 됩니다.",
      },
      {
        // ★「인터넷이 아예 필요 없다」로 읽히면 안 된다 — 설치할 때 정품 인증 1회는 연결이 필요하다.
        //  (상품등록_가이드.md 11번 · 8번 ⑤) 인증을 마친 뒤 행사 운영에는 필요 없다.
        //  이 한 줄을 빼면 사실과 다른 약속이 된다.
        icon: "🔌",
        title: "행사장 인터넷이 없어도",
        desc: "공유기 한 대만 있으면 발표가 돌아갑니다. (설치할 때 정품 인증 1회만 인터넷에 연결하면, 그 뒤 행사 운영에는 필요 없습니다)",
      },
      {
        icon: "📲",
        title: "앱을 깔지 않는다",
        desc: "태블릿은 브라우저에 주소만 넣으면 연결됩니다. 참가자 기기에 설치를 부탁할 일이 없습니다.",
      },
    ],
    metaDesc:
      "WPMS 무선 발표 관리 시스템 — 발표자 노트·타이머·화면공유를 태블릿으로. 공유기 한 대로 도는 윈도우 프로그램(ver.26).",
  },
  {
    slug: "starflow",
    tab: "별의 결",
    name: "별의 결",
    emoji: "🌙",
    kicker: "STARFLOW",
    headline: "오늘 하루, 어떻게 흘러갈까",
    lead: "사주·오늘의 운세·타로·궁합·MBTI·이름풀이를 한곳에서 봅니다. 결과는 이미지 카드로 저장하고 그대로 공유할 수 있습니다.",
    status: "운영 중",
    statusTone: "bg-emerald-100 text-emerald-800",
    ctas: [
      {
        label: "별의 결 보러 가기",
        href: "https://starflow.today",
        kind: "primary",
        external: true,
      },
      { label: "관련 글 보기", href: "#관련글", kind: "ghost" },
    ],
    bgFrom: "#1f1147",
    bgTo: "#7b4fb5",
    keywords: ["별의결", "별의 결", "운세", "타로", "사주", "궁합", "MBTI", "이름풀이"],
    brandTerms: ["별의 결", "별의결", "starflow"],
    highlights: [
      {
        icon: "🔮",
        title: "여섯 가지를 한곳에",
        desc: "사주·오늘의 운세·타로·궁합·MBTI·이름풀이. 앱을 여러 개 깔 필요가 없습니다.",
      },
      {
        icon: "🖼️",
        title: "결과가 카드로 남는다",
        desc: "본 결과를 이미지 카드로 저장합니다. 친구에게 그대로 보낼 수 있습니다.",
      },
      {
        icon: "📱",
        title: "설치가 필요 없다",
        desc: "주소만 열면 바로 봅니다. 폰에서도 그대로 편하게 보입니다.",
      },
    ],
    metaDesc:
      "별의 결 — 사주·오늘의 운세·타로·궁합·MBTI·이름풀이를 한곳에서. 결과는 이미지 카드로 저장·공유.",
  },
];

export const serviceOf = (slug: string): ServiceDef | undefined =>
  services.find((s) => s.slug === slug);

const norm = (s: string) => s.toLowerCase().replace(/\s|·/g, "");

/**
 * 이 글이 그 서비스의 글인가.
 *
 * ★넓게 잡으면 안 된다.
 *   처음엔 열쇠말을 제목·요약 아무 데서나 찾게 했더니, 「발표」 두 글자가
 *   «충남 도의회가 2026년 체육 정책을 **발표하며**…» 라는 스포츠 기사에 걸려서
 *   WPMS 안내 화면에 엉뚱한 기사가 «WPMS 관련 글»로 올라왔다 (2026-08-18 검수에서 잡음).
 *   서비스 안내 화면에 상관없는 글이 붙으면 그 화면 전체를 못 믿게 된다.
 *
 *   그래서 두 가지만 인정한다:
 *     ① 글에 붙은 **태그**가 열쇠말과 정확히 같을 때  (자동 파이프라인이 붙이는 방식)
 *     ② **제목**에 그 서비스의 고유한 이름이 들어 있을 때 (brandTerms — 흔한 낱말은 안 넣는다)
 *   요약 본문은 보지 않는다. 걸릴 것보다 잘못 걸릴 것이 많다.
 */
export function matchesService(
  post: { title?: string; tags?: string[]; summary?: string },
  svc: ServiceDef,
): boolean {
  const tags = (post.tags ?? []).map(norm);
  if (svc.keywords.some((k) => tags.includes(norm(k)))) return true;

  const title = norm(post.title ?? "");
  return svc.brandTerms.some((t) => title.includes(norm(t)));
}
