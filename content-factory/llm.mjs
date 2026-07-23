// AI 엔진 계층 — Gemini 우선, 실패하면 Claude로 자동 대체
//
// Gemini(구글)가 Claude보다 훨씬 싸다. 다만 크레딧이 떨어지거나 장애가 나면
// 서비스가 멈추면 안 되므로, 실패 시 Claude로 자동으로 넘어간다.
// 사장님은 아무것도 안 해도 되고, 로그에 어느 엔진을 썼는지 남는다.

const GROQ_KEY = process.env.GROQ_API_KEY;
// 여러 개면 하나 소진 시 다음 키로 자동 로테이션 (구글 계정마다 하루 1,500회 → 개수만큼 배)
const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5,
].filter(Boolean);
const CEREBRAS_KEY = process.env.CEREBRAS_API_KEY;
const NVIDIA_KEY = process.env.NVIDIA_API_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY;

const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b"; // 한국어 우수 + 무료 한도 넉넉(20b가 120b보다 여유)
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest"; // 항상 최신 flash (신·구 키 모두 호환)
const CEREBRAS_MODEL = process.env.CEREBRAS_MODEL || "gpt-oss-120b"; // (무료 크레딧 활성 시) 텍스트 전용
const NVIDIA_MODEL = process.env.NVIDIA_MODEL || "meta/llama-3.3-70b-instruct"; // NVIDIA NIM 무료·텍스트 전용
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "google/gemma-4-31b-it:free"; // 무료 지시형 모델
const CLAUDE_MODEL = "claude-sonnet-5";

export const llmEnabled = Boolean(GROQ_KEY || GEMINI_KEYS.length || CEREBRAS_KEY || NVIDIA_KEY || OPENROUTER_KEY || CLAUDE_KEY);

// ---- Groq (주력: 무료 한도 넉넉·빠름·한국어 우수). 텍스트 전용(이미지 미지원) ----
async function askGroq(system, user, opt) {
  if (!GROQ_KEY) throw new Error("GROQ_API_KEY 없음");
  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: user });
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      max_tokens: opt.maxTokens ?? 2200,
      temperature: opt.careful ? 0.2 : 0.7,
    }),
    signal: AbortSignal.timeout(60000),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok || !data.choices) throw new Error(`Groq: ${JSON.stringify(data).slice(0, 120)}`);
  const text = (data.choices[0]?.message?.content ?? "").trim();
  if (!text) throw new Error("Groq: 빈 응답");
  return text;
}

// ---- Gemini ----
async function askGemini(system, user, opt, key) {
  if (!key) throw new Error("GEMINI_API_KEY 없음");

  const parts = [{ text: user }];

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
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          maxOutputTokens: opt.maxTokens ?? 2200,
          temperature: opt.careful ? 0.2 : 0.7,
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

  const data = await res.json();
  if (data.error) throw new Error(`Gemini: ${data.error.message.slice(0, 120)}`);
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!text) throw new Error("Gemini: 빈 응답");
  return text;
}

// ---- Claude (대체용) ----
async function askClaude(system, user, opt) {
  if (!CLAUDE_KEY) throw new Error("ANTHROPIC_API_KEY 없음");

  const content = [{ type: "text", text: user }];
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
  const data = await res.json();
  return data.content?.map((c) => c.text ?? "").join("").trim() ?? "";
}

// ---- Cerebras (무료 대용량·초고속, 텍스트 전용) ----
async function askCerebras(system, user, opt) {
  if (!CEREBRAS_KEY) throw new Error("CEREBRAS_API_KEY 없음");
  const messages = [];
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
    signal: AbortSignal.timeout(60000),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok || !data.choices) throw new Error(`Cerebras: ${JSON.stringify(data).slice(0, 120)}`);
  const text = (data.choices[0]?.message?.content ?? "").trim();
  if (!text) throw new Error("Cerebras: 빈 응답");
  return text;
}

// ---- OpenRouter (무료 모델 여러 개를 한 키로 자동 라우팅, 텍스트 전용) ----
async function askOpenRouter(system, user, opt) {
  if (!OPENROUTER_KEY) throw new Error("OPENROUTER_API_KEY 없음");
  const messages = [];
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
  const data = await res.json();
  if (!res.ok || !data.choices) throw new Error(`OpenRouter: ${JSON.stringify(data).slice(0, 120)}`);
  const text = (data.choices[0]?.message?.content ?? "").trim();
  if (!text) throw new Error("OpenRouter: 빈 응답");
  return text;
}

