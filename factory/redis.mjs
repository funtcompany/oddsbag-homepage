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
export const redisReady = Boolean(URL && TOKEN);

// 하루 단위 카운터 (유튜브 무료 한도 관리에 쓴다). 이틀 뒤 자동 삭제.
export async function bumpDaily(key) {
  const k = `${key}:${new Date().toISOString().slice(0, 10)}`;
  const n = await cmd(["INCR", k]);
  await cmd(["EXPIRE", k, 172800]);
  return Number(n);
}
export async function readDaily(key) {
  const k = `${key}:${new Date().toISOString().slice(0, 10)}`;
  return Number((await cmd(["GET", k])) ?? 0);
}
