import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import Script from "next/script";
import Interactions from "@/components/Interactions";
import "./globals.css";

// 한글 폰트 주의점:
//  subsets에 "latin"만 넣고 preload를 켜두면 한글 글리프가 빠진 채로 로드돼
//  기기마다 다른 폰트로 대체되고, 특수문자·신조어에서 글자가 깨져 보인다.
//  preload를 끄면 Next가 모든 서브셋(한글 포함)을 함께 넣어준다.
const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
  preload: false, // ← 한글 글리프 전체 포함
  fallback: [
    "Apple SD Gothic Neo",
    "Pretendard",
    "Malgun Gothic",
    "sans-serif",
  ],
});

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

// 구글 애널리틱스 측정ID.
//  이 값은 비밀키가 아니라 페이지 소스에 그대로 노출되는 공개 식별자다.
//  그래서 Vercel 환경변수가 빠져도 측정이 멈추지 않도록 기본값을 함께 둔다.
//  2026-08-11 방을 옮겼다 — 로봇 계정이 읽을 수 있는 속성(548621262)의 스트림으로.
//  전 주소 G-G4PMTWJ0XC 는 로봇에 권한이 없는 다른 속성이라, 숫자가 쌓여도 자동으로 못 읽었다.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-ESQ2EQ7TN9";

// 검색엔진에 '이 사이트가 뭔지' 알려주는 구조화 데이터
const SITE_JSONLD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://oddsbag.co.kr/#org",
      name: "오즈백 ODDSBAG",
      url: "https://oddsbag.co.kr",
      logo: "https://oddsbag.co.kr/og.png",
      sameAs: [
        "https://instagram.com/oddsbag_official",
        "https://www.facebook.com/profile.php?id=61586029697990",
      ],
    },
    {
      "@type": "WebSite",
      "@id": "https://oddsbag.co.kr/#site",
      url: "https://oddsbag.co.kr",
      name: "오즈백 ODDSBAG",
      inLanguage: "ko-KR",
      publisher: { "@id": "https://oddsbag.co.kr/#org" },
      potentialAction: {
        "@type": "SearchAction",
        target: "https://oddsbag.co.kr/magazine?q={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL("https://oddsbag.co.kr"),
  title: {
    default: "오즈백 ODDSBAG | 이상하게 필요한 것들, 여기 다 있어",
    template: "%s | 오즈백 ODDSBAG",
  },
  // 실제로 있는 것만 적는다 (지시 2026-08-12).
  //  아직 안 만든 도구 이름을 검색엔진에 넘기면 들어온 사람이 빈손으로 나가고,
  //  구글은 '적힌 것과 다른 사이트'로 본다.
  description:
    "이상하게 필요한 것들을 한곳에. 오늘의 이슈를 정리한 매거진, 사주·운세 별의 결, 직접 만든 음악과 이야기 — 오즈백에 다 있어.",
  keywords: [
    "오즈백",
    "ODDSBAG",
    "오즈백 매거진",
    "별의 결",
    "오늘의 운세",
    "오즈백 뮤직",
    "오즈백 테일즈",
    "오늘의 이슈",
  ],
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "https://oddsbag.co.kr",
    siteName: "오즈백 ODDSBAG",
    title: "오즈백 ODDSBAG | 이상하게 필요한 것들, 여기 다 있어",
    description: "매일의 사회·경제·스포츠 이슈를 오즈백 시선으로.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "오즈백 ODDSBAG 매거진",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "오즈백 ODDSBAG",
    description: "이상하게 필요한 것들, 오즈백에 다 있어",
    images: ["/og.png"],
  },
  // 홈 주소를 하나로 못박는다.
  //  이게 없으면 oddsbag.co.kr / www / 물음표 붙은 주소가 서로 다른 페이지로 취급돼
  //  검색엔진이 점수를 나눠 갖는다. (기사 페이지엔 이미 들어가 있고 홈만 빠져 있었다)
  alternates: { canonical: "/" },
  // 검색엔진 소유확인
  //  구글 코드는 서치콘솔에서 발급받아 Vercel 환경변수에 넣으면 자동으로 붙는다.
  //  (환경변수 이름: NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION)
  verification: {
    ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
      ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
      : {}),
    other: {
      "naver-site-verification": "86499460c0cebd8ea3e67ab9760eb64b80932da7",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} h-full antialiased`}>
      {/*
        GA 코드는 반드시 <head> 안에 있어야 한다.
        next/script(afterInteractive)는 <body> 끝에 붙이는데, 측정은 되지만
        구글 서치콘솔 소유권 확인이 "head에 없다"며 거부한다.
        그래서 여기서는 일반 script 태그로 head에 직접 넣는다.
      */}
      <head>
        {/*
          «자바스크립트가 살아 있다»는 표시를 첫 그림 그리기 전에 붙인다.
          스크롤 나타나기(.ob-reveal)는 이 표시가 있을 때만 요소를 숨긴다 —
          안 그러면 JS 가 안 도는 환경에서 본문이 통째로 안 보인다 (globals.css 참고).
          next/script 로 넣으면 body 끝이라 이미 늦다. 그래서 head 에 직접 둔다.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.add('js')`,
          }}
        />
        {GA_ID && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`,
              }}
            />
          </>
        )}
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_JSONLD) }}
        />
        {children}
        {/* 마우스 포인터 + 스크롤 나타나기.
            손가락으로 쓰는 기기와 「움직임 줄이기」를 켠 사람에게는 스스로 꺼진다.
            자바스크립트가 안 돌아도 글은 전부 그대로 읽힌다. */}
        <Interactions />
        {ADSENSE_CLIENT && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
