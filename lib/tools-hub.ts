// 오즈백 툴즈 — 웹서비스(도구) 모음의 단일 원본
//
// ★이름을 바꾸려면 여기 TOOLS_HUB_NAME 한 줄만 고치면 화면 전체가 따라온다.
//   («만드는 것들» 홈 카드 · /service 랜딩 · 상단 하위 탭 모두 이 값을 쓴다)
//
// 도구가 늘어나면 아래 hubTools 배열에 한 칸 더 넣는다. /service 랜딩이 자동으로 카드를 그린다.
//
// ★여기에 넣는 것은 «내가 넣은 것으로 결과물이 나오는» 도구뿐이다(파일이든 글이든).
//   오즈백이 모아 둔 것을 보여 주는 서비스(「챙길 것」 /check)는 성격이 달라 여기 없다.
//   섞으면 이 허브가 무엇을 모아 둔 곳인지 흐려진다. (사장님 결정 2026-08-26)
//
// ★도구를 하나 늘릴 때 손대는 곳은 세 군데다. 하나만 하면 «조용히» 반쪽이 된다.
//   ① 여기 hubTools 에 한 칸        → 허브 카드·사이트맵이 저절로 따라온다
//   ② app/service/<slug>/           → 화면 (page.tsx + Client.tsx)
//   ③ lib/boards.ts 에 게시판 한 칸 → 그 도구 글이 도구 밑에 붙는다 (안 하면 글이 엉뚱한 데 간다)
//   ③을 빠뜨려 새 글 8편이 통째로 다른 도구 밑으로 간 적이 있다 → scripts/시험/게시판-시험.mjs 가 잡는다

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
    slug: "image",
    name: "사진 줄이기",
    emoji: "🖼",
    desc: "「파일이 너무 큽니다」로 막혔을 때. 사진을 여러 장 한꺼번에 가볍게 만들고 형식도 바꿔 드립니다. 압축파일 하나로 받으실 수 있습니다.",
    href: "/service/image",
    status: "새로 나옴",
  },
  {
    slug: "idphoto",
    name: "증명사진 만들기",
    emoji: "🪪",
    desc: "갖고 계신 사진을 여권·운전면허 규격 크기로 잘라 드립니다. 인화지 한 장에 여러 장 앉힌 것도 같이 나와서 사진관에 그대로 맡기시면 됩니다.",
    href: "/service/idphoto",
    status: "새로 나옴",
  },
  {
    slug: "count",
    name: "글자수 세기",
    emoji: "🔢",
    desc: "자기소개서처럼 「몇 자 이내」가 정해진 글을 쓸 때. 공백 포함·공백 제외·바이트를 한 화면에 보여 드리고, 한도까지 몇 자 남았는지 셉니다.",
    href: "/service/count",
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
