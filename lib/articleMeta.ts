// 글 상세 페이지의 검색엔진용 정보(메타태그·구조화 데이터)를 한곳에서 만든다.
// 매거진·오즈백·뮤직 세 코너가 같은 규칙을 쓰되 주소와 breadcrumb만 다르다.

import type { Metadata } from "next";
import type { Post } from "@/lib/posts";
import { channelOf } from "@/lib/channels";
import { extractGuide } from "@/lib/guide";

const SITE = "https://oddsbag.co.kr";

// 가이드(꿀팁) 글은 '속보'가 아니다.
//  뉴스로 신고하면 구글이 2~3일 뒤 신선도가 떨어진 기사로 취급한다.
//  가이드는 Article + HowTo(따라하기) + FAQPage(자주 묻는 질문)로 신고해야
//  검색 결과에서 단계·질문이 펼쳐져 나온다.
const GUIDE_CATEGORIES = new Set(["꿀팁", "가이드"]);
export function isGuidePost(post: Post): boolean {
  return GUIDE_CATEGORIES.has(post.category);
}

export function articleUrl(post: Post): string {
  return `${SITE}${channelOf(post.channel).base}/${post.slug}`;
}

export function articleMetadata(post: Post): Metadata {
  const image = `/api/og/${post.slug}`;
  const url = articleUrl(post);
  return {
    title: post.title,
    description: post.summary,
    keywords: [...(post.tags ?? []), post.category, "오즈백", "이슈", "뉴스"],
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

export function articleJsonLd(post: Post) {
  const ch = channelOf(post.channel);
  const url = articleUrl(post);
  const guide = isGuidePost(post);
  // 가이드면 본문에서 [단계]·[Q]/[A]를 그대로 뽑아 구조화 데이터로 내보낸다.
  // ※ 값이 비면 그 스키마는 통째로 뺀다 — 빈 스키마는 구글이 오히려 감점한다.
  const parts = guide ? extractGuide(post.body) : null;

  const graph: Record<string, unknown>[] = [
      {
        "@type": guide
          ? "Article"
          : ch.key === "magazine"
            ? "NewsArticle"
            : "Article",
        headline: post.title.slice(0, 110),
        description: post.summary,
        image: [`${SITE}/api/og/${post.slug}`],
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
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "홈", item: SITE },
          {
            "@type": "ListItem",
            position: 2,
            name: ch.label,
            item: `${SITE}${ch.href}`,
          },
          { "@type": "ListItem", position: 3, name: post.title, item: url },
        ],
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
        image: [`${SITE}/api/og/${post.slug}`],
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
