// 인스타 프로필에 실제로 쌓여 있는 게시물 수 — 마지막 카드가 약속하는 숫자. (2026-08-11)
//
// 【왜 필요한가】 3채널-통합전략 4-2 「변경 4」
//  마지막 카드는 "오즈백이 매일 하나씩"이라는 **미래 약속**이었다. 미래 약속으로는 프로필을 안 누른다.
//  "지금 프로필에 58개가 있다"가 지금 당장 눌러 갈 이유다.
//
// 【숫자를 어디서 세나 — 여기서만 센다】
//  ★ 인스타가 알려주는 media_count 하나만 쓴다. 다른 데서 세면 거짓말이 된다.
//    실측(2026-08-11): Redis `social:ig:carousel` 은 0인데 프로필엔 캐러셀이 34개 있었고,
//    `reels:done` 은 33인데 올라간 릴스는 24개였다. **만든 것 ≠ 올라간 것.** 그래서 그 값은 안 쓴다.
//  ★ 못 세면 null 을 돌려준다. 그러면 카드는 숫자 없는 옛 문구로 돌아간다.
//    **추정치·반올림값을 넣지 않는다.** 화면에 적힌 숫자는 사람이 프로필에 가서 셀 수 있어야 한다.
//
// 【왜 캐시하나】
//  카드 그림은 홈페이지(/api/card)가 그리는데 거기엔 인스타 열쇠가 없을 수 있다.
//  공장(이 폴더)이 세어서 Redis 에 적어두고, 홈페이지는 그걸 읽기만 한다. (lib/igProfile.ts)

import { kvGet, kvSet } from "./store.mjs";

export const IG_COUNT_KEY = "ig:profile:count";

// 하루에 최대 3편이 올라간다. 12시간이면 많아야 1~2개 차이라 매번 물어볼 이유가 없다.
const FRESH_HOURS = 12;

/**
 * 프로필 게시물 수. 셀 수 없으면 null.
 * @param {{refresh?: boolean}} opts refresh=false 면 적어둔 값만 읽는다(인스타에 안 물어봄).
 */
export async function profileCount({ refresh = true } = {}) {
  const cached = await readCache();
  if (cached && cached.ageHours < FRESH_HOURS) return cached.n;
  if (!refresh) return cached?.n ?? null;

  const fresh = await askInstagram();
  // 인스타가 답을 안 하면 마지막으로 센 값을 그대로 쓴다 (없으면 null → 숫자 없는 문구)
  if (fresh == null) return cached?.n ?? null;

  try {
    await kvSet(IG_COUNT_KEY, JSON.stringify({ n: fresh, at: new Date().toISOString() }));
  } catch {
    /* 적어두기 실패는 치명적이지 않다 — 이번 회차 숫자는 이미 손에 있다 */
  }
  return fresh;
}

async function readCache() {
  try {
    const raw = await kvGet(IG_COUNT_KEY);
    if (!raw) return null;
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    const n = Number(v?.n);
    if (!Number.isFinite(n) || n <= 0) return null;
    const t = Date.parse(v?.at ?? "");
    return { n, ageHours: Number.isFinite(t) ? (Date.now() - t) / 3600000 : Infinity };
  } catch {
    return null;
  }
}

async function askInstagram() {
  const id = process.env.INSTAGRAM_ACCOUNT_ID;
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!id || !token) return null;
  try {
    const r = await fetch(
      `https://graph.facebook.com/v21.0/${id}?fields=media_count&access_token=${encodeURIComponent(token)}`,
    );
    const j = await r.json();
    const n = Number(j?.media_count);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// 마지막 카드 문구 — 세 곳(lib/cards.ts · content-factory/cards.mjs · factory/render.mjs)이
// 글자까지 똑같아야 한다. 그림과 목소리가 다른 숫자를 말하면 그게 제일 나쁜 실패다.
// 여기 값을 고치면 저 세 곳을 같이 고친다. (lib/cards.ts 에도 같은 함수가 있다)
// ─────────────────────────────────────────────────────────────
export const CTA_BODY = "저장해두면 필요할 때 꺼내 보고, 팔로우하면 내일 것도 옵니다";

export function ctaTitle(count) {
  return count ? `이런 거,\n프로필에 ${count}개 쌓여 있습니다` : "이상하게 필요한 것들,\n오즈백이 매일 하나씩";
}

export function ctaSay(count) {
  return count
    ? `이런 거, 프로필에 ${count}개 쌓여 있습니다. 오즈백 계정 눌러서 팔로우하고 가세요.`
    : "이런 거 매일 하나씩 올립니다. 오즈백 계정 눌러서 팔로우하고 가세요.";
}
