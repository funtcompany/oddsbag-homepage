// ─────────────────────────────────────────────────────────────
//  자료 코드 (시리얼키) — 오즈백 툴즈 «HTML 링크 생성기»
// ─────────────────────────────────────────────────────────────
//
//  ★사장님 결정(2026-08-19): 링크는 이렇게 나간다.
//
//      https://oddsbag.co.kr/service/html-link/K7M2-P94F8XQ2N6VB
//                                              └방문자┘ └─자료코드─┘
//
//     · 앞 4자리 = 그 브라우저의 «방문자 지문». 같은 사람이 만든 링크는 앞이 같다.
//       (소유자 id 에서 해시로 뽑는다 — 저장하지 않아도 늘 같은 값이 나온다)
//     · 뒤 12자리 = 자료마다 새로 뽑는 무작위 시리얼.
//     · 합쳐서 80비트 → 주소를 «찍어서» 남의 자료에 들어오는 것은 불가능하다.
//       (옛 방식은 10자리 hex = 40비트였다)
//
//  ★막는 것과 못 막는 것 — 헷갈리면 안 된다.
//     막는다   — 주소를 모르는 사람이 추측·무차별 대입으로 들어오는 것
//     못 막는다 — 링크를 «받은» 사람이 남에게 전달하는 것
//                 (로그인이 없기 때문이다. 회원가입은 만들지 않기로 결정됐다)
//
//  글자는 Crockford Base32 — I·L·O·U 를 뺐다. 사람이 눈으로 옮겨 적어도 틀리지 않는다.
//  읽을 때는 O→0, I·L→1 로 고쳐 받으므로 잘못 적어도 대개 열린다.

import crypto from "node:crypto";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // 32자 (I, L, O, U 없음)
export const VISITOR_LEN = 4;
export const ITEM_LEN = 12;
export const CODE_LEN = VISITOR_LEN + ITEM_LEN;

/** 바이트를 Crockford Base32 글자로 — 필요한 길이만큼 */
function toBase32(bytes: Buffer, len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i % bytes.length] % 32];
  return out;
}

/** 방문자 지문 4자 — 같은 소유자면 «언제나 같은 값». 따로 저장하지 않는다. */
export function visitorCode(ownerId: string): string {
  const h = crypto.createHash("sha256").update(`htmllink:v1:${ownerId}`).digest();
  return toBase32(h, VISITOR_LEN);
}

/** 자료 시리얼 12자 — 자료마다 새로. 60비트. */
function itemCode(): string {
  return toBase32(crypto.randomBytes(ITEM_LEN), ITEM_LEN);
}

/** 저장용 id (16자, 하이픈 없음) */
export function makeCode(ownerId: string): string {
  return visitorCode(ownerId) + itemCode();
}

/** 주소·화면에 보여줄 모양 — K7M2-P94F8XQ2N6VB */
export function formatCode(code: string): string {
  const c = String(code || "");
  if (c.length !== CODE_LEN) return c; // 옛 자료(10자 hex)는 그대로 둔다
  return `${c.slice(0, VISITOR_LEN)}-${c.slice(VISITOR_LEN)}`;
}

/**
 * 주소에서 받은 글자를 저장용 id 로 되돌린다.
 *  · 하이픈·공백을 지우고 대문자로
 *  · 눈으로 헷갈리는 글자를 고쳐 받는다 (O→0, I·L→1)
 *  · 길이·글자가 맞지 않으면 null → 라우트는 404 를 낸다
 */
export function parseCode(input: string): string | null {
  const c = String(input || "")
    .replace(/[\s-]/g, "")
    .toUpperCase()
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (c.length !== CODE_LEN) return null;
  for (const ch of c) if (!ALPHABET.includes(ch)) return null;
  return c;
}
