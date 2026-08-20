// 오즈백 툴즈 «HTML 링크 생성기» 저장소
//
//  ★2026-08-21 개편 — 레디스를 완전히 떼어냈다.
//     전에는 메타(제목·소유자·크기)만 레디스에 있었는데, 레디스 월 한도(50만)가 터지면
//     본문이 Blob 에 멀쩡히 있어도 «자료를 못 찾는» 상태가 됐다. 도구 전체가 500 으로 죽었다.
//     이제 본문과 메타가 같은 곳(Blob)에 나란히 있어, 이 도구는 레디스와 무관하게 돈다.
//
//  HTML 본문 → Blob  htmllink/<id>.html   (토큰 없으면 로컬 .data/htmllink/<id>.html)
//  메타       → Blob  htmllink/<id>.json   (토큰 없으면 로컬 .data/htmllink/<id>.json)
//
//  ★Blob 은 «private» 저장소다 (2026-08-19 운영에서 확인).
//     public 으로 올리려 하면 «Cannot use public access on a private store» 로 막힌다.
//     private 가 이 도구에 오히려 맞다 — 본문이 blob 공개주소로 새지 않고,
//     반드시 우리 뷰어([code])를 거치므로 거기 씌운 sandbox 를 우회할 길이 없다.
//
//  ★목록을 어떻게 뽑나 — id 앞 4자리가 곧 «방문자 지문»이다(htmllink-code.ts).
//     그래서 list({ prefix: "htmllink/<지문>" }) 하면 그 사람 것만 좁혀서 가져온다.
//     지문은 4자(32^4≈100만)라 다른 사람과 겹칠 수 있으므로 ownerId 로 «한 번 더» 거른다.

import { put, del, get, list } from "@vercel/blob";
import { promises as fs } from "fs";
import path from "path";
import { makeCode, visitorCode } from "@/lib/htmllink-code";

// 일반 방문자 업로드 상한 (관리자는 무제한). 사장님 결정 c, 2026-08-19.
export const VISITOR_UPLOAD_LIMIT = 5;

export interface HtmlLinkMeta {
  id: string;
  ownerId: string;
  title: string;
  createdAt: string; // ISO
  size: number; // bytes
}

const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
// 저장소가 private 로 만들어져 있다. 올릴 때와 읽을 때가 «같아야» 한다 → 한 곳에서 정한다.
const BLOB_ACCESS = "private" as const;
// Vercel 서버는 파일시스템이 «읽기 전용»이라 .data/ 폴백이 통하지 않는다.
//  Blob 토큰 없이 배포하면 업로드가 알 수 없는 500 으로 죽는다 → 원인을 말해 주는 오류로 바꾼다.
const onServerless = process.env.VERCEL === "1" || !!process.env.VERCEL_ENV;
const DATA_DIR = path.join(process.cwd(), ".data", "htmllink");
const PREFIX = "htmllink/";

const bodyBlob = (id: string) => `${PREFIX}${id}.html`;
const metaBlob = (id: string) => `${PREFIX}${id}.json`;
const bodyLocal = (id: string) => path.join(DATA_DIR, `${id}.html`);
const metaLocal = (id: string) => path.join(DATA_DIR, `${id}.json`);

const safeId = (id: string) => /^[a-zA-Z0-9_-]+$/.test(id);

/** 운영에서 저장이 «아예 불가능한» 상태인지 — 라우트가 사람 말로 안내하는 데 쓴다. */
export function storeReady(): boolean {
  return useBlob || !onServerless;
}

// ── Blob/파일 공통 읽고 쓰기 ──
async function writeBlob(p: string, body: string, contentType: string): Promise<void> {
  await put(p, body, {
    access: BLOB_ACCESS,
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

async function readBlob(p: string): Promise<string | null> {
  // useCache:false — 방금 올린 것을 바로 열어도 옛 내용이 나오지 않게
  const found = await get(p, { access: BLOB_ACCESS, useCache: false });
  if (!found) return null;
  return await new Response(found.stream).text();
}

async function readLocal(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, "utf8");
  } catch {
    return null;
  }
}

// ── 본문 ──
async function saveBody(id: string, html: string): Promise<void> {
  if (useBlob) {
    await writeBlob(bodyBlob(id), html, "text/html; charset=utf-8");
    return;
  }
  if (onServerless) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN 이 없습니다. Vercel 프로젝트에 Blob 저장소를 연결해 주세요 " +
        "(운영 서버는 파일로 저장할 수 없습니다).",
    );
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(bodyLocal(id), html, "utf8");
}

