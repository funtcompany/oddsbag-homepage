// 문의함 — 홈페이지 '문의' 폼으로 들어온 내용을 모아 두는 곳
//
// 저장 위치(Redis)
//   contact:ids        들어온 순서대로 쌓이는 문의 번호 목록
//   contact:<번호>     문의 한 건 (JSON)
//
// 메일은 따로 보내되(사장님 알림용), 홈페이지 관리자 화면에서도 전부 볼 수 있게 남긴다.
// → 메일이 스팸함에 들어가도 문의를 놓치지 않는다.

import { kvGet, kvSet, rpush, lrange } from "@/lib/store";

export type InquiryKind = "제보" | "정정" | "제휴" | "저작권" | "기타";
export type InquiryStatus = "new" | "done";

export interface Inquiry {
  id: string;
  kind: InquiryKind;
  name: string;
  email: string;
  message: string;
  createdAt: string;
  status: InquiryStatus;
  note?: string; // 처리 메모
}

const IDS = "contact:ids";
const key = (id: string) => `contact:${id}`;

export const inquiryKinds: InquiryKind[] = [
  "제보",
  "정정",
  "제휴",
  "저작권",
  "기타",
];

function newId(): string {
  const t = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const r = Math.random().toString(36).slice(2, 7);
  return `${t}-${r}`;
}

export async function addInquiry(input: {
  kind: string;
  name: string;
  email: string;
  message: string;
}): Promise<Inquiry> {
  const kind = (inquiryKinds as string[]).includes(input.kind)
    ? (input.kind as InquiryKind)
    : "기타";
  const item: Inquiry = {
    id: newId(),
    kind,
    name: input.name.slice(0, 60),
    email: input.email.slice(0, 120),
    message: input.message.slice(0, 4000),
    createdAt: new Date().toISOString(),
    status: "new",
  };
  await kvSet(key(item.id), JSON.stringify(item));
  await rpush(IDS, item.id);
  return item;
}

export async function listInquiries(limit = 200): Promise<Inquiry[]> {
  let ids: string[] = [];
  try {
    ids = await lrange(IDS);
  } catch {
    return [];
  }
  const recent = ids.slice(-limit).reverse(); // 최신순
  const out: Inquiry[] = [];
  for (const id of recent) {
    try {
      const raw = await kvGet(key(id));
      if (raw) out.push(JSON.parse(raw) as Inquiry);
    } catch {
      /* 한 건이 깨져도 나머지는 보여준다 */
    }
  }
  return out;
}

export async function updateInquiry(
  id: string,
  patch: { status?: InquiryStatus; note?: string },
): Promise<boolean> {
  const raw = await kvGet(key(id));
  if (!raw) return false;
  const item = JSON.parse(raw) as Inquiry;
  if (patch.status) item.status = patch.status;
  if (patch.note !== undefined) item.note = String(patch.note).slice(0, 500);
  await kvSet(key(id), JSON.stringify(item));
  return true;
}

/** 사장님께 보내는 알림 메일 본문 */
export function inquiryMailHtml(item: Inquiry): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<div style="font-family:'Apple SD Gothic Neo',sans-serif;background:#f3f4f6;background:linear-gradient(#f3f4f6,#f3f4f6);padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;background:linear-gradient(#ffffff,#ffffff);border-radius:16px;padding:24px">
    <p style="margin:0;font-size:12px;font-weight:800;letter-spacing:2px;color:#5b2d8e">ODDSBAG 문의</p>
    <h1 style="margin:8px 0 16px;font-size:20px;color:#1a1a2e">[${esc(item.kind)}] ${esc(item.name || "이름 없음")}</h1>
    <p style="margin:0 0 4px;font-size:14px;color:#6b7280">답장 주소: ${esc(item.email)}</p>
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280">접수 시각: ${esc(item.createdAt)}</p>
    <div style="white-space:pre-wrap;font-size:15px;line-height:1.7;color:#1a1a2e;border-top:1px solid #f3f4f6;padding-top:16px">${esc(item.message)}</div>
    <a href="https://oddsbag.co.kr/admin" style="display:inline-block;margin-top:20px;background:#1a1a2e;background:linear-gradient(#1a1a2e,#1a1a2e);color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:800;font-size:14px">관리자 문의함 열기</a>
  </div>
</div>`;
}
