// 원문 기사 본문 읽어오기
//
// 지금까지는 제목 + RSS 한 줄 요약만 보고 글을 썼다.
// 그러면 AI가 나머지를 '상상'해서 채우고 → 심사관이 가짜뉴스로 판단한다 (당연하다).
//
// 그래서 발행 전에 반드시 원문 기사를 실제로 읽고, 그 사실만으로 글을 쓴다.
// 원문을 못 읽으면 그 이슈는 쓰지 않는다. (품질 > 물량)

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const MIN_CHARS = 800; // 이보다 짧으면 '제대로 못 읽었다'고 본다 (메뉴·관련기사 잡동사니로 AI가 창작하는 것 방지 — 못 읽으면 건너뛴다)
const MAX_CHARS = 4000;

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

// 기사 본문이 들어있을 법한 영역을 우선 추출
function extractMain(html) {
  const zones = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]+id=["'](?:dic_area|newsct_article|articleBodyContents|article-body|articleBody)["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i,
    /<div[^>]+class=["'][^"']*(?:article[-_]?body|news[-_]?body|content[-_]?body|entry[-_]?content)[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
  ];
  for (const re of zones) {
    const m = html.match(re);
    if (m) {
      const text = stripHtml(m[1]);
      if (text.length >= MIN_CHARS) return text;
    }
  }
  // 못 찾으면 <p> 태그들을 긁어 모은다
  const ps = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripHtml(m[1]))
    .filter((t) => t.length > 30);
  return ps.join("\n");
}

export async function fetchArticleText(url) {
  if (!url || !/^https?:\/\//.test(url)) return { text: "", url, ok: false };
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "ko,en;q=0.8" },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return { text: "", url, ok: false };

    const finalUrl = res.url || url;

    // 한국 언론사는 EUC-KR을 쓰는 곳이 있다 — 그대로 읽으면 글자가 깨진다
    const buf = await res.arrayBuffer();
    const ctype = res.headers.get("content-type") ?? "";
    let charset = /charset=([\w-]+)/i.exec(ctype)?.[1]?.toLowerCase() ?? "";
    if (!charset) {
      const head = new TextDecoder("utf-8").decode(buf.slice(0, 2048));
      charset = /charset=["']?([\w-]+)/i.exec(head)?.[1]?.toLowerCase() ?? "utf-8";
    }
    if (charset === "ks_c_5601-1987" || charset === "ksc5601") charset = "euc-kr";
    let html;
    try {
      html = new TextDecoder(charset).decode(buf);
    } catch {
      html = new TextDecoder("utf-8").decode(buf);
    }

    // 구글 뉴스 중계 페이지 → 실제 기사 주소가 본문에 박혀 있으면 한 번 더 따라간다
    if (/news\.google\.com/.test(finalUrl)) {
      const m =
        html.match(/data-n-au=["'](https?:\/\/[^"']+)["']/) ||
        html.match(/<a[^>]+href=["'](https?:\/\/(?!news\.google\.com)[^"']+)["'][^>]*>/);
      if (m) return await fetchArticleText(m[1]);
      return { text: "", url: finalUrl, ok: false };
    }

    const text = extractMain(html).slice(0, MAX_CHARS);
    return { text, url: finalUrl, ok: text.length >= MIN_CHARS };
  } catch {
    return { text: "", url, ok: false };
  }
}

// 이슈 하나에 대해 '믿을 수 있는 원문 텍스트'를 확보한다.
//  1) 수집된 링크에서 바로 읽기
//  2) 실패하면 (구글 뉴스 중계 링크 등) 제목으로 네이버에서 같은 기사를 찾아 원문 읽기
//  3) 그래도 실패하면 null → 이 이슈는 쓰지 않는다
export async function resolveSourceText(issue) {
  const direct = await fetchArticleText(issue.link);
  if (direct.ok) return { text: direct.text, url: direct.url };

  const { resolveArticleLink } = await import("./naver.mjs");
  const alt = await resolveArticleLink(issue.title);
  if (alt && alt !== issue.link) {
    const second = await fetchArticleText(alt);
    if (second.ok) return { text: second.text, url: second.url };
  }
  return null;
}
