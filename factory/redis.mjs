// Upstash Redis REST 접속 — 발행글을 홈페이지(Vercel) 거치지 않고 직접 읽는다.
const URL = (process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/$/, "");
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function cmd(args) {
  const r = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const j = await r.json();
  if (j.error) throw new Error("Redis: " + j.error);
  return j.result;
}

export const smembers = (key) => cmd(["SMEMBERS", key]);
export const sadd = (key, member) => cmd(["SADD", key, member]);
export const srem = (key, member) => cmd(["SREM", key, member]);
export async function getJSON(key) {
  const v = await cmd(["GET", key]);
  return v ? JSON.parse(v) : null;
}

// ★여러 글을 한 번에 읽는다 (MGET).
//   글 148편을 getJSON 148번으로 읽으면 스크립트 한 번에 148 명령이 나간다.
//   MGET 으로 묶으면 3 명령이다 — Upstash 는 «명령 수»로 세니 키가 몇 개든 MGET 은 1이다.
//   릴스·유튜브·정리 스크립트가 매일 발행글 전수를 훑기 때문에 여기가 크다.
const MGET_CHUNK = Math.max(1, Number(process.env.REDIS_MGET_CHUNK || 50));

export async function mgetJSON(keys) {
  if (!keys.length) return [];
  const out = [];
  for (let i = 0; i < keys.length; i += MGET_CHUNK) {
    const raws = (await cmd(["MGET", ...keys.slice(i, i + MGET_CHUNK)])) ?? [];
    for (const r of raws) {
      if (!r) { out.push(null); continue; }
      try { out.push(JSON.parse(r)); } catch { out.push(null); }
    }
  }
  return out;
}

/** 글 slug 목록 → 글 객체 목록 (못 읽은 건 빠진다) */
export const getPosts = (slugs) =>
  mgetJSON(slugs.map((s) => `post:${s}`)).then((a) => a.filter(Boolean));
// 값 저장 (채널 성적표처럼 날짜별로 쌓아 두는 기록에 쓴다)
export const kvSet = (key, value) => cmd(["SET", key, value]);
export const redisReady = Boolean(URL && TOKEN);

// 줄 세우기(LIST) — 폐기 대기줄처럼 "먼저 넣은 것부터 하나씩" 꺼낼 때 쓴다.
export const llen = (key) => cmd(["LLEN", key]);
export const lrange = (key, a = 0, b = -1) => cmd(["LRANGE", key, a, b]);
export const rpush = (key, value) => cmd(["RPUSH", key, value]);
export const lpop = (key) => cmd(["LPOP", key]);

// 하루 단위 카운터 (유튜브 무료 한도 관리에 쓴다). 이틀 뒤 자동 삭제.
// 하루 기준은 한국 시간. UTC로 세면 오전 9시에 날짜가 바뀌어 "하루 N개"가 어긋난다.
const kstDay = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

export async function bumpDaily(key) {
  const k = `${key}:${kstDay()}`;
  const n = await cmd(["INCR", k]);
  await cmd(["EXPIRE", k, 172800]);
  return Number(n);
}
export async function readDaily(key) {
  const k = `${key}:${kstDay()}`;
  return Number((await cmd(["GET", k])) ?? 0);
}
