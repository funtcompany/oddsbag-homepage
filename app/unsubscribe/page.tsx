import LegalPage, { Section, List } from "@/components/LegalPage";
import { readUnsubscribeToken } from "@/lib/email";
import { getSiteConfig } from "@/lib/sitecfg";
import Link from "next/link";
import type { Metadata } from "next";

// 메일에서 들어오는 화면이라 색인시키지 않는다 (토큰이 붙은 주소가 검색에 뜨면 안 된다).
export const metadata: Metadata = {
  title: "뉴스레터 구독 해지",
  description: "오즈백 매거진 뉴스레터 구독을 해지합니다.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SP = { t?: string; done?: string; bad?: string };

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const cfg = await getSiteConfig();
  const MAIL = cfg.contact.email;

  const token = (sp.t ?? "").trim();
  const email = token ? readUnsubscribeToken(token) : null;

  // ---- ① 해지 완료 ----
  if (sp.done === "1") {
    return (
      <LegalPage
        title="구독을 해지했습니다"
        lead="더 이상 오즈백 뉴스레터를 보내지 않습니다."
      >
        <Section heading="처리 결과">
          <p className="rounded-2xl bg-oddsbag-light-gray px-5 py-6 text-center">
            <span className="block text-2xl">✅</span>
            <span className="mt-3 block text-[15px] font-bold text-oddsbag-dark">
              등록돼 있던 이메일 주소를 지웠습니다.
            </span>
            <span className="mt-2 block text-xs text-oddsbag-gray">
              보관하지 않고 바로 삭제했습니다.
            </span>
          </p>
        </Section>

        <Section heading="잘못 누르셨나요?">
          <p>
            언제든 다시 신청하실 수 있습니다. 아래에서 이메일만 적으시면 됩니다.
          </p>
          <p>
            <Link
              href="/#subscribe"
              className="inline-block rounded-full bg-oddsbag-purple px-6 py-3 text-[15px] font-black text-white transition hover:bg-oddsbag-purple-dark"
            >
              다시 구독하기
            </Link>
          </p>
        </Section>

        <Section heading="그래도 메일이 오면">
          <p>
            해지 직전에 이미 발송된 메일이 뒤늦게 도착할 수 있습니다. 하루 뒤에도
            계속 온다면{" "}
            <a
              href={`mailto:${MAIL}`}
              className="font-bold text-oddsbag-purple underline"
            >
              {MAIL}
            </a>{" "}
            로 알려주세요. 직접 처리해 드립니다.
          </p>
        </Section>
      </LegalPage>
    );
  }

  // ---- ② 토큰이 없거나 위조된 링크 ----
  if (!email) {
    return (
      <LegalPage
        title="해지 링크를 확인할 수 없습니다"
        lead="주소가 잘리거나 오래된 링크일 수 있습니다."
      >
        <Section heading="이럴 때 이렇게 됩니다">
          <List
            items={[
              <>메일 앱이 링크를 도중에 잘라서 붙였을 때</>,
              <>링크를 복사하다 뒷부분이 빠졌을 때</>,
              <>구독 신청 화면에서 받은 링크가 아닐 때</>,
            ]}
          />
          {sp.bad === "1" && (
            <p className="text-sm font-bold text-red-500">
              방금 보낸 해지 요청의 링크가 올바르지 않아 처리하지 못했습니다.
            </p>
          )}
        </Section>

        <Section heading="가장 빠른 해결">
          <p>
            받으신 메일 맨 아래의 <strong>구독 해지</strong> 링크를 다시
            눌러주세요. 그래도 안 되면 아래로 메일 한 줄만 주시면 저희가 직접
            지워드립니다.
          </p>
          <p className="rounded-2xl bg-oddsbag-light-gray px-5 py-6 text-center">
            <a
              href={`mailto:${MAIL}`}
              className="text-lg font-black text-oddsbag-purple underline underline-offset-4 sm:text-xl"
            >
              {MAIL}
            </a>
            <span className="mt-2 block text-xs text-oddsbag-gray">
              눌러서 바로 메일 쓰기
            </span>
          </p>
        </Section>
      </LegalPage>
    );
  }

  // ---- ③ 확인 화면 (여기서는 아직 아무것도 지우지 않았다) ----
  //
  // ★한 번 더 누르게 하는 이유
  //   회사 메일 보안 프로그램이 메일 속 링크를 미리 눌러 안전한지 검사한다.
  //   링크를 여는 것만으로 해지되면 본인 의사와 상관없이 구독이 끊긴다.
  //   그래서 실제 삭제는 이 버튼(POST)에서만 일어난다.
  const masked = (() => {
    const [local, domain] = email.split("@");
    return `${local.slice(0, 1)}${"*".repeat(Math.max(2, local.length - 1))}@${domain}`;
  })();

  return (
    <LegalPage
      title="구독을 해지하시겠습니까?"
      lead="아직 해지되지 않았습니다. 아래 버튼을 누르셔야 처리됩니다."
    >
      <Section heading="해지할 주소">
        <p className="rounded-2xl bg-oddsbag-light-gray px-5 py-6 text-center">
          <span className="text-lg font-black text-oddsbag-dark sm:text-xl">
            {masked}
          </span>
          <span className="mt-2 block text-xs text-oddsbag-gray">
            보안을 위해 일부만 보여드립니다
          </span>
        </p>
      </Section>

      <Section heading="누르시면 이렇게 됩니다">
        <List
          items={[
            <>등록된 이메일 주소를 즉시 삭제합니다. 따로 보관하지 않습니다.</>,
            <>이후로 오즈백 뉴스레터가 발송되지 않습니다.</>,
            <>
              매거진은 <strong>oddsbag.co.kr</strong> 에서 그대로 보실 수
              있습니다.
            </>,
          ]}
        />
        {/* 자바스크립트 없이도 눌리도록 일반 폼으로 보낸다 — 메일 앱 내장 브라우저 대비 */}
        <form action="/api/unsubscribe" method="post" className="pt-1">
          <input type="hidden" name="t" value={token} />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="rounded-full bg-oddsbag-purple px-6 py-3 text-[15px] font-black text-white transition hover:bg-oddsbag-purple-dark"
            >
              해지하기
            </button>
            <Link
              href="/"
              className="rounded-full border border-oddsbag-light-gray px-6 py-3 text-[15px] font-bold text-oddsbag-gray transition hover:text-oddsbag-dark"
            >
              그냥 두기
            </Link>
          </div>
        </form>
      </Section>

      <Section heading="잘못 들어오셨다면">
        <p>
          아무것도 누르지 않고 이 창을 닫으시면 됩니다. 구독은 그대로
          유지됩니다.
        </p>
      </Section>
    </LegalPage>
  );
}
