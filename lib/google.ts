// 구글 애널리틱스(GA4) · 서치콘솔 데이터 읽어오기
//
// 구글 계정에 매번 로그인할 수 없으므로 "서비스 계정"이라는 로봇 계정을 쓴다.
// 로봇 계정의 열쇠(비공개 키)로 신분증(JWT)을 만들어 구글에 내밀면
// 1시간짜리 출입증(access token)을 내준다. 그걸로 데이터를 조회한다.
//
// 필요한 환경변수 (.env.local)
//   GOOGLE_SA_EMAIL        서비스 계정 주소 (…@….iam.gserviceaccount.com)
//   GOOGLE_SA_PRIVATE_KEY  비공개 키 (-----BEGIN PRIVATE KEY----- … )
//   GA4_PROPERTY_ID        애널리틱스 속성 ID (숫자만)
//   GSC_SITE_URL           서치콘솔에 등록한 주소 (https://oddsbag.co.kr/)
//
// 하나라도 없으면 configured=false 를 돌려주고 화면에서는 안내문을 띄운다.
// (설정 전이라고 대시보드 전체가 죽으면 안 된다)

import crypto from "node:crypto";

const SA_EMAIL = process.env.GOOGLE_SA_EMAIL;
const SA_KEY = process.env.GOOGLE_SA_PRIVATE_KEY?.replace(/\\n/g, "\n");
const GA4_PROPERTY = process.env.GA4_PROPERTY_ID;
const GSC_SITE = process.env.GSC_SITE_URL || "https://oddsbag.co.kr/";

const SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
].join(" ");

export function googleConfigured(): boolean {
  return Boolean(SA_EMAIL && SA_KEY);
}
export function ga4Configured(): boolean {
  return googleConfigured() && Boolean(GA4_PROPERTY);
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

let cachedToken: { token: string; expires: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (!SA_EMAIL || !SA_KEY) throw new Error("구글 서비스 계정이 설정되지 않았습니다.");
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: SA_EMAIL,
      scope: SCOPES,
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    }),
  );
  const signature = b64url(
    crypto.sign("RSA-SHA256", Buffer.from(`${header}.${claim}`), SA_KEY),
  );

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claim}.${signature}`,
    }),
    cache: "no-store",
  });

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
    error?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(
      `구글 인증 실패: ${data.error_description ?? data.error ?? res.status}`,
    );
  }
  cachedToken = {
    token: data.access_token,
    expires: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

// ---------- 애널리틱스 (방문자·유입경로) ----------

interface GaRow {
  dimensionValues?: { value: string }[];
  metricValues?: { value: string }[];
}

async function runReport(body: unknown): Promise<GaRow[]> {
  const token = await getAccessToken();
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );
  const data = (await res.json()) as { rows?: GaRow[]; error?: { message: string } };
  if (!res.ok) throw new Error(`애널리틱스 오류: ${data.error?.message ?? res.status}`);
  return data.rows ?? [];
}

const num = (r: GaRow, i = 0) => Number(r.metricValues?.[i]?.value ?? 0);
const dim = (r: GaRow, i = 0) => r.dimensionValues?.[i]?.value ?? "";

// 일자별 방문자 수
export async function gaDaily(days = 28) {
  const rows = await runReport({
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
    orderBys: [{ dimension: { dimensionName: "date" } }],
  });
  return rows.map((r) => ({
    date: dim(r).replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3"),
    users: num(r, 0),
    pageViews: num(r, 1),
  }));
}

// 유입 경로 (구글 검색 / 네이버 / 인스타 / 직접 …)
export async function gaSources(days = 28, limit = 12) {
  const rows = await runReport({
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
    dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
    metrics: [{ name: "sessions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit,
  });
  return rows.map((r) => ({
    source: dim(r, 0),
    medium: dim(r, 1),
    sessions: num(r),
    label: prettySource(dim(r, 0), dim(r, 1)),
  }));
}

// 많이 본 페이지
export async function gaTopPages(days = 28, limit = 30) {
  const rows = await runReport({
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "screenPageViews" }],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit,
  });
  return rows.map((r) => ({ path: dim(r), views: num(r) }));
}

// 구글이 주는 영문 출처 이름을 사장님이 알아볼 수 있게 바꾼다
function prettySource(source: string, medium: string): string {
  const s = source.toLowerCase();
  if (s.includes("google") && medium === "organic") return "구글 검색";
  if (s.includes("naver") && medium === "organic") return "네이버 검색";
  if (s.includes("daum") || s.includes("kakao")) return "다음/카카오";
  if (s.includes("bing")) return "빙 검색";
  if (s.includes("instagram") || s === "l.instagram.com") return "인스타그램";
  if (s.includes("facebook") || s === "l.facebook.com" || s === "m.facebook.com")
    return "페이스북";
  if (s.includes("youtube")) return "유튜브";
  if (s.includes("t.co") || s.includes("twitter") || s.includes("x.com")) return "X(트위터)";
  if (s.includes("threads")) return "스레드";
  if (s === "(direct)") return "직접 방문 (주소 입력·즐겨찾기)";
  if (medium === "email") return "뉴스레터 메일";
  if (medium === "organic") return `${source} 검색`;
  if (medium === "referral") return `${source} 링크`;
  return source || "알 수 없음";
}

// ---------- 서치콘솔 (검색 노출·키워드) ----------

interface GscRow {
  keys?: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

async function gscQuery(body: unknown): Promise<GscRow[]> {
  const token = await getAccessToken();
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
      GSC_SITE,
    )}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );
  const data = (await res.json()) as { rows?: GscRow[]; error?: { message: string } };
  if (!res.ok) throw new Error(`서치콘솔 오류: ${data.error?.message ?? res.status}`);
  return data.rows ?? [];
}

function isoDaysAgo(n: number): string {
  return new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10);
}

// 검색 유입 키워드 순위
export async function gscKeywords(days = 28, limit = 25) {
  const rows = await gscQuery({
    startDate: isoDaysAgo(days),
    endDate: isoDaysAgo(1),
    dimensions: ["query"],
    rowLimit: limit,
  });
  return rows.map((r) => ({
    query: r.keys?.[0] ?? "",
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));
}

// 검색에 뜨는 글 목록 (글별 노출·클릭·평균 순위)
export async function gscPages(days = 28, limit = 200) {
  const rows = await gscQuery({
    startDate: isoDaysAgo(days),
    endDate: isoDaysAgo(1),
    dimensions: ["page"],
    rowLimit: limit,
  });
  return rows.map((r) => ({
    page: r.keys?.[0] ?? "",
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));
}

// 전체 합계 (오늘까지 며칠간 검색으로 몇 명이 들어왔나)
export async function gscTotals(days = 28) {
  const rows = await gscQuery({
    startDate: isoDaysAgo(days),
    endDate: isoDaysAgo(1),
    dimensions: [],
    rowLimit: 1,
  });
  const r = rows[0];
  return {
    clicks: r?.clicks ?? 0,
    impressions: r?.impressions ?? 0,
    ctr: r?.ctr ?? 0,
    position: r?.position ?? 0,
  };
}
