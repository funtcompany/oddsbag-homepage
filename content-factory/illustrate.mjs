// 제미나이 삽화 — 스톡 사진이 안 맞는 정보성 글의 커버를 대신 그린다.
//
// 【왜 필요한가】
//  "맥북 단축키 7가지" 같은 글에 어울리는 스톡 사진은 없다. 억지로 노트북 사진을 붙이면
//  내용과 상관없는 장식이 된다. 그래서 추상 일러스트를 그려 커버로 쓴다.
//
// 【지키는 것】
//  · 글자를 그리게 하지 않는다. 한글은 거의 깨지고, 영문도 틀린 단어가 나온다.
//    제목·설명은 홈페이지가 HTML로 얹는다.
//  · 실제 프로그램 화면(메뉴·아이콘)을 그리게 하지 않는다. 없는 메뉴가 생기면 가짜 화면이다.
//  · 한도에 걸리거나 실패하면 조용히 건너뛴다. 커버가 없으면 기존 타이포 디자인이 나온다.
//
// 【키를 따로 쓰는 이유】
//  글 쓰는 데 쓰는 제미나이 키와 같은 키를 쓰면 이미지가 하루 한도를 잡아먹어
//  정작 글이 안 써진다(실측: 이미지 요청 몇 번에 하루 한도 소진).
//  그래서 GEMINI_IMAGE_API_KEY 를 따로 받고, 없으면 아예 동작하지 않는다.

import { kvSet } from "./store.mjs";

const KEY = process.env.GEMINI_IMAGE_API_KEY;
const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";
const ON = process.env.ILLUSTRATE === "1";

// Redis 한 값의 크기 한계가 있어, 큰 이미지는 저장하지 않고 넘어간다.
const MAX_BYTES = Number(process.env.ILLUS_MAX_BYTES || 700_000);

export const illustrateEnabled = Boolean(ON && KEY);

// 분야별 그림 분위기 — 브랜드 색(딥 퍼플 + 네온 옐로)을 유지한다
const STYLE =
  "clean minimal flat vector illustration, deep purple (#5B2D8E) and bright yellow (#FFE600) accents, " +
  "white background, simple geometric shapes, soft shadows, modern editorial style, wide banner composition";

const NEGATIVE =
  "absolutely no text, no letters, no words, no numbers, no logos, no watermark, " +
  "no user interface screenshots, no realistic app windows or menus, no human faces";

function buildPrompt(title, summary) {
  // 제목을 그대로 넣으면 그 글자를 그림 안에 그리려 든다 → 주제만 영어 개념어로 전달한다.
  const topic = `${title} ${summary ?? ""}`.slice(0, 180);
  return (
    `Create a header illustration for an article about: ${topic}\n\n` +
    `Style: ${STYLE}\n` +
    `Must not include: ${NEGATIVE}\n` +
    `Convey the idea through objects, icons and shapes only.`
  );
}

/**
 * 커버 삽화를 만들어 저장하고, 홈페이지에서 쓸 주소를 돌려준다.
 * 꺼져 있거나 실패하면 null (호출한 쪽은 그냥 커버 없이 진행하면 된다).
 */
export async function makeIllustration(post) {
  if (!illustrateEnabled) return null;

  const body = {
    contents: [{ parts: [{ text: buildPrompt(post.title, post.summary) }] }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: "16:9" },
    },
  };

  let data;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    data = await res.json();
  } catch (e) {
    console.log("  · 삽화 건너뜀(요청 실패):", e.message);
    return null;
  }

  if (data.error) {
    // 한도 초과는 흔한 일이라 조용히 넘어간다 (원인은 남긴다)
    const ids = (data.error.details ?? [])
      .flatMap((d) => d.violations ?? [])
      .map((v) => v.quotaId ?? "")
      .filter(Boolean);
    console.log(
      `  · 삽화 건너뜀: ${data.error.message?.slice(0, 60)}`,
      ids.length ? `(${ids.join(",")})` : "",
    );
    return null;
  }

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const img = parts.find((p) => p.inlineData?.data);
  if (!img) {
    console.log("  · 삽화 건너뜀: 이미지가 오지 않음");
    return null;
  }

  const b64 = img.inlineData.data;
  const bytes = Math.floor((b64.length * 3) / 4);
  if (bytes > MAX_BYTES) {
    console.log(`  · 삽화 건너뜀: 너무 큼 (${Math.round(bytes / 1024)}KB)`);
    return null;
  }

  try {
    await kvSet(`illus:${post.slug}`, JSON.stringify({
      mime: img.inlineData.mimeType || "image/png",
      data: b64,
      at: new Date().toISOString(),
    }));
  } catch (e) {
    console.log("  · 삽화 저장 실패:", e.message);
    return null;
  }

  console.log(`  · 삽화 생성 (${Math.round(bytes / 1024)}KB)`);
  return `/api/illus/${post.slug}`;
}
