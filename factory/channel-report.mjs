// 채널 성적표 — 유튜브·인스타·페북이 실제로 몇 명에게 닿았는지 매일 기록한다.
//
// 왜 만들었나 (2026-08-08)
//   게시물 47개를 올리는 동안 아무도 이 숫자를 본 적이 없었다. 그래서 카드뉴스가
//   29개 연속 도달 0이라는 걸 3주 동안 몰랐다. 무엇이 먹히는지 모르면 자동화는
//   열심히 헛일을 한다. 이제 매일 재서 남긴다.
//
// ★ 2026-08-08 저녁 보강 — 정작 살아있는 채널을 안 재고 있었다
//   이 성적표는 인스타(팔로워 0)와 페북(팔로워 0)만 쟀다. 그런데 실제로 사람이 보는 곳은
//   유튜브다 — 영상 36개, 편당 300~524회. 죽은 채널 둘을 매일 재고 산 채널 하나를 안 봤다.
//   판단 근거가 될 유일한 숫자가 성적표에 없었다는 뜻이다. 그래서 유튜브를 넣는다.
//   같은 이유로 채널마다 따로 세운다 — 인스타 토큰이 만료돼도 유튜브 숫자는 계속 나와야 한다.
//   (전에는 인스타 자격증명이 없으면 성적표 전체가 그 자리에서 끝났다)
//
// 하는 일
//   · 유튜브: 구독자·총조회수, 어제 대비 늘어난 조회수, 상위 영상
//   · 인스타: 형식별(릴스/카드뉴스) 도달·반응 + 프로필방문·팔로우(2026-08-10 추가)
//   · 검색: 서치콘솔 클릭·노출·평균순위와 상위 검색어 (2026-08-11 추가 — 광고비 0원의 유일한 길)
//   · 최근 7일과 그 앞 7일을 비교해 나아졌는지 나빠졌는지 보여준다
//   · 결과를 Redis 에 날짜별로 쌓아 둔다 (2일 점검 리포트가 가져다 쓴다)
//
// 쓰는 법
//   node channel-report.mjs            성적표 출력 + 기록
//   node channel-report.mjs --출력만    기록하지 않고 보기만

import { kvSet, getJSON } from "./redis.mjs";

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
// 값()은 항목이 아예 없어도 0 을 준다 — "진짜 0" 과 "못 잰 것" 이 똑같이 보인다.
// 프로필방문처럼 0 인지 아닌지가 판단의 전부인 숫자는 이걸로 구분해야 한다.
const 왔나 = (d, name) => (d.data ?? []).some((x) => x.name === name);

// 게시물 하나의 성적 — 인사이트는 게시물마다 따로 물어야 한다
//
// ★ 2026-08-08 보강 — 좋아요만으로는 판단이 안 된다 (채널-성장전략.md 3장)
//   · 저장·공유: 꿀팁 콘텐츠는 좋아요보다 '저장'으로 반응한다. 좋아요 0인데 저장 5면 성공한 글이다.
//   · 평균시청시간(릴스): 첫 3초를 고쳤는지 아닌지가 여기 바로 찍힌다. 도달보다 빠른 신호다.
//   metric 을 한 번에 물었다가 하나라도 지원 안 되면 호출 전체가 죽으므로, 실패하면 reach 만 다시 묻는다.
async function 성적(mediaId, 릴스인가) {
  const 기본 = { reach: 0, saved: 0, shares: 0, 시청초: 0, 프로필방문: 0, 팔로우: 0, 프로필잼: false };
  const 시청 = 릴스인가 ? ",ig_reels_avg_watch_time" : "";
  // 넓은 것부터 좁은 것까지 차례로 시도한다.
  // 한 항목이라도 거부당하면 호출 전체가 죽으므로, 프로필방문이 안 되는 게시물에서도
  // 저장·공유·평균시청은 그대로 살아남아야 한다. (전에는 곧바로 reach 만 남았다)
  const 후보 = [
    `reach,saved,shares,profile_visits,follows${시청}`,
    `reach,saved,shares${시청}`,
    "reach",
  ];
  for (const metric of 후보) {
    try {
      const d = await meta(`/${mediaId}/insights`, { metric });
      return {
        reach: 값(d, "reach"),
        saved: 값(d, "saved"),
        shares: 값(d, "shares"),
        // ★ 2026-08-10 추가 (3채널-통합전략 4-0)
        //   인스타에서 남은 질문은 "본 사람이 계정을 눌러보나" 하나뿐인데, 성적표가 그걸 안 물었다.
        //   안 재면 무엇을 고쳐서 무엇이 움직였는지 영원히 모른다.
        프로필방문: 값(d, "profile_visits"),
        팔로우: 값(d, "follows"),
        프로필잼: 왔나(d, "profile_visits"), // 진짜 0 인지, 메타가 안 준 건지 구분용
        // 메타는 밀리초로 준다 → 초로 바꿔 사람이 읽을 수 있게
        시청초: 릴스인가 ? +(값(d, "ig_reels_avg_watch_time") / 1000).toFixed(1) : 0,
      };
    } catch {
      // 다음 후보로 좁혀서 다시 묻는다
    }
  }
  return 기본; // 너무 오래됐거나 권한이 없으면 0 으로 둔다
}

