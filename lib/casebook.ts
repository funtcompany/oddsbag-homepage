// 케이스북 읽기 — 서버 전용 (fs 를 쓴다)
//
// data/casebook/*.json 을 읽어 「챙길 것」 이 쓸 모양(CheckCard)으로 바꾼다.
// 바꾸는 «규칙» 은 lib/casebook-shape.ts 에 있다 (서버 없이 시험하려고 갈라 뒀다).

import fs from "fs";
import path from "path";
import vocab from "@/data/casebook-vocab.json";
import { postUrl } from "@/lib/channels";
import { getVisiblePosts } from "@/lib/posts";
import { toCard, type RawCase } from "@/lib/casebook-shape";
import { ymdKST, type CheckCard, type HaveOption } from "@/lib/checklist";

const CASEBOOK_DIR = path.join(process.cwd(), "data", "casebook");

export type { HaveOption };

export const haveOptions: HaveOption[] = vocab.have;

function readRaw(): RawCase[] {
  if (!fs.existsSync(CASEBOOK_DIR)) return [];
  const out: RawCase[] = [];
  for (const f of fs.readdirSync(CASEBOOK_DIR)) {
    // «_» 로 시작하는 것은 어휘표·메모라 항목이 아니다. «._» 는 외장하드가 남기는 찌꺼기다.
    if (!f.endsWith(".json") || f.startsWith("_") || f.startsWith("._")) continue;
    try {
      out.push(JSON.parse(fs.readFileSync(path.join(CASEBOOK_DIR, f), "utf-8")) as RawCase);
    } catch {
      // 한 건이 깨져도 도구 전체가 죽지는 않게 한다 (검사기가 따로 잡는다)
      console.warn(`케이스북을 못 읽었다: ${f}`);
    }
  }
  return out;
}

/** 도구에 내보낼 카드 전부 */
export async function getCheckCards(): Promise<CheckCard[]> {
  const 오늘 = ymdKST();
  const 아는것 = new Set(haveOptions.map((h) => h.id));

  // 케이스북 id 와 같은 slug 의 발행글이 있으면 「자세히」로 이어 준다
  const 글주소 = new Map<string, string>();
  try {
    for (const p of await getVisiblePosts()) 글주소.set(p.slug, postUrl(p));
  } catch {
    console.warn("발행글 목록을 못 읽어 「자세히」 링크 없이 간다");
  }

  return readRaw()
    .map((c) => toCard(c, 아는것, 글주소, 오늘))
    .filter((c): c is CheckCard => c !== null);
}
