// ─────────────────────────────────────────────────────────────
//  이북 HTML 만들기 — 오즈백 툴즈 «이북 제작기»
// ─────────────────────────────────────────────────────────────
//
//  페이지 그림들을 받아 «한 장짜리 자체 완결 HTML» 로 만든다.
//  밖에서 아무것도 안 불러온다(글꼴·스크립트·그림 전부 안에 있다) —
//  그래서 인터넷 없이 열어도 되고, HTML 링크 생성기에 그대로 올릴 수 있다.
//
//  ★반드시 지킬 것 — localStorage 를 쓰지 않는다.
//     이 HTML 은 HTML 링크 생성기의 뷰어(CSP sandbox, allow-same-origin 없음) 안에서도
//     돌아야 한다. 그 안에서는 localStorage·쿠키 접근이 «예외를 던진다».
//     한 줄이라도 감싸지 않고 쓰면 거기서 리더 전체가 죽는다.
//     (board.md 2026-08-19 «localStorage 막힘 ✅» 참고 — 그게 정상 동작이다)

export interface EbookPage {
  /** data: URI */
  src: string;
  /** 목차에 뜨는 이름 (없으면 «N쪽») */
  label?: string;
}

export interface EbookOptions {
  title: string;
  pages: EbookPage[];
  /** 표지 아래 작게 들어가는 한 줄. 없으면 안 넣는다 */
  subtitle?: string;
  /** 넘김 방향 — 만화·세로쓰기 자료는 rtl */
  direction?: "ltr" | "rtl";
  /** 넓은 화면에서 두 쪽씩 펼쳐 보기 */
  spread?: boolean;
}

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** </script> 가 문자열 안에 있으면 거기서 스크립트가 끊긴다 — JSON 을 심을 땐 반드시 거친다 */
const safeJson = (v: unknown) =>
  JSON.stringify(v)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

