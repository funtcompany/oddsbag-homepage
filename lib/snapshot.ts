// 발행글 스냅샷 — 레디스가 안 될 때 화면을 채우는 마지막 안전판
//
// 왜 있는가
//   글 본문이 전부 레디스에만 있어서, 레디스가 하루 한도(50만 명령)에 걸리거나
//   잠깐 장애가 나면 목록이 통째로 «아직 올라온 글이 없습니다»가 된다. 실제로 그렇게 됐다.
//   그래서 배포할 때마다 발행글을 파일 한 장으로 함께 실어 보낸다.
//   레디스가 안 되면 이 파일로 렌더한다 — 새 글만 늦게 뜰 뿐, 사이트는 멀쩡히 보인다.
//
// 누가 만드나 : scripts/snapshot.mjs (빌드 직전 prebuild 에서 자동 실행, 명령 4개)
// 어디 있나  : content/published-snapshot.json

import fs from "fs";
import path from "path";
import type { Post } from "@/lib/posts";

const FILE = path.join(process.cwd(), "content", "published-snapshot.json");

interface SnapshotFile {
  at?: string;
  count?: number;
  posts?: Post[];
}

let cached: SnapshotFile | null = null;

function load(): SnapshotFile {
  if (cached) return cached;
  try {
    if (!fs.existsSync(FILE)) return (cached = { posts: [] });
    cached = JSON.parse(fs.readFileSync(FILE, "utf-8")) as SnapshotFile;
    if (!Array.isArray(cached.posts)) cached.posts = [];
  } catch (e) {
    console.warn("스냅샷 읽기 실패:", (e as Error).message);
    cached = { posts: [] };
  }
  return cached;
}

/** 배포에 실린 발행글 (없으면 빈 배열) */
export function readPublishedSnapshot(): Post[] {
  return load().posts ?? [];
}

/** 스냅샷이 언제 것이고 몇 편인지 — 점검 화면용 */
export function snapshotInfo(): { count: number; at: string | null } {
  const s = load();
  return { count: s.posts?.length ?? 0, at: s.at ?? null };
}
