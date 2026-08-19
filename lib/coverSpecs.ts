// «만드는 것들» 글 썸네일 — 카드뉴스 첫 장 서식
//
// 지시 2026-08-19 «아이콘만 큼직하게 들어간 썸네일은 밋밋하다.
//                  카드뉴스 첫 장처럼 그림 + 글자로, 썸네일 비율에 맞춰 다시»
//
// ★왜 제목을 그대로 안 쓰나
//   썸네일은 4:3 이라 카드뉴스(4:5)보다 세로가 짧다. 긴 제목을 넣으면 3~4줄이 되고
//   글자가 작아져 결국 안 읽힌다. 카드 아래 글자칸에 제목이 또 있으므로,
//   커버에는 «두 줄짜리 후킹 문구»만 넣는다 — 멀리서도 읽히는 크기로.
//
// ★글자 크기는 cqw(칸 너비 비례)로 잡는다.
//   같은 카드가 모바일 2단(≈170px)에도, 데스크톱 4단(≈280px)에도 들어간다.
//   px 로 고정하면 한쪽이 반드시 깨진다.

export type Motif =
  | "browser"
  | "steps"
  | "chat"
  | "grid"
  | "qa"
  | "tiles"
  | "compare"
  | "shield"
  | "phone"
  | "bot"
  | "stars";

export interface CoverSpec {
  /** 두 줄 후킹 문구 — 아래 줄이 강조된다 */
  lines: [string, string];
  /** 왼쪽 위 꼬리표 */
  badge: string;
  motif: Motif;
  /** 바탕 색조 — tools(잉크퍼플) / night(별의 결) */
  tone?: "tools" | "night";
}

export const coverSpecs: Record<string, CoverSpec> = {
  // ── HTML 링크 생성기 게시판 ──
  "oddsbag-tools-html-link-launch": {
    lines: ["HTML 파일을", "링크 하나로"],
    badge: "첫 도구 공개",
    motif: "browser",
  },
  "how-to-make-html-link": {
    lines: ["붙여넣고", "링크 받기"],
    badge: "만드는 법",
    motif: "steps",
  },
  "why-html-file-does-not-open": {
    lines: ["카톡으로 보내면", "왜 안 열릴까"],
    badge: "원인부터",
    motif: "chat",
  },
  "html-link-troubleshooting": {
    lines: ["화면이 깨질 때", "원인 6가지"],
    badge: "해결법",
    motif: "grid",
  },
  "html-link-generator-faq": {
    lines: ["자주 묻는", "10가지"],
    badge: "묻고 답하기",
    motif: "qa",
  },
  "html-link-use-cases": {
    lines: ["이럴 때 씁니다", "실무 7가지"],
    badge: "활용",
    motif: "tiles",
  },
  "html-preview-methods-compared": {
    lines: ["미리보기 방법", "4가지 비교"],
    badge: "비교",
    motif: "compare",
  },
  "html-upload-safety-check": {
    lines: ["안전한지", "보는 법 4가지"],
    badge: "안전",
    motif: "shield",
  },
  "mobile-invitation-html-link": {
    lines: ["청첩장·초대장", "링크로 보내기"],
    badge: "초대장",
    motif: "phone",
  },
  "share-ai-generated-html": {
    lines: ["AI가 만든 HTML", "어떻게 보내나"],
    badge: "AI 결과물",
    motif: "bot",
  },

  // ── 별의 결 게시판 ──
  "starflow-byeorui-gyeol": {
    lines: ["운세를 한 곳에서", "별의 결"],
    badge: "새 서비스",
    motif: "stars",
    tone: "night",
  },
};

export const coverSpecOf = (slug: string): CoverSpec | undefined =>
  coverSpecs[slug];
