// 인스타 프로필 게시물 수 — 홈페이지는 '읽기만' 한다. (2026-08-11)
//
// 세는 일은 공장이 한다: content-factory/ig-profile.mjs 가 12시간마다 인스타에 물어보고
// Redis 에 적어둔다. 여기(Vercel)엔 인스타 열쇠가 없을 수 있어서 물어보지 않는다.
//
// ★ 적힌 값이 없거나 너무 오래됐으면 null 을 돌려준다 → 카드가 숫자 없는 문구로 돌아간다.
//   낡은 숫자를 화면에 적는 것이 숫자를 안 적는 것보다 나쁘다. 사람이 프로필에 가서 세면 들킨다.
//
// 쌍둥이 주의: 문구(ctaTitle/CTA_BODY)는 content-factory/ig-profile.mjs 에도 같은 것이 있다.
//   한쪽만 고치면 그림과 목소리가 다른 말을 한다.

import { kvGet } from "@/lib/store";

export const IG_COUNT_KEY = "ig:profile:count";

// 공장이 12시간마다 갱신한다. 3일 넘게 안 갱신됐으면 공장이 멈춘 것이니 숫자를 안 쓴다.
const MAX_AGE_HOURS = 72;

/** 프로필 게시물 수. 적힌 값이 없거나 낡았으면 null. */
export async function cachedProfileCount(): Promise<number | null> {
  try {
    const raw = await kvGet(IG_COUNT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { n?: number; at?: string };
    const n = Number(v?.n);
    if (!Number.isFinite(n) || n <= 0) return null;
    const t = Date.parse(v?.at ?? "");
    if (!Number.isFinite(t) || (Date.now() - t) / 3600000 > MAX_AGE_HOURS) return null;
    return n;
  } catch {
    return null;
  }
}

// ── 마지막 카드 문구 (content-factory/ig-profile.mjs 와 글자까지 같아야 한다) ──
export const CTA_BODY = "저장해두면 필요할 때 꺼내 보고, 팔로우하면 내일 것도 옵니다";

export function ctaTitle(count?: number | null): string {
  return count ? `이런 거,\n프로필에 ${count}개 쌓여 있습니다` : "이상하게 필요한 것들,\n오즈백이 매일 하나씩";
}

export function ctaSay(count?: number | null): string {
  return count
    ? `이런 거, 프로필에 ${count}개 쌓여 있습니다. 오즈백 계정 눌러서 팔로우하고 가세요.`
    : "이런 거 매일 하나씩 올립니다. 오즈백 계정 눌러서 팔로우하고 가세요.";
}
