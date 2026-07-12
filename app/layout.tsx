import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

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
  // 네이버 서치어드바이저 인증 (발급 후 코드 입력)
  // verification: { other: { "naver-site-verification": "인증코드" } },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
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
