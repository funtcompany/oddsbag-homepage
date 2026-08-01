// 옛 영상 폐기 — 하루에 딱 한 편씩, 오래된 것부터 조용히 내린다.
//
// 왜 하루 한 편인가: 24편을 한 번에 지우면 채널 조회수의 79%가 하루아침에 사라진다.
//   유튜브 입장에서도 갑작스러운 대량 삭제는 좋을 게 없다. 그래서 천천히 뺀다.
//
// 무엇을 지우나: 2026-07-29 화면 수정 이전에 만들어진 영상들.
//   · 사진 없는 옛 디자인 (아래 40%가 빈 공간)
//   · 소제목 잘림(…), 번호 중복(배지 01 + 제목 1.)
//   지운 글은 다시 만들지 않는다 (사장님 지시 2026-08-01). 대기줄에서도 뺀다.
//   홈페이지 글은 건드리지 않는다 — 영상만 내린다.
//
// 대기줄: reels:retire (Redis LIST) — 앞에서부터 하나씩 꺼내 쓴다. 비면 아무것도 안 한다.
//
// 실행:  node retire-old.mjs           → 모의실행 (무엇을 지울지 보여주기만)
//        APPLY=1 node retire-old.mjs   → 실제 삭제
import { lrange, lpop, llen, srem } from "./redis.mjs";

const APPLY = process.env.APPLY === "1";
const PER_RUN = Number(process.env.RETIRE_PER_RUN || 1);
const IG = process.env.INSTAGRAM_ACCOUNT_ID;
const TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const G = "https://graph.facebook.com/v21.0";
const Y = "https://www.googleapis.com/youtube/v3";

const norm = (s) => String(s || "").replace(/\s+/g, "").replace(/#shorts$/i, "").toLowerCase();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ytToken() {
  const r = await (
    await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: process.env.YOUTUBE_CLIENT_ID,
        client_secret: process.env.YOUTUBE_CLIENT_SECRET,
        refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
    })
  ).json();
  if (!r.access_token) throw new Error("유튜브 토큰 실패: " + JSON.stringify(r).slice(0, 120));
  return r.access_token;
}

// 인스타/페북에서 같은 글의 게시물을 찾는다 (첫 줄이 훅과 같은 것)
async function findSocial(lead) {
  const found = { ig: null, fb: null, fbToken: TOKEN };
  if (!TOKEN || !lead) return found;
  const match = (first) => first && (first === lead || first.startsWith(lead.slice(0, 12)));
  try {
    let url = `${G}/${IG}/media?fields=id,caption&limit=100&access_token=${TOKEN}`;
    while (url && !found.ig) {
      const j = await (await fetch(url)).json();
      const hit = (j.data || []).find((m) => match(norm((m.caption || "").split("\n")[0])));
      if (hit) found.ig = hit.id;
      url = j.paging?.next || "";
    }
  } catch { /* 인스타를 못 찾아도 유튜브 삭제는 계속한다 */ }
  try {
    const pid = process.env.FACEBOOK_PAGE_ID
      || (await (await fetch(`${G}/me?fields=id&access_token=${TOKEN}`)).json()).id;
    const pt = (await (await fetch(`${G}/${pid}?fields=access_token&access_token=${TOKEN}`)).json()).access_token || TOKEN;
    found.fbToken = pt;
    let url = `${G}/${pid}/videos?fields=id,description&limit=100&access_token=${pt}`;
    while (url && !found.fb) {
      const j = await (await fetch(url)).json();
      const hit = (j.data || []).find((v) => match(norm((v.description || "").split("\n")[0])));
      if (hit) found.fb = hit.id;
      url = j.paging?.next || "";
    }
  } catch { /* 페북도 마찬가지 */ }
  return found;
}

async function main() {
  const total = await llen("reels:retire");
  if (!total) {
    console.log("폐기 대기줄이 비었습니다 — 할 일 없음.");
    return;
  }
  const batch = (await lrange("reels:retire", 0, PER_RUN - 1)).map((r) => JSON.parse(r));
  console.log(`폐기 대기 ${total}편 · 이번에 ${batch.length}편 · ${APPLY ? "실제 삭제" : "모의실행(APPLY=1 로 실제 삭제)"}\n`);

  const tok = APPLY ? await ytToken() : null;

  for (const item of batch) {
    console.log(`▶ ${item.at?.slice(0, 10)} 조회 ${item.views} · ${item.title}`);
    const social = await findSocial(norm(item.hook || item.title));
    console.log(`   유튜브 ${item.yt} · 인스타 ${social.ig ?? "못찾음"} · 페북 ${social.fb ?? "못찾음"}`);

    if (!APPLY) continue;

    const r = await fetch(`${Y}/videos?id=${item.yt}`, { method: "DELETE", headers: { Authorization: `Bearer ${tok}` } });
    console.log(`   유튜브 삭제: ${r.status === 204 ? "OK" : (r.status === 404 ? "이미 없음" : await r.text())}`);
    await sleep(200);

    if (social.ig) {
      const j = await (await fetch(`${G}/${social.ig}?access_token=${TOKEN}`, { method: "DELETE" })).json();
      console.log(`   인스타 삭제: ${JSON.stringify(j).slice(0, 60)}`);
      await sleep(200);
    }
    if (social.fb) {
      const j = await (await fetch(`${G}/${social.fb}?access_token=${social.fbToken}`, { method: "DELETE" })).json();
      console.log(`   페북 삭제: ${JSON.stringify(j).slice(0, 60)}`);
      await sleep(200);
    }

    // 다시 만들지 않는다 — 완료 표시와 재제작 대기줄 양쪽에서 뺀다
    if (item.slug) {
      await srem("reels:done", item.slug);
      await srem("reels:priority", item.slug);
    }
    await lpop("reels:retire");
    console.log(`   완료 — 남은 대기 ${await llen("reels:retire")}편\n`);
  }

  if (!APPLY) console.log("\n(모의실행 — 실제로는 아무것도 지우지 않았습니다)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
