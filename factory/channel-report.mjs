// 채널 성적표 — 인스타·페북이 실제로 몇 명에게 닿았는지 매일 기록한다.
//
// 왜 만들었나 (2026-08-08)
//   게시물 47개를 올리는 동안 아무도 이 숫자를 본 적이 없었다. 그래서 카드뉴스가
//   29개 연속 도달 0이라는 걸 3주 동안 몰랐다. 무엇이 먹히는지 모르면 자동화는
//   열심히 헛일을 한다. 이제 매일 재서 남긴다.
//
// 하는 일
//   · 형식별(릴스/카드뉴스) 도달·반응을 모아 성적표를 찍는다
//   · 최근 7일과 그 앞 7일을 비교해 나아졌는지 나빠졌는지 보여준다
//   · 결과를 Redis 에 날짜별로 쌓아 둔다 (2일 점검 리포트가 가져다 쓴다)
//
// 쓰는 법
//   node channel-report.mjs            성적표 출력 + 기록
//   node channel-report.mjs --출력만    기록하지 않고 보기만

import { kvSet } from "./redis.mjs";

const TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const IG = process.env.INSTAGRAM_ACCOUNT_ID;
const PAGE = process.env.FACEBOOK_PAGE_ID;
const G = "https://graph.facebook.com/v21.0";
const 기록안함 = process.argv.includes("--출력만");

async function meta(path, params = {}) {
  const q = new URLSearchParams({ ...params, access_token: TOKEN });
  const res = await fetch(`${G}${path}?${q}`, { cache: "no-store" });
  const d = await res.json();
  if (d.error) throw new Error(`Meta: ${d.error.message}`);
  return d;
}

// 게시물 하나의 성적 — 인사이트는 게시물마다 따로 물어야 한다
async function 성적(mediaId) {
  try {
    const d = await meta(`/${mediaId}/insights`, { metric: "reach" });
    return { reach: d.data?.[0]?.values?.[0]?.value ?? 0 };
  } catch {
    return { reach: 0 }; // 너무 오래됐거나 권한이 없으면 0 으로 둔다
  }
}

const 일수 = (iso) => (Date.now() - new Date(iso).getTime()) / 864e5;

async function main() {
  if (!TOKEN || !IG) {
    console.log("인스타 자격증명이 없어 성적표를 건너뜁니다.");
    return;
  }

  const prof = await meta(`/${IG}`, {
    fields: "username,followers_count,media_count",
  });

  // 게시물 전부 (많아야 수백 개라 한 번에 훑는다)
  const 게시물 = [];
  let after;
  do {
    const q = await meta(`/${IG}/media`, {
      fields: "id,timestamp,media_product_type,like_count,comments_count",
      limit: "50",
      ...(after ? { after } : {}),
    });
    게시물.push(...(q.data ?? []));
    after = q.paging?.cursors?.after && q.paging?.next ? q.paging.cursors.after : null;
  } while (after && 게시물.length < 300);

  for (const m of 게시물) Object.assign(m, await 성적(m.id));

  // ---- 형식별 ----
  const 묶음 = {};
  for (const m of 게시물) {
    const k = m.media_product_type === "REELS" ? "릴스" : "카드뉴스";
    (묶음[k] ??= []).push(m);
  }
  const 요약 = (list) => {
    const r = list.reduce((s, m) => s + m.reach, 0);
    const l = list.reduce((s, m) => s + (m.like_count ?? 0), 0);
    return {
      개수: list.length,
      도달: r,
      평균도달: list.length ? +(r / list.length).toFixed(1) : 0,
      좋아요: l,
      반응률: r ? +((l / r) * 100).toFixed(2) : 0,
    };
  };

  console.log(`\n📊 오즈백 채널 성적표 — @${prof.username}`);
  console.log(`팔로워 ${prof.followers_count}명 · 게시물 ${prof.media_count}개\n`);
  console.log("형식별 (계정 전체)");
  for (const [k, v] of Object.entries(묶음)) {
    const s = 요약(v);
    console.log(
      `  ${k.padEnd(5)} ${String(s.개수).padStart(3)}개 · 도달 ${String(s.도달).padStart(5)} · 평균 ${String(s.평균도달).padStart(6)} · 좋아요 ${s.좋아요} · 반응률 ${s.반응률}%`,
    );
  }

  // ---- 최근 7일 vs 그 앞 7일 ----
  const 최근 = 게시물.filter((m) => 일수(m.timestamp) <= 7);
  const 이전 = 게시물.filter((m) => 일수(m.timestamp) > 7 && 일수(m.timestamp) <= 14);
  console.log("\n최근 7일 vs 그 앞 7일");
  const a = 요약(최근), b = 요약(이전);
  const 화살표 = (x, y) => (x > y ? "▲" : x < y ? "▼" : "―");
  console.log(`  게시물   ${a.개수} ← ${b.개수}`);
  console.log(`  도달합계 ${a.도달} ← ${b.도달}  ${화살표(a.도달, b.도달)}`);
  console.log(`  평균도달 ${a.평균도달} ← ${b.평균도달}  ${화살표(a.평균도달, b.평균도달)}`);
  console.log(`  좋아요   ${a.좋아요} ← ${b.좋아요}  ${화살표(a.좋아요, b.좋아요)}`);

  // ---- 페이스북 ----
  let 페북 = null;
  if (PAGE) {
    try {
      const p = await meta(`/${PAGE}`, { fields: "name,fan_count" });
      페북 = { 이름: p.name, 팔로워: p.fan_count ?? 0 };
      console.log(`\n페이스북 ${p.name} · 팔로워 ${p.fan_count ?? 0}명`);
    } catch (e) {
      console.log(`\n페이스북 조회 실패: ${e.message}`);
    }
  }

  // ---- 사람이 읽을 한 줄 ----
  const 릴 = 요약(묶음["릴스"] ?? []), 카 = 요약(묶음["카드뉴스"] ?? []);
  console.log("\n한 줄 판단");
  if (카.개수 >= 5 && 카.도달 === 0)
    console.log("  · 카드뉴스는 도달이 0이다. 릴스로 더 옮길 것.");
  if (릴.개수 >= 5 && 릴.반응률 < 0.5)
    console.log(
      `  · 릴스는 닿기는 하는데(평균 ${릴.평균도달}) 반응률 ${릴.반응률}% — 본 사람이 아무 반응을 안 한다. 도달을 늘리기 전에 내용·첫 3초를 손볼 것.`,
    );
  if (prof.followers_count === 0)
    console.log("  · 팔로워가 아직 0명이다. 도달이 늘어도 팔로우로 이어지지 않으면 계정이 안 큰다.");

  if (!기록안함) {
    const 오늘 = new Date().toISOString().slice(0, 10);
    await kvSet(
      `channel:report:${오늘}`,
      JSON.stringify({
        날짜: 오늘,
        팔로워: prof.followers_count,
        게시물: prof.media_count,
        형식별: Object.fromEntries(Object.entries(묶음).map(([k, v]) => [k, 요약(v)])),
        최근7일: a,
        앞7일: b,
        페북,
      }),
    );
    console.log(`\n기록 완료 — channel:report:${오늘}`);
  }
}

main().catch((e) => {
  // 성적표가 실패해도 릴스 만들기를 막지 않는다
  console.error("성적표 실패:", e.message);
});
