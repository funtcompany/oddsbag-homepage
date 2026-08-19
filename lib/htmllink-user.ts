// ─────────────────────────────────────────────────────────────
//  방문자 seam (갈아끼우는 부품) — 오즈백 툴즈 «HTML 링크 생성기» 전용
// ─────────────────────────────────────────────────────────────
//
//  ★사장님 결정(2026-08-19, b): 정식 회원가입은 «만들지 않는다».
//     그래서 «누구인가»를 아래 두 갈래로만 판단한다.
//       ① 관리자  — 기존 오즈백 admin 쿠키(oddsbag_admin)가 유효하면 관리자.
//       ② 방문자  — 그 외에는 첫 방문 때 자동 발급되는 «익명 쿠키»(htmllink_user).
//                   로그인 화면은 없다. 쿠키가 없으면 login 라우트 GET 이 즉석 발급한다.
//
//  ★모든 라우트·페이지는 getCurrentUser() «하나»에만 의존한다.
//     진짜 회원 시스템이 언젠가 붙으면 이 함수 «내부»만 갈아끼운다.
//
//  주의 — 익명 쿠키의 성질(사장님께 이미 보고된 파급):
//     · 쿠키를 지우면 그 브라우저의 «내 자료함»에 다시 못 들어간다(복구 불가).
//     · 5개 업로드 상한도 쿠키 단위라, 쿠키를 새로 받으면 초기화되는 «약한» 제한이다.

import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

export const USER_COOKIE = "htmllink_user";
const USER_DAYS = 365; // 익명 쿠키는 오래 유지 — 지우면 자료 접근을 잃으므로

// 관리자의 소유자 id. 관리자가 올린 자료는 이 id 로 격리된다.
export const ADMIN_OWNER_ID = "__admin__";

// 방문자 쿠키 서명 열쇠. 운영에선 ADMIN_PASSWORD 를 쓴다.
//  ★로컬 시험용 폴백 — ADMIN_PASSWORD 가 없어도 격리 시험이 돌아가게 한다.
const SECRET = process.env.ADMIN_PASSWORD || "htmllink-temp-dev-secret";

async function hmac(message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// 토큰 = <방문자id>.<서명>   (방문자id 는 우리가 만든 안전한 문자만 씀 → 인코딩 불필요)
export async function createUserToken(userId: string): Promise<string> {
  return `${userId}.${await hmac(userId)}`;
}

async function verifyUserToken(token?: string | null): Promise<{ userId: string } | null> {
  if (!token) return null;
  const idx = token.lastIndexOf(".");
  if (idx <= 0) return null;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  if (!payload || !sig) return null;
  if (!/^v-[a-f0-9]{24,}$/.test(payload)) return null; // 우리가 발급한 형식만
  if (!safeEqual(sig, await hmac(payload))) return null;
  return { userId: payload };
}

// 새 익명 방문자 id — 첫 방문 때 login 라우트가 이걸로 쿠키를 심는다.
export function newVisitorId(): string {
  return "v-" + crypto.randomUUID().replace(/-/g, "");
}

export interface CurrentUser {
  userId: string;
  isAdmin: boolean;
}

// ★이 함수 하나가 seam 이다. 회원 시스템이 붙으면 이 안만 바꾼다.
//   관리자 먼저 확인하고, 아니면 방문자 쿠키를 읽는다.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  if (await verifySessionToken(jar.get(SESSION_COOKIE)?.value)) {
    return { userId: ADMIN_OWNER_ID, isAdmin: true };
  }
  const v = await verifyUserToken(jar.get(USER_COOKIE)?.value);
  return v ? { userId: v.userId, isAdmin: false } : null;
}

export const userCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: USER_DAYS * 86400,
};
