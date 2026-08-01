"use client";

import { useEffect } from "react";

// 글을 열면 조회수 1 올린다.
// 같은 탭에서 새로고침해도 중복으로 세지 않도록 sessionStorage로 한 번만 보낸다.
export default function ViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `oddsbag-viewed:${slug}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    fetch("/api/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
      keepalive: true,
    }).catch(() => {
      // 조회수 집계 실패가 글 읽기를 방해하면 안 된다 — 조용히 넘어간다
    });
  }, [slug]);

  return null;
}