const 일수 = (iso) => (Date.now() - new Date(iso).getTime()) / 864e5;

// 계정 전체 인사이트 — 프로필 방문의 '진짜 기준값'은 여기서 나온다.
//
// ★ 2026-08-10 실측으로 알아낸 것
//   릴스는 게시물별로 프로필방문을 아예 못 잰다. 메타가 이렇게 답한다:
//   "The Media Insights API does not support the profile_visits metric for this media product type."
//   (카드뉴스는 된다. 그런데 카드뉴스는 도달이 0이라 잴 게 없다 — 사람이 닿는 건 릴스뿐이다)
//   그래서 게시물별 숫자만 보면 정작 알고 싶은 값이 통째로 빈다.
//   계정 단위 profile_views 는 릴스·검색·태그·프로필 직접방문을 전부 합쳐서 준다. 이쪽이 답이다.
//   ※ profile_views 는 metric_type=total_value 를 반드시 같이 보내야 한다(안 보내면 거부당한다).
async function 계정인사이트(며칠 = 7) {
  const now = Math.floor(Date.now() / 1000);
  const 공통 = { period: "day", metric_type: "total_value", since: String(now - 며칠 * 86400), until: String(now) };
  const 하나 = async (metric) => {
    try {
      const d = await meta(`/${IG}/insights`, { metric, ...공통 });
      const m = (d.data ?? [])[0];
      return m ? (m.total_value?.value ?? 0) : null; // 항목 자체가 안 오면 null = 못 쟀다 (0 과 구분)
    } catch {
      return null;
    }
  };
  const [프로필방문, 도달, 링크탭] = await Promise.all([
    하나("profile_views"),
    하나("reach"),
    하나("profile_links_taps"),
  ]);
  return { 며칠, 프로필방문, 도달, 링크탭 };
}

