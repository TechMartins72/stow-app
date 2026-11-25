import { ASK_LIMITS, ASK_SYSTEM, accountContext, checkAskRequest, takeQuestion } from "@/app/_lib/ask";
import type { ChatMessage, StreamEvent, ToolCall } from "@/app/_lib/groq-stream";
import { GROQ_DEFAULT_MODEL, GroqError, groqConfigured, openChatStream, type ChatRequest, type ToolSpec } from "@/app/_server/groq";
import { loadHome } from "@/app/_server/home";
import { getAssetSummary } from "@/app/_server/market-summary";
import { readSession } from "@/app/_server/session";

// Ask Stow: answers questions with an AI model on Groq, from a read-only snapshot
// of the user's own account plus one read-only tool that fetches True Markets'
// market news summary for a ticker. The model has no tool that can move money;
// its answer is shown as text and nothing in it is executed.
//
// Response: newline-delimited JSON events
//   {"type":"status","text":"…"} | {"type":"text","text":"…"} | {"type":"done","remaining":n} | {"type":"error","message":"…"}
// Errors before the answer starts come back as a normal JSON error with a status code.

const MODEL = process.env.ASK_MODEL || GROQ_DEFAULT_MODEL;
const UNAVAILABLE = "Ask Stow isn't available right now. Please try again later.";
/** Rounds of tool calls before the model must answer; and lookups per round. */
const MAX_TOOL_ROUNDS = 2;
const MAX_LOOKUPS = 4;

const TOOLS: ToolSpec[] = [
  {
    type: "function",
    function: {
      name: "get_asset_summary",
      description:
        "True Markets' latest AI-written market news summary for one asset, by ticker (for example SOL, ETH, BTC, AAPL, NVDA). Use it for questions about what is moving an asset or market news.",
      parameters: {
        type: "object",
        properties: { symbol: { type: "string", description: "The ticker, like SOL or AAPL" } },
        required: ["symbol"],
      },
    },
  },
];

// Per-user daily question counts. In memory: resets on restart and is per server instance.
const g = globalThis as typeof globalThis & { __askCounts?: Map<string, { day: string; used: number }> };
const counts = (g.__askCounts ??= new Map());

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return fail(401, "Sign in to use Ask Stow.");
  if (!groqConfigured()) return fail(503, "Ask Stow isn't set up yet.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "That request wasn't readable.");
  }
  const check = checkAskRequest(body);
  if (!check.ok) return fail(400, check.error);

  const now = new Date();
  const remaining = takeQuestion(counts, session.userId, now);
  if (remaining === null) {
    return fail(429, `You've asked ${ASK_LIMITS.perDay} questions today. Ask Stow resets at midnight UTC.`);
  }
  const refund = () => {
    const c = counts.get(session.userId);
    if (c && c.used > 0) c.used -= 1;
  };

  const home = await loadHome();
  if (!home.ok) {
    refund();
    return fail(503, "Couldn't load your balances just now. Try again in a moment.");
  }

  const convo: ChatMessage[] = [
    { role: "system", content: ASK_SYSTEM },
    {
      role: "system",
      content: `Account snapshot for the person asking (read-only):\n<account_snapshot>\n${accountContext(home.data, now)}\n</account_snapshot>`,
    },
    ...check.messages,
  ];
  const request = (withTools: boolean): ChatRequest => ({
    model: MODEL,
    messages: convo,
    max_completion_tokens: 4_000,
    ...(withTools ? { tools: TOOLS } : {}),
  });

  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 60_000);
  let events: AsyncGenerator<StreamEvent>;
  try {
    events = await openChatStream(request(true), abort.signal);
  } catch (err) {
    clearTimeout(timeout);
    refund();
    return fail(503, describe(err));
  }

  const encoder = new TextEncoder();
  const body$ = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: object) => controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
      try {
        for (let round = 0; ; round++) {
          let finish: Extract<StreamEvent, { type: "finish" }> | null = null;
          for await (const e of events) {
            if (e.type === "text") send({ type: "text", text: e.text });
            else finish = e;
          }
          if (finish?.reason === "length") send({ type: "text", text: "…" });
          if (finish?.reason !== "tool_calls" || finish.toolCalls.length === 0) break;

          send({ type: "status", text: "Checking True Markets market data…" });
          convo.push({ role: "assistant", content: null, tool_calls: finish.toolCalls });
          for (const [i, call] of finish.toolCalls.entries()) {
            convo.push({
              role: "tool",
              tool_call_id: call.id,
              content: i < MAX_LOOKUPS ? await runTool(call) : "Too many lookups at once; answer with what you have.",
            });
          }
          // The last round has no tools, so the model has to answer.
          events = await openChatStream(request(round + 1 < MAX_TOOL_ROUNDS), abort.signal);
        }
        send({ type: "done", remaining });
      } catch (err) {
        console.warn(`[ask] stream: ${err instanceof Error ? err.message : String(err)}`);
        send({ type: "error", message: "Ask Stow stopped partway through. Please try again." });
      } finally {
        clearTimeout(timeout);
        controller.close();
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(body$, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Read-only: True Markets' news summary for one ticker, as text for the model. */
async function runTool(call: ToolCall): Promise<string> {
  if (call.function.name !== "get_asset_summary") return `Unknown tool ${call.function.name}.`;
  let symbol = "";
  try {
    symbol = String((JSON.parse(call.function.arguments) as { symbol?: unknown }).symbol ?? "");
  } catch {
    // Falls through to the check below.
  }
  if (!/^[A-Za-z0-9.]{1,12}$/.test(symbol)) return "That isn't a ticker symbol.";
  const s = await getAssetSummary(symbol);
  if (!s) return `True Markets has no market summary for ${symbol.toUpperCase()} right now.`;
  return JSON.stringify({
    source: "True Markets",
    symbol: symbol.toUpperCase(),
    summary: s.text,
    sentiment: s.sentiment,
    as_of: s.asOf?.toISOString() ?? null,
  });
}

/** A short message for the user; the details go to the server log. */
function describe(err: unknown): string {
  console.warn(`[ask] ${err instanceof Error ? err.message : String(err)}`);
  if (err instanceof GroqError && err.status === 429) return "Ask Stow is busy right now. Try again in a minute.";
  return UNAVAILABLE;
}

function fail(status: number, error: string) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}
