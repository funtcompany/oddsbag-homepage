// ─────────────────────────────────────────────────────────────
//  «원본 HTML 그대로 보이게» 하는 부품 — 오즈백 툴즈 «HTML 링크 생성기»
// ─────────────────────────────────────────────────────────────
//
//  ★왜 필요한가 (2026-08-21 실측으로 확인)
//     뷰어는 남이 올린 HTML 을 CSP sandbox 로 가둔다. 거기엔 allow-same-origin 이 «없다».
//     없어야 맞다 — 있으면 그 문서가 oddsbag.co.kr 의 쿠키(관리자 세션까지)를 읽고
//     우리 /api/* 를 우리 권한으로 부를 수 있게 된다.
//
//     그런데 그 대가로 문서가 «출신 없는(opaque origin)» 상태가 되어 이렇게 된다:
//
//         localStorage.getItem(...)   → SecurityError 를 «던진다»
//         sessionStorage.setItem(...) → SecurityError 를 «던진다»
//         document.cookie             → SecurityError 를 «던진다»
//
//     보고서 스크립트는 대개 첫 줄에서 «지난번에 고른 테마»를 꺼내려고 localStorage 를 만진다.
//     try/catch 가 없으면 거기서 스크립트가 통째로 멈춘다. 그 아래 있던
//     표 그리기·탭 전환·목차·그래프가 «전부» 실행되지 않는다.
//     → 화면은 떴는데 «내용이 안 뜨고 버튼이 죽은» 상태. 사장님이 보신 그 증상이다.
//
//  ★그래서 무엇을 하나
//     샌드박스는 그대로 두고, 문서 맨 앞에 «메모리로 도는 가짜 저장소»를 끼워 넣는다.
//     진짜 저장소가 없는 자리에 던지지 않는 대역을 놓는 것뿐이라 보안이 약해지지 않는다.
//     (읽을 진짜 쿠키가 애초에 없다 — 여전히 opaque origin 이다)
//     새로고침하면 값은 사라진다. 그건 맞는 동작이다 — 남의 자료가 방문자 기기에
//     영구 저장소를 갖는 것이 오히려 안 될 일이다.
//
//  ★고쳐지지 «않는» 것 — 링크에 담기는 건 HTML 파일 «한 장»뿐이다.
//     <img src="사진/표.png"> 처럼 옆 파일을 가리키면 링크로는 안 나온다.
//     이건 샌드박스와 무관하고 고칠 수도 없다 → 올릴 때 미리 알려 준다(inspectHtml).

/** 던지지 않는 대역 저장소. 문서의 «맨 앞»에서 돌아야 한다. */
const STORAGE_SHIM = `(function(){
function memStore(){var m=Object.create(null);return{
getItem:function(k){k=String(k);return Object.prototype.hasOwnProperty.call(m,k)?m[k]:null;},
setItem:function(k,v){m[String(k)]=String(v);},
removeItem:function(k){delete m[String(k)];},
clear:function(){m=Object.create(null);},
key:function(i){var ks=Object.keys(m);return i<ks.length?ks[i]:null;},
get length(){return Object.keys(m).length;}};}
["localStorage","sessionStorage"].forEach(function(n){var ok=false;
try{var s=window[n];s.setItem("__probe__","1");s.removeItem("__probe__");ok=true;}catch(e){}
if(!ok){try{Object.defineProperty(window,n,{value:memStore(),configurable:true});}catch(e){}}});
var jar="",okc=false;try{document.cookie;okc=true;}catch(e){}
if(!okc){try{Object.defineProperty(document,"cookie",{configurable:true,
get:function(){return jar;},
set:function(v){var p=String(v).split(";")[0],i=p.indexOf("=");if(i>0){var k=p.slice(0,i);
var a=jar?jar.split("; "):[];a=a.filter(function(x){return x.slice(0,x.indexOf("="))!==k;});
a.push(p);jar=a.join("; ");}}});}catch(e){}}
})();`;

const SHIM_TAG = `<script data-oddsbag-shim>${STORAGE_SHIM}</script>`;

/**
 * 대역 저장소를 문서 맨 앞에 끼워 넣는다.
 *  ★<!doctype> «앞»에 넣으면 안 된다 — 브라우저가 옛날모드(quirks)로 떨어져 표가 깨진다.
 *    그래서 <head> → <html> → doctype 다음 순서로 자리를 찾는다.
 */
