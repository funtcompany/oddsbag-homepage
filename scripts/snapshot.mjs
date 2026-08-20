#!/usr/bin/env node
// 발행글 스냅샷 만들기 — content/published-snapshot.json
//
// 왜 : 글 본문이 전부 레디스에만 있어서, 레디스가 하루 한도(50만 명령)에 걸리면
//      매거진이 통째로 «아직 올라온 글이 없습니다»가 된다 (2026-08-20 실제로 그랬다).
//      배포마다 발행글을 파일 한 장으로 함께 실어 두면, 레디스가 죽어도 사이트는 그대로 보인다.
//
// 값 : 명령 4개 (SMEMBERS 1 + MGET 3). 하루 한도의 0.0008%.
// 언제 : npm run build 직전(prebuild)에 자동. 손으로 돌리려면 `npm run snapshot`
//
// ★안전장치 — 아래 경우엔 기존 스냅샷을 «건드리지 않고» 그냥 끝낸다(빌드는 계속된다).
//   · 레디스 환경변수가 없을 때        → 로컬 빌드에서 운영 레디스를 안 건드리는 규칙과 맞춘다
//   · 레디스가 한도·장애로 안 읽힐 때   → 빈 스냅샷으로 덮어쓰면 그게 바로 사고다
//   · 읽은 편수가 기존의 절반도 안 될 때 → 사고 난 자료로 멀쩡한 스냅샷을 덮지 않는다

import fs from "fs";
import path from "path";

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const OUT = path.join(process.cwd(), "content", "published-snapshot.json");
const CHUNK = 50;

const done = (msg) => {
  console.log(`[스냅샷] ${msg}`);
  process.exit(0); // ★무슨 일이 있어도 빌드를 세우지 않는다
};

async function redis(command) {
  const res = await fetch(URL_, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(text.slice(0, 200) || `HTTP ${res.status}`);
  }
  if (data.error) throw new Error(data.error);
  return data.result;
}

function existing() {
  try {
    const j = JSON.parse(fs.readFileSync(OUT, "utf-8"));
    return Array.isArray(j.posts) ? j.posts.length : 0;
  } catch {
    return 0;
  }
}

async function main() {
  if (!URL_ || !TOKEN) {
    done(`레디스 환경변수가 없어 건너뜀 (기존 스냅샷 ${existing()}편 그대로)`);
  }

  const had = existing();
  let slugs;
  try {
    slugs = (await redis(["SMEMBERS", "posts:published"])) ?? [];
  } catch (e) {
    done(`레디스를 못 읽어 건너뜀 (${e.message}) — 기존 ${had}편 그대로`);
  }

  const posts = [];
  try {
    for (let i = 0; i < slugs.length; i += CHUNK) {
      const chunk = slugs.slice(i, i + CHUNK);
      const raws =
        (await redis(["MGET", ...chunk.map((s) => `post:${s}`)])) ?? [];
      for (const r of raws) {
        if (!r) continue;
        try {
          posts.push(JSON.parse(r));
        } catch {
          /* 깨진 글 한 편은 건너뛴다 */
        }
      }
    }
  } catch (e) {
    done(`읽는 중 끊겨 건너뜀 (${e.message}) — 기존 ${had}편 그대로`);
  }

  if (posts.length === 0) {
    done(`읽은 글이 0편이라 건너뜀 — 기존 ${had}편 그대로`);
  }
  if (had > 0 && posts.length < had * 0.5) {
    done(`${posts.length}편은 기존 ${had}편의 절반도 안 돼 건너뜀 (자료 사고 의심)`);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  // ★글 한 편을 한 줄로 적는다.
  //   이 파일은 매일 레포에 커밋된다(snapshot-daily.yml). 전부 한 줄이면 한 글자만 바뀌어도
  //   깃이 «700KB 통째로 바뀜»으로 기록해 레포가 해마다 수백 MB 로 분다.
  //   한 편 한 줄이면 바뀐 글만 기록된다. 읽는 쪽은 그냥 JSON.parse 라 달라지는 게 없다.
  const body =
    `{"at":${JSON.stringify(new Date().toISOString())},` +
    `"count":${posts.length},"posts":[\n` +
    posts.map((p) => JSON.stringify(p)).join(",\n") +
    `\n]}\n`;
  fs.writeFileSync(OUT, body);
  const kb = Math.round(fs.statSync(OUT).size / 1024);
  done(`${posts.length}편 저장 (${kb}KB, 명령 ${1 + Math.ceil(slugs.length / CHUNK)}개)`);
}

main().catch((e) => done(`예상 못 한 오류로 건너뜀: ${e.message}`));
