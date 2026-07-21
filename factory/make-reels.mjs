// 오즈백 영상 공장 (자립형) — GitHub Actions에서 실행. Vercel/홈페이지에 의존하지 않는다.
//  1) DB(Upstash Redis)에서 발행글을 직접 읽어 오늘 만들 글을 고른다
//  2) 카드 구성 + 나레이션(구글 Chirp3-HD)
//  3) 세로화면(1080×1920)을 공장 안에서 직접 렌더 (satori+resvg)
//  4) ffmpeg로 이어붙이고 트렌디 BGM(은은한 고정 볼륨) 믹스 → mp4
//  5) (선택) 유튜브 쇼츠 + 인스타 릴스 게시
//  6) 완료를 DB에 기록(reels:done) → 중복 제작 방지
//
// 환경변수(GitHub Secrets): UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, GOOGLE_TTS_API_KEY
//   (선택) ODDS_VOICE, YT_PRIVACY, REEL_LIMIT, 유튜브/인스타 게시 자격증명

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { smembers, sadd, getJSON, redisReady } from "./redis.mjs";
import { makeMusic, writeWav, pickBgm } from "./music.mjs";
import { uploadShort, setThumbnail, addToCategoryPlaylist } from "./youtube.mjs";
import { postReel } from "./instagram.mjs";
import { postVideo } from "./facebook.mjs";
import { uploadPublic } from "./host.mjs";
import { hashtags, keywords } from "./hashtags.mjs";
import { findBrollForCategory, downloadBroll, brollCredit } from "./pexels.mjs";
import { buildCards, reelSay, paletteFor, loadFontsForPost, renderFrame, ENTER_FRAMES, FPS } from "./render.mjs";

const TTS_KEY = process.env.GOOGLE_TTS_API_KEY;
const VOICE = process.env.ODDS_VOICE || "ko-KR-Chirp3-HD-Aoede";
const RATE = Number(process.env.ODDS_RATE || 1.0); // 배속 (1.0=기본, 낮을수록 차분)
const COMMA_MS = Number(process.env.ODDS_COMMA_MS || 300);  // 쉼표 쉼
const PERIOD_MS = Number(process.env.ODDS_PERIOD_MS || 500); // 문장 끝 쉼
const LIMIT = Number(process.env.REEL_LIMIT || 1);
const YT_PRIVACY = process.env.YT_PRIVACY || "public";
const OUT = path.resolve("out");
fs.mkdirSync(OUT, { recursive: true });
const K_PUB = "posts:published", DONE = "reels:done";
const sh = (c) => execSync(c, { stdio: "inherit" });
const probe = (f) => parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${f}"`).toString().trim());

// 자연스러운 '끊어읽기': 문장부호에서 쉼(break)을 준다. 붙여읽으면 뭉개져 들리므로 쉼이 핵심.
function ssmlFor(text) {
  let t = text.replace(/\s+/g, " ").trim();
  t = t.replace(/([·ㆍ/])/g, ", ");                 // 가운뎃점·슬래시 → 쉼
  t = t.replace(/["'"'「」『』]/g, "");                // 따옴표 제거(어색한 끊김 방지)
  if (!/[.!?…]$/.test(t)) t += ".";                  // 문장 끝 마침표 → 마무리 억양
  const esc = t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const b = esc.replace(/([,])\s*/g, `$1<break time="${COMMA_MS}ms"/>`).replace(/([.!?…])\s+/g, `$1<break time="${PERIOD_MS}ms"/>`);
  return `<speak>${b}</speak>`;
}
async function tts(text, outPath) {
  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${TTS_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: { ssml: ssmlFor(text) }, voice: { languageCode: "ko-KR", name: VOICE }, audioConfig: { audioEncoding: "MP3", speakingRate: RATE } }),
  });
  const j = await res.json();
  if (!j.audioContent) throw new Error("TTS 실패: " + JSON.stringify(j).slice(0, 200));
  fs.writeFileSync(outPath, Buffer.from(j.audioContent, "base64"));
}

