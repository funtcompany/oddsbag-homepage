"use client";

import { useState } from "react";

// 문의 종류 (서버 쪽 lib/inbox.ts 와 같은 목록을 쓴다 —
//  거기엔 DB 접속 코드가 들어 있어 브라우저로 딸려 오면 안 되므로 여기 따로 적는다)
const inquiryKinds = ["제보", "정정", "제휴", "저작권", "기타"];

export default function ContactForm({ thanks }: { thanks: string }) {
  const [kind, setKind] = useState<string>("제보");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // 스팸 잡는 빈 칸
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setState("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, name, email, message, website }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "보내지 못했습니다.");
      setState("done");
    } catch (err) {
      setError((err as Error).message);
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-oddsbag-purple/30 bg-oddsbag-purple/5 px-6 py-10 text-center">
        <p className="text-2xl">✅</p>
        <p className="mt-3 text-[15px] font-bold text-oddsbag-dark">{thanks}</p>
      </div>
    );
  }

  const box =
    "w-full rounded-xl border border-oddsbag-light-gray px-4 py-3 text-[15px] outline-none transition focus:border-oddsbag-purple";

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {inquiryKinds.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${
              kind === k
                ? "bg-oddsbag-purple text-white"
                : "border border-oddsbag-light-gray text-oddsbag-gray hover:text-oddsbag-dark"
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* autoComplete 를 달아 두면 폰에서 저장된 이름·메일이 바로 뜬다 (타자 두 번 덜 친다) */}
        <input
          className={box}
          placeholder="이름 (선택)"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
        />
        {/* 이름에는 «(선택)»이라 적어 두고 메일에는 아무 표시가 없어,
            보내기를 눌러야 «필수»인 걸 알 수 있었다 → 미리 알려준다 */}
        <input
          className={box}
          type="email"
          required
          autoComplete="email"
          placeholder="답장받을 이메일 (필수)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={120}
        />
      </div>

      <textarea
        className={`${box} min-h-[160px] resize-y leading-relaxed`}
        required
        placeholder="문의 내용을 적어주세요. 정정 요청이면 글 제목이나 주소를 함께 적어주시면 빠릅니다."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={4000}
      />

      {/* 자동 프로그램 거르기 — 화면에는 보이지 않는다 */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="hidden"
      />

      {error && <p className="text-sm font-bold text-red-500">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          disabled={state === "sending"}
          className="rounded-full bg-oddsbag-purple px-6 py-3 text-[15px] font-black text-white transition hover:bg-oddsbag-purple-dark disabled:opacity-50"
        >
          {state === "sending" ? "보내는 중…" : "문의 보내기"}
        </button>
        <span className="text-xs text-oddsbag-gray">
          보통 영업일 기준 2~3일 안에 답변드립니다.
        </span>
      </div>
    </form>
  );
}
