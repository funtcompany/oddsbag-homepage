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
import { uploadShort, setThumbnail } from "./youtube.mjs";
import { postReel } from "./instagram.mjs";
import { postVideo } from "./facebook.mjs";
import { uploadPublic } from "./host.mjs";
import { hashtags, keywords } from "./hashtags.mjs";
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
  const total = cards.length;
  const pal = paletteFor(post.slug, post.mood);
  const fonts = await loadFontsForPost(cards);

  // 나레이션 + 카드 길이
  const offsets = []; let acc = 0;
  for (let i = 0; i < cards.length; i++) {
    const mp3 = path.join(work, `n${i}.mp3`);
    await tts(reelSay(cards[i]), mp3);
    cards[i].narr = mp3;
    const d = Math.max(2.6, probe(mp3) + 0.75);
    offsets.push(acc); acc += d; cards[i].dur = d;
  }
  const totalDur = acc;

  // 프레임 자체 렌더 + 카드별 클립
  const clips = [];
  for (let c = 0; c < total; c++) {
    const cdir = path.join(work, `c${c}`); fs.mkdirSync(cdir, { recursive: true });
    for (let f = 0; f < ENTER_FRAMES; f++) {
      const png = await renderFrame(post, cards, c, total, f / FPS, fonts, pal);
      fs.writeFileSync(path.join(cdir, `${String(f).padStart(3, "0")}.png`), png);
    }
    const hold = (cards[c].dur - ENTER_FRAMES / FPS).toFixed(3);
    const clip = path.join(work, `clip${c}.mp4`);
    sh(`ffmpeg -y -framerate ${FPS} -i "${cdir}/%03d.png" -vf "tpad=stop_mode=clone:stop_duration=${hold},format=yuv420p,fps=${FPS}" -c:v libx264 -preset medium -crf 18 "${clip}"`);
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
  sh(`ffmpeg -y ${inputs.join(" ")} -filter_complex "${fc}" -map 0:v -map "[a]" -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a aac -b:a 160k -shortest "${final}"`);
  console.log(`  ✅ 완성: ${final} (${totalDur.toFixed(1)}초)`);

  // 썸네일 = 첫 장(훅 카드) 고정 — 세 플랫폼 표지를 동일한 첫 장면으로 통일
  let thumb = null;
  try {
    const png = await renderFrame(post, cards, 0, total, 5, fonts, pal); // t=5 → 완전히 안착한 첫 장
    const thumbPng = path.join(work, "thumb.png");
    fs.writeFileSync(thumbPng, png);
    thumb = path.join(work, "thumb.jpg");
    sh(`ffmpeg -y -i "${thumbPng}" -q:v 2 "${thumb}"`);
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
  }
  catch (e) { console.log("  · 유튜브 건너뜀:", e.message); }
  try {
    const url = await uploadPublic(final);
    let coverUrl;
    if (thumb) { try { coverUrl = await uploadPublic(thumb); } catch (e) { console.log("  · 인스타 커버 업로드 건너뜀:", e.message); } }
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