export function buildEbookHtml(o: EbookOptions): string {
  const title = o.title?.trim() || "이북";
  const dir = o.direction === "rtl" ? "rtl" : "ltr";
  const pages = o.pages.map((p, i) => ({ src: p.src, label: p.label || `${i + 1}쪽` }));

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<style>
:root{--bg:#14161c;--panel:#1e2129;--line:#2e323d;--fg:#eef0f4;--dim:#a2a8b6;--accent:#7c5cff}
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html,body{height:100%}
body{background:var(--bg);color:var(--fg);font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard","Malgun Gothic",system-ui,sans-serif;overflow:hidden;overscroll-behavior:none}
#app{display:flex;flex-direction:column;height:100dvh}

/* 위 막대 */
#bar{display:flex;align-items:center;gap:8px;padding:10px 12px;padding-top:max(10px,env(safe-area-inset-top));background:var(--panel);border-bottom:1px solid var(--line);flex:none;transition:transform .22s,opacity .22s;z-index:5}
#bar.hide{transform:translateY(-100%);opacity:0;pointer-events:none}
#ttl{font-weight:800;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;word-break:keep-all}
.btn{background:#282c36;color:var(--fg);border:1px solid var(--line);border-radius:9px;padding:7px 11px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;font-family:inherit}
.btn:hover{background:#333846;border-color:#454b5c}
.btn:active{transform:scale(.96)}
.btn[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:#fff}

/* 보는 자리 */
#stage{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#0e1014}
#track{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;height:100%;padding:8px}
#track img{max-width:100%;max-height:100%;object-fit:contain;display:block;border-radius:4px;background:#fff;user-select:none;-webkit-user-drag:none}
#track.two img{max-width:calc(50% - 3px)}
#stage.zoom{overflow:auto;align-items:flex-start;justify-content:flex-start;cursor:grab}
#stage.zoom #track{height:auto;min-height:100%;padding:0}
#stage.zoom #track img{max-width:none;max-height:none;width:180%;border-radius:0}

/* 좌우 누르는 자리 (보이지 않는다) */
.tap{position:absolute;top:0;bottom:0;width:26%;z-index:2;border:0;background:transparent;cursor:pointer;padding:0}
.tap:disabled{cursor:default}
#tapPrev{left:0}#tapNext{right:0}
.nav{position:absolute;top:50%;transform:translateY(-50%);z-index:3;width:42px;height:42px;border-radius:50%;border:1px solid var(--line);background:rgba(24,26,33,.72);color:#fff;font-size:19px;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .18s;font-family:inherit}
#stage:hover .nav{opacity:1}
.nav:disabled{opacity:0!important}
#navPrev{left:10px}#navNext{right:10px}

/* 아래 막대 */
#foot{display:flex;align-items:center;gap:10px;padding:9px 12px;padding-bottom:max(9px,env(safe-area-inset-bottom));background:var(--panel);border-top:1px solid var(--line);flex:none;transition:transform .22s,opacity .22s;z-index:5}
#foot.hide{transform:translateY(100%);opacity:0;pointer-events:none}
#rng{flex:1;min-width:0;accent-color:var(--accent);cursor:pointer;height:22px}
#num{font-size:12.5px;color:var(--dim);font-variant-numeric:tabular-nums;white-space:nowrap;font-weight:700}

/* 목차 */
#toc{position:absolute;inset:0;background:rgba(10,11,15,.96);z-index:10;display:none;flex-direction:column}
#toc.on{display:flex}
#tocHead{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--line);flex:none}
#tocHead b{font-size:15px}
#grid{flex:1;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px;padding:14px;-webkit-overflow-scrolling:touch}
.th{background:#20232b;border:2px solid transparent;border-radius:8px;overflow:hidden;cursor:pointer;padding:0;display:flex;flex-direction:column;font-family:inherit}
.th.cur{border-color:var(--accent)}
.th img{width:100%;aspect-ratio:3/4;object-fit:cover;display:block;background:#fff}
.th span{font-size:11px;color:var(--dim);padding:5px 4px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media (max-width:520px){#grid{grid-template-columns:repeat(auto-fill,minmax(74px,1fr))}#ttl{font-size:13px}.btn{padding:7px 9px;font-size:12px}}
</style>
</head>
<body>
<div id="app">
  <div id="bar">
    <span style="font-size:17px" aria-hidden>📖</span>
    <div id="ttl">${esc(title)}</div>
    <button class="btn" id="bToc" type="button">목차</button>
    <button class="btn" id="bTwo" type="button" aria-pressed="false">두쪽</button>
    <button class="btn" id="bZoom" type="button" aria-pressed="false">확대</button>
    <button class="btn" id="bFull" type="button">전체화면</button>
  </div>

  <div id="stage">
    <div id="track"></div>
    <button class="tap" id="tapPrev" type="button" aria-label="이전 쪽"></button>
    <button class="tap" id="tapNext" type="button" aria-label="다음 쪽"></button>
    <button class="nav" id="navPrev" type="button" aria-label="이전 쪽">‹</button>
    <button class="nav" id="navNext" type="button" aria-label="다음 쪽">›</button>
    <div id="toc">
      <div id="tocHead"><b>목차 — 눌러서 이동</b><button class="btn" id="bTocX" type="button">닫기</button></div>
      <div id="grid"></div>
    </div>
  </div>

  <div id="foot">
    <button class="btn" id="bPrev" type="button">◀</button>
    <input id="rng" type="range" min="1" step="1" aria-label="쪽 넘기기">
    <button class="btn" id="bNext" type="button">▶</button>
    <span id="num"></span>
  </div>
</div>

<script>
(function(){
"use strict";
var PAGES = ${safeJson(pages)};
var RTL = ${dir === "rtl"};
var N = PAGES.length;
var cur = 0;          // 0부터
var two = ${o.spread ? "window.innerWidth>=900" : "false"};
var zoom = false;
var chrome = true;    // 위·아래 막대가 보이는가

var $ = function(id){ return document.getElementById(id); };
var track=$("track"), rng=$("rng"), num=$("num"), stage=$("stage"), grid=$("grid");

// ★localStorage 는 «쓰지 않는다». sandbox 안에서 예외를 던진다 (윗주석 참고).
//   보던 쪽 기억이 필요하면 주소 뒤 #12 로만 남긴다 — 이건 sandbox 에서도 안전하다.

function step(){ return (two && N>1) ? 2 : 1; }
function clamp(i){ return Math.max(0, Math.min(N-1, i)); }

function render(){
  track.className = two ? "two" : "";
  track.textContent = "";
  var list = [cur];
  if (two && cur+1 < N) list.push(cur+1);
  if (RTL) list.reverse();
  for (var k=0;k<list.length;k++){
    var im = new Image();
    im.src = PAGES[list[k]].src;
    im.alt = PAGES[list[k]].label;
    im.decoding = "sync";
    track.appendChild(im);
  }
  rng.value = String(cur+1);
  num.textContent = (cur+1) + (two && cur+1<N ? "-"+(cur+2) : "") + " / " + N;
  $("bPrev").disabled = $("tapPrev").disabled = $("navPrev").disabled = cur<=0;
  var last = cur >= N-step();
  $("bNext").disabled = $("tapNext").disabled = $("navNext").disabled = last;
  var cs = grid.children;
  for (var j=0;j<cs.length;j++) cs[j].className = "th" + (j===cur ? " cur" : "");
  try { history.replaceState(null,"","#"+(cur+1)); } catch(e){}
  if (zoom) stage.scrollTop = 0;
}

function go(i){ var n = clamp(i); if (n!==cur){ cur=n; render(); } }
function next(){ go(cur + step()); }
function prev(){ go(cur - step()); }

// 좌우 누름 — RTL 이면 뜻이 뒤집힌다
function goLeft(){ RTL ? next() : prev(); }
function goRight(){ RTL ? prev() : next(); }

$("bPrev").onclick = prev;  $("bNext").onclick = next;
$("tapPrev").onclick = goLeft;  $("tapNext").onclick = goRight;
$("navPrev").onclick = goLeft;  $("navNext").onclick = goRight;
rng.oninput = function(){ go(parseInt(rng.value,10)-1); };

document.addEventListener("keydown", function(e){
  if (e.key==="ArrowRight"||e.key==="PageDown"||e.key===" ") { e.preventDefault(); goRight(); }
  else if (e.key==="ArrowLeft"||e.key==="PageUp") { e.preventDefault(); goLeft(); }
  else if (e.key==="Home") go(0);
  else if (e.key==="End") go(N-1);
  else if (e.key==="Escape") { if ($("toc").classList.contains("on")) closeToc(); }
});

// 손가락으로 넘기기 — 세로로 긁는 것(스크롤)과 구분한다
var sx=0, sy=0, tracking=false;
stage.addEventListener("touchstart", function(e){
  if (zoom || e.touches.length!==1) { tracking=false; return; }
  sx=e.touches[0].clientX; sy=e.touches[0].clientY; tracking=true;
}, {passive:true});
stage.addEventListener("touchend", function(e){
  if (!tracking) return;
  tracking=false;
  var t=e.changedTouches[0], dx=t.clientX-sx, dy=t.clientY-sy;
  if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)*1.4) return;
  dx < 0 ? goRight() : goLeft();
}, {passive:true});

// 목차
function openToc(){ $("toc").classList.add("on"); var c=grid.children[cur]; if(c&&c.scrollIntoView) c.scrollIntoView({block:"center"}); }
function closeToc(){ $("toc").classList.remove("on"); }
$("bToc").onclick = function(){ $("toc").classList.contains("on") ? closeToc() : openToc(); };
$("bTocX").onclick = closeToc;

// 두쪽 / 확대 / 전체화면
$("bTwo").onclick = function(){
  two=!two; this.setAttribute("aria-pressed", two?"true":"false");
  if (two) cur = cur - (cur%2);
  render();
};
$("bZoom").onclick = function(){
  zoom=!zoom; this.setAttribute("aria-pressed", zoom?"true":"false");
  stage.classList.toggle("zoom", zoom);
  if (zoom && two){ two=false; $("bTwo").setAttribute("aria-pressed","false"); }
  render();
};
$("bFull").onclick = function(){
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  } catch(e){}
};

// 가운데를 누르면 막대가 숨는다 (그림을 크게 본다)
track.addEventListener("click", function(){
  if (zoom) return;
  chrome=!chrome;
  $("bar").classList.toggle("hide", !chrome);
  $("foot").classList.toggle("hide", !chrome);
});

// 목차 썸네일 — 페이지가 많으면 미리 다 그리면 느리므로 보일 때 채운다
var tocBuilt=false;
function buildToc(){
  if (tocBuilt) return; tocBuilt=true;
  var frag=document.createDocumentFragment();
  for (var i=0;i<N;i++){
    (function(i){
      var b=document.createElement("button");
      b.type="button"; b.className="th"+(i===cur?" cur":"");
      var im=new Image(); im.src=PAGES[i].src; im.alt=""; im.loading="lazy";
      var sp=document.createElement("span"); sp.textContent=PAGES[i].label;
      b.appendChild(im); b.appendChild(sp);
      b.onclick=function(){ go(i); closeToc(); };
      frag.appendChild(b);
    })(i);
  }
  grid.appendChild(frag);
}

rng.max = String(N);
buildToc();

// 주소 뒤에 #12 가 붙어 있으면 거기서 시작한다
var h = parseInt((location.hash||"").replace("#",""),10);
if (h>=1 && h<=N) cur = h-1;
if (two) cur = cur - (cur%2);
render();
})();
</script>
</body>
</html>`;
}
