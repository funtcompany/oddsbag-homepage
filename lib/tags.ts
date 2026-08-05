// 해시태그 — 홈페이지(Next) 쪽 진입점.
//
// 계산과 목록은 content-factory/tags.mjs · tagpool.json 한 곳에만 있다.
// 여기서 다시 구현하지 않는다 — 예전에 목록을 두 벌 두었다가, 카드뉴스 쪽만 고치고
// 릴스 쪽이 빠져 꿀팁 글에 #이슈 #뉴스가 붙어 나간 적이 있다.
//
// 태그를 고치려면: content-factory/tagpool.json
import {
  buildTagList as _buildTagList,
  hashtagText as _hashtagText,
  youtubeHashtagText as _youtubeHashtagText,
  youtubeKeywords as _youtubeKeywords,
  YT_DESC_TAG_LIMIT as _YT_DESC_TAG_LIMIT,
} from "../content-factory/tags.mjs";

/** 태그가 붙는 글에서 실제로 쓰는 값들만 추린 모양 */
export type TaggablePost = {
  slug?: string;
  title?: string;
  category?: string;
  tags?: string[];
};

/** 유튜브 설명란 해시태그 상한 — 넘기면 유튜브가 전부 무시한다 */
export const YT_DESC_TAG_LIMIT: number = _YT_DESC_TAG_LIMIT;

/** 대·중·소분류를 골고루 섞은 태그 배열 */
export function buildTagList(post: TaggablePost, max = 30): string[] {
  return _buildTagList(post, max);
}

/** 해시태그 문자열 (인스타·페북·틱톡용) */
export function hashtagText(post: TaggablePost, max = 30): string {
  return _hashtagText(post, max);
}

/** 유튜브 설명란용 — 15개를 넘기지 않는다 */
export function youtubeHashtagText(post: TaggablePost): string {
  return _youtubeHashtagText(post);
}

/** 유튜브 tags 필드용 키워드 (# 없이, 500자 안에서) */
export function youtubeKeywords(post: TaggablePost, max = 30): string[] {
  return _youtubeKeywords(post, max);
}
