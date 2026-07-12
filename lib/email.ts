// 뉴스레터 이메일 발송 (Resend)
// 도메인 인증 전엔 onboarding@resend.dev 로 계정주 이메일에만 발송 가능.
// 인증 후 EMAIL_FROM 을 news@oddsbag.co.kr 등으로 바꾸면 전체 발송 가능.

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

// 공통 레이아웃
function wrap(inner: string): string {
  return `<div style="margin:0;padding:0;background:#f4f1fb">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px;font-family:'Apple SD Gothic Neo',-apple-system,'Malgun Gothic',sans-serif;color:#1a1a2e">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:22px">
      <span style="display:inline-block;width:26px;height:26px;border-radius:8px;background:#5b2d8e;color:#fff;text-align:center;line-height:26px;font-weight:900">O</span>
      <span style="font-size:19px;font-weight:900;letter-spacing:-.5px">ODDSBAG <span style="color:#7b4fb5">오즈백</span></span>
    </div>
    ${inner}
    <div style="margin-top:32px;padding-top:18px;border-top:1px solid #e6e0f0;font-size:12px;color:#8a7fa6;line-height:1.7">
      이상하게 필요한 것들, 오즈백에 · <a href="${SITE}" style="color:#7b4fb5;text-decoration:none">oddsbag.co.kr</a><br/>
      이 메일은 오즈백 매거진 구독자에게 발송됩니다.
    </div>
  </div>
</div>`;
}

function postRow(p: Post): string {
  return `<a href="${SITE}/magazine/${p.slug}" style="display:block;text-decoration:none;border:1px solid #eee;border-radius:14px;padding:16px 18px;margin-bottom:12px;background:#fff">
    <div style="font-size:12px;font-weight:800;color:#7b4fb5">${p.category}</div>
    <div style="font-size:16px;font-weight:800;color:#1a1a2e;margin-top:4px;line-height:1.4">${p.title}</div>
    <div style="font-size:14px;color:#6d6580;margin-top:6px;line-height:1.5">${p.summary}</div>
  </a>`;
}

export function welcomeHtml(latest: Post[]): string {
  const list = latest.slice(0, 3).map(postRow).join("");
  return wrap(`
    <div style="background:linear-gradient(135deg,#5b2d8e,#3a1a63);border-radius:18px;padding:28px 24px;color:#fff">
      <div style="font-size:22px;font-weight:900;line-height:1.3">구독해주셔서 감사해요! 🎉</div>
      <div style="font-size:15px;color:#e7dcff;margin-top:8px;line-height:1.6">이제 매일 아침, 오즈백이 정리한 오늘의 핵심 이슈를 이 메일로 받아보실 수 있어요.</div>
    </div>
    <div style="font-size:15px;font-weight:800;margin:26px 0 12px">먼저, 요즘 오즈백 인기 이슈</div>
    ${list}
    <a href="${SITE}" style="display:inline-block;margin-top:8px;background:#ffe600;color:#1a1a2e;font-weight:900;text-decoration:none;padding:12px 22px;border-radius:12px">오즈백 매거진 보러가기 →</a>
  `);
}

export function newsletterHtml(posts: Post[]): string {
  const list = posts.slice(0, 5).map(postRow).join("");
  const today = new Date().toISOString().slice(0, 10);
  return wrap(`
    <div style="font-size:13px;font-weight:800;color:#7b4fb5;letter-spacing:1px">오즈백 매거진 · ${today}</div>
    <div style="font-size:22px;font-weight:900;margin:6px 0 4px">오늘의 이슈, 골라서 📮</div>
    <div style="font-size:14px;color:#6d6580;margin-bottom:20px">한번쯤 알아두면 좋은 이슈만 오즈백 시선으로.</div>
    ${list}
    <a href="${SITE}" style="display:inline-block;margin-top:8px;background:#ffe600;color:#1a1a2e;font-weight:900;text-decoration:none;padding:12px 22px;border-radius:12px">전체 이슈 보기 →</a>
  `);
}
