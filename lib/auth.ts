// 관리자 로그인 (쿠키 세션)
//
// 예전 방식: 비밀번호를 주소창(?password=…)과 요청 본문에 매번 실어 보냈다.
//   → 브라우저 기록·서버 접속 로그·프록시에 비밀번호가 그대로 남는다.
// 지금 방식: 한 번 로그인하면 서명된 토큰을 httpOnly 쿠키로 심는다.
//   → 자바스크립트로 못 읽고, 주소창에도 안 남는다.
//
// 토큰 구조:  <만료시각(ms)>.<서명>
//   서명 = HMAC-SHA256(만료시각, ADMIN_PASSWORD)
//   비밀번호 자체는 토큰에 들어가지 않는다.

const ADMIN = process.env.ADMIN_PASSWORD;

export const SESSION_COOKIE = "oddsbag_admin";
const SESSION_DAYS = 14;

// Edge 런타임에서도 도는 Web Crypto 사용 (middleware에서 씀)
async function hmac(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// 길이가 달라도 같은 시간이 걸리도록 비교 (타이밍 공격 차단)
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isAuthConfigured(): boolean {
  return Boolean(ADMIN);
}

export async function createSessionToken(): Promise<string> {
  if (!ADMIN) throw new Error("ADMIN_PASSWORD 미설정");
  const exp = String(Date.now() + SESSION_DAYS * 86400_000);
  return `${exp}.${await hmac(exp, ADMIN)}`;
}

export async function verifySessionToken(token?: string | null): Promise<boolean> {
  if (!ADMIN || !token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig) return false;
  if (!Number(exp) || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(exp, ADMIN));
}

export function checkPassword(input: unknown): boolean {
  if (!ADMIN || typeof input !== "string") return false;
  return safeEqual(input, ADMIN);
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_DAYS * 86400,
};

// 라우트 핸들러용 인증 확인.
//   1) 쿠키 세션 (관리자 화면에서 오는 정상 경로)
//   2) x-admin-password 헤더 (터미널에서 curl로 부를 때 — 주소창에 안 남는다)
export async function isAdminRequest(req: Request): Promise<boolean> {
  const header = req.headers.get("x-admin-password");
  if (header && checkPassword(header)) return true;

  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return verifySessionToken(match?.[1]);
}
