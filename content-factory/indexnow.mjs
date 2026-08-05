// IndexNow — 새 글이 나왔다고 검색엔진에 직접 알린다.
//
// 왜 필요한가:
//   사이트맵은 "여기 있으니 언제든 와서 보세요"고, IndexNow는 "지금 나왔으니 와보세요"다.
//   로봇이 올 때까지 기다리지 않아도 된다.
//
// 어디에 통하나:
//   · 네이버 (2023년 7월부터 지원) — 서치어드바이저 로그인 없이 키만 있으면 된다
//   · 빙 — 빙 색인은 챗GPT·코파일럿 검색에 그대로 쓰인다
//   · 구글은 IndexNow를 안 받는다 → 구글은 서치콘솔 등록이 따로 필요하다
//
// 열쇠 파일:
//   public/<키>.txt 안에 키와 똑같은 글자가 들어 있어야 한다.
//   검색엔진이 그 파일을 읽어 "이 사이트 주인이 맞네"를 확인한다. 파일을 지우면 동작이 멈춘다.

const KEY = process.env.INDEXNOW_KEY || "aa43fafb90216063e8529373ed9345cc";
const HOST = "oddsbag.co.kr";
const ORIGIN = `https://${HOST}`;

// 같은 내용을 두 곳에 보낸다. 한 곳이 죽어도 다른 곳은 받는다.
const ENDPOINTS = [
  "https://api.indexnow.org/indexnow",
  "https://searchadvisor.naver.com/indexnow",
];

/**
 * 주소 목록을 검색엔진에 알린다.
 * @param {string[]} urls  전체 주소(https://…) 또는 '/magazine/xxx' 같은 경로
 * @returns {Promise<{ok:boolean, sent:number, results:{endpoint:string,status:number|string}[]}>}
 */
export async function pingIndexNow(urls) {
  const list = [...new Set((urls || []).filter(Boolean))]
    .map((u) => (u.startsWith("http") ? u : `${ORIGIN}${u.startsWith("/") ? "" : "/"}${u}`))
    .filter((u) => u.startsWith(ORIGIN)) // 남의 집 주소는 보내면 거절당한다
    .slice(0, 10000); // 한 번에 보낼 수 있는 상한

  if (list.length === 0) return { ok: true, sent: 0, results: [] };

  const body = JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: `${ORIGIN}/${KEY}.txt`,
    urlList: list,
  });

  const results = [];
  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body,
        signal: AbortSignal.timeout(15000),
      });
      results.push({ endpoint, status: res.status });
    } catch (e) {
      // 알리기 실패가 발행을 막으면 안 된다 — 기록만 남기고 넘어간다
      results.push({ endpoint, status: e?.name === "TimeoutError" ? "시간초과" : String(e?.message || e) });
    }
  }
  // 200·202 는 받았다는 뜻이다 (202 = 접수했고 키는 나중에 확인하겠다)
  const ok = results.some((r) => r.status === 200 || r.status === 202);
  return { ok, sent: list.length, results };
}

/** 글 하나를 알린다 (발행 직후에 부른다) */
export async function pingPost(slug, channel = "magazine") {
  const path = channel === "magazine" ? `/magazine/${slug}` : `/${channel}/${slug}`;
  // 글 주소와 함께 홈·사이트맵도 같이 알려 목록이 갱신된 것을 전한다
  return pingIndexNow([path, "/", "/sitemap.xml"]);
}
