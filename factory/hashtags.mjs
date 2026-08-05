// 릴스·유튜브용 해시태그 — 실제 계산은 content-factory/tags.mjs 하나에서 한다.
//
// 예전엔 이 파일이 태그 목록을 따로 들고 있었다. 그래서 카드뉴스 쪽(cards.mjs)에서
// '꿀팁' 태그를 고쳤을 때 이 파일만 빠졌고, 릴스에는 계속 #이슈 #뉴스가 붙어 나갔다.
// 목록을 두 벌 두면 반드시 어긋난다 — 그래서 여기엔 목록을 두지 않는다.
//
// 태그를 고치려면: content-factory/tagpool.json
import {
  hashtagText,
  youtubeHashtagText,
  youtubeKeywords,
  YT_DESC_TAG_LIMIT,
} from "../content-factory/tags.mjs";

export { YT_DESC_TAG_LIMIT };

/**
 * 해시태그 문자열.
 * n 을 15 이하로 주면 유튜브 설명란 규칙(15개 초과 시 전부 무시)에 맞춰진다.
 */
export function hashtags(post, n = 15) {
  return n <= YT_DESC_TAG_LIMIT ? youtubeHashtagText(post) : hashtagText(post, n);
}

/** 유튜브 tags 필드용 키워드 배열 (# 없이, 500자 안에서 최대한 많이) */
export function keywords(post, n = 30) {
  return youtubeKeywords(post, n);
}
