// 글 상세 페이지의 검색엔진용 정보(메타태그·구조화 데이터)를 한곳에서 만든다.
// 매거진·오즈백·뮤직 세 코너가 같은 규칙을 쓰되 주소와 breadcrumb만 다르다.

import type { Metadata } from "next";
import type { Post } from "@/lib/posts";
import { channelOf } from "@/lib/channels";
import { extractGuide } from "@/lib/guide";
import { serviceOf } from "@/lib/services-catalog";

const SITE = "https://oddsbag.co.kr";

// 가이드(꿀팁) 글은 '속보'가 아니다.
//  뉴스로 신고하면 구글이 2~3일 뒤 신선도가 떨어진 기사로 취급한다.
//  가이드는 Article + HowTo(따라하기) + FAQPage(자주 묻는 질문)로 신고해야
//  검색 결과에서 단계·질문이 펼쳐져 나온다.
const GUIDE_CATEGORIES = new Set(["꿀팁", "가이드"]);
export function isGuidePost(post: Post): boolean {
  return GUIDE_CATEGORIES.has(post.category);
}

// 게시판 전용 글(boardOnly)도 '뉴스'가 아니다.
//  WPMS 같은 제품 안내 글을 NewsArticle 로 신고하면 구글 뉴스에 제품 광고를 기사로 내는 셈이 된다.
//  (지시 2026-08-18 «WPMS 원고는 뉴스가 아니다») → 언제나 일반 Article 로 신고한다.
export function isBoardPost(post: Post): boolean {
  return Boolean(post.boardOnly);
}

export function articleUrl(post: Post): string {
  return `${SITE}${channelOf(post.channel).base}/${post.slug}`;
}

// 구글은 기사 이미지를 "화면비가 다른 여러 장"으로 주는 걸 권장한다.
//  한 장만 주면 디스커버·이미지 검색에서 자리를 못 잡는 화면비가 생긴다.
//  둘 다 이미 서버에서 즉시 만들어지는 이미지라 새로 만들 게 없다.
//   · /api/og   → 1200x630 (가로, 링크 공유용)
//   · /api/card → 1440x1800 (세로, 인스타 카드 1장째)
function articleImages(post: Post): string[] {
  return [`${SITE}/api/og/${post.slug}`, `${SITE}/api/card/${post.slug}?i=0`];
}

export function articleMetadata(post: Post): Metadata {
  const image = `/api/og/${post.slug}`;
  const url = articleUrl(post);
  return {
    title: post.title,
    description: post.summary,
    keywords: [
      ...(post.tags ?? []),
      post.category,
      "오즈백",
      // 게시판 전용 글(제품 안내)은 '이슈·뉴스'가 아니다
      ...(post.boardOnly ? [] : ["이슈", "뉴스"]),
    ],
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      locale: "ko_KR",
      siteName: "오즈백 ODDSBAG",
      title: post.title,
      description: post.summary,
      url,
      publishedTime: post.publishedAt ?? post.date,
      modifiedTime: post.auditedAt ?? post.publishedAt ?? post.date,
      section: post.category,
      tags: post.tags,
      images: [{ url: image, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.summary,
      images: [image],
    },
  };
}

// 빵부스러기 — 게시판 전용 글은 그 게시판을 한 칸 끼워 넣는다.
//  «홈 > 만드는 것들 > WPMS > 글» 이라고 알려야 구글이 뉴스가 아닌 제품 안내로 읽는다.
function breadcrumb(
  post: Post,
  chLabel: string,
  chHref: string,
  url: string,
): Record<string, unknown>[] {
  const items: { name: string; item: string }[] = [
    { name: "홈", item: SITE },
    { name: chLabel, item: `${SITE}${chHref}` },
  ];
  const svc = post.boardOnly ? serviceOf(post.boardOnly) : undefined;
  if (svc) items.push({ name: svc.tab, item: `${SITE}/oddsbag/service/${svc.slug}` });
  items.push({ name: post.title, item: url });
  return items.map((it, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: it.name,
    item: it.item,
  }));
}

export function articleJsonLd(post: Post) {
  const ch = channelOf(post.channel);
  const url = articleUrl(post);
  const guide = isGuidePost(post);
  const board = isBoardPost(post);
  // 가이드면 본문에서 [단계]·[Q]/[A]를 그대로 뽑아 구조화 데이터로 내보낸다.
  // ※ 값이 비면 그 스키마는 통째로 뺀다 — 빈 스키마는 구글이 오히려 감점한다.
  const parts = guide ? extractGuide(post.body) : null;

  const graph: Record<string, unknown>[] = [
      {
        "@type":
          guide || board
            ? "Article"
            : ch.key === "magazine"
              ? "NewsArticle"
              : "Article",
        headline: post.title.slice(0, 110),
        description: post.summary,
        image: articleImages(post),
        datePublished: post.publishedAt ?? post.date,
        dateModified: post.auditedAt ?? post.publishedAt ?? post.date,
        articleSection: post.category,
        keywords: (post.tags ?? []).join(", "),
        inLanguage: "ko-KR",
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        author: {
          "@type": "Organization",
          name: "오즈백 ODDSBAG",
          url: SITE,
        },
        publisher: {
          "@type": "Organization",
          name: "오즈백 ODDSBAG",
          logo: { "@type": "ImageObject", url: `${SITE}/og.png` },
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: breadcrumb(post, ch.label, ch.href, url),
      },
  ];

  if (parts) {
    // ① 따라하기 — [단계] 줄이 가장 많이 이어진 묶음 하나를 HowTo로 (2단계 이상일 때만)
    const steps = parts.stepGroups.reduce<string[]>(
      (best, g) => (g.length > best.length ? g : best),
      [],
    );
    if (steps.length >= 2) {
      graph.push({
        "@type": "HowTo",
        name: post.title.slice(0, 110),
        description: parts.answer || post.summary,
        image: articleImages(post),
        inLanguage: "ko-KR",
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        step: steps.map((t, i) => ({
          "@type": "HowToStep",
          position: i + 1,
          name: t.slice(0, 80),
          text: t,
        })),
      });
    }
    // ② 자주 묻는 질문 — [Q]/[A] 짝이 하나라도 있을 때만
    if (parts.faqs.length > 0) {
      graph.push({
        "@type": "FAQPage",
        inLanguage: "ko-KR",
        mainEntity: parts.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      });
    }
  }

  return { "@context": "https://schema.org", "@graph": graph };
}
