// 뉴스레터 이메일 발송 (Resend)
// ⚠️ 다크 디자인으로 제작: 지메일 등이 다크모드에서 색을 뒤집지 않게 하려면
//    애초에 어두운 배경이어야 한다. 라이트모드에서도 고급스러운 다크 매거진으로 보인다.

import type { Post } from "@/lib/posts";

const KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || "ODDSBAG 오즈백 <onboarding@resend.dev>";
const SITE = "https://oddsbag.co.kr";

export const emailEnabled = Boolean(KEY);

export async function sendEmail(to: string, subject: string, html: string) {
  if (!KEY) throw new Error("RESEND_API_KEY 미설정");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Resend ${res.status}`);
  return data;
}

// ---- 다크 팔레트 ----
const BG = "#1c1530"; // 페이지 배경 (카드와 동일 → 액자 테두리 없음)
const CARD = "#1c1530"; // 카드
const LINE = "#2c2445"; // 구분선
const INK = "#f3eefc"; // 본문 텍스트
const SUB = "#b3a6cf"; // 보조 텍스트
const MUT = "#8577a8"; // 흐린 텍스트
const YELLOW = "#ffe600";
const PURPLE = "#7b4fb5";

const CAT_COLOR: Record<string, string> = {
  사회: "#5c6b80",
  경제: "#0f8f70",
  스포츠: "#2f6fd0",
  "IT·테크": "#7b4fb5",
  "문화·연예": "#c04a80",
  트렌드: "#c9702a",
};

// 지메일 다크모드는 background-color를 지우지만 background-image(그라디언트)는 유지한다.
// 모든 배경에 단색 그라디언트를 함께 넣어 색이 사라지지 않게 한다 ("방탄 배경").
const bg = (c: string) => `background-color:${c};background-image:linear-gradient(${c},${c});`;

const F = `-apple-system,'Apple SD Gothic Neo','Malgun Gothic',Arial,sans-serif`;

function chip(cat: string): string {
  const c = CAT_COLOR[cat] ?? PURPLE;
  return `<span style="display:inline-block;${bg(c)}color:#ffffff;font-size:11px;font-weight:800;letter-spacing:.5px;padding:5px 11px;border-radius:999px">${cat}</span>`;
}

function thumb(p: Post, w: number, h: number): string {
  if (p.cover) {
    return `<img src="${p.cover}" width="${w}" height="${h}" alt="" style="display:block;width:${w}px;height:${h}px;object-fit:cover;border-radius:10px;border:0" />`;
  }
  return `<div style="width:${w}px;height:${h}px;border-radius:10px;${bg("#2f2148")}text-align:center;line-height:${h}px;font-size:${Math.round(h / 2.4)}px">${p.emoji ?? "📰"}</div>`;
}

function shell(inner: string, preheader: string): string {
  return `<!doctype html><html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
</head>
<body style="margin:0;padding:0;${bg(BG)}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${BG}" style="${bg(BG)}padding:0">
 <tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;font-family:${F};color:${INK}">
   ${inner}
   <tr><td style="padding:28px 8px 10px;text-align:center;font-size:12px;color:${MUT};line-height:1.9">
     <div style="font-weight:900;color:${INK};font-size:15px;letter-spacing:-.3px">ODDSBAG <span style="color:${YELLOW}">오즈백</span></div>
     <div style="margin-top:6px">이상하게 필요한 것들, 오즈백에</div>
     <div style="margin-top:12px">
       <a href="${SITE}" style="color:${SUB};text-decoration:none;font-weight:700">매거진</a>
       &nbsp;·&nbsp;
       <a href="https://instagram.com/oddsbag_official" style="color:${SUB};text-decoration:none;font-weight:700">인스타그램</a>
       &nbsp;·&nbsp;
       <a href="${SITE}/link" style="color:${SUB};text-decoration:none;font-weight:700">전체 채널</a>
     </div>
     <div style="margin-top:14px;color:#6b5f88">이 메일은 오즈백 매거진 구독자에게 발송됩니다.</div>
   </td></tr>
  </table>
 </td></tr>
</table></body></html>`;
}

function hero(title: string, sub: string, date?: string): string {
  return `<tr><td bgcolor="#3a1a63" style="background:#3a1a63;background-image:linear-gradient(135deg,#6b3aa8 0%,#33165c 100%);padding:38px 30px 34px">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:10px">
        <div style="width:30px;height:30px;border-radius:9px;${bg(PURPLE)}color:#ffffff;font-weight:900;font-size:17px;text-align:center;line-height:30px">O</div>
      </td>
      <td style="font-weight:900;font-size:17px;color:#ffffff;letter-spacing:-.3px">ODDSBAG <span style="color:#d9c2ff">오즈백 매거진</span></td>
    </tr></table>
    ${date ? `<div style="margin-top:24px;font-size:12px;font-weight:800;letter-spacing:2px;color:${YELLOW}">${date}</div>` : ""}
    <div style="margin-top:8px;font-size:29px;font-weight:900;color:#ffffff;letter-spacing:-1px;line-height:1.3">${title}</div>
    <div style="margin-top:11px;font-size:14.5px;color:#d5c6f0;line-height:1.65">${sub}</div>
  </td></tr>`;
}

