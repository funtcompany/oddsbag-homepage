// 오즈백 툴즈 «HTML 링크 생성기» 저장소
//
//  메타(제목·소유자·공유토큰 등)  → Redis (lib/store.ts 재사용, 없으면 메모리 폴백)
//  HTML 본문                       → Vercel Blob (BLOB_READ_WRITE_TOKEN 있을 때)
//                                     없으면 로컬 .data/htmllink/<id>.html 파일 (토큰 없이 로컬 시험)
//
//  Redis 키 구조
//    htmllink:meta:<id>        → 메타 JSON 한 건
//    htmllink:owner:<ownerId>  → 그 사람이 올린 id 들의 집합(SET)
//    htmllink:share:<token>    → 공유토큰 → id (역색인)

import crypto from "crypto";
import { put, del, list } from "@vercel/blob";
import { promises as fs } from "fs";
import path from "path";
import { kvGet, kvSet, kvDel, sadd, srem, smembers, scard } from "@/lib/store";

// 일반 방문자 업로드 상한 (관리자는 무제한). 사장님 결정 c, 2026-08-19.
export const VISITOR_UPLOAD_LIMIT = 5;

export interface HtmlLinkMeta {
  id: string;
  ownerId: string;
  title: string;
  createdAt: string; // ISO
  size: number; // bytes
  shareToken: string | null; // 공유 켜짐 = 토큰 있음
}

const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
// Vercel 서버는 파일시스템이 «읽기 전용»이라 .data/ 폴백이 통하지 않는다.
//  Blob 토큰 없이 배포하면 업로드가 알 수 없는 500 으로 죽는다 → 원인을 말해 주는 오류로 바꾼다.
const onServerless = process.env.VERCEL === "1" || !!process.env.VERCEL_ENV;
const DATA_DIR = path.join(process.cwd(), ".data", "htmllink");
const blobPath = (id: string) => `htmllink/${id}.html`;
const localPath = (id: string) => path.join(DATA_DIR, `${id}.html`);

const metaKey = (id: string) => `htmllink:meta:${id}`;
const ownerKey = (ownerId: string) => `htmllink:owner:${ownerId}`;
const shareKey = (token: string) => `htmllink:share:${token}`;

const safeId = (id: string) => /^[a-zA-Z0-9_-]+$/.test(id);

// ── 본문 저장/읽기/삭제 ──
async function saveBody(id: string, html: string): Promise<void> {
  if (useBlob) {
    await put(blobPath(id), html, {
      access: "public",
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
    const { blobs } = await list({ prefix: blobPath(id), limit: 1 });
    const hit = blobs.find((b) => b.pathname === blobPath(id));
    if (!hit) return null;
    const res = await fetch(hit.url, { cache: "no-store" });
    return res.ok ? await res.text() : null;
  }
  try {
    return await fs.readFile(localPath(id), "utf8");
  } catch {
    return null;
  }
}

async function deleteBody(id: string): Promise<void> {
  if (useBlob) {
    const { blobs } = await list({ prefix: blobPath(id) });
    const urls = blobs.map((b) => b.url);
    if (urls.length) await del(urls);
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
  const id = crypto.randomBytes(5).toString("hex"); // 10자
  const meta: HtmlLinkMeta = {
    id,
    ownerId,
    title: (title || "제목 없는 자료").slice(0, 120),
    createdAt: new Date().toISOString(),
    size: Buffer.byteLength(html, "utf8"),
    shareToken: null,
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

// ── 공유 켜기/끄기 ──
export async function setShare(id: string, on: boolean): Promise<HtmlLinkMeta | null> {
  const meta = await getMeta(id);
  if (!meta) return null;
  if (on) {
    if (!meta.shareToken) {
      const token = crypto.randomBytes(12).toString("hex"); // 24자, 추측 어려움
      meta.shareToken = token;
      await kvSet(shareKey(token), id);
    }
  } else if (meta.shareToken) {
    await kvDel(shareKey(meta.shareToken));
    meta.shareToken = null;
  }
  await putMeta(meta);
  return meta;
}

// ── 공유토큰으로 찾기 (비회원 열람) ──
export async function getByShareToken(token: string): Promise<HtmlLinkMeta | null> {
  if (!token || !/^[a-f0-9]+$/.test(token)) return null;
  const id = await kvGet(shareKey(token));
  if (!id) return null;
  const meta = await getMeta(id);
  // 역색인이 낡았을 수 있으니 실제 메타의 토큰과 일치할 때만 인정
  return meta && meta.shareToken === token ? meta : null;
}

// ── 삭제 (본문 + 메타 + 소유자색인 + 공유색인) ──
export async function deleteItem(id: string): Promise<void> {
  const meta = await getMeta(id);
  await deleteBody(id);
  await kvDel(metaKey(id));
  if (meta) {
    await srem(ownerKey(meta.ownerId), id);
    if (meta.shareToken) await kvDel(shareKey(meta.shareToken));
  }
}
