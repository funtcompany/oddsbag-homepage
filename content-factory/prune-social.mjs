// 인스타 저노출 게시물 정리
//
// 올린 지 일주일이 지났는데 노출수가 기준(기본 20) 미만인 게시물을 내린다.
// 반응 없는 글이 프로필에 쌓이면 새로 들어온 사람이 "죽은 계정"으로 보고 나간다.
//
// 【안전장치】 게시물 삭제는 되돌릴 수 없다. 그래서 기본은 '목록만 보고'다.
//  · PRUNE_MODE=report (기본) — 지울 대상만 뽑아서 보여주고 실제로는 안 지운다
//  · PRUNE_MODE=delete        — 실제로 지운다
//  · 지우기 전에 게시물 정보를 Redis 에 백업한다 (ig:pruned:<id>)
//  · 하루 삭제 상한(PRUNE_MAX_PER_DAY, 기본 5)을 둬서 사고가 나도 계정이 비지 않는다
//  · 노출수를 못 읽으면(권한 오류·API 장애) 그 글은 절대 건드리지 않는다
//
// 필요한 권한 (지금 토큰에는 없음 — 메타 앱에서 추가 후 토큰 재발급 필요):
//  · instagram_manage_insights  — 노출수 읽기
//  · instagram_manage_contents  — 게시물 삭제

import { kvGet, kvSet, sadd, smembers } from "./store.mjs";

const IG_ID = process.env.INSTAGRAM_ACCOUNT_ID;
const TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const G = "https://graph.facebook.com/v21.0";

export const pruneEnabled = Boolean(IG_ID && TOKEN);

const MIN_VIEWS = Number(process.env.PRUNE_MIN_VIEWS || 20); // 이 미만이면 정리 대상
const AGE_DAYS = Number(process.env.PRUNE_AGE_DAYS || 7); // 게시 후 이만큼 지난 글만
const MAX_PER_DAY = Number(process.env.PRUNE_MAX_PER_DAY || 5); // 하루 삭제 상한 (안전장치)
const MODE = process.env.PRUNE_MODE === "delete" ? "delete" : "report";

const K_PRUNED = "ig:pruned"; // 지운 게시물 id 집합
const K_KEPT = "ig:pruneKept"; // 기준을 넘겨 살려둔 게시물 id (다시 조회하지 않게)

async function graph(path, params = {}, method = "GET") {
  const qs = new URLSearchParams({ ...params, access_token: TOKEN });
  // GET·DELETE 는 주소줄에, POST 는 본문에 실어 보낸다
  const inBody = method === "POST";
  const res = await fetch(inBody ? `${G}${path}` : `${G}${path}?${qs}`, {
    method,
    body: inBody ? qs : undefined,
    cache: "no-store",
  });
  const data = await res.json();
  if (data.error) throw new Error(`Meta: ${data.error.message}`);
  return data;
}

// 노출수 읽기.
// 메타가 지표 이름을 여러 번 바꿔서(impressions → views) 되는 것을 순서대로 시도한다.
// 하나도 못 읽으면 null 을 돌려주고, 그 글은 건드리지 않는다.
async function readViews(mediaId) {
  for (const metric of ["views", "impressions", "reach"]) {
    try {
      const d = await graph(`/${mediaId}/insights`, { metric });
      const v = d.data?.[0]?.values?.[0]?.value;
      if (typeof v === "number") return { metric, value: v };
    } catch {
      /* 다음 지표로 */
    }
  }
  return null;
}

export async function runPrune() {
  const out = {
    mode: MODE,
    checked: 0,
    targets: [], // 기준 미달 — 정리 대상
    deleted: [],
    unreadable: 0, // 노출수를 못 읽어 건너뛴 글
    errors: [],
  };

  if (!pruneEnabled) {
    out.errors.push("인스타 미설정 (INSTAGRAM_ACCOUNT_ID/ACCESS_TOKEN)");
    return out;
  }

  let media;
  try {
    const d = await graph(`/${IG_ID}/media`, {
      fields: "id,media_type,timestamp,permalink,caption",
      limit: "100",
    });
    media = d.data ?? [];
  } catch (e) {
    out.errors.push(`게시물 목록: ${e.message}`);
    return out;
  }

  let pruned, kept;
  try {
    [pruned, kept] = await Promise.all([smembers(K_PRUNED), smembers(K_KEPT)]);
  } catch {
    pruned = [];
    kept = [];
  }
  const skip = new Set([...(pruned ?? []), ...(kept ?? [])]);

  const cutoff = Date.now() - AGE_DAYS * 864e5;
  const old = media.filter(
    (m) => !skip.has(m.id) && new Date(m.timestamp).getTime() <= cutoff,
  );

  for (const m of old) {
    const v = await readViews(m.id);
    out.checked++;

    // 노출수를 못 읽으면 절대 지우지 않는다. (권한 오류를 '노출 0'으로 오해하면 계정이 비어버린다)
    if (!v) {
      out.unreadable++;
      continue;
    }

    if (v.value >= MIN_VIEWS) {
      // 기준을 넘겼다 — 앞으로 다시 조회하지 않는다 (노출수는 시간이 갈수록 늘기만 한다)
      try {
        await sadd(K_KEPT, m.id);
      } catch {
        /* ignore */
      }
      continue;
    }

    const target = {
      id: m.id,
      type: m.media_type,
      at: m.timestamp,
      views: v.value,
      metric: v.metric,
      permalink: m.permalink,
      caption: (m.caption ?? "").slice(0, 60),
    };
    out.targets.push(target);
  }

  // 오래된 것부터 정리 (가장 가망 없는 글부터)
  out.targets.sort((a, b) => a.at.localeCompare(b.at));

  if (MODE !== "delete") {
    console.log(
      `[목록만 보기] 정리 대상 ${out.targets.length}건 — 실제로 지우려면 PRUNE_MODE=delete`,
    );
    return out;
  }

  for (const t of out.targets.slice(0, MAX_PER_DAY)) {
    try {
      // 지우기 전에 백업 (되돌릴 수는 없지만 무엇을 지웠는지는 남는다)
      await kvSet(`ig:pruned:${t.id}`, JSON.stringify({ ...t, prunedAt: new Date().toISOString() }));
      await graph(`/${t.id}`, {}, "DELETE");
      await sadd(K_PRUNED, t.id);
      out.deleted.push(t);
    } catch (e) {
      out.errors.push(`삭제 ${t.id}: ${e.message}`);
    }
  }

  if (out.targets.length > MAX_PER_DAY) {
    console.log(
      `정리 대상 ${out.targets.length}건 중 ${MAX_PER_DAY}건만 처리 — 나머지는 내일 (안전장치)`,
    );
  }

  try {
    await kvSet("ig:prunedAt", new Date().toISOString());
  } catch {
    /* ignore */
  }
  return out;
}
