import Link from "next/link";
import {
  services,
  matchesService,
  type ServiceDef,
} from "@/lib/services-catalog";
import type { Post } from "@/lib/posts";

// 기사 맨 끝 — 그 글과 «정말로» 맞는 오즈백 서비스가 있을 때만 뜨는 칸.
//
// ★왜 만들었나
//   본문 렌더러(ArticleView)는 본문 안의 주소를 링크로 만들지 않는다.
//   그래서 글에 starflow.today 를 적어도 «글자»로만 보이고 눌리지 않았다.
//   지금까지 오즈백 → 서비스로 가는 길은 「태그 → 서비스 탭」 하나뿐이었다.
//   이 칸이 글 끝에서 한 번 더 문을 열어 준다.
//
// ★안 뜨는 게 기본이다
//   맞는 서비스가 없으면 아무것도 안 그린다(null). 상관없는 기사에 배너가 붙으면
//   그 순간부터 독자가 이 칸 전체를 광고로 보고 무시한다.
//   판정은 lib/services-catalog 의 matchesService 하나만 쓴다 —
//   태그 정확 일치 + 제목의 고유 이름. (요약·본문은 보지 않는다. 잘못 걸릴 게 더 많다)

/**
 * 금액·무료 표기를 걸러내는 자.
 * 회사 공통 규칙 — 안내 화면에서는 값을 말하지 않는다(00-hq/policy.json).
 * 파는 값은 판매 페이지에서만 말한다. 「무료」도 값에 대한 말이라 여기서 뺀다.
 * ※ `원`을 홑글자로 잡으면 「원문·원래」까지 걸리므로 «숫자+원» 꼴만 잡는다.
 */
const 금액표기 = /[0-9][0-9,]*\s*원|₩|무료|공짜|할인|세일|가격|요금|결제|free/i;

/**
 * 한 줄 설명 — services-catalog 의 lead 첫 문장을 그대로 쓴다.
 * 여기서 문구를 새로 짓지 않는다. 서비스 설명의 원본은 카탈로그 한 곳이어야
 * 나중에 설명이 바뀔 때 이 칸만 낡는 일이 없다.
 * 금액·무료가 든 문장은 통째로 버리고 그 다음 문장을 쓴다.
 */
function 한줄(svc: ServiceDef): string {
  const 문장 = svc.lead
    .split(/\.\s+/) // 마침표+공백 = 문장 경계 (ES2017 목표라 lookbehind는 쓰지 않는다)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !금액표기.test(s));

  const first = 문장[0] ?? svc.headline;
  return first.endsWith(".") ? first : `${first}.`;
}

/**
 * 어디로 보낼까 —
 *  ① 카탈로그의 주 버튼(primary)이 바깥 사이트면 거기로 (별의 결 → starflow.today)
 *  ② 없으면 오즈백 안의 서비스 안내 화면으로
 * 목적지도 카탈로그가 정한다. 여기에 주소를 새로 적지 않는다.
 */
function 목적지(svc: ServiceDef): { href: string; external: boolean } {
  const primary = svc.ctas.find((c) => c.kind === "primary" && c.external);
  if (primary) return { href: primary.href, external: true };
  return { href: `/oddsbag/service/${svc.slug}`, external: false };
}

export default function ServiceBand({ post }: { post: Post }) {
  // 게시판 전용 글은 이미 그 서비스 화면 «안»에 있는 글이다. 같은 문을 두 번 그리지 않는다.
  if (post.boardOnly) return null;

  // 여러 개가 맞아도 첫 하나만. 배너를 두 장 붙이면 둘 다 무시당한다.
  const svc = services.find((s) => matchesService(post, s));
  if (!svc) return null;

  const { href, external } = 목적지(svc);
  const 버튼 =
    "shrink-0 rounded-xl bg-oddsbag-purple px-5 py-2.5 text-[14px] font-black text-white transition hover:brightness-125";

  return (
    <aside className="mt-10 rounded-2xl border border-oddsbag-purple/20 bg-oddsbag-purple/[0.06] p-5">
      <p className="text-[11.5px] font-black tracking-[0.16em] text-oddsbag-purple">
        오즈백이 만드는 것
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <span className="text-3xl" aria-hidden>
          {svc.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-black text-oddsbag-dark">{svc.name}</p>
          <p
            className="mt-0.5 text-[14px] leading-relaxed text-oddsbag-gray"
            style={{ wordBreak: "keep-all" }}
          >
            {한줄(svc)}
          </p>
        </div>
        {external ? (
          // 바깥 사이트로 나간다 → 읽던 기사를 잃지 않게 새 탭.
          // rel 은 보안상 필수 (새 탭이 원래 창을 조작하지 못하게 한다).
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={버튼}
          >
            보러 가기 ↗
          </a>
        ) : (
          <Link href={href} className={버튼}>
            보러 가기 →
          </Link>
        )}
      </div>
    </aside>
  );
}