// 오늘 만들 글 선정: 발행글 중 아직 릴스 없는 것, 최신 우선
async function pickPending(limit) {
  const [pubSlugs, doneArr] = await Promise.all([smembers(K_PUB), smembers(DONE)]);
  const done = new Set(doneArr || []);
  const fresh = (pubSlugs || []).filter((s) => !done.has(s));
  const posts = (await Promise.all(fresh.map((s) => getJSON(`post:${s}`)))).filter(Boolean).filter((p) => p.status === "published");
  posts.sort((a, b) => (b.publishedAt ?? b.date ?? "").localeCompare(a.publishedAt ?? a.date ?? ""));
  return posts.slice(0, limit);
}

async function buildReel(post) {
  const slug = post.slug;
  const work = path.join(OUT, slug);
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  console.log(`\n▶ ${slug} — ${post.title}`);

  const cards = buildCards(post);
  const pal = paletteFor(post.slug, post.mood);

  // B-roll 배경(선택): 저작권 안전한 Pexels 무료 영상. 못 찾으면 조용히 타이포로 폴백.
  let brollFile = null, brollDur = 0, renderOpts = {};
  if (process.env.USE_BROLL === "1" && process.env.PEXELS_API_KEY) {
    try {
      const b = await findBrollForCategory(post.category, (post.tags || [])[0]);
      if (b) {
        brollFile = path.join(work, "broll.mp4");
        await downloadBroll(b.link, brollFile);
        brollDur = b.duration;
        renderOpts = { transparent: true, credit: brollCredit(b).caption };
        console.log(`  · 배경영상: "${b.query}" (${b.author} / Pexels, ${b.duration}s)`);
      }
    } catch (e) { console.log("  · 배경영상 건너뜀(타이포로 진행):", e.message); }
  }

  const fonts = await loadFontsForPost(cards, renderOpts.credit || ""); // 출처 글자도 폰트에 포함(깨짐 방지)

  // 나레이션 + 카드 길이
  let acc = 0;
  for (let i = 0; i < cards.length; i++) {
    const mp3 = path.join(work, `n${i}.mp3`);
    await tts(reelSay(cards[i]), mp3);
    cards[i].narr = mp3;
    cards[i].dur = Math.max(2.6, probe(mp3) + 0.75);
    acc += cards[i].dur;
  }
  // 숏폼 상한(기본 40초): 초과하면 뒤쪽 포인트/정리 카드부터 덜어낸다(훅·무슨일이냐·CTA는 유지)
  const MAX_SEC = Number(process.env.MAX_REEL_SEC || 40);
  while (acc > MAX_SEC && cards.length > 3) {
    let idx = -1;
    for (let i = cards.length - 2; i >= 2; i--) { if (["point", "quote"].includes(cards[i].kind)) { idx = i; break; } }
    if (idx < 0) break;
    acc -= cards[idx].dur; cards.splice(idx, 1);
  }
  const total = cards.length;
  const offsets = []; let a2 = 0;
  for (const c of cards) { offsets.push(a2); a2 += c.dur; }
  const totalDur = a2;
  console.log(`  · 길이 ${totalDur.toFixed(1)}초 · 카드 ${total}장`);

  // 프레임 자체 렌더 + 카드별 클립
  const clips = [];
  for (let c = 0; c < total; c++) {
    const cdir = path.join(work, `c${c}`); fs.mkdirSync(cdir, { recursive: true });
    for (let f = 0; f < ENTER_FRAMES; f++) {
      const png = await renderFrame(post, cards, c, total, f / FPS, fonts, pal, renderOpts);
      fs.writeFileSync(path.join(cdir, `${String(f).padStart(3, "0")}.png`), png);
    }
    const hold = (cards[c].dur - ENTER_FRAMES / FPS).toFixed(3);
    const clip = path.join(work, `clip${c}.mp4`);
    if (brollFile) {
      // 배경 영상 위에 투명 카드 프레임을 얹는다. 카드마다 배경 시작점을 옮겨 장면 변화를 준다.
      const off = brollDur > cards[c].dur ? (offsets[c] % (brollDur - cards[c].dur)).toFixed(2) : 0;
      sh(`ffmpeg -y -ss ${off} -stream_loop -1 -i "${brollFile}" -framerate ${FPS} -i "${cdir}/%03d.png" -filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=${FPS}[bg];[1:v]tpad=stop_mode=clone:stop_duration=${hold},format=rgba[ov];[bg][ov]overlay=0:0,format=yuv420p[v]" -map "[v]" -t ${cards[c].dur.toFixed(3)} -c:v libx264 -preset medium -crf 20 "${clip}"`);
    } else {
      sh(`ffmpeg -y -framerate ${FPS} -i "${cdir}/%03d.png" -vf "tpad=stop_mode=clone:stop_duration=${hold},format=yuv420p,fps=${FPS}" -c:v libx264 -preset medium -crf 18 "${clip}"`);
    }
    clips.push(clip);
  }
  fs.writeFileSync(path.join(work, "list.txt"), clips.map((c) => `file '${c}'`).join("\n"));
  const silent = path.join(work, "video.mp4");
  sh(`ffmpeg -y -f concat -safe 0 -i "${work}/list.txt" -c copy "${silent}"`);

  // BGM + 나레이션 믹스 (은은한 고정 볼륨) — 글마다 스타일·조를 다르게 골라 다양하게
  const music = path.join(work, "music.wav");
  const bgm = pickBgm(post.category, post.slug);
  console.log(`  · BGM: ${bgm.style}${bgm.shift ? ` (${bgm.shift > 0 ? "+" : ""}${bgm.shift})` : ""}`);
  writeWav(music, makeMusic(bgm.style, totalDur, 44100, bgm.shift));
  const inputs = [`-i "${silent}"`, `-i "${music}"`, ...cards.map((c) => `-i "${c.narr}"`)];
  let fc = ""; const v = [];
  cards.forEach((c, i) => { const d = Math.round((offsets[i] + 0.35) * 1000); fc += `[${i + 2}:a]adelay=${d}|${d},volume=2.1[v${i}];`; v.push(`[v${i}]`); });
  fc += `${v.join("")}amix=inputs=${v.length}:normalize=0[voice];`;
  fc += `[1:a]highpass=f=60,volume=0.22,afade=t=in:st=0:d=0.8[bg];`;
  fc += `[bg][voice]amix=inputs=2:normalize=0,alimiter=limit=0.95,afade=t=out:st=${(totalDur - 0.6).toFixed(2)}:d=0.6[a]`;
  const final = path.join(OUT, `${slug}.mp4`);
  // 용량 최소화(≈5MB): 배경영상형도 무료 호스팅에 빠르게 올라가 인스타가 확실히 받아가게. 모바일 화질엔 충분.
  sh(`ffmpeg -y ${inputs.join(" ")} -filter_complex "${fc}" -map 0:v -map "[a]" -c:v libx264 -preset medium -crf 26 -maxrate 2200k -bufsize 4400k -pix_fmt yuv420p -c:a aac -b:a 128k -shortest "${final}"`);
  console.log(`  ✅ 완성: ${final} (${totalDur.toFixed(1)}초)`);

  // 썸네일 = 첫 장(훅 카드) 고정 — 세 플랫폼 표지를 동일한 첫 장면으로 통일
  let thumb = null;
  try {
    thumb = path.join(work, "thumb.jpg");
    if (brollFile) {
      // 배경영상형은 완성 영상의 훅 구간(첫 카드 후반)에서 한 장 추출 → 배경까지 담긴 표지
      const at = Math.min(cards[0].dur - 0.3, ENTER_FRAMES / FPS + 0.6).toFixed(2);
      sh(`ffmpeg -y -ss ${at} -i "${final}" -vframes 1 -q:v 2 "${thumb}"`);
    } else {
      const png = await renderFrame(post, cards, 0, total, 5, fonts, pal, renderOpts); // t=5 → 완전히 안착한 첫 장
      const thumbPng = path.join(work, "thumb.png");
      fs.writeFileSync(thumbPng, png);
      sh(`ffmpeg -y -i "${thumbPng}" -q:v 2 "${thumb}"`);
    }
  } catch (e) { console.log("  · 썸네일 렌더 건너뜀:", e.message); thumb = null; }

  // 게시 (자격증명 있을 때만) — 유입 최적화: 훅 첫줄 + 명확한 CTA + 태그(10~30개)
  const lead = (post.hook || post.title).trim();
  const igTags = hashtags(post, 30); // 인스타는 첫 댓글에 30개
  const igCaption = `${lead}\n\n👉 전체 내용은 프로필 링크에서 (oddsbag.co.kr)\n📌 오즈백 팔로우하고 매일 이슈 받아보기`;
  const ytDesc = `${lead}\n\n👉 oddsbag.co.kr 에서 전체 글 보기\n📌 @oddsbag_official 구독\n\n${hashtags(post, 15)}`;
  const fbCaption = `${lead}\n\n👉 전체 글 보기 → oddsbag.co.kr\n📌 오즈백 페이지 팔로우\n\n${hashtags(post, 15)}`;
  try {
    const vid = await uploadShort(final, { title: `${post.title} #Shorts`, description: ytDesc, tags: keywords(post, 20), privacy: YT_PRIVACY });
    if (thumb && vid) { try { await setThumbnail(vid, thumb); } catch (e) { console.log("  · 유튜브 썸네일 건너뜀:", e.message); } }
    if (vid) { try { await addToCategoryPlaylist(vid, post.category); } catch (e) { console.log("  · 재생목록 건너뜀:", e.message); } }
  }
  catch (e) { console.log("  · 유튜브 건너뜀:", e.message); }
  try {
    // 인스타는 메타 호환 호스트(uguu 등, tmpfiles 제외)에만 올린다. 영상 실패면 인스타 자체를 건너뛴다.
    const url = await uploadPublic(final, { metaSafe: true });
    let coverUrl;
    if (thumb) {
      await new Promise((r) => setTimeout(r, 4000)); // uguu 연속 업로드 제한 회피
      try { coverUrl = await uploadPublic(thumb, { metaSafe: true }); }
      catch (e) { console.log("  · 인스타 커버 생략(첫 프레임 사용):", e.message); } // 커버 실패해도 릴스는 올린다
    }
    await postReel(url, igCaption, coverUrl, igTags);
  }
  catch (e) { console.log("  · 인스타 건너뜀:", e.message); }
  try { await postVideo(final, fbCaption, thumb); }
  catch (e) { console.log("  · 페이스북 건너뜀:", e.message); }

  fs.rmSync(work, { recursive: true, force: true });
}

async function main() {
  if (!redisReady) throw new Error("UPSTASH_REDIS_REST_URL/TOKEN 필요");
  if (!TTS_KEY) throw new Error("GOOGLE_TTS_API_KEY 필요");
  const pending = await pickPending(LIMIT);
  if (!pending.length) { console.log("만들 릴스 없음 (모두 제작됨)"); return; }
  console.log(`릴스 ${pending.length}개 제작 시작`);
  for (const post of pending) {
    try {
      await buildReel(post);
      if (process.env.MARK_DONE !== "0") await sadd(DONE, post.slug);
    } catch (e) {
      console.error(`  ✗ ${post.slug} 실패:`, e.message);
    }
  }
  console.log("\n영상 공장 종료");
}
main().catch((e) => { console.error(e); process.exit(1); });
