import { getBody } from "@/lib/htmllink-store";
import { withStorageShim } from "@/lib/htmllink-render";
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
//
// ★2026-08-21 세 가지가 바뀌었다
//   ① 메타를 «읽지 않는다» — 본문이 있으면 그 자료는 있는 것이다.
//      전에는 메타(레디스)를 먼저 봐서, 본문이 멀쩡해도 레디스가 죽으면 링크가 통째로 죽었다.
//   ② 대역 저장소를 문서 맨 앞에 끼운다 — 아래 sandbox 때문에 스크립트가 죽던 것을 살린다.
//      (왜 필요한지는 lib/htmllink-render.ts 에 실측과 함께 적어 뒀다)
//   ③ 실패해도 500 을 내지 않는다 — 거래처가 보는 화면이라 «점검 중» 안내를 낸다.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const id = parseCode(code);
  if (!id) return notFound();

  let html: string | null;
  try {
    html = await getBody(id);
  } catch (e) {
    console.error("[htmllink] 뷰어 읽기 실패", id, e);
    return unavailable();
  }
  if (html == null) return notFound();

  return new Response(withStorageShim(html), {
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
      //   ※그 대가로 localStorage·쿠키가 «예외를 던진다» → withStorageShim 이 대역을 놓아 준다.
      //     대역은 메모리라 남의 문서가 방문자 기기에 영구 저장소를 갖지 못한다. 보안은 그대로다.
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

function page(title: string, emoji: string, message: string, status: number) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>${title}</title>` +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<body style="font-family:system-ui,sans-serif;background:#0f1115;color:#e8eaed;display:flex;height:100vh;margin:0;align-items:center;justify-content:center;text-align:center;padding:20px">' +
      `<div><div style="font-size:44px">${emoji}</div><p style="line-height:1.7">${message}</p></div></body>`,
    {
      status,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    },
  );
}

function notFound() {
  return page(
    "없는 자료",
    "🔍",
    "자료를 찾을 수 없습니다.<br>주소가 잘못됐거나 삭제됐을 수 있어요.",
    404,
  );
}

// 저장소가 잠깐 말썽일 때 — 「없는 자료」라고 하면 안 된다. 자료는 그대로 있다.
function unavailable() {
  return page(
    "잠시 점검 중",
    "🛠",
    "지금 저장소를 점검하고 있습니다.<br>자료는 그대로 있으니 잠시 뒤 다시 열어 주세요.",
    503,
  );
}
