import "server-only";

import { readChatStream, type ChatMessage, type StreamEvent } from "@/app/_lib/groq-stream";

// Groq's OpenAI-compatible chat API, over plain fetch. Used by Ask Stow and the
// Advisor's market-context line. Text only: nothing it returns is executed.

const BASE_URL = "https://api.groq.com/openai/v1";
/** Default model for both features; override with ASK_MODEL / ADVISOR_CONTEXT_MODEL. */
export const GROQ_DEFAULT_MODEL = "openai/gpt-oss-120b";

export type ToolSpec = {
  type: "function";
  function: { name: string; description: string; parameters: object };
};

export type ChatRequest = {
  model: string;
  messages: ChatMessage[];
  max_completion_tokens: number;
  tools?: ToolSpec[];
};

export class GroqError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

export const groqConfigured = () => Boolean(process.env.GROQ_API_KEY);

async function post(body: object, signal: AbortSignal): Promise<Response> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
    cache: "no-store",
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    let code: string | undefined;
    try {
      const j = (await res.json()) as { error?: { message?: string; code?: string } };
      if (j.error?.message) message = `HTTP ${res.status}: ${j.error.message}`;
      code = j.error?.code;
    } catch {
      // Not JSON; the status says enough.
    }
    throw new GroqError(res.status, message, code);
  }
  return res;
}

// gpt-oss models reason before answering: keep it short, and never show it.
const REASONING = { reasoning_effort: "low", include_reasoning: false };

/**
 * Starts a streamed reply. Resolves once Groq has accepted the request, so
 * setup errors (bad key, rate limit) surface here rather than mid-answer.
 */
export async function openChatStream(
  req: ChatRequest,
  signal: AbortSignal,
): Promise<AsyncGenerator<StreamEvent>> {
  const res = await post({ ...REASONING, ...req, stream: true }, signal);
  return readChatStream(textChunks(res.body!));
}

async function* textChunks(body: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      yield decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

/** One complete reply. Null text when the model stopped for any reason but finishing. */
export async function chat(
  req: ChatRequest,
  timeoutMs: number,
): Promise<string | null> {
  const res = await post({ ...REASONING, ...req }, AbortSignal.timeout(timeoutMs));
  const j = (await res.json()) as {
    choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  };
  const choice = j.choices?.[0];
  return choice?.finish_reason === "stop" ? (choice.message?.content ?? null) : null;
}
