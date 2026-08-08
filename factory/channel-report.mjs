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

// 인사이트 응답에서 숫자 하나 꺼내기 — 메타가 metric 마다 values / total_value 를 섞어 쓴다
const 값 = (d, name) => {
  const m = (d.data ?? []).find((x) => x.name === name);
  return m?.values?.[0]?.value ?? m?.total_value?.value ?? 0;
};

// 게시물 하나의 성적 — 인사이트는 게시물마다 따로 물어야 한다
//
// ★ 2026-08-08 보강 — 좋아요만으로는 판단이 안 된다 (채널-성장전략.md 3장)
//   · 저장·공유: 꿀팁 콘텐츠는 좋아요보다 '저장'으로 반응한다. 좋아요 0인데 저장 5면 성공한 글이다.
//   · 평균시청시간(릴스): 첫 3초를 고쳤는지 아닌지가 여기 바로 찍힌다. 도달보다 빠른 신호다.
//   metric 을 한 번에 물었다가 하나라도 지원 안 되면 호출 전체가 죽으므로, 실패하면 reach 만 다시 묻는다.
async function 성적(mediaId, 릴스인가) {
  const 기본 = { reach: 0, saved: 0, shares: 0, 시청초: 0 };
  const metric = 릴스인가
    ? "reach,saved,shares,ig_reels_avg_watch_time"
    : "reach,saved,shares";
  try {
    const d = await meta(`/${mediaId}/insights`, { metric });
    return {
      reach: 값(d, "reach"),
      saved: 값(d, "saved"),
      shares: 값(d, "shares"),
      // 메타는 밀리초로 준다 → 초로 바꿔 사람이 읽을 수 있게
      시청초: 릴스인가 ? +(값(d, "ig_reels_avg_watch_time") / 1000).toFixed(1) : 0,
    };
  } catch {
    try {
      const d = await meta(`/${mediaId}/insights`, { metric: "reach" });
      return { ...기본, reach: 값(d, "reach") };
    } catch {
      return 기본; // 너무 오래됐거나 권한이 없으면 0 으로 둔다
    }
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

  for (const m of 게시물) Object.assign(m, await 성적(m.id, m.media_product_type === "REELS"));

  // ---- 형식별 ----
  const 묶음 = {};
  for (const m of 게시물) {
    const k = m.media_product_type === "REELS" ? "릴스" : "카드뉴스";
    (묶음[k] ??= []).push(m);
  }
  const 요약 = (list) => {
    const r = list.reduce((s, m) => s + m.reach, 0);
    const l = list.reduce((s, m) => s + (m.like_count ?? 0), 0);
    const c = list.reduce((s, m) => s + (m.comments_count ?? 0), 0);
    const sv = list.reduce((s, m) => s + (m.saved ?? 0), 0);
    const sh = list.reduce((s, m) => s + (m.shares ?? 0), 0);
    // 평균시청시간은 실제로 값이 온 것만 평균한다 (0인 것까지 넣으면 평균이 가짜로 내려간다)
    const 시청 = list.filter((m) => m.시청초 > 0);
    return {
      개수: list.length,
      도달: r,
      평균도달: list.length ? +(r / list.length).toFixed(1) : 0,
      좋아요: l,
      댓글: c,
      저장: sv,
      공유: sh,
      반응률: r ? +((l / r) * 100).toFixed(2) : 0,
      // ★ 좋아요만 세면 꿀팁 콘텐츠를 과소평가한다 — 이런 글에는 '저장'으로 반응한다.
      //   단 댓글은 넣지 않는다. 도달 0인 카드뉴스에도 댓글이 20개 달려 있다 = 사람이 아니라 스팸이다.
      //   넣으면 참여율이 1.79% 로 부풀어 "잘 되고 있다"는 거짓 신호가 된다(2026-08-08 실측).
      참여율: r ? +(((l + sv + sh) / r) * 100).toFixed(2) : 0,
      평균시청초: 시청.length ? +(시청.reduce((s, m) => s + m.시청초, 0) / 시청.length).toFixed(1) : 0,
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
    console.log(
      `        └ 저장 ${s.저장} · 공유 ${s.공유} · 참여율 ${s.참여율}% (댓글 ${s.댓글}은 스팸으로 보여 제외)` +
        (s.평균시청초 ? ` · 평균시청 ${s.평균시청초}초` : ""),
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
  if (릴.개수 >= 5 && 릴.반응률 < 0.5 && 릴.참여율 > 릴.반응률)
    console.log(
      `  · 다만 저장·공유까지 세면 ${릴.참여율}% 다. 좋아요가 아니라 '저장'으로 반응하는 중이니 좋아요만 보고 접지 말 것.`,
    );
  if (릴.평균시청초 > 0) {
    console.log(
      `  · 릴스 평균시청 ${릴.평균시청초}초 — 첫 3초를 고친 효과는 도달보다 이 숫자에 먼저 나타난다. 매일 비교할 것.`,
    );
    // 우리 릴스는 60~179초로 만든다. 평균시청이 30초에도 못 미치면 만든 것의 대부분을 아무도 안 본다는 뜻이다.
    if (릴.평균시청초 < 30)
      console.log(
        `  · 평균시청이 30초를 못 넘는다. 60~179초짜리를 만들고 있으니 뒤쪽은 사실상 아무도 안 본다. 길이를 줄이는 안을 검토할 것.`,
      );
  }
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
