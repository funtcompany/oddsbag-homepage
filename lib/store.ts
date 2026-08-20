// 커뮤니티 데이터 저장소 (조회수·반응·댓글·구독)
//
// 운영 환경: Upstash Redis (환경변수 KV_REST_API_URL / KV_REST_API_TOKEN 설정 시 자동 사용)
// 로컬/미설정: 메모리 폴백 (서버 재시작 시 초기화 — 개발용)
//
// 👉 무료 Upstash Redis 연동만 하면 좋아요/댓글/구독자/랭킹이 실제로 저장됩니다.

const KV_URL =
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const KV_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

/**
 * 비상 차단 스위치.
 * Vercel 환경변수에 REDIS_OFF=1 만 넣으면 이 파일이 레디스를 아예 부르지 않는다.
 * 화면은 스냅샷(content/published-snapshot.json)으로 그대로 뜬다.
 * ★쓰기는 메모리로 빠져 사라진다 — 읽기 전용 비상 모드다. 풀리면 값을 지운다.
 */
const FORCED_OFF = /^(1|on|true|yes)$/i.test(process.env.REDIS_OFF ?? "");

export const isPersistent = Boolean(KV_URL && KV_TOKEN) && !FORCED_OFF;

// ---- 메모리 폴백 ----
const mem = {
  hash: new Map<string, Record<string, string>>(),
  set: new Map<string, Set<string>>(),
};

// ---- 차단기 (circuit breaker) ----
//
// 하루 한도(50만)가 터지면 Upstash 는 요청을 거절하는데, ★거절된 요청도 한도에서 깎인다.
// 그래서 실패할 때마다 계속 두드리면 한도가 풀리는 순간 그 두드림이 다시 즉시 태운다.
// 「한도 초과」를 한 번 보면 정해진 시간 동안 아예 부르지 않는다. 그동안 화면은 스냅샷으로 뜬다.
const QUOTA_COOLDOWN_MS = Number(
  process.env.REDIS_QUOTA_COOLDOWN_MS || 15 * 60_000,
);
const FAIL_COOLDOWN_MS = 30_000;
const FAIL_THRESHOLD = 3;

let openUntil = 0; // 이 시각까지는 부르지 않는다
let failures = 0;
let lastReason = "";

export class RedisUnavailable extends Error {}

/** 지금 레디스를 부를 수 있나 */
export function redisReady(): boolean {
  return isPersistent && Date.now() >= openUntil;
}

/** 관리자 화면·점검용 상태 */
export function redisStatus() {
  return {
    persistent: isPersistent,
    forcedOff: FORCED_OFF,
    blocked: Date.now() < openUntil,
    openUntil: openUntil ? new Date(openUntil).toISOString() : null,
    lastReason,
  };
}

const isQuotaError = (msg: string) =>
  /max requests limit|max daily request|quota|exceeded|too many requests|429/i.test(
    msg,
  );

function trip(reason: string, quota: boolean): void {
  lastReason = reason;
  if (quota) {
    openUntil = Date.now() + QUOTA_COOLDOWN_MS;
    failures = 0;
    console.warn(
      `[redis] 한도 초과 — ${Math.round(QUOTA_COOLDOWN_MS / 60000)}분간 호출 중단:`,
      reason,
    );
    return;
  }
  failures += 1;
  if (failures >= FAIL_THRESHOLD) {
    openUntil = Date.now() + FAIL_COOLDOWN_MS;
    failures = 0;
    console.warn("[redis] 연속 실패 — 30초간 호출 중단:", reason);
  }
}

// ---- Upstash REST 호출 ----
async function redis(command: (string | number)[]): Promise<unknown> {
  if (Date.now() < openUntil) {
    throw new RedisUnavailable(`레디스 차단 중 (${lastReason})`);
  }

  let res: Response;
  try {
    res = await fetch(KV_URL!, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      cache: "no-store",
    });
  } catch (e) {
    trip((e as Error).message, false);
    throw e;
  }

  // ★res.json() 을 바로 쓰지 않는다 — 한도 초과 응답이 JSON 이 아닐 때가 있어
  //   여기서 던지면 「한도 초과」라는 진짜 이유가 파싱 오류에 묻힌다.
  const text = await res.text();
  let data: { result?: unknown; error?: string } = {};
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    data = { error: text.slice(0, 200) || `HTTP ${res.status}` };
  }

  const err = data.error ?? (res.ok ? undefined : `HTTP ${res.status}`);
  if (err) {
    trip(err, isQuotaError(err) || res.status === 429);
    throw new Error(err);
  }

  failures = 0;
  openUntil = 0;
  return data.result;
}

// 해시 값 증가 (조회수, 반응 카운트)
export async function hincr(
  key: string,
  field: string,
  by = 1,
): Promise<number> {
  if (isPersistent) {
    return (await redis(["HINCRBY", key, field, by])) as number;
  }
  const h = mem.hash.get(key) ?? {};
  const next = (parseInt(h[field] ?? "0", 10) || 0) + by;
  h[field] = String(next);
  mem.hash.set(key, h);
  return next;
}

// 키에 만료시간 걸기 (날짜별 조회수처럼 오래 두면 안 되는 데이터)
export async function expire(key: string, ttlSec: number): Promise<void> {
  if (isPersistent) {
    await redis(["EXPIRE", key, ttlSec]);
  }
}

