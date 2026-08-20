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

export const isPersistent = Boolean(KV_URL && KV_TOKEN);

// ---- 메모리 폴백 ----
const mem = {
  hash: new Map(),
  set: new Map(),
};

// ---- 차단기 (circuit breaker) ----
//
// 하루 한도(50만)가 터지면 Upstash 는 요청을 거절하는데, ★거절된 요청도 한도에서 깎인다.
// 실패할 때마다 계속 두드리면 한도가 풀리는 순간 그 두드림이 다시 즉시 태운다.
// 한 번 「한도 초과」를 보면 정해진 시간 동안 아예 부르지 않는다.
const QUOTA_COOLDOWN_MS = Number(
  process.env.REDIS_QUOTA_COOLDOWN_MS || 15 * 60_000,
);
let openUntil = 0;
let lastReason = "";

export function redisStatus() {
  return {
    blocked: Date.now() < openUntil,
    openUntil: openUntil ? new Date(openUntil).toISOString() : null,
    lastReason,
  };
}

const isQuotaError = (msg) =>
  /max requests limit|max daily request|quota|exceeded|too many requests|429/i.test(
    msg,
  );

// ---- Upstash REST 호출 ----
async function redis(command) {
  if (Date.now() < openUntil) {
    throw new Error(`레디스 차단 중 (${lastReason})`);
  }

  const res = await fetch(KV_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });

  // ★res.json() 을 바로 쓰지 않는다 — 한도 초과 응답이 JSON 이 아닐 때가 있어
  //   여기서 던지면 「한도 초과」라는 진짜 이유가 파싱 오류에 묻힌다.
  const text = await res.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text.slice(0, 200) || `HTTP ${res.status}` };
  }

  const err = data.error ?? (res.ok ? undefined : `HTTP ${res.status}`);
  if (err) {
    lastReason = err;
    if (isQuotaError(err) || res.status === 429) {
      openUntil = Date.now() + QUOTA_COOLDOWN_MS;
      console.warn(
        `[redis] 한도 초과 — ${Math.round(QUOTA_COOLDOWN_MS / 60000)}분간 호출 중단:`,
        err,
      );
    }
    throw new Error(err);
  }

  openUntil = 0;
  return data.result;
}

// 해시 값 증가 (조회수, 반응 카운트)
export async function hincr(key, field, by = 1) {
  if (isPersistent) {
    return await redis(["HINCRBY", key, field, by]);
  }
  const h = mem.hash.get(key) ?? {};
  const next = (parseInt(h[field] ?? "0", 10) || 0) + by;
  h[field] = String(next);
  mem.hash.set(key, h);
  return next;
}

// 해시 전체 조회 (반응 카운트 묶음)
export async function hgetall(key) {
  if (isPersistent) {
    const flat = (await redis(["HGETALL", key])) ?? [];
    const out = {};
    for (let i = 0; i < flat.length; i += 2)
      out[flat[i]] = parseInt(flat[i + 1], 10) || 0;
    return out;
  }
  const h = mem.hash.get(key) ?? {};
  const out = {};
  for (const k of Object.keys(h)) out[k] = parseInt(h[k], 10) || 0;
  return out;
}

// 집합에 추가 (구독 이메일 중복 방지), 반환: 새로 추가됐으면 1
export async function sadd(key, member) {
  if (isPersistent) {
    return await redis(["SADD", key, member]);
  }
  const s = mem.set.get(key) ?? new Set();
  const had = s.has(member);
  s.add(member);
  mem.set.set(key, s);
  return had ? 0 : 1;
}

export async function scard(key) {
  if (isPersistent) {
    return await redis(["SCARD", key]);
  }
  return mem.set.get(key)?.size ?? 0;
}

// 리스트에 밀어넣기 (댓글)
export async function rpush(key, value) {
  if (isPersistent) {
    return await redis(["RPUSH", key, value]);
  }
  const s = mem.hash.get(key)?.__list;
  const arr = s ? JSON.parse(s) : [];
  arr.push(value);
  mem.hash.set(key, { __list: JSON.stringify(arr) });
  return arr.length;
}

export async function lrange(key) {
  if (isPersistent) {
    return (await redis(["LRANGE", key, 0, -1])) ?? [];
  }
  const s = mem.hash.get(key)?.__list;
  return s ? JSON.parse(s) : [];
}

// ---- 범용 문자열 KV (게시물 저장용) ----
const memKv = new Map();

export async function kvGet(key) {
  if (isPersistent) {
    return (await redis(["GET", key])) ?? null;
  }
  return memKv.get(key) ?? null;
}

export async function kvSet(key, value) {
  if (isPersistent) {
    await redis(["SET", key, value]);
    return;
  }
  memKv.set(key, value);
}

export async function kvDel(key) {
  if (isPersistent) {
    await redis(["DEL", key]);
    return;
  }
  memKv.delete(key);
}

export async function smembers(key) {
  if (isPersistent) {
    return (await redis(["SMEMBERS", key])) ?? [];
  }
  return Array.from(mem.set.get(key) ?? []);
}

export async function srem(key, member) {
  if (isPersistent) {
    await redis(["SREM", key, member]);
    return;
  }
  mem.set.get(key)?.delete(member);
}

// ---- 여러 키를 한 번에 읽기 (MGET) ----
//
// 발행글 148편을 GET 148번으로 읽으면 점검 한 회차에 149 명령이 나간다.
// MGET 으로 묶으면 4 명령이다. Upstash 는 «명령 수»로 세니 키가 몇 개든 MGET 은 1이다.
const MGET_CHUNK = Math.max(1, Number(process.env.REDIS_MGET_CHUNK || 50));

export async function kvMget(keys) {
  if (keys.length === 0) return [];
  if (!isPersistent) return keys.map((k) => memKv.get(k) ?? null);

  const out = [];
  for (let i = 0; i < keys.length; i += MGET_CHUNK) {
    const chunk = keys.slice(i, i + MGET_CHUNK);
    const res = (await redis(["MGET", ...chunk])) ?? [];
    for (let j = 0; j < chunk.length; j += 1) out.push(res[j] ?? null);
  }
  return out;
}
