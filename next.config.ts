import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ★빌드 캐시(.next)를 외장하드 «밖»으로 빼려는 시도는 2026-08-19 에 두 방법 다 실패했다.
  //   ① distDir 에 절대경로 → Next 가 «프로젝트 폴더 기준 상대경로»로 읽어
  //      오히려 외장하드 안쪽(homepage/private/tmp/...)에 1.1GB 가 쌓였다.
  //   ② .next 를 로컬 SSD 심링크로 → turbopack 이 그 자리에서 node_modules 를 못 찾아
  //      «Cannot find module '@tailwindcss/postcss'» 로 홈이 500.
  //   그래서 캐시는 그냥 여기 둔다. 커지면 .next 폴더를 지우면 된다(다시 생긴다).

  // ★content/ 를 서버 함수에 반드시 함께 싣는다.
  //   레디스가 한도·장애로 안 될 때 화면을 채우는 자료가 전부 여기 있다
  //   (content/posts/*.json 시드 · content/published-snapshot.json 발행글 스냅샷).
  //   Next 가 «안 쓰는 파일»로 보고 빼면 비상 대비가 통째로 사라진다.
  outputFileTracingIncludes: {
    "/**": ["./content/**"],
  },
};

export default nextConfig;
