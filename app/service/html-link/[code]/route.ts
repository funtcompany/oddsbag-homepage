import { getMeta, getBody } from "@/lib/htmllink-store";
import { parseCode } from "@/lib/htmllink-code";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 뷰어 — 사장님 결정 A(2026-08-19): 이 «링크 자체가 공유용»이다.
//  시리얼키만 맞으면 «누구나»(비회원 포함) 원본 HTML 을 효과까지 그대로 풀페이지로 재생한다.
//  (자료 «목록»은 여전히 올린 브라우저의 쿠키로만 보인다 — 그건 /api/htmllink/items 에서 격리.)
//
// ★주소 모양 (2026-08-19 사장님 지시로 바뀜)
//     https://oddsbag.co.kr/service/html-link/K7M2-P94F8XQ2N6VB
//   앞 4자리는 방문자 지문, 뒤 12자리는 자료 시리얼. 합쳐 80비트라 찍어서는 못 들어온다.
//   옛 주소(/service/html-link/v/<10자hex>)는 같은 날 걷어냈다.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const id = parseCode(code);
  if (!id) return notFound();

  const meta = await getMeta(id);
  if (!meta) return notFound();

  const html = await getBody(id);
  if (html == null) return notFound();

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      // 남의 사이트에 iframe 으로 박히는 것 방지
      "x-frame-options": "SAMEORIGIN",
      // ★남이 올린 HTML 이 oddsbag.co.kr «같은 주소»에서 도는 것을 끊는다.
      //   sandbox 에 allow-same-origin 을 «주지 않으면» 그 문서는 빈 출신(opaque origin)이 되어
      //   우리 쿠키(oddsbag_admin · htmllink_user)를 못 읽고, /api/* 를 우리 권한으로 못 부른다.
      //   관리자로 로그인된 브라우저로 남의 링크를 열어도 관리자 API 가 열리지 않는다.
      //   ※대신 그 문서 안에서 localStorage·쿠키는 못 쓴다 (그림·효과·스크립트는 그대로 돈다).
      "content-security-policy":
        "sandbox allow-scripts allow-forms allow-popups allow-modals allow-downloads allow-popups-to-escape-sandbox",
      // ★검색엔진에 «절대» 남지 않게 (2026-08-20).
      //   시리얼키는 찍어서 못 맞히지만(60비트), 링크를 받은 사람이 블로그·공개 게시판·
      //   오픈채팅에 붙여넣는 순간 크롤러가 그 주소를 «발견»한다. 그때 이 헤더가 없으면
      //   구글이 색인해 본문까지 검색 결과에 남는다. 자료를 지워도 캐시가 한동안 남는다.
      //   ※robots.txt 에 Disallow 를 넣는 방식은 «역효과»다 — 크롤을 막으면 크롤러가
      //     이 noindex 를 읽지 못해, 이미 발견된 주소가 제목 없는 URL 로 그냥 남는다.
      //     크롤은 열어 두고 헤더로 빼는 것이 맞다.
      "x-robots-tag": "noindex, nofollow, noarchive, nosnippet, noimageindex",
      // 올린 HTML 안에서 밖으로 나가는 링크를 눌러도 시리얼 주소가 Referer 로 따라가지 않게.
      //  문서가 <meta name="referrer" content="unsafe-url"> 로 브라우저 기본값을 덮어쓸 수
      //  있으므로 응답 헤더로 못박는다.
      "referrer-policy": "no-referrer",
    },
  });
}

function notFound() {
  return new Response(
    '<!doctype html><meta charset="utf-8"><title>없는 자료</title>' +
      '<body style="font-family:system-ui,sans-serif;background:#0f1115;color:#e8eaed;display:flex;height:100vh;margin:0;align-items:center;justify-content:center;text-align:center">' +
      '<div><div style="font-size:44px">🔍</div><p>자료를 찾을 수 없습니다.<br>주소가 잘못됐거나 삭제됐을 수 있어요.</p></div></body>',
    { status: 404, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
