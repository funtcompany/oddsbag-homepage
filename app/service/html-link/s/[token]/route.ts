import { getByShareToken, getBody } from "@/lib/htmllink-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 공유링크 — 토큰이 맞으면 «비회원도» 원본 HTML을 재생.
//  토큰이 없거나 공유가 꺼진 항목은 404.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const meta = await getByShareToken(token);
  if (!meta) return notFound();

  const html = await getBody(meta.id);
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
    },
  });
}

function notFound() {
  return new Response(
    '<!doctype html><meta charset="utf-8"><title>없는 페이지</title>' +
      '<body style="font-family:system-ui,sans-serif;background:#0f1115;color:#e8eaed;display:flex;height:100vh;margin:0;align-items:center;justify-content:center;text-align:center">' +
      '<div><div style="font-size:44px">🔍</div><p>자료를 찾을 수 없습니다.<br>링크가 만료됐거나 공유가 꺼졌을 수 있어요.</p></div></body>',
    { status: 404, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
