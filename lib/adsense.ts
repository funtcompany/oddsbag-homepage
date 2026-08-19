// 구글 애드센스 — 게시자 ID와 켜짐/꺼짐을 여기 한 곳에서만 정한다.
//
// ★게시자 ID를 환경변수로 두지 않는 이유 (2026-08-19)
//   원래 NEXT_PUBLIC_ADSENSE_CLIENT 환경변수 하나에 광고 스크립트와
//   광고칸이 전부 걸려 있었는데, 그 값이 빈 채로 배포돼 있었다.
//   그 결과 홈에도 기사에도 애드센스 코드가 한 줄도 안 붙었고
//   (실측 2026-08-19: 홈·기사 both 0건), 애드센스는 계속
//   「사이트 검토 필요」에서 멈춰 있었다. 아무도 몰랐던 건
//   빈 환경변수가 조용히 통과하기 때문이다.
//   게시자 ID는 어차피 HTML 소스에 그대로 노출되는 공개 식별자라
//   비밀이 아니다. 그래서 코드에 박는다 — 배포되면 무조건 붙는다.
//   (바로 위 lib 이웃인 GA_ID 도 같은 이유로 기본값을 코드에 둔다)
export const ADSENSE_PUB = "ca-pub-4770622939733372";

// ads.txt 에 쓰는 형태 ("ca-" 가 빠진다). public/ads.txt 와 값이 같아야 한다.
export const ADSENSE_PUB_SHORT = ADSENSE_PUB.replace(/^ca-/, "");

// ★광고칸(빈 자리)을 실제로 그릴지 — 승인 전에는 끈다 (사장님 결정 2026-08-19).
//   끄면 AdSlot 이 아무것도 안 그려서 지금 화면 그대로다.
//   심사에는 <head> 의 애드센스 코드와 소유확인 메타태그만 있으면 되고,
//   광고칸은 필요 없다.
//
//   승인 나면 Vercel 환경변수에 둘 중 아무거나 넣으면 켜진다 —
//     NEXT_PUBLIC_ADSENSE_ON=1
//     NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-4770622939733372  (옛 방식도 그대로 먹힘)
//   ※ NEXT_PUBLIC_* 는 빌드할 때 박히므로, 넣은 뒤 재배포해야 반영된다.
export const ADS_ENABLED =
  process.env.NEXT_PUBLIC_ADSENSE_ON === "1" ||
  !!process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
