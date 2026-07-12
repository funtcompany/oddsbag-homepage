"use client";

import { useState } from "react";

export default function SubscribeBox() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) {
      setState("error");
      setMessage("이메일 주소를 확인해주세요.");
      return;
    }
    setState("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "실패");
      setState("done");
      setMessage(data.already ? "이미 구독 중이세요! 😊" : "구독 완료! 감사합니다 🎉");
      setEmail("");
    } catch {
      setState("error");
      setMessage("잠시 후 다시 시도해주세요.");
    }
  }

  return (
    <section
      id="subscribe"
      className="scroll-mt-28 overflow-hidden rounded-3xl bg-oddsbag-dark p-6 text-white sm:p-8"
    >
      <div className="mx-auto max-w-xl text-center">
        <h2 className="text-xl font-black sm:text-2xl">
          매일 아침, 오늘의 이슈만 골라서 📮
        </h2>
        <p className="mt-1.5 text-sm text-white/70">
          구독하면 오즈백이 정리한 핵심 이슈를 놓치지 않아요.
        </p>

        <form onSubmit={submit} className="mt-5 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일 주소를 입력하세요"
            className="flex-1 rounded-xl border border-white/25 bg-white px-4 py-3 text-oddsbag-dark placeholder:text-oddsbag-gray/70 outline-none ring-2 ring-transparent focus:border-oddsbag-yellow focus:ring-oddsbag-yellow"
          />
          <button
            type="submit"
            disabled={state === "loading"}
            className="rounded-xl bg-oddsbag-yellow px-6 py-3 text-sm font-black text-oddsbag-dark transition hover:brightness-95 disabled:opacity-60"
          >
            {state === "loading" ? "처리중…" : "구독하기"}
          </button>
        </form>

        {message && (
          <p
            className={`mt-3 text-sm font-medium ${
              state === "error" ? "text-red-300" : "text-oddsbag-yellow"
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