// ---- NVIDIA NIM (무료·기한무제한, 텍스트 전용). 콜드스타트로 느릴 수 있어 타임아웃 넉넉히 ----
async function askNvidia(system, user, opt) {
  if (!NVIDIA_KEY) throw new Error("NVIDIA_API_KEY 없음");
  const messages = [];
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
  const data = await res.json();
  if (!res.ok || !data.choices) throw new Error(`NVIDIA: ${JSON.stringify(data).slice(0, 120)}`);
  const text = (data.choices[0]?.message?.content ?? "").trim();
  if (!text) throw new Error("NVIDIA: 빈 응답");
  return text;
}

// ---- 공용 진입점 ----
// 무료 AI 한도(분당 요청/토큰) 준수: 호출 간 최소 간격 + 한도 초과 시 잠깐 쉬고 재시도.
let _lastCall = 0, _lastGroq = 0;
const MIN_GAP_MS = Number(process.env.LLM_MIN_GAP_MS || 4500); // Gemini ≈13회/분
const GROQ_GAP_MS = Number(process.env.GROQ_GAP_MS || 7000);   // Groq ≈8회/분 (무료 분당 한도 이내)
const _sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const _isQuota = (m) => /quota|RESOURCE_EXHAUSTED|429|rate limit|too many/i.test(String(m));

export async function ask(system, user, opt = {}) {
  const hasImages = (opt.images?.length ?? 0) > 0;
  // 1) 텍스트는 Groq 우선 (무료 한도 넉넉). 이미지 인식(비전)은 Groq 미지원 → Gemini로.
  if (GROQ_KEY && !hasImages) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const wait = GROQ_GAP_MS - (Date.now() - _lastGroq);
      if (wait > 0) await _sleep(wait);
      _lastGroq = Date.now();
      try {
        return await askGroq(system, user, opt);
      } catch (e) {
        if (/rate limit|429|too many/i.test(e.message) && attempt === 0) { await _sleep(12000); continue; } // 분당 한도 → 12초 쉬고 1회 재시도
        console.warn("Groq 실패 → Gemini로 대체:", e.message);
        break;
      }
    }
  }
  // 2) Gemini (키 여러 개면 소진 시 다음 키로 자동 로테이션. 비전 포함, 또는 Groq 실패 시)
  for (const gkey of GEMINI_KEYS) {
    const wait = MIN_GAP_MS - (Date.now() - _lastCall);
    if (wait > 0) await _sleep(wait);
    _lastCall = Date.now();
    try {
      return await askGemini(system, user, opt, gkey);
    } catch (e) {
      if (_isQuota(e.message)) { console.warn("Gemini 키 소진 → 다음 키로:", e.message.slice(0, 50)); continue; }
      console.warn("Gemini 실패 → 다음 엔진:", e.message);
      break;
    }
  }
  // 3) Cerebras (텍스트 전용, 무료 대용량 — Groq·Gemini 한도 소진 시 받아준다)
  if (CEREBRAS_KEY && !hasImages) {
    try {
      return await askCerebras(system, user, opt);
    } catch (e) {
      console.warn("Cerebras 실패 → Claude로 대체:", e.message);
    }
  }
  // 4) NVIDIA (텍스트 전용, 무료·무제한 — 일시적 혼잡 시 잠깐 쉬고 재시도)
  if (NVIDIA_KEY && !hasImages) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await askNvidia(system, user, opt);
      } catch (e) {
        const busy = /ResourceExhausted|Service Unavailable|worker|limit reached|429|503|timed? ?out/i.test(e.message);
        if (busy && attempt < 2) { await _sleep(8000); continue; } // 혼잡 → 8초 쉬고 재시도
        console.warn("NVIDIA 실패 → Claude로 대체:", e.message);
        break;
      }
    }
  }
  // 5) OpenRouter (무료 모델 자동 라우팅 — NVIDIA까지 소진/실패 시 받아준다)
  if (OPENROUTER_KEY && !hasImages) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await askOpenRouter(system, user, opt);
      } catch (e) {
        if (/429|rate limit|Service Unavailable|timed? ?out/i.test(e.message) && attempt < 1) { await _sleep(6000); continue; }
        console.warn("OpenRouter 실패 → Claude로 대체:", e.message);
        break;
      }
    }
  }
  // 6) Claude (최후 예비)
  return askClaude(system, user, opt);
}
