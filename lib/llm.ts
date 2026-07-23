// AI 엔진 계층 — Gemini 우선, 실패하면 Claude로 자동 대체
//
// Gemini(구글)가 Claude보다 훨씬 싸다. 다만 크레딧이 떨어지거나 장애가 나면
// 서비스가 멈추면 안 되므로, 실패 시 Claude로 자동으로 넘어간다.
// 사장님은 아무것도 안 해도 되고, 로그에 어느 엔진을 썼는지 남는다.

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const CEREBRAS_KEY = process.env.CEREBRAS_API_KEY;
const NVIDIA_KEY = process.env.NVIDIA_API_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY;

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const CEREBRAS_MODEL = process.env.CEREBRAS_MODEL || "gpt-oss-120b"; // (무료 크레딧 활성 시) 텍스트 전용
const NVIDIA_MODEL = process.env.NVIDIA_MODEL || "meta/llama-3.3-70b-instruct"; // NVIDIA NIM 무료·텍스트 전용
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "google/gemma-4-31b-it:free"; // 무료 지시형 모델
const CLAUDE_MODEL = "claude-sonnet-5";

export const llmEnabled = Boolean(GEMINI_KEY || CEREBRAS_KEY || NVIDIA_KEY || OPENROUTER_KEY || CLAUDE_KEY);

export interface AskOptions {
  maxTokens?: number;
  /** 심사처럼 정확도가 중요한 작업은 true (Gemini의 추론 예산을 열어준다) */
  careful?: boolean;
  /** 이미지 URL (사진 고르기 등) */
  images?: string[];
}

// ---- Gemini ----
async function askGemini(system: string, user: string, opt: AskOptions): Promise<string> {
  if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY 없음");

  const parts: Record<string, unknown>[] = [{ text: user }];

  // 이미지가 있으면 내려받아 함께 보낸다 (Gemini는 URL을 직접 못 읽는다)
  for (const url of opt.images ?? []) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      if (buf.byteLength > 4_000_000) continue;
      parts.push({
        inline_data: {
          mime_type: res.headers.get("content-type")?.split(";")[0] || "image/jpeg",
          data: Buffer.from(buf).toString("base64"),
        },
      });
    } catch {
      /* 실패한 이미지는 건너뛴다 */
    }
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": GEMINI_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          maxOutputTokens: opt.maxTokens ?? 2200,
          temperature: opt.careful ? 0.2 : 0.7,
          // 심사가 아니면 추론 과정을 끄고 바로 답하게 한다 (빠르고 싸다)
          thinkingConfig: { thinkingBudget: opt.careful ? 1024 : 0 },
        },
        safetySettings: [
          // 뉴스 매거진이라 시사·사건 내용이 정상적으로 다뤄져야 한다
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
        ],
      }),
      cache: "no-store",
    },
  );

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message: string };
  };
  if (data.error) throw new Error(`Gemini: ${data.error.message.slice(0, 120)}`);
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!text) throw new Error("Gemini: 빈 응답");
  return text;
}

