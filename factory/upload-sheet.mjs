// 업로드 양식 — 손으로 올릴 때 쓰는 한 장짜리 안내문(HTML).
//
// 왜 만드나: 유튜브 API 한도(하루 10,000점)를 오즈백·오즈백뮤직이 **같은 프로젝트로 나눠 쓴다.**
//   쇼츠 1편을 API로 올리면 1,600점이 나가지만, **손으로 올리면 0점이다.**
//   그래서 뮤직 앨범을 올리는 날처럼 한도가 빠듯할 땐 손으로 올리는 편이 낫다.
//
// 이 파일은 영상 옆에 같은 이름의 .html 을 하나 놓는다.
// 열면 제목·설명·태그가 복사 버튼과 함께 나와서, 유튜브 업로드 창에 붙여넣기만 하면 된다.
import fs from "node:fs";
import path from "node:path";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function block(label, value, hint = "") {
  return `<section>
  <h2>${esc(label)}${hint ? `<span class="hint">${esc(hint)}</span>` : ""}</h2>
  <div class="row">
    <pre id="b${block.n = (block.n || 0) + 1}">${esc(value)}</pre>
    <button onclick="copyIt('b${block.n}',this)">복사</button>
  </div>
</section>`;
}

/**
 * @param {object} p  { slug, title, category, videoFile, thumbFile, ytTitle, ytDesc, ytTags,
 *                      igCaption, igTags, fbCaption, seconds }
 * @returns {string} 만들어진 html 파일 경로
 */
export function writeUploadSheet(outDir, p) {
  block.n = 0;
  const file = path.join(outDir, `${p.slug}.html`);
  const mins = Math.floor((p.seconds || 0) / 60), secs = Math.round((p.seconds || 0) % 60);

  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>업로드 양식 · ${esc(p.title)}</title>
<style>
  :root { --purple:#5B2D8E; --yellow:#FFE600; --line:#e6e6ea; --ink:#1a1a1f; --dim:#6b6b76; }
  * { box-sizing:border-box }
  body { margin:0; padding:20px; font:16px/1.6 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif; color:var(--ink); background:#f6f6f9 }
  .wrap { max-width:760px; margin:0 auto }
  header { background:var(--purple); color:#fff; border-radius:14px; padding:20px 22px; margin-bottom:18px }
  header h1 { margin:0 0 6px; font-size:20px; line-height:1.35 }
  header .meta { font-size:14px; opacity:.85 }
  .file { background:var(--yellow); color:#1a1a1f; border-radius:12px; padding:14px 16px; margin-bottom:18px; font-weight:700 }
  .file code { font-weight:400; background:rgba(0,0,0,.08); padding:2px 6px; border-radius:5px; word-break:break-all }
  section { background:#fff; border:1px solid var(--line); border-radius:12px; padding:14px 16px; margin-bottom:12px }
  h2 { margin:0 0 8px; font-size:15px; color:var(--purple); display:flex; align-items:center; gap:8px; flex-wrap:wrap }
  .hint { font-weight:400; font-size:13px; color:var(--dim) }
  .row { display:flex; gap:10px; align-items:flex-start }
  pre { flex:1; margin:0; padding:12px; background:#fafafc; border:1px solid var(--line); border-radius:8px;
        white-space:pre-wrap; word-break:break-word; font:14px/1.6 inherit; max-height:260px; overflow:auto }
  button { flex:0 0 auto; padding:10px 14px; border:0; border-radius:8px; background:var(--purple); color:#fff;
           font-size:14px; font-weight:700; cursor:pointer }
  button.done { background:#2e7d32 }
  ol { background:#fff; border:1px solid var(--line); border-radius:12px; padding:14px 16px 14px 34px; margin:18px 0 0 }
  ol li { margin:6px 0 }
  .why { font-size:14px; color:var(--dim); margin-top:14px; line-height:1.7 }
  @media (max-width:600px){ .row{flex-direction:column} button{width:100%} }
</style></head><body><div class="wrap">

<header>
  <h1>${esc(p.title)}</h1>
  <div class="meta">${esc(p.category || "")} · ${mins}분 ${secs}초 · ${esc(p.slug)}</div>
</header>

<div class="file">📹 올릴 영상 파일: <code>${esc(p.videoFile)}</code></div>

${block("유튜브 제목", p.ytTitle, "100자 제한")}
${block("유튜브 설명", p.ytDesc)}
${block("유튜브 태그", (p.ytTags || []).join(", "), "쉼표로 구분해서 붙여넣기")}
${block("인스타 캡션", p.igCaption)}
${block("인스타 해시태그", p.igTags, "첫 댓글에 붙여넣기")}
${block("페이스북 글", p.fbCaption)}

<ol>
  <li><b>유튜브</b> → 만들기 → 동영상 업로드 → 위 mp4 선택</li>
  <li>제목·설명·태그를 위에서 복사해 붙여넣기</li>
  <li>시청자층: <b>아동용 아님</b> 선택</li>
  <li>공개 상태: <b>공개</b> → 게시</li>
  <li>인스타·페북은 각각 캡션을 복사해 올리기</li>
</ol>

<p class="why">손으로 올리면 유튜브 API 한도를 <b>한 점도 쓰지 않습니다.</b>
자동으로 올리면 1편당 1,600점이 나가고, 이 한도는 오즈백·오즈백뮤직이 함께 나눠 씁니다.
뮤직 앨범을 올리는 날처럼 한도가 빠듯할 때 이 양식으로 손수 올리시면 됩니다.</p>

<script>
function copyIt(id, btn) {
  navigator.clipboard.writeText(document.getElementById(id).innerText).then(() => {
    const before = btn.textContent;
    btn.textContent = "복사됨"; btn.classList.add("done");
    setTimeout(() => { btn.textContent = before; btn.classList.remove("done"); }, 1400);
  });
}
</script>
</div></body></html>`;

  fs.writeFileSync(file, html);

  // 【사람용 html 옆에 기계용 json 도 같이 둔다】 (2026-08-10 추가)
  //   대표가 유튜브에 올린 뒤 제목·설명·태그·썸네일을 자동으로 채우려면
  //   이 값들을 프로그램이 읽어야 한다. html 을 되읽어 파싱하는 방법은
  //   서식을 조금만 손대도 조용히 깨진다 — 그래서 원본 값을 그대로 남긴다.
  //   읽는 곳: 01_오피셜/유튜브대기/받아오기.mjs → 업로드계획.json 을 만든다.
  try {
    fs.writeFileSync(
      path.join(outDir, `${p.slug}.json`),
      JSON.stringify(
        {
          slug: p.slug, 제목: p.title, 카테고리: p.category, 길이초: p.seconds ?? null,
          영상파일: p.videoFile, 썸네일파일: p.thumbFile ?? null,
          유튜브: { 제목: p.ytTitle, 설명: p.ytDesc, 태그: p.ytTags ?? [] },
          인스타: { 캡션: p.igCaption, 태그: p.igTags ?? [] },
          페북: { 캡션: p.fbCaption },
        },
        null,
        2,
      ),
      "utf8",
    );
  } catch { /* 양식(html)은 이미 나왔다 — json 실패가 영상 제작을 막지는 않는다 */ }

  return file;
}
