import { NextResponse } from "next/server";
import { incrWithTtl } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 스크랩 정리기 — 주소의 «제목»을 대신 읽어다 준다.
//
//  브라우저가 직접 남의 사이트를 부를 수 없어서(CORS) 서버가 대신 간다.
//  ★그래서 이 라우트는 «남이 시키는 주소로 우리 서버가 접속하는» 통로다.
//    그대로 두면 우리 서버를 발판 삼아 내부망을 훑을 수 있다(SSRF).
//    아래 세 겹으로 막는다 — ①주소 검사 ②따라가는 이동(redirect)마다 재검사 ③횟수 제한.

const MAX_URLS = 25; // 한 번에
const HOP_MAX = 3; // 주소 이동 따라가기
const BODY_MAX = 96 * 1024; // 앞부분만 읽는다 — <head> 만 있으면 된다
const TIMEOUT = 7000;

// 하루 한도 (사람 기준이 아니라 «브라우저 하나» 기준의 헐거운 제한)
const RATE_MAX = 400;
const RATE_TTL = 60 * 60;

/** 우리 서버가 «가면 안 되는» 곳인가 */
function blocked(u: URL): string | null {
  if (u.protocol !== "http:" && u.protocol !== "https:") return "http(s) 주소만 됩니다.";
  const h = u.hostname.toLowerCase();

  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) {
    return "내부 주소는 읽을 수 없습니다.";
  }
  // IPv6 은 통째로 막는다 — 사설/링크로컬 판정이 까다롭고, 스크랩 대상에 쓸 일이 없다
  if (h.includes(":") || h.startsWith("[")) return "내부 주소는 읽을 수 없습니다.";

  // IPv4 리터럴이면 사설·특수 대역을 막는다
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (m.slice(1).some((x) => Number(x) > 255)) return "주소가 올바르지 않습니다.";
    if (
      a === 10 || a === 127 || a === 0 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) || // 클라우드 메타데이터(169.254.169.254)가 여기 있다
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    ) {
      return "내부 주소는 읽을 수 없습니다.";
    }
  }
  return null;
}

/** <head> 에서 제목·설명·사이트이름을 꺼낸다 (파서를 쓰지 않는다 — head 만 보면 되므로) */
function readHead(html: string) {
  const pick = (re: RegExp) => {
    const m = html.match(re);
    return m ? decodeEntities(m[1].trim().replace(/\s+/g, " ")) : "";
  };
  const meta = (prop: string) =>
    pick(
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`,
        "i",
      ),
    ) ||
    pick(
      new RegExp(
        `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`,
        "i",
      ),
    );

  return {
    title: meta("og:title") || pick(/<title[^>]*>([\s\S]*?)<\/title>/i),
    desc: meta("og:description") || meta("description"),
    site: meta("og:site_name"),
  };
}

function decodeEntities(s: string): string {
  const named: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'",
  };
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, e: string) => {
    const k = e.toLowerCase();
    if (named[k]) return named[k];
    if (k.startsWith("#x")) return String.fromCodePoint(parseInt(k.slice(2), 16) || 32);
    if (k.startsWith("#")) return String.fromCodePoint(parseInt(k.slice(1), 10) || 32);
    return whole;
  });
}

/** 한국 사이트는 아직 EUC-KR 이 많다 — 잘못 풀면 제목이 통째로 깨진다 */
function decodeBody(buf: ArrayBuffer, contentType: string): string {
  const head = new TextDecoder("utf-8").decode(buf.slice(0, 4096));
  const fromHeader = contentType.match(/charset=["']?([\w-]+)/i)?.[1];
  const fromMeta =
    head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ||
    head.match(/content=["'][^"']*charset=([\w-]+)/i)?.[1];
  const cs = (fromHeader || fromMeta || "utf-8").toLowerCase();
  if (/utf-?8/.test(cs)) return new TextDecoder("utf-8").decode(buf);
  try {
    return new TextDecoder(cs).decode(buf);
  } catch {
    return new TextDecoder("utf-8").decode(buf);
  }
}

// ★유튜브·비메오는 «공식 창구(oEmbed)»로 묻는다 (2026-08-20).
//   유튜브 watch 화면은 자바스크립트로 그려져서, <head> 앞 96KB 안에 og:title 이 «없다».
//   실제로 확인했다 — 우리가 읽어 온 98KB 안에 og:title 0건, <title> 0건.
//   그래서 제목 대신 주소만 남았다. oEmbed 는 제목·만든이를 JSON 한 줄로 준다.
//   스크랩에서 유튜브 링크는 가장 흔한 축이라 이 한 겹이 값을 크게 바꾼다.
const OEMBED: [RegExp, (u: string) => string][] = [
  [
    /(^|\.)youtube\.com$|(^|\.)youtu\.be$/,
    (u) => `https://www.youtube.com/oembed?url=${encodeURIComponent(u)}&format=json`,
  ],
  [
    /(^|\.)vimeo\.com$/,
    (u) => `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(u)}`,
  ],
];

