import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessageStreamParams, BetaRawMessageStreamEvent } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { ASK_LIMITS, ASK_SYSTEM, accountContext, checkAskRequest, takeQuestion, type AskMessage } from "@/app/_lib/ask";
import { loadHome } from "@/app/_server/home";
import { readSession } from "@/app/_server/session";

// Ask Stow: answers questions with Claude, from a read-only snapshot of the
// user's own account plus True Markets' public Market Data MCP server (via
// Anthropic's MCP connector). Claude has no tool that can move money; its
// answer is shown as text and nothing in it is executed.
//
// Response: newline-delimited JSON events
//   {"type":"status","text":"…"} | {"type":"text","text":"…"} | {"type":"done","remaining":n} | {"type":"error","message":"…"}
// Errors before Claude starts answering come back as a normal JSON error with a status code.

const MODEL = process.env.ASK_MODEL || "claude-opus-5-5";
const MARKET_MCP = { name: "truemarkets-marketdata", url: "https://mcp.truemarkets.co/marketdata/mcp" };
const UNAVAILABLE = "Ask Stow isn't available right now. Please try again later.";

// Per-user daily question counts. In memory: resets on restart and is per server instance.
const g = globalThis as typeof globalThis & { __askCounts?: Map<string, { day: string; used: number }> };
const counts = (g.__askCounts ??= new Map());

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return fail(401, "Sign in to use Ask Stow.");
  if (!process.env.ANTHROPIC_API_KEY) return fail(503, "Ask Stow isn't set up yet.");

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
  const context = accountContext(home.data, now);

  let opened: Opened;
  try {
    opened = await openAnswer(check.messages, context, true);
  } catch (err) {
    // The market data server being down shouldn't take Ask Stow down: answer from the snapshot alone.
    if (mentionsMcp(err)) {
      try {
        opened = await openAnswer(check.messages, context, false);
      } catch (err2) {
        refund();
        return fail(503, describe(err2));
      }
    } else {
      refund();
      return fail(503, describe(err));
    }
  }

  const encoder = new TextEncoder();
  const body$ = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: object) => controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
      try {
        let event: IteratorResult<StreamEvent> = opened.first;
        while (!event.done) {
          const e = event.value;
          if (e.type === "content_block_start" && e.content_block.type === "mcp_tool_use") {
            send({ type: "status", text: "Checking True Markets market data…" });
          } else if (e.type === "content_block_delta" && e.delta.type === "text_delta") {
            send({ type: "text", text: e.delta.text });
          }
          event = await opened.iterator.next();
        }
        const final = await opened.stream.finalMessage();
        if (final.stop_reason === "refusal") {
          send({ type: "text", text: "\n\nI can't help with that one. Try asking about your savings, budgets or the markets." });
        } else if (final.stop_reason === "max_tokens") {
          send({ type: "text", text: "…" });
        }
        send({ type: "done", remaining });
      } catch (err) {
        console.warn(`[ask] stream: ${err instanceof Error ? err.message : String(err)}`);
        send({ type: "error", message: "Ask Stow stopped partway through. Please try again." });
      } finally {
        controller.close();
      }
    },
    cancel() {
      opened.stream.abort();
    },
  });

  return new Response(body$, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

type ClaudeStream = ReturnType<Anthropic["beta"]["messages"]["stream"]>;
type StreamEvent = BetaRawMessageStreamEvent;
type Opened = { stream: ClaudeStream; iterator: AsyncIterator<StreamEvent>; first: IteratorResult<StreamEvent> };

/** Starts Claude's answer and waits for its first event, so setup errors (credit, auth, MCP) surface here. */
async function openAnswer(messages: AskMessage[], context: string, withMarketData: boolean): Promise<Opened> {
  const client = new Anthropic({ timeout: 60_000, maxRetries: 1 });
  const params: BetaMessageStreamParams = {
    model: MODEL,
    max_tokens: 4_000,
    output_config: { effort: "low" },
    betas: withMarketData ? ["server-side-fallback-2026-07-01", "mcp-client-2025-11-20"] : ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [
      { type: "text", text: ASK_SYSTEM, cache_control: { type: "ephemeral" } },
      {
        type: "text",
        text: `Account snapshot for the person asking (read-only):\n<account_snapshot>\n${context}\n</account_snapshot>${
          withMarketData ? "" : "\n\nMarket data tools are unavailable right now; say so if a question needs live market news."
        }`,
      },
    ],
    messages,
    ...(withMarketData
      ? {
          mcp_servers: [{ type: "url" as const, ...MARKET_MCP }],
          tools: [{ type: "mcp_toolset" as const, mcp_server_name: MARKET_MCP.name }],
        }
      : {}),
  };
  const stream = client.beta.messages.stream(params);
  const iterator = stream[Symbol.asyncIterator]();
  const first = await iterator.next();
  return { stream, iterator, first };
}

function mentionsMcp(err: unknown): boolean {
  return err instanceof Anthropic.APIError && /mcp/i.test(err.message);
}

/** A short message for the user; the details go to the server log. */
function describe(err: unknown): string {
  console.warn(`[ask] ${err instanceof Error ? err.message : String(err)}`);
  if (err instanceof Anthropic.RateLimitError) return "Ask Stow is busy right now. Try again in a minute.";
  return UNAVAILABLE;
}

function fail(status: number, error: string) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}