function featured(p: Post): string {
  const img = p.cover
    ? `<img src="${p.cover}" width="600" height="250" alt="" style="display:block;width:100%;height:250px;object-fit:cover;border:0" />`
    : `<div style="height:140px;${bg("#2f2148")}text-align:center;line-height:140px;font-size:60px">${p.emoji ?? "📰"}</div>`;
  return `<tr><td bgcolor="${CARD}" style="${bg(CARD)}padding:0">
    <a href="${SITE}/magazine/${p.slug}" style="text-decoration:none;color:inherit">
      ${img}
      <div style="padding:26px 28px 30px">
        <div style="font-size:11px;font-weight:900;letter-spacing:2px;color:${YELLOW}">오늘의 픽</div>
        <div style="margin-top:12px">${chip(p.category)}</div>
        <div style="margin-top:13px;font-size:24px;font-weight:900;color:${INK};line-height:1.35;letter-spacing:-.6px">${p.title}</div>
        <div style="margin-top:11px;font-size:15px;color:${SUB};line-height:1.7">${p.summary}</div>
        <div style="margin-top:20px">
          <span style="display:inline-block;${bg(PURPLE)}color:#ffffff;font-weight:900;font-size:15px;padding:14px 30px;border-radius:11px">읽어보기 →</span>
        </div>
      </div>
    </a>
  </td></tr>`;
}

function row(p: Post): string {
  return `<tr><td bgcolor="${CARD}" style="${bg(CARD)}padding:0 28px">
    <a href="${SITE}/magazine/${p.slug}" style="text-decoration:none;color:inherit;display:block">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${LINE}">
        <tr>
          <td width="106" valign="top" style="padding:19px 14px 19px 0">${thumb(p, 92, 74)}</td>
          <td valign="top" style="padding:19px 0">
            ${chip(p.category)}
            <div style="margin-top:9px;font-size:16px;font-weight:800;color:${INK};line-height:1.45;letter-spacing:-.3px">${p.title}</div>
            <div style="margin-top:6px;font-size:13.5px;color:${MUT};line-height:1.6">${p.summary.slice(0, 58)}${p.summary.length > 58 ? "…" : ""}</div>
          </td>
        </tr>
      </table>
    </a>
  </td></tr>`;
}

function sectionLabel(text: string): string {
  return `<tr><td bgcolor="${CARD}" style="${bg(CARD)}padding:26px 28px 2px;font-size:12px;font-weight:900;letter-spacing:2px;color:${MUT}">${text}</td></tr>`;
}

function bottomCta(): string {
  return `<tr><td bgcolor="${CARD}" style="${bg(CARD)}padding:28px 28px 36px;text-align:center;border-top:1px solid ${LINE}">
    <div style="font-size:15.5px;font-weight:800;color:${INK}">오늘의 이슈, 더 있어요</div>
    <div style="margin-top:16px">
      <a href="${SITE}" style="display:inline-block;${bg(PURPLE)}color:#ffffff;font-weight:900;font-size:14px;padding:14px 32px;border-radius:11px;text-decoration:none">전체 이슈 보러가기 →</a>
    </div>
  </td></tr>`;
}

// ================= 템플릿 =================
export function newsletterHtml(posts: Post[]): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, ". ");
  const [top, ...rest] = posts.slice(0, 5);
  if (!top)
    return shell(hero("오늘의 이슈", "곧 새 이슈로 찾아올게요."), "오즈백 매거진");
  return shell(
    hero("오늘의 이슈, 골라서 📮", "한번쯤 알아두면 좋은 것만 오즈백 시선으로.", today) +
      featured(top) +
      (rest.length ? sectionLabel("그 외 오늘의 이슈") : "") +
      rest.map(row).join("") +
      bottomCta(),
    `${top.title} 외 ${rest.length}건`,
  );
}

export function welcomeHtml(latest: Post[]): string {
  const [top, ...rest] = latest.slice(0, 4);
  return shell(
    hero(
      "구독해주셔서 감사해요 🎉",
      "이제 매일 아침, 오즈백이 정리한 오늘의 핵심 이슈를 이 메일로 받아보실 수 있어요.",
    ) +
      (top ? featured(top) : "") +
      (rest.length ? sectionLabel("요즘 인기 이슈") : "") +
      rest.map(row).join("") +
      bottomCta(),
    "오즈백 매거진 구독을 환영합니다",
  );
}
