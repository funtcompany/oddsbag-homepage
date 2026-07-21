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
