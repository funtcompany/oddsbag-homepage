// 오즈백 툴즈 «HTML 링크 생성기» 저장소
//
//  메타(제목·소유자·크기 등)    → Redis (lib/store.ts 재사용, 없으면 메모리 폴백)
//  HTML 본문                       → Vercel Blob (BLOB_READ_WRITE_TOKEN 있을 때)
//                                     없으면 로컬 .data/htmllink/<id>.html 파일 (토큰 없이 로컬 시험)
//
//  ★Blob 은 «private» 저장소다 (2026-08-19 운영에서 확인).
//     public 으로 올리려 하면 «Cannot use public access on a private store» 로 막힌다.
//     private 가 이 도구에 오히려 맞다 — 본문이 blob 공개주소로 새지 않고,
//     반드시 우리 뷰어([code])를 거치므로 거기 씌운 sandbox 를 우회할 길이 없다.
//
//  Redis 키 구조
//    htmllink:meta:<id>        → 메타 JSON 한 건
//    htmllink:owner:<ownerId>  → 그 사람이 올린 id 들의 집합(SET)

import { put, del, get } from "@vercel/blob";
import { promises as fs } from "fs";
import path from "path";
import { kvGet, kvSet, kvDel, sadd, srem, smembers, scard } from "@/lib/store";
import { makeCode } from "@/lib/htmllink-code";

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
const blobPath = (id: string) => `htmllink/${id}.html`;
const localPath = (id: string) => path.join(DATA_DIR, `${id}.html`);

const metaKey = (id: string) => `htmllink:meta:${id}`;
const ownerKey = (ownerId: string) => `htmllink:owner:${ownerId}`;

const safeId = (id: string) => /^[a-zA-Z0-9_-]+$/.test(id);

// ── 본문 저장/읽기/삭제 ──
async function saveBody(id: string, html: string): Promise<void> {
  if (useBlob) {
    await put(blobPath(id), html, {
      access: BLOB_ACCESS,
      contentType: "text/html; charset=utf-8",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  } else {
    if (onServerless) {
      throw new Error(
        "BLOB_READ_WRITE_TOKEN 이 없습니다. Vercel 프로젝트에 Blob 저장소를 연결해 주세요 " +
          "(운영 서버는 파일로 저장할 수 없습니다).",
      );
    }
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(localPath(id), html, "utf8");
  }
}

export async function getBody(id: string): Promise<string | null> {
  if (!safeId(id)) return null;
  if (useBlob) {
    // useCache:false — 방금 올린 것을 바로 열어도 옛 내용이 나오지 않게
    const found = await get(blobPath(id), { access: BLOB_ACCESS, useCache: false });
    if (!found) return null;
    return await new Response(found.stream).text();
  }
  try {
    return await fs.readFile(localPath(id), "utf8");
  } catch {
    return null;
  }
}

async function deleteBody(id: string): Promise<void> {
  if (useBlob) {
    // pathname 을 그대로 넘길 수 있다 — 목록을 훑을 필요가 없다
    await del(blobPath(id));
  } else {
    await fs.rm(localPath(id), { force: true });
  }
}

// ── 메타 ──
export async function getMeta(id: string): Promise<HtmlLinkMeta | null> {
  if (!safeId(id)) return null;
  const raw = await kvGet(metaKey(id));
  return raw ? (JSON.parse(raw) as HtmlLinkMeta) : null;
}

async function putMeta(meta: HtmlLinkMeta): Promise<void> {
  await kvSet(metaKey(meta.id), JSON.stringify(meta));
}

// ── 만들기 ──
export async function createItem(
  ownerId: string,
  title: string,
  html: string,
): Promise<HtmlLinkMeta> {
  // ★사장님 결정(2026-08-19) — 시리얼키 방식. 방문자 지문 4자 + 자료 시리얼 12자 = 80비트.
  //   옛 방식은 randomBytes(5) = 10자 hex(40비트)였다. lib/htmllink-code.ts 참고.
  const id = makeCode(ownerId);
  const meta: HtmlLinkMeta = {
    id,
    ownerId,
    title: (title || "제목 없는 자료").slice(0, 120),
    createdAt: new Date().toISOString(),
    size: Buffer.byteLength(html, "utf8"),
  };
  await saveBody(id, html);
  await putMeta(meta);
  await sadd(ownerKey(ownerId), id);
  return meta;
}

// ── 소유자가 올린 자료 개수 (상한 검사용) ──
export async function countByOwner(ownerId: string): Promise<number> {
  return scard(ownerKey(ownerId));
}

// ── 소유자별 목록 (최신순) ──
export async function listByOwner(ownerId: string): Promise<HtmlLinkMeta[]> {
  const ids = await smembers(ownerKey(ownerId));
  const metas = await Promise.all(ids.map((id) => getMeta(id)));
  return metas
    .filter((m): m is HtmlLinkMeta => !!m && m.ownerId === ownerId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// ── 이름 변경 (소유자 확인은 호출부에서) ──
export async function renameItem(id: string, title: string): Promise<HtmlLinkMeta | null> {
  const meta = await getMeta(id);
  if (!meta) return null;
  meta.title = (title || meta.title).slice(0, 120);
  await putMeta(meta);
  return meta;
}

// ── 삭제 (본문 + 메타 + 소유자색인) ──
export async function deleteItem(id: string): Promise<void> {
  const meta = await getMeta(id);
  await deleteBody(id);
  await kvDel(metaKey(id));
  if (meta) {
    await srem(ownerKey(meta.ownerId), id);
  }
}
