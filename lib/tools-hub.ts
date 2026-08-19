// 오즈백 툴즈 — 웹서비스(도구) 모음의 단일 원본
//
// ★이름을 바꾸려면 여기 TOOLS_HUB_NAME 한 줄만 고치면 화면 전체가 따라온다.
//   («만드는 것들» 홈 카드 · /service 랜딩 · 상단 하위 탭 모두 이 값을 쓴다)
//
// 도구가 늘어나면 아래 hubTools 배열에 한 칸 더 넣는다. /service 랜딩이 자동으로 카드를 그린다.

export const TOOLS_HUB_NAME = "오즈백 툴즈";
export const TOOLS_HUB_TAGLINE =
  "필요할 때 바로 꺼내 쓰는 작은 웹 도구들. 오즈백이 하나씩 만들어 채웁니다.";
export const TOOLS_HUB_EMOJI = "🧰";
export const TOOLS_HUB_HREF = "/service";

export interface HubTool {
  slug: string;
  name: string;
  emoji: string;
  /** 한 줄 소개 */
  desc: string;
  href: string;
  /** 지금 상태 — 사실만 적는다 */
  status: string;
}

export const hubTools: HubTool[] = [
  {
    slug: "html-link",
    name: "HTML 링크 생성기",
    emoji: "🔗",
    desc: "내가 만든 HTML을 올리면 링크가 나옵니다. 그 링크로 열면 효과까지 원본 그대로 재생되고, 원하면 공유링크로 남에게도 보여줄 수 있습니다.",
    href: "/service/html-link",
    status: "쓸 수 있음",
  },
  {
    slug: "ebook",
    name: "이북 제작기",
    emoji: "📚",
    desc: "PDF나 사진 묶음(ZIP도 됩니다)을 올리면 넘겨 보는 전자책으로 만들어 드립니다. 파일로 받거나 링크로 보낼 수 있습니다.",
    href: "/service/ebook",
    status: "새로 나옴",
  },
  {
    slug: "scrap",
    name: "스크랩 정리기",
    emoji: "🗂",
    desc: "모아둔 주소와 사진을 한꺼번에 정리합니다. 주소는 제목을 붙여 엑셀로, 사진은 이름을 바꾸고 묶어서 압축파일로 내려받습니다.",
    href: "/service/scrap",
    status: "새로 나옴",
  },
];