// 키 하나 증가 + 만료시간 지정 (로그인 시도 횟수 제한용)
// 반환: 증가 후 값
export async function incrWithTtl(key: string, ttlSec: number): Promise<number> {
  if (isPersistent) {
    const n = (await redis(["INCR", key])) as number;
    if (n === 1) await redis(["EXPIRE", key, ttlSec]);
    return n;
  }
  const now = Date.now();
  const cur = memCounter.get(key);
  if (!cur || cur.expires < now) {
    memCounter.set(key, { n: 1, expires: now + ttlSec * 1000 });
    return 1;
  }
  cur.n += 1;
  return cur.n;
}

export async function counterGet(key: string): Promise<number> {
  if (isPersistent) {
    const v = (await redis(["GET", key])) as string | null;
    return v ? parseInt(v, 10) || 0 : 0;
  }
  const cur = memCounter.get(key);
  return cur && cur.expires > Date.now() ? cur.n : 0;
}

export async function counterReset(key: string): Promise<void> {
  if (isPersistent) {
    await redis(["DEL", key]);
    return;
  }
  memCounter.delete(key);
}

const memCounter = new Map<string, { n: number; expires: number }>();

// 해시 전체 조회 (반응 카운트 묶음)
export async function hgetall(key: string): Promise<Record<string, number>> {
  if (isPersistent) {
    const flat = ((await redis(["HGETALL", key])) as string[]) ?? [];
    const out: Record<string, number> = {};
    for (let i = 0; i < flat.length; i += 2)
      out[flat[i]] = parseInt(flat[i + 1], 10) || 0;
    return out;
  }
  const h = mem.hash.get(key) ?? {};
  const out: Record<string, number> = {};
  for (const k of Object.keys(h)) out[k] = parseInt(h[k], 10) || 0;
  return out;
}

// 집합에 추가 (구독 이메일 중복 방지), 반환: 새로 추가됐으면 1
export async function sadd(key: string, member: string): Promise<number> {
  if (isPersistent) {
    return (await redis(["SADD", key, member])) as number;
  }
  const s = mem.set.get(key) ?? new Set<string>();
  const had = s.has(member);
  s.add(member);
  mem.set.set(key, s);
  return had ? 0 : 1;
}

export async function scard(key: string): Promise<number> {
  if (isPersistent) {
    return (await redis(["SCARD", key])) as number;
  }
  return mem.set.get(key)?.size ?? 0;
}

// 리스트에 밀어넣기 (댓글)
export async function rpush(key: string, value: string): Promise<number> {
  if (isPersistent) {
    return (await redis(["RPUSH", key, value])) as number;
  }
  const s = mem.hash.get(key)?.__list;
  const arr: string[] = s ? JSON.parse(s) : [];
  arr.push(value);
  mem.hash.set(key, { __list: JSON.stringify(arr) });
  return arr.length;
}

export async function lrange(key: string): Promise<string[]> {
  if (isPersistent) {
    return ((await redis(["LRANGE", key, 0, -1])) as string[]) ?? [];
  }
  const s = mem.hash.get(key)?.__list;
  return s ? (JSON.parse(s) as string[]) : [];
}

// ---- 범용 문자열 KV (게시물 저장용) ----
const memKv = new Map<string, string>();

export async function kvGet(key: string): Promise<string | null> {
  if (isPersistent) {
    return ((await redis(["GET", key])) as string | null) ?? null;
  }
  return memKv.get(key) ?? null;
}

export async function kvSet(key: string, value: string): Promise<void> {
  if (isPersistent) {
    await redis(["SET", key, value]);
    return;
  }
  memKv.set(key, value);
}

export async function kvDel(key: string): Promise<void> {
  if (isPersistent) {
    await redis(["DEL", key]);
    return;
  }
  memKv.delete(key);
}

export async function smembers(key: string): Promise<string[]> {
  if (isPersistent) {
    return ((await redis(["SMEMBERS", key])) as string[]) ?? [];
  }
  return Array.from(mem.set.get(key) ?? []);
}

export async function srem(key: string, member: string): Promise<void> {
  if (isPersistent) {
    await redis(["SREM", key, member]);
    return;
  }
  mem.set.get(key)?.delete(member);
}

// ---- 여러 키를 한 번에 읽기 (MGET) ----
//
// ★왜 있는가
//   발행글 148편을 GET 148번으로 읽으면 목록을 한 번 새로 고칠 때마다 149 명령이 나간다.
//   1분마다 새로 고치면 방문자 0명이어도 하루 21만 명령 — 한도(50만)의 절반을 그냥 쓴다.
//   MGET 으로 묶으면 같은 일이 4 명령이다. Upstash 는 «명령 수»로 세니 키가 몇 개든 MGET 은 1이다.
//   (한 번에 너무 많이 담으면 응답이 커지므로 50개씩 끊는다)
const MGET_CHUNK = Math.max(1, Number(process.env.REDIS_MGET_CHUNK || 50));

export async function kvMget(keys: string[]): Promise<(string | null)[]> {
  if (keys.length === 0) return [];
  if (!isPersistent) return keys.map((k) => memKv.get(k) ?? null);

  const out: (string | null)[] = [];
  for (let i = 0; i < keys.length; i += MGET_CHUNK) {
    const chunk = keys.slice(i, i + MGET_CHUNK);
    const res = (await redis(["MGET", ...chunk])) as (string | null)[] | null;
    for (let j = 0; j < chunk.length; j += 1) out.push(res?.[j] ?? null);
  }
  return out;
}
