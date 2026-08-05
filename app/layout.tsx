import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import Script from "next/script";
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
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-G4PMTWJ0XC";

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
  description:
    "한번쯤 써볼 만한 잡다하고 이색적인 기능들을 한곳에. 사과문 생성기, 수면 사이클 역산기, 카페인 계산기부터 오늘의 이슈까지 — 오즈백에 다 있어.",
  keywords: [
    "오즈백",
    "ODDSBAG",
    "사과문 생성기",
    "수면 사이클 계산기",
    "카페인 계산기",
    "더치페이 계산기",
    "이색 도구",
    "생활 도구",
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
