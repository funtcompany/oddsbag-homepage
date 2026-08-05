// 【가이드 전용】 GitHub Actions 진입점 — 뉴스는 건드리지 않고 꿀팁(가이드)만 만든다.
//
// 뉴스는 오늘 안 나가면 죽지만, 가이드는 다음 주에 나가도 값이 같다.
// 그래서 뉴스 슬롯(아침 8시·저녁 8시)과 겹치지 않는 새벽에 따로 돈다.
//   · 외부 뉴스 API를 아예 부르지 않는다 (한도도 시간도 아낀다)
//   · 인스타에는 올라간다 — 인스타는 가이드 전용 채널이다(사장님 지시 2026-08-05).
//     뉴스는 social.mjs 에서 막히고, 여기서 만든 가이드가 그 자리를 채운다.
//   · 남은 주제가 30개 밑으로 떨어지면 로그에 경고를 남긴다
import { runCollection, K_SEEN } from "./pipeline.mjs";
import { remainingEvergreen } from "./evergreen.mjs";
import { smembers } from "./store.mjs";

const LOW_TOPIC_WARN = 30;

const r = await runCollection({
  sources: [],
  guideOnly: true,
  limit: Number(process.env.GUIDE_LIMIT || 1),
});

console.log(
  "가이드 결과:",
  JSON.stringify(
    {
      예약: r.queued?.length ?? 0,
      발행: r.published?.length ?? 0,
      검수함: r.held?.length ?? 0,
      오류: r.errors ?? [],
    },
    null,
    2,
  ),
);

// 주제 소진 경고 — 떨어지고 나서 알면 늦다. 미리 알린다.
try {
  const seen = new Set(await smembers(K_SEEN));
  const left = remainingEvergreen(seen);
  if (left <= LOW_TOPIC_WARN) {
    console.log(`⚠️ 남은 가이드 주제 ${left}개 — evergreen-data.mjs 에 주제 보충이 필요합니다 (facts 포함).`);
  } else {
    console.log(`남은 가이드 주제 ${left}개`);
  }
} catch {
  // 주제 개수를 못 세도 본 작업은 이미 끝났다 — 조용히 넘어간다
}
