// 인스타그램 릴스 자동 게시 (Instagram Graph API)
// 필요한 환경변수: INSTAGRAM_ACCOUNT_ID, INSTAGRAM_ACCESS_TOKEN, MEDIA_PUBLIC_BASE
//
// ※ 인스타 릴스는 '공개 접근 가능한 영상 URL'을 요구한다 (파일 업로드 불가).
//   그래서 워크플로가 완성 mp4를 공개 위치(예: GitHub Release)에 올리고,
//   그 주소의 베이스를 MEDIA_PUBLIC_BASE 로 넘겨준다. → ${MEDIA_PUBLIC_BASE}/${slug}.mp4

const IG = process.env.INSTAGRAM_ACCOUNT_ID;
const TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const BASE = process.env.MEDIA_PUBLIC_BASE;
const G = "https://graph.facebook.com/v21.0";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function postReel(mp4Path, slug, caption) {
  if (!IG || !TOKEN) throw new Error("인스타 미설정 (토큰 없음)");
  if (!BASE) throw new Error("인스타 미설정 (공개 영상 URL 호스팅 MEDIA_PUBLIC_BASE 필요)");
  const videoUrl = `${BASE.replace(/\/$/, "")}/${slug}.mp4`;

  // 1) 릴스 컨테이너 생성
  const create = await (await fetch(`${G}/${IG}/media`, {
    method: "POST",
    body: new URLSearchParams({ media_type: "REELS", video_url: videoUrl, caption, access_token: TOKEN }),
  })).json();
  if (!create.id) throw new Error("컨테이너 실패: " + JSON.stringify(create).slice(0, 160));

  // 2) 인코딩 완료까지 대기 (최대 ~90초)
  for (let i = 0; i < 30; i++) {
    await sleep(3000);
    const st = await (await fetch(`${G}/${create.id}?fields=status_code&access_token=${TOKEN}`)).json();
    if (st.status_code === "FINISHED") break;
    if (st.status_code === "ERROR") throw new Error("인스타 인코딩 실패");
  }

  // 3) 발행
  const pub = await (await fetch(`${G}/${IG}/media_publish`, {
    method: "POST",
    body: new URLSearchParams({ creation_id: create.id, access_token: TOKEN }),
  })).json();
  if (!pub.id) throw new Error("발행 실패: " + JSON.stringify(pub).slice(0, 160));
  console.log(`  · 인스타 릴스 게시: ${pub.id}`);
  return pub.id;
}
