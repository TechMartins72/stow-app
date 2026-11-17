import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { firstSentences, parseSummary, summarySymbol, type AssetSummary } from "@/app/_lib/market-summary";

// True Markets' public Market Data MCP server: read-only, no login. Only the
// AI summaries come from here (they aren't in the REST API). Display only:
// nothing fetched here feeds a trade, a quote or the Advisor's choices.
const mcpUrl = () => process.env.MARKET_DATA_MCP_URL || "https://mcp.truemarkets.co/marketdata/mcp";
const TIMEOUT_MS = 8_000;
// Summaries are written daily; keep one for 6 hours. Misses (no summary, or
// the server is down) are kept for 15 minutes so a dead server isn't hammered.
const HIT_TTL = 6 * 3_600_000;
const MISS_TTL = 15 * 60_000;

type Entry = { value: AssetSummary | null; expires: number };
const g = globalThis as typeof globalThis & {
  __summaries?: Map<string, Entry>;
  __summaryInflight?: Map<string, Promise<AssetSummary | null>>;
  __contextLines?: Map<string, { value: string; expires: number }>;
};
const cache = (g.__summaries ??= new Map());
const inflight = (g.__summaryInflight ??= new Map());

/** True Markets' latest AI summary for a ticker, or null (no summary, or unreachable). Never throws. */
export async function getAssetSummary(ticker: string): Promise<AssetSummary | null> {
  const symbol = summarySymbol(ticker);
  const hit = cache.get(symbol);
  if (hit && hit.expires > Date.now()) return hit.value;
  const running = inflight.get(symbol);
  if (running) return running;

  const p = fetchSummary(symbol)
    .catch((err: unknown) => {
      console.warn(`[market-summary] ${symbol}: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    })
    .then((value) => {
      cache.set(symbol, { value, expires: Date.now() + (value ? HIT_TTL : MISS_TTL) });
      inflight.delete(symbol);
      return value;
    });
  inflight.set(symbol, p);
  return p;
}

async function fetchSummary(symbol: string): Promise<AssetSummary | null> {
  const client = new Client({ name: "stow", version: "0.1.0" });
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl())), { timeout: TIMEOUT_MS, signal });
    const result = await client.callTool({ name: "get_asset_summary", arguments: { symbol } }, undefined, { timeout: TIMEOUT_MS, signal });
    return parseSummary(result);
  } finally {
    await client.close().catch(() => {});
  }
}

/**
 * One line of market context for an Advisor suggestion about `ticker`. With
 * ANTHROPIC_API_KEY set, Claude relates the day's summary to the suggestion in
 * one neutral sentence; otherwise (or if Claude fails) it's the summary's
 * first sentence. Null when there's no summary. Never throws.
 */
export async function marketContextLine(ticker: string, suggestion: { id: string; title: string; why: string }): Promise<string | null> {
  const summary = await getAssetSummary(ticker);
  if (!summary) return null;
  const fallback = firstSentences(summary.text, 1, 220);
  if (!process.env.ANTHROPIC_API_KEY) return fallback;

  const lines = (g.__contextLines ??= new Map());
  const key = `${suggestion.id}|${summary.text.slice(0, 80)}`;
  const hit = lines.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  // If Claude fails (no credit, outage), show the fallback but try again soon.
  const written = await askClaude(ticker, suggestion, summary.text);
  const value = written ?? fallback;
  lines.set(key, { value, expires: Date.now() + (written ? HIT_TTL : MISS_TTL) });
  return value;
}

const CONTEXT_MODEL = process.env.ADVISOR_CONTEXT_MODEL ?? "claude-opus-5-5";
const SYSTEM = `You write one sentence of market context for a suggestion card in Stow, a savings and budgeting app.
Use only the news summary you are given. Say what is happening with the asset and, if it is clearly relevant, how it relates to the suggestion.
Do not recommend buying, selling or holding. Do not predict prices. No hype, no jargon, no emoji.
Write at most 30 words, as plain text. If the summary has nothing relevant, reply with exactly: NONE`;

async function askClaude(ticker: string, suggestion: { title: string; why: string }, summary: string): Promise<string | null> {
  try {
    const client = new Anthropic({ timeout: 20_000, maxRetries: 1 });
    const res = await client.beta.messages.create({
      model: CONTEXT_MODEL,
      max_tokens: 2_000,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `<suggestion>${suggestion.title}. ${suggestion.why}</suggestion>\n<asset>${ticker}</asset>\n<news_summary>${summary}</news_summary>`,
        },
      ],
    });
    if (res.stop_reason !== "end_turn") return null;
    const text = res.content
      .flatMap((b) => (b.type === "text" ? [b.text] : []))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text || text === "NONE" || text.length > 300) return null;
    return text;
  } catch (err) {
    console.warn(`[advisor-context] Claude: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