async function viaOembed(url: URL, signal: AbortSignal) {
  for (const [re, make] of OEMBED) {
    if (!re.test(url.hostname.toLowerCase())) continue;
    try {
      const res = await fetch(make(url.toString()), { signal, headers: { accept: "application/json" } });
      if (!res.ok) return null; // 비공개·삭제된 영상 → 일반 방식으로 넘어간다
      const j = (await res.json()) as { title?: string; author_name?: string; provider_name?: string };
      if (!j?.title) return null;
      return {
        title: j.title,
        desc: j.author_name ? `${j.author_name} 채널` : "",
        site: j.provider_name || url.hostname,
      };
    } catch {
      return null; // 창구가 막혀 있으면 조용히 일반 방식으로
    }
  }
  return null;
}

async function peekOne(input: string) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { url: input, error: "주소 모양이 아닙니다." };
  }
  const why = blocked(url);
  if (why) return { url: input, error: why };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);

  try {
    // 공식 창구가 있는 곳이면 먼저 거기로 (유튜브·비메오)
    const em = await viaOembed(url, ctrl.signal);
    if (em) return { url: input, ...em };

    let current = url;
    for (let hop = 0; hop <= HOP_MAX; hop++) {
      const res = await fetch(current.toString(), {
        redirect: "manual",
        signal: ctrl.signal,
        headers: {
          // 우리가 누구인지 밝힌다 — 몰래 긁지 않는다
          "user-agent": "Mozilla/5.0 (compatible; OddsbagScrapBot/1.0; +https://oddsbag.co.kr/service/scrap)",
          accept: "text/html,application/xhtml+xml",
          "accept-language": "ko,en;q=0.8",
        },
      });

      // 주소가 옮겨졌으면 «옮겨진 곳»도 다시 검사한다 (여기를 빼면 막은 의미가 없다)
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return { url: input, error: "주소가 옮겨졌는데 갈 곳이 없습니다." };
        const next = new URL(loc, current);
        const why2 = blocked(next);
        if (why2) return { url: input, error: why2 };
        current = next;
        continue;
      }

      if (!res.ok) return { url: input, error: `열리지 않습니다 (${res.status})` };

      const ct = res.headers.get("content-type") || "";
      if (!/text\/html|application\/xhtml/i.test(ct)) {
        // HTML 이 아니면 제목이 없다 — 파일 이름을 제목 삼는다
        const name = decodeURIComponent(current.pathname.split("/").pop() || "");
        return { url: input, title: name || current.hostname, desc: "", site: current.hostname, kind: ct.split(";")[0] };
      }

      // 앞부분만 읽는다 — <head> 를 지나면 더 볼 이유가 없다
      const reader = res.body?.getReader();
      const chunks: Uint8Array[] = [];
      let got = 0;
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done || !value) break;
          chunks.push(value);
          got += value.length;
          if (got >= BODY_MAX) {
            await reader.cancel();
            break;
          }
        }
      }
      const merged = new Uint8Array(got);
      let at = 0;
      for (const c of chunks) {
        merged.set(c.subarray(0, Math.min(c.length, got - at)), at);
        at += c.length;
        if (at >= got) break;
      }

      const html = decodeBody(merged.buffer as ArrayBuffer, ct);
      const head = readHead(html);
      return {
        url: input,
        title: head.title || current.hostname,
        desc: head.desc.slice(0, 200),
        site: head.site || current.hostname,
      };
    }
    return { url: input, error: "주소 이동이 너무 많습니다." };
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    return { url: input, error: /abort/i.test(msg) ? "너무 오래 걸립니다." : "읽지 못했습니다." };
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: Request) {
  let urls: string[] = [];
  try {
    const body = await req.json();
    urls = Array.isArray(body?.urls) ? body.urls.map(String) : [];
  } catch {
    return NextResponse.json({ error: "요청을 읽지 못했습니다." }, { status: 400 });
  }
  if (!urls.length) return NextResponse.json({ items: [] });
  if (urls.length > MAX_URLS) {
    return NextResponse.json(
      { error: `한 번에 ${MAX_URLS}개까지만 읽을 수 있습니다.` },
      { status: 400 },
    );
  }

  // 횟수 제한 — 우리 서버가 남의 심부름꾼으로 무한정 쓰이지 않게
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const used = await incrWithTtl(`scrap:peek:${ip}`, RATE_TTL);
  if (used > RATE_MAX) {
    return NextResponse.json(
      { error: "잠시 뒤에 다시 시도해 주세요. (한 시간 한도를 넘었습니다)" },
      { status: 429 },
    );
  }

  // 한꺼번에 다 부르면 상대 서버에 무례하다 — 5개씩 나눠 간다
  const items: unknown[] = [];
  for (let i = 0; i < urls.length; i += 5) {
    items.push(...(await Promise.all(urls.slice(i, i + 5).map(peekOne))));
  }
  return NextResponse.json({ items });
}
