import { NextRequest, NextResponse } from "next/server";
import { hincr, hgetall, incrWithTtl } from "@/lib/store";

// 지금 화면에 뜨는 4개 + 옛 이름 4개.
//  옛 이름을 빼면 이미 저장된 값이 400 으로 튕기고, 남아 있는 옛 화면(캐시)에서 눌린 것도 버려진다.
//  받아주기만 하고 새로 보여주지는 않는다 — components/ReactionBar.tsx 참고.
const VALID = new Set([
  "helped",
  "didnt_know",
  "save_later",
  "need_more",
  "like",
  "wow",
  "sad",
  "angry",
]);
const key = (slug: string) => `reactions:${slug}`;

// ---- 접속제한(같은 사람이 무한히 못 누르게) ----
//
// 화면(components/ReactionBar.tsx)은 localStorage 로 1인 1회를 막지만,
// 그건 브라우저 안에서만 참이다. curl 한 줄이면 숫자를 무한히 올릴 수 있었다.
// 그래서 서버에서도 같은 제한을 건다. 방식은 app/api/contact/route.ts 와 동일하게
// incrWithTtl(lib/store.ts) 한 줄로 세고, 넘으면 더 올리지 않는다.
//
// 한도를 1 이 아니라 3 으로 둔 이유:
//  국내 모바일은 통신사 NAT 라 수천 명이 같은 공인 IP 로 나온다. 1 로 잠그면
//  「남이 눌렀다는 이유로 내가 못 누르는」 정상 이용자가 생긴다. 무한 증가만 막으면 되므로 여유를 둔다.
const PER_SLUG_LIMIT = 3; // 한 IP가 한 글에 하루 최대 몇 번
const PER_SLUG_TTL = 86400; // 24시간
// 글을 바꿔 가며 긁는 스크립트용 — 글 단위 한도만으로는 못 막는다.
const HOURLY_LIMIT = 40; // 한 IP가 한 시간에 누를 수 있는 총 횟수
const HOURLY_TTL = 3600;

// 접속자 IP.
//  x-vercel-forwarded-for 는 프록시가 직접 넣는 값이라 위조가 안 된다. 이걸 먼저 본다.
//  (x-forwarded-for 는 이용자가 헤더로 흉내낼 여지가 있어 마지막 순번)
function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

// ★IP 를 키에 그대로 넣지 않는다.
//  Upstash 콘솔·모니터링·느린쿼리 로그에 방문자 IP 가 평문으로 남기 때문이다.
//  소금(salt)을 섞어 해시하고 앞 16자만 쓴다 — 같은 사람인지 구분만 되면 충분하고,
//  값만 보고 원래 IP 로 되돌릴 수는 없다. (Web Crypto 라 node/edge 어디서든 돈다)
const IP_SALT = process.env.REACTION_IP_SALT || "oddsbag-reactions-v1";
async function ipTag(ip: string): Promise<string> {
  const buf = new TextEncoder().encode(`${IP_SALT}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug 필요" }, { status: 400 });
  // ★레디스가 한도·장애로 안 되면 500 이 아니라 «아직 0개»로 답한다.
  //   여기서 500 을 내면 글 화면의 반응 막대가 오류로 깨진다 — 본문은 멀쩡한데도.
  let counts: Record<string, number> = {};
  try {
    counts = await hgetall(key(slug));
  } catch (e) {
    console.warn("반응 읽기 실패, 0으로 표시:", (e as Error).message);
  }
  // ★엣지 캐싱 30초 → 5분.
  //   글이 100편 뜨는 날 30초 캐시면 반응 조회만 하루 57만 명령이다 — 한도를 이것 하나로 넘긴다.
  //   반응 숫자는 30초 만에 안 바뀌어도 아무도 모르고, 내가 누른 값은 POST 응답으로 즉시 보인다.
  return NextResponse.json(
    { counts },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}

export async function POST(req: NextRequest) {
  try {
    const { slug, reaction } = await req.json();
    if (typeof slug !== "string" || !VALID.has(reaction)) {
      return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
    }
    // 아무 문자열이나 slug 로 보내면 저장소에 쓰레기 키가 무한히 쌓인다. 길이만 막아둔다.
    const s = slug.trim();
    if (!s || s.length > 120) {
      return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
    }

    const tag = await ipTag(clientIp(req));
    const hourly = await incrWithTtl(`reactions:rate:${tag}`, HOURLY_TTL);
    const perSlug = await incrWithTtl(
      `reactions:rate:${tag}:${s}`,
      PER_SLUG_TTL,
    );

    // 한도를 넘으면 숫자를 올리지 않고 「지금 숫자」만 돌려준다.
    //  오류(429)를 던지지 않는 이유 — ① 화면이 깨지는 것보다 낫고
    //  ② 공격자에게 「여기서 막혔다」를 알려줄 이유가 없다. 겉보기엔 성공과 똑같다.
    if (hourly > HOURLY_LIMIT || perSlug > PER_SLUG_LIMIT) {
      const counts = await hgetall(key(s));
      return NextResponse.json({ ok: true, counts });
    }

    await hincr(key(s), reaction, 1);
    const counts = await hgetall(key(s));
    return NextResponse.json({ ok: true, counts });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