// ───────────────────────── 유튜브 ─────────────────────────
// 오즈백에서 유일하게 사람이 보는 채널이다. 여기 숫자가 판단의 근거다.
//
// ★ 조회수를 비교할 때 조심할 것 — 이 프로젝트가 한 번 속은 함정이다
//   영상은 시간이 갈수록 조회수가 쌓인다. 그래서 "이번 주에 올린 영상 평균"과
//   "지난주에 올린 영상 평균"을 그냥 비교하면, 오래된 쪽이 무조건 이긴다.
//   전에 릴스에서 "긴 영상이 도달이 높다"고 잘못 읽은 원인이 정확히 이것이었다.
//   그래서 진짜 신호는 따로 둔다 → 채널 총조회수의 '어제 대비 증가분'.
//   이건 영상 나이와 무관하게 "오늘 하루 우리 채널이 몇 번 보였나"를 그대로 말해준다.
async function 유튜브성적() {
  const CID = process.env.YOUTUBE_CLIENT_ID;
  const CS = process.env.YOUTUBE_CLIENT_SECRET;
  const RT = process.env.YOUTUBE_REFRESH_TOKEN;
  if (!CID || !CS || !RT) {
    console.log("\n유튜브 자격증명이 없어 건너뜁니다.");
    return null;
  }

  const tr = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CID, client_secret: CS, refresh_token: RT, grant_type: "refresh_token" }),
  });
  const tj = await tr.json();
  if (!tj.access_token) throw new Error(`토큰 발급 실패 (${tj.error ?? "이유 불명"}) — 키가 만료됐는지 확인하세요`);
  const H = { Authorization: `Bearer ${tj.access_token}` };
  const yt = async (p) => {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/${p}`, { headers: H });
    const j = await r.json();
    if (j.error) throw new Error(`유튜브: ${j.error.message}`);
    return j;
  };

  const ch = (await yt("channels?part=snippet,statistics,contentDetails&mine=true")).items?.[0];
  if (!ch) throw new Error("채널을 못 찾았습니다");
  const 총조회 = +(ch.statistics.viewCount ?? 0);
  const 구독 = +(ch.statistics.subscriberCount ?? 0);

  // 업로드 목록 → 영상별 조회수 (50개씩 나눠 묻는다)
  const up = ch.contentDetails.relatedPlaylists.uploads;
  const ids = [];
  let page;
  do {
    const q = await yt(`playlistItems?part=contentDetails&maxResults=50&playlistId=${up}${page ? `&pageToken=${page}` : ""}`);
    ids.push(...(q.items ?? []).map((i) => i.contentDetails.videoId));
    page = q.nextPageToken;
  } while (page && ids.length < 200);

  const 영상 = [];
  for (let i = 0; i < ids.length; i += 50) {
    const q = await yt(`videos?part=statistics,snippet,status&id=${ids.slice(i, i + 50).join(",")}`);
    for (const v of q.items ?? []) {
      영상.push({
        제목: v.snippet.title,
        조회: +(v.statistics.viewCount ?? 0),
        좋아요: +(v.statistics.likeCount ?? 0),
        공개일: v.snippet.publishedAt,
        공개여부: v.status.privacyStatus,
      });
    }
  }
  const 공개 = 영상.filter((v) => v.공개여부 === "public");

  // 어제 기록과 비교 — 나이 편향이 없는 유일한 신호
  let 어제총조회 = null;
  try {
    const 어제 = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    어제총조회 = (await getJSON(`channel:report:${어제}`))?.유튜브?.총조회수 ?? null;
  } catch { /* 어제 기록이 없으면 그냥 넘어간다 — 첫날엔 비교 대상이 없다 */ }

  console.log(`\n📺 유튜브 ${ch.snippet.title}`);
  console.log(`구독자 ${구독}명 · 공개영상 ${공개.length}개 · 총조회수 ${총조회.toLocaleString()}회`);
  if (어제총조회 !== null) {
    const 증가 = 총조회 - 어제총조회;
    console.log(`  └ 어제 대비 ${증가 >= 0 ? "+" : ""}${증가.toLocaleString()}회 ← 나이 편향 없는 진짜 신호. 이 줄을 매일 볼 것.`);
  } else {
    console.log("  └ 어제 기록이 없어 증가분을 못 냅니다 (내일부터 나옵니다)");
  }

  const 상위 = [...공개].sort((a, b) => b.조회 - a.조회).slice(0, 5);
  // 제목에 실제로 보여주는 개수를 쓴다. 2개만 찍으면서 "5개"라고 하면 성적표가 거짓말을 한다.
  console.log(`\n  많이 본 영상 ${상위.length}개`);
  for (const v of 상위) {
    console.log(`    ${v.공개일.slice(0, 10)} ${String(v.조회).padStart(5)}회 ♥${v.좋아요} ${v.제목.slice(0, 38)}`);
  }

  const 최근7 = 공개.filter((v) => 일수(v.공개일) <= 7);
  const 평균 = 공개.length ? Math.round(공개.reduce((s, v) => s + v.조회, 0) / 공개.length) : 0;
  console.log(`\n  전체 평균 ${평균}회 · 최근 7일 올린 영상 ${최근7.length}개`);
  if (최근7.length)
    console.log(`    ※ 최근 영상은 아직 조회수가 쌓일 시간이 없어 낮게 나옵니다. 평균끼리 비교하지 마세요.`);

  return {
    채널: ch.snippet.title,
    구독자: 구독,
    총조회수: 총조회,
    어제대비: 어제총조회 !== null ? 총조회 - 어제총조회 : null,
    공개영상수: 공개.length,
    평균조회수: 평균,
    최근7일업로드: 최근7.length,
    상위: 상위.map((v) => ({ 제목: v.제목, 조회: v.조회, 공개일: v.공개일.slice(0, 10) })),
  };
}

async function 인스타파트() {
  if (!TOKEN || !IG) {
    console.log("인스타 자격증명이 없어 인스타·페북 성적표를 건너뜁니다.");
    return null;
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
    const pv = list.reduce((s, m) => s + (m.프로필방문 ?? 0), 0);
    const fo = list.reduce((s, m) => s + (m.팔로우 ?? 0), 0);
    // 프로필방문이 실제로 온 게시물 수. 이게 0이면 합계 0은 "안 눌렀다"가 아니라 "못 쟀다"다.
    const pv잰것 = list.filter((m) => m.프로필잼).length;
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
      프로필방문: pv,
      팔로우: fo,
      프로필잰개수: pv잰것,
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
    console.log(
      s.프로필잰개수
        ? `        └ 프로필방문 ${s.프로필방문} · 팔로우 ${s.팔로우}  (${s.프로필잰개수}/${s.개수}건 측정됨)`
        : `        └ 프로필방문 — 메타가 안 줌 (0이 아니라 '못 쟀다'는 뜻)`,
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
  if (a.프로필잰개수 || b.프로필잰개수) {
    console.log(`  프로필방문 ${a.프로필방문} ← ${b.프로필방문}  ${화살표(a.프로필방문, b.프로필방문)}`);
    console.log(`  팔로우   ${a.팔로우} ← ${b.팔로우}  ${화살표(a.팔로우, b.팔로우)}`);
  }

  // ---- 계정 전체 (프로필 방문의 기준값) ----
  const 계정 = await 계정인사이트(7);
  console.log("\n계정 전체 · 최근 7일");
  console.log(
    `  도달 ${계정.도달 ?? "―"} · 프로필 방문 ${계정.프로필방문 ?? "못 쟀음"} · 프로필 링크 누름 ${계정.링크탭 ?? "―"}`,
  );
  console.log("  ※ 릴스는 게시물별로 프로필 방문을 못 잰다(메타가 지원 안 함). 이 계정 숫자가 기준이다.");

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
  // ★ 인스타에서 지금 우리가 판단하려는 숫자는 이것 하나다 (3채널-통합전략 4장)
  //   "도달한 사람이 계정을 눌러보나". 계정 전체 숫자로 본다 — 릴스는 게시물별로 못 재기 때문.
  if (계정.프로필방문 === null)
    console.log(
      "  · 프로필 방문을 메타가 안 준다. 자동으로 못 잰다 — 앱 인사이트를 눈으로 볼 것. (0으로 읽지 말 것)",
    );
  else if (계정.프로필방문 === 0)
    console.log(
      `  · 프로필 방문 7일 0회 (같은 기간 도달 ${계정.도달 ?? "?"}). 닿기는 하는데 계정을 누른 사람이 한 명도 없다 — 화면에 '누를 이유'가 없다는 뜻이다.`,
    );
  else
    console.log(
      `  · 프로필 방문 7일 ${계정.프로필방문}회 (도달 ${계정.도달 ?? "?"}). 0을 깼다 — 이 숫자를 매일 비교할 것.`,
    );

  if (prof.followers_count === 0)
    console.log("  · 팔로워가 아직 0명이다. 도달이 늘어도 팔로우로 이어지지 않으면 계정이 안 큰다.");

  return {
    팔로워: prof.followers_count,
    게시물: prof.media_count,
    형식별: Object.fromEntries(Object.entries(묶음).map(([k, v]) => [k, 요약(v)])),
    최근7일: a,
    앞7일: b,
    계정7일: 계정, // 프로필 방문 기준값 — 2일 리포트가 추이를 보려면 이게 매일 쌓여야 한다
    페북,
  };
}

// ── 검색 유입 (서치콘솔) ─────────────────────────────────────────────
// SNS 도달은 우리가 밀어서 나온 숫자지만, 검색 클릭은 사람이 찾아서 들어온 숫자다.
// 광고비 0원으로 크려면 결국 이 칸이 자라야 한다. 2026-08-11부터 잰다.
//
// 로봇 계정(서비스 계정)으로 읽는다 — 열쇠가 없으면 조용히 건너뛴다.
// ★ 서치콘솔은 데이터가 2~3일 늦게 채워진다. 그래서 어제까지가 아니라
//   「이틀 전까지의 7일」을 본다. 안 그러면 최근 칸이 늘 낮게 나와 매일 나빠지는 것처럼 보인다.
async function 검색유입() {
  const email = process.env.GOOGLE_SA_EMAIL;
  const key = process.env.GOOGLE_SA_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const site = process.env.GSC_SITE_URL || "https://oddsbag.co.kr/";
  if (!email || !key) return null;

  const { default: crypto } = await import("node:crypto");
  const b64 = (s) =>
    Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const now = Math.floor(Date.now() / 1000);
  const head = b64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/webmasters.readonly",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    }),
  );
  const sig = b64(crypto.sign("RSA-SHA256", Buffer.from(`${head}.${claim}`), key));
  const tr = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${head}.${claim}.${sig}`,
    }),
  }).then((r) => r.json());
  if (!tr.access_token) throw new Error(`출입증 실패 ${JSON.stringify(tr).slice(0, 120)}`);

  const 날 = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const 물어보기 = async (body) => {
    const r = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${tr.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    ).then((x) => x.json());
    if (r.error) throw new Error(`${r.error.status} ${r.error.message.slice(0, 100)}`);
    return r.rows ?? [];
  };

  const 합 = (rows) => {
    const r = rows[0];
    return {
      클릭: r?.clicks ?? 0,
      노출: r?.impressions ?? 0,
      순위: r?.position ? Number(r.position.toFixed(1)) : null,
    };
  };

  const [최근, 이전, 검색어, 페이지] = await Promise.all([
    물어보기({ startDate: 날(8), endDate: 날(2), dimensions: [] }).then(합),
    물어보기({ startDate: 날(15), endDate: 날(9), dimensions: [] }).then(합),
    물어보기({ startDate: 날(30), endDate: 날(2), dimensions: ["query"], rowLimit: 5 }),
    물어보기({ startDate: 날(30), endDate: 날(2), dimensions: ["page"], rowLimit: 3 }),
  ]);

  console.log("\n검색 유입 (서치콘솔)");
  console.log(`  최근 7일 (${날(8)}~${날(2)}) — 클릭 ${최근.클릭} · 노출 ${최근.노출} · 평균순위 ${최근.순위 ?? "-"}`);
  console.log(`  그 앞 7일 (${날(15)}~${날(9)}) — 클릭 ${이전.클릭} · 노출 ${이전.노출} · 평균순위 ${이전.순위 ?? "-"}`);

  const 증감 = (a, b, 이름) => {
    if (b === 0) return a > 0 ? `  · ${이름} ${b}→${a} (0을 깼다)` : null;
    const p = Math.round(((a - b) / b) * 100);
    return `  · ${이름} ${b}→${a} (${p >= 0 ? "+" : ""}${p}%)`;
  };
  for (const 줄 of [증감(최근.클릭, 이전.클릭, "클릭"), 증감(최근.노출, 이전.노출, "노출")])
    if (줄) console.log(줄);

  if (검색어.length) {
    console.log("  최근 30일 상위 검색어");
    for (const x of 검색어) console.log(`    · ${x.keys[0]} — 클릭 ${x.clicks} / 노출 ${x.impressions}`);
  } else {
    console.log("  최근 30일 검색어: 아직 없음");
  }
  if (페이지.length) {
    console.log("  검색으로 들어온 글");
    for (const x of 페이지)
      console.log(`    · ${x.keys[0].replace(/^https?:\/\/[^/]+/, "")} — 클릭 ${x.clicks}`);
  }

  // 노출은 나는데 클릭이 없다 = 검색 결과에 뜨긴 뜨는데 제목이 안 눌린다는 뜻이다.
  if (최근.노출 >= 20 && 최근.클릭 === 0)
    console.log("  · 노출은 있는데 클릭이 0이다. 순위 문제가 아니라 제목·설명이 안 눌리는 것이다.");

  return {
    최근7일: 최근,
    앞7일: 이전,
    상위검색어: 검색어.map((x) => ({ 말: x.keys[0], 클릭: x.clicks, 노출: x.impressions })),
    상위페이지: 페이지.map((x) => ({ 주소: x.keys[0], 클릭: x.clicks })),
  };
}