export function withStorageShim(html: string): string {
  const head = html.match(/<head\b[^>]*>/i);
  if (head?.index != null) {
    const at = head.index + head[0].length;
    return html.slice(0, at) + SHIM_TAG + html.slice(at);
  }
  const htmlTag = html.match(/<html\b[^>]*>/i);
  if (htmlTag?.index != null) {
    const at = htmlTag.index + htmlTag[0].length;
    return html.slice(0, at) + SHIM_TAG + html.slice(at);
  }
  const doctype = html.match(/<!doctype[^>]*>/i);
  if (doctype?.index != null) {
    const at = doctype.index + doctype[0].length;
    return html.slice(0, at) + SHIM_TAG + html.slice(at);
  }
  return SHIM_TAG + html;
}

// ── 올릴 때 미리 알려 주기 ──

// 링크로 옮겨도 «그대로 되는» 주소들 — 경고 대상이 아니다
const OK_PREFIX =
  /^(https?:|\/\/|data:|blob:|#|mailto:|tel:|javascript:|about:)/i;

/** src="..." / href="..." 에서 옆 파일을 가리키는 것만 골라낸다. */
function collectLocalRefs(html: string): string[] {
  const found = new Set<string>();
  const attr = /\b(?:src|href)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let m: RegExpExecArray | null;
  while ((m = attr.exec(html)) !== null) {
    const v = (m[2] ?? m[3] ?? m[4] ?? "").trim();
    if (!v || OK_PREFIX.test(v)) continue;
    found.add(v.slice(0, 120));
    if (found.size >= 50) break;
  }
  // <style> 안의 url(...) 도 같은 함정이다
  const css = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
  while ((m = css.exec(html)) !== null) {
    const v = (m[1] ?? "").trim();
    if (!v || OK_PREFIX.test(v)) continue;
    found.add(v.slice(0, 120));
    if (found.size >= 50) break;
  }
  return [...found];
}

/**
 * <script> 안의 «코드»만 모은다.
 *  ★본문 글자를 같이 보면 안 된다 — 보고서가 "localStorage 를 안 씁니다" 라고
 *    설명만 해도 「저장소를 쓰는 문서」로 잘못 짚는다(board.html 에서 실제로 걸렸다).
 */
function scriptBodies(html: string): string[] {
  const out: string[] = [];
  const re = /<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push(m[1] ?? "");
  // 인라인 이벤트(onclick="..." 등)도 코드다
  const on = /\son[a-z]+\s*=\s*("([^"]*)"|'([^']*)')/gi;
  while ((m = on.exec(html)) !== null) out.push(m[2] ?? m[3] ?? "");
  return out;
}

export interface HtmlInspection {
  /** 옆 파일을 가리키는 주소들 — 링크에는 «안 담긴다» */
  localRefs: string[];
  /** 저장소를 쓰는 문서인지 — 새로고침하면 값이 사라진다고 알려 준다 */
  usesStorage: boolean;
  /** 사람이 읽을 안내문 (없으면 빈 배열) */
  notes: string[];
}

/** 올리기 직전에 한 번 훑어, 링크로 옮기면 달라질 것을 미리 말해 준다. */
export function inspectHtml(html: string): HtmlInspection {
  const localRefs = collectLocalRefs(html);
  const usesStorage = scriptBodies(html).some((code) =>
    /\b(localStorage|sessionStorage|document\.cookie|indexedDB)\b/.test(code),
  );
  const notes: string[] = [];

  if (localRefs.length) {
    const 예시 = localRefs.slice(0, 3).join(", ");
    notes.push(
      `이 파일은 옆에 있는 다른 파일 ${localRefs.length}개를 가져다 씁니다(${예시}` +
        `${localRefs.length > 3 ? " 외" : ""}). 링크에는 HTML 한 장만 담기므로 ` +
        `그림·표·글꼴이 빈칸으로 보일 수 있습니다. 한 파일로 합쳐서(이미지는 data: 로 넣어) 올리시면 그대로 나옵니다.`,
    );
  }
  if (usesStorage) {
    notes.push(
      "이 파일은 브라우저 저장소를 씁니다. 공유 링크에서는 화면·기능은 정상으로 돌지만 " +
        "새로고침하면 저장된 값(고른 테마·접은 상태 등)은 초기화됩니다.",
    );
  }
  return { localRefs, usesStorage, notes };
}