export async function getBody(id: string): Promise<string | null> {
  if (!safeId(id)) return null;
  return useBlob ? readBlob(bodyBlob(id)) : readLocal(bodyLocal(id));
}

// ── 메타 ──
export async function getMeta(id: string): Promise<HtmlLinkMeta | null> {
  if (!safeId(id)) return null;
  const raw = useBlob ? await readBlob(metaBlob(id)) : await readLocal(metaLocal(id));
  if (!raw) return null;
  try {
    const m = JSON.parse(raw) as HtmlLinkMeta;
    return m && typeof m.id === "string" ? m : null;
  } catch {
    return null; // 깨진 메타는 «없는 것»으로 — 여기서 던지면 목록 전체가 죽는다
  }
}

async function putMeta(meta: HtmlLinkMeta): Promise<void> {
  const raw = JSON.stringify(meta);
  if (useBlob) {
    await writeBlob(metaBlob(meta.id), raw, "application/json; charset=utf-8");
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(metaLocal(meta.id), raw, "utf8");
}

// ── 만들기 ──
export async function createItem(
  ownerId: string,
  title: string,
  html: string,
): Promise<HtmlLinkMeta> {
  // ★사장님 결정(2026-08-19) — 시리얼키 방식. 방문자 지문 4자 + 자료 시리얼 12자 = 80비트.
  //   lib/htmllink-code.ts 참고.
  const id = makeCode(ownerId);
  const meta: HtmlLinkMeta = {
    id,
    ownerId,
    title: (title || "제목 없는 자료").slice(0, 120),
    createdAt: new Date().toISOString(),
    size: Buffer.byteLength(html, "utf8"),
  };
  // 본문 먼저 — 메타만 남고 본문이 없는 «빈 링크»가 생기지 않게
  await saveBody(id, html);
  await putMeta(meta);
  return meta;
}

// ── 그 사람 자료의 id 목록 (메타는 아직 안 읽음) ──
async function idsByOwner(ownerId: string): Promise<string[]> {
  if (useBlob) {
    const { blobs } = await list({ prefix: PREFIX + visitorCode(ownerId), limit: 1000 });
    return blobs
      .map((b) => b.pathname)
      .filter((p) => p.startsWith(PREFIX) && p.endsWith(".json"))
      .map((p) => p.slice(PREFIX.length, -".json".length));
  }
  const files = await fs.readdir(DATA_DIR).catch(() => [] as string[]);
  return files.filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -".json".length));
}

// ── 소유자별 목록 (최신순) ──
export async function listByOwner(ownerId: string): Promise<HtmlLinkMeta[]> {
  const ids = await idsByOwner(ownerId);
  const metas = await Promise.all(ids.map((id) => getMeta(id)));
  return metas
    .filter((m): m is HtmlLinkMeta => !!m && m.ownerId === ownerId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// ── 소유자가 올린 자료 개수 (상한 검사용) ──
export async function countByOwner(ownerId: string): Promise<number> {
  return (await listByOwner(ownerId)).length;
}

// ── 이름 변경 (소유자 확인은 호출부에서) ──
export async function renameItem(id: string, title: string): Promise<HtmlLinkMeta | null> {
  const meta = await getMeta(id);
  if (!meta) return null;
  meta.title = (title || meta.title).slice(0, 120);
  await putMeta(meta);
  return meta;
}

// ── 삭제 (본문 + 메타) ──
export async function deleteItem(id: string): Promise<void> {
  if (!safeId(id)) return;
  if (useBlob) {
    // pathname 을 그대로 넘길 수 있다 — 목록을 훑을 필요가 없다.
    //  ★한쪽이 이미 없어도(옛 자료·중간에 끊긴 업로드) 나머지는 지워져야 한다 → 따로 지운다.
    for (const p of [bodyBlob(id), metaBlob(id)]) {
      try {
        await del(p);
      } catch (e) {
        console.error("[htmllink] 삭제 실패(넘어감)", p, e);
      }
    }
    return;
  }
  await fs.rm(bodyLocal(id), { force: true });
  await fs.rm(metaLocal(id), { force: true });
}