// ---- Claude (대체용) ----
async function askClaude(system: string, user: string, opt: AskOptions): Promise<string> {
  if (!CLAUDE_KEY) throw new Error("ANTHROPIC_API_KEY 없음");

  const content: unknown[] = [{ type: "text", text: user }];
  for (const url of opt.images ?? []) {
    content.push({ type: "image", source: { type: "url", url } });
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": CLAUDE_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: opt.maxTokens ?? 2200,
      system,
      messages: [{ role: "user", content }],
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Claude ${res.status}: ${(await res.text()).slice(0, 120)}`);
  const data = (await res.json()) as { content?: { text?: string }[] };
  return data.content?.map((c) => c.text ?? "").join("").trim() ?? "";
}

// ---- Cerebras (무료 대용량·초고속, 텍스트 전용) ----
async function askCerebras(system: string, user: string, opt: AskOptions): Promise<string> {
  if (!CEREBRAS_KEY) throw new Error("CEREBRAS_API_KEY 없음");
  const messages: { role: string; content: string }[] = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: user });
  const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${CEREBRAS_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CEREBRAS_MODEL,
      messages,
      max_tokens: opt.maxTokens ?? 2200,
      temperature: opt.careful ? 0.2 : 0.7,
    }),
    cache: "no-store",
  });
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  if (!res.ok || !data.choices) throw new Error(`Cerebras: ${JSON.stringify(data).slice(0, 120)}`);
  const text = (data.choices[0]?.message?.content ?? "").trim();
  if (!text) throw new Error("Cerebras: 빈 응답");
  return text;
}

// ---- OpenRouter (무료 모델 여러 개를 한 키로 자동 라우팅, 텍스트 전용) ----
async function askOpenRouter(system: string, user: string, opt: AskOptions): Promise<string> {
  if (!OPENROUTER_KEY) throw new Error("OPENROUTER_API_KEY 없음");
  const messages: { role: string; content: string }[] = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: user });
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://oddsbag.co.kr",
      "X-Title": "ODDSBAG",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages,
      max_tokens: opt.maxTokens ?? 2200,
      temperature: opt.careful ? 0.2 : 0.7,
    }),
    signal: AbortSignal.timeout(90000),
    cache: "no-store",
  });
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  if (!res.ok || !data.choices) throw new Error(`OpenRouter: ${JSON.stringify(data).slice(0, 120)}`);
  const text = (data.choices[0]?.message?.content ?? "").trim();
  if (!text) throw new Error("OpenRouter: 빈 응답");
  return text;
}

// ---- NVIDIA NIM (무료·기한무제한, 텍스트 전용) ----
async function askNvidia(system: string, user: string, opt: AskOptions): Promise<string> {
  if (!NVIDIA_KEY) throw new Error("NVIDIA_API_KEY 없음");
  const messages: { role: string; content: string }[] = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: user });
  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${NVIDIA_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      messages,
      max_tokens: opt.maxTokens ?? 2200,
      temperature: opt.careful ? 0.2 : 0.7,
    }),
    signal: AbortSignal.timeout(90000),
    cache: "no-store",
  });
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  if (!res.ok || !data.choices) throw new Error(`NVIDIA: ${JSON.stringify(data).slice(0, 120)}`);
  const text = (data.choices[0]?.message?.content ?? "").trim();
  if (!text) throw new Error("NVIDIA: 빈 응답");
  return text;
}

// ---- 공용 진입점 ----
export async function ask(system: string, user: string, opt: AskOptions = {}): Promise<string> {
  const hasImages = (opt.images?.length ?? 0) > 0;
  if (GEMINI_KEY) {
    try {
      return await askGemini(system, user, opt);
    } catch (e) {
      // 크레딧 소진·장애 → 대체 엔진 (서비스는 멈추지 않는다)
      console.warn("Gemini 실패 → 대체 엔진:", (e as Error).message);
    }
  }
  // Cerebras (텍스트 전용, 무료 대용량 — Gemini 한도 소진 시 받아준다)
  if (CEREBRAS_KEY && !hasImages) {
    try {
      return await askCerebras(system, user, opt);
    } catch (e) {
      console.warn("Cerebras 실패 → 대체 엔진:", (e as Error).message);
    }
  }
  // NVIDIA (텍스트 전용, 무료·무제한 — 일시적 혼잡 시 잠깐 쉬고 재시도)
  if (NVIDIA_KEY && !hasImages) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await askNvidia(system, user, opt);
      } catch (e) {
        const msg = (e as Error).message;
        const busy = /ResourceExhausted|Service Unavailable|worker|limit reached|429|503|timed? ?out/i.test(msg);
        if (busy && attempt < 2) { await new Promise((r) => setTimeout(r, 8000)); continue; }
        console.warn("NVIDIA 실패 → 대체 엔진:", msg);
        break;
      }
    }
  }
  // OpenRouter (무료 모델 자동 라우팅 — 앞 엔진 모두 소진/실패 시 받아준다)
  if (OPENROUTER_KEY && !hasImages) {
    try {
      return await askOpenRouter(system, user, opt);
    } catch (e) {
      console.warn("OpenRouter 실패 → Claude로 대체:", (e as Error).message);
    }
  }
  return askClaude(system, user, opt);
}
