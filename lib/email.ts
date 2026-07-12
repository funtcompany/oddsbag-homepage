// 뉴스레터 이메일 발송 (Resend)
// 이메일 클라이언트 호환을 위해 테이블 + 인라인 스타일만 사용.

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

// ---- 디자인 토큰 ----
const CAT_COLOR: Record<string, string> = {
  사회: "#4b5563",
  경제: "#0f766e",
  스포츠: "#2563eb",
  "IT·테크": "#7b4fb5",
  "문화·연예": "#db2777",
  트렌드: "#ea7317",
};
const F = `-apple-system,'Apple SD Gothic Neo','Malgun Gothic',Arial,sans-serif`;

function chip(cat: string): string {
  const c = CAT_COLOR[cat] ?? "#7b4fb5";
  return `<span style="display:inline-block;background:${c};color:#fff;font-size:11px;font-weight:800;letter-spacing:.5px;padding:5px 10px;border-radius:999px">${cat}</span>`;
}

// 사진 없으면 브랜드 컬러 블록
function thumb(p: Post, w: number, h: number): string {
  if (p.cover) {
    return `<img src="${p.cover}" width="${w}" height="${h}" alt="" style="display:block;width:${w}px;height:${h}px;object-fit:cover;border-radius:10px;border:0" />`;
  }
  return `<div style="width:${w}px;height:${h}px;border-radius:10px;background:#5b2d8e;text-align:center;line-height:${h}px;font-size:${Math.round(h / 2.4)}px">${p.emoji ?? "📰"}</div>`;
}

// ---- 공통 레이아웃 ----
function shell(inner: string, preheader: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#efeaf8">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efeaf8;padding:24px 12px">
 <tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;font-family:${F};color:#1a1a2e">
   ${inner}
   <!-- 푸터 -->
   <tr><td style="padding:26px 8px 8px;text-align:center;font-size:12px;color:#8a7fa6;line-height:1.8">
     <div style="font-weight:900;color:#5b2d8e;font-size:14px;letter-spacing:-.3px">ODDSBAG 오즈백</div>
     <div style="margin-top:6px">이상하게 필요한 것들, 오즈백에</div>
     <div style="margin-top:10px">
       <a href="${SITE}" style="color:#7b4fb5;text-decoration:none;font-weight:700">매거진</a>
       &nbsp;·&nbsp;
       <a href="https://instagram.com/oddsbag.official" style="color:#7b4fb5;text-decoration:none;font-weight:700">인스타그램</a>
       &nbsp;·&nbsp;
       <a href="${SITE}/link" style="color:#7b4fb5;text-decoration:none;font-weight:700">전체 채널</a>
     </div>
     <div style="margin-top:12px;color:#a99fc0">이 메일은 오즈백 매거진 구독자에게 발송됩니다.</div>
   </td></tr>
  </table>
 </td></tr>
</table></body></html>`;
}

// ---- 히어로 헤더 ----
function hero(title: string, sub: string, date?: string): string {
  return `<tr><td style="background:#5b2d8e;background-image:linear-gradient(135deg,#6b3aa8 0%,#3a1a63 100%);border-radius:20px 20px 0 0;padding:34px 32px 30px">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:10px">
        <div style="width:30px;height:30px;border-radius:9px;background:#ffe600;color:#3a1a63;font-weight:900;font-size:18px;text-align:center;line-height:30px">O</div>
      </td>
      <td style="font-weight:900;font-size:17px;color:#fff;letter-spacing:-.3px">ODDSBAG <span style="color:#d9c2ff">오즈백 매거진</span></td>
    </tr></table>
    ${date ? `<div style="margin-top:22px;font-size:12px;font-weight:800;letter-spacing:2px;color:#ffe600">${date}</div>` : ""}
    <div style="margin-top:8px;font-size:28px;font-weight:900;color:#fff;letter-spacing:-1px;line-height:1.3">${title}</div>
    <div style="margin-top:10px;font-size:14px;color:#d9c9f2;line-height:1.6">${sub}</div>
  </td></tr>`;
}

// ---- 오늘의 픽 (대표 기사) ----
function featured(p: Post): string {
  const img = p.cover
    ? `<img src="${p.cover}" width="600" height="260" alt="" style="display:block;width:100%;height:260px;object-fit:cover;border:0" />`
    : `<div style="height:150px;background:#3a1a63;text-align:center;line-height:150px;font-size:64px">${p.emoji ?? "📰"}</div>`;
  return `<tr><td style="background:#ffffff;padding:0">
    <a href="${SITE}/magazine/${p.slug}" style="text-decoration:none;color:inherit">
      ${img}
      <div style="padding:24px 28px 28px">
        <div style="font-size:11px;font-weight:900;letter-spacing:2px;color:#c084fc">오늘의 픽</div>
        <div style="margin-top:10px">${chip(p.category)}</div>
        <div style="margin-top:12px;font-size:23px;font-weight:900;color:#1a1a2e;line-height:1.35;letter-spacing:-.6px">${p.title}</div>
        <div style="margin-top:10px;font-size:15px;color:#6d6580;line-height:1.65">${p.summary}</div>
        <div style="margin-top:18px">
          <span style="display:inline-block;background:#ffe600;color:#1a1a2e;font-weight:900;font-size:14px;padding:12px 24px;border-radius:10px">읽어보기 →</span>
        </div>
      </div>
    </a>
  </td></tr>`;
}

// ---- 나머지 기사 (썸네일 + 텍스트) ----
function row(p: Post): string {
  return `<tr><td style="background:#ffffff;padding:0 28px">
    <a href="${SITE}/magazine/${p.slug}" style="text-decoration:none;color:inherit;display:block">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee9f5">
        <tr>
          <td width="104" valign="top" style="padding:18px 14px 18px 0">${thumb(p, 92, 74)}</td>
          <td valign="top" style="padding:18px 0">
            ${chip(p.category)}
            <div style="margin-top:8px;font-size:16px;font-weight:800;color:#1a1a2e;line-height:1.4;letter-spacing:-.3px">${p.title}</div>
            <div style="margin-top:6px;font-size:13.5px;color:#8a7fa6;line-height:1.55">${p.summary.slice(0, 60)}${p.summary.length > 60 ? "…" : ""}</div>
          </td>
        </tr>
      </table>
    </a>
  </td></tr>`;
}

function sectionLabel(text: string): string {
  return `<tr><td style="background:#ffffff;padding:26px 28px 4px;font-size:12px;font-weight:900;letter-spacing:2px;color:#b7abd0">${text}</td></tr>`;
}

function bottomCta(): string {
  return `<tr><td style="background:#ffffff;padding:26px 28px 32px;border-radius:0 0 20px 20px;text-align:center;border-top:1px solid #eee9f5">
    <div style="font-size:15px;font-weight:800;color:#1a1a2e">오늘의 이슈, 더 있어요</div>
    <div style="margin-top:14px">
      <a href="${SITE}" style="display:inline-block;background:#5b2d8e;color:#fff;font-weight:900;font-size:14px;padding:13px 30px;border-radius:11px;text-decoration:none">전체 이슈 보러가기 →</a>
    </div>
  </td></tr>`;
}

// ================= 템플릿 =================
export function newsletterHtml(posts: Post[]): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, ". ");
  const [top, ...rest] = posts.slice(0, 5);
  if (!top) return shell(hero("오늘의 이슈", "곧 새 이슈로 찾아올게요."), "오즈백 매거진");
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