async function main() {
  // 채널을 따로 세운다 — 한쪽 토큰이 만료돼도 다른 쪽 숫자는 계속 나와야 한다.
  // (전에는 인스타 자격증명이 없으면 여기서 전부 끝나서, 살아있는 유튜브까지 같이 눈이 멀었다)
  const [유튜브, 인스타, 검색] = await Promise.all([
    유튜브성적().catch((e) => {
      console.log(`\n유튜브 조회 실패: ${e.message}`);
      return null;
    }),
    인스타파트().catch((e) => {
      console.log(`\n인스타 조회 실패: ${e.message}`);
      return null;
    }),
    검색유입().catch((e) => {
      console.log(`\n검색 유입 조회 실패: ${e.message}`);
      return null;
    }),
  ]);

  if (!유튜브 && !인스타) {
    console.log("\n어느 채널도 못 쟀습니다. 자격증명을 확인하세요.");
    return;
  }

  if (유튜브) {
    console.log("\n채널 비교");
    const ig = 인스타?.형식별?.["릴스"]?.도달 ?? 0;
    console.log(`  유튜브 총조회 ${유튜브.총조회수.toLocaleString()}회 vs 인스타 릴스 총도달 ${ig.toLocaleString()}회`);
    if (ig && 유튜브.총조회수 > ig * 3)
      console.log(`  · 유튜브가 인스타보다 ${Math.round(유튜브.총조회수 / ig)}배 닿는다. 일의 배분이 이 비율과 맞는지 볼 것.`);
    if (유튜브.구독자 === 0)
      console.log("  · 유튜브도 구독자는 0명이다. 조회는 나는데 남지 않는다 — 구독을 부르는 마무리가 없다는 뜻.");
  }

  if (!기록안함) {
    const 오늘 = new Date().toISOString().slice(0, 10);
    await kvSet(
      `channel:report:${오늘}`,
      JSON.stringify({ 날짜: 오늘, 유튜브, 검색, ...(인스타 ?? {}) }),
    );
    console.log(`\n기록 완료 — channel:report:${오늘}`);
  }
}

main().catch((e) => {
  // 성적표가 실패해도 릴스 만들기를 막지 않는다
  console.error("성적표 실패:", e.message);
});
