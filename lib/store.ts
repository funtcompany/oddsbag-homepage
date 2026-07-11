// 커뮤니티 데이터 저장소 (조회수·반응·댓글·구독)
//
// 운영 환경: Upstash Redis (환경변수 KV_REST_API_URL / KV_REST_API_TOKEN 설정 시 자동 사용)
// 로컬/미설정: 메모리 폴백 (서버 재시작 시 초기화 — 개발용)
//
// 👉 무료 Upstash Redis 연동만 하면 좋아요/댓글/구독자/랭킹이 실제로 저장됩니다.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

export const isPersistent = Boolean(KV_URL && KV_TOKEN);

// ---- 메모리 폴백 ----
const mem = {
  hash: new Map<string, Record<string, string>>(),
  set: new Map<string, Set<string>>(),
};

// ---- Upstash REST 호출 ----
async function redis(command: (string | number)[]): Promise<unknown> {
  const res = await fetch(KV_URL!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  const data = (await res.json()) as { result?: unknown; error?: string };
  if (data.error) throw new Error(data.error);
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
