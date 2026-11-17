// Pure helpers for True Markets' AI asset summaries (Market Data MCP server,
// tool `get_asset_summary`). Display only: nothing here feeds a trade or the
// Advisor's choice of suggestion. The tool's output format isn't documented,
// so parsing accepts JSON (in structured content or text) or plain text, and
// anything unusable becomes null, which hides the card.

export type Sentiment = "positive" | "negative" | "mixed" | "neutral";

export interface AssetSummary {
  /** The summary, as plain sentences (markdown stripped). */
  text: string;
  sentiment: Sentiment | null;
  /** When True Markets generated it, if the tool says. */
  asOf: Date | null;
}

/** The symbol True Markets' market data uses for one of our tickers. */
export function summarySymbol(ticker: string): string {
  const t = ticker.trim().toUpperCase();
  return t === "CBBTC" ? "BTC" : t;
}

interface ToolResultLike {
  isError?: unknown;
  content?: unknown;
  structuredContent?: unknown;
}

const TEXT_KEYS = ["summary", "text", "content", "analysis", "overview", "description", "body"];
const SENTIMENT_KEYS = ["sentiment", "sentiment_label", "sentimentLabel", "overall_sentiment", "mood"];
const DATE_KEYS = ["date", "as_of", "asOf", "generated_at", "generatedAt", "created_at", "createdAt", "updated_at", "updatedAt", "timestamp"];
const NO_DATA = /^(no|not)\b.*\b(summary|data|available|found)\b/i;

export function parseSummary(raw: unknown): AssetSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const result = raw as ToolResultLike;
  if (result.isError) return null;
  const candidates: unknown[] = [];
  if (result.structuredContent) candidates.push(result.structuredContent);
  for (const block of Array.isArray(result.content) ? result.content : []) {
    if (block && typeof block === "object" && (block as { type?: unknown }).type === "text") {
      const raw = String((block as { text?: unknown }).text ?? "").trim();
      candidates.push(tryJson(raw) ?? raw);
    }
  }
  for (const c of candidates) {
    const parsed = fromValue(c);
    if (parsed) return parsed;
  }
  return null;
}

function fromValue(value: unknown): AssetSummary | null {
  if (typeof value === "string") return fromFields(value, null, null);
  if (Array.isArray(value)) return value.length > 0 ? fromValue(value[0]) : null;
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  // Some APIs wrap the payload: { data: {...} } or { summary: {...} }.
  for (const wrap of ["data", "result", "summary"]) {
    const inner = obj[wrap];
    if (inner && typeof inner === "object") {
      const parsed = fromValue(inner);
      if (parsed) return parsed;
    }
  }
  const text = pick(obj, TEXT_KEYS);
  if (typeof text !== "string") return null;
  return fromFields(text, pick(obj, SENTIMENT_KEYS), pick(obj, DATE_KEYS));
}

function fromFields(rawText: string, rawSentiment: unknown, rawDate: unknown): AssetSummary | null {
  const text = plain(rawText);
  if (text.length < 40 || NO_DATA.test(text)) return null;
  return { text, sentiment: toSentiment(rawSentiment), asOf: toDate(rawDate) };
}

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  return undefined;
}

function tryJson(raw: string): unknown {
  if (!raw.startsWith("{") && !raw.startsWith("[")) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function toSentiment(raw: unknown): Sentiment | null {
  if (typeof raw === "number") return raw > 0.15 ? "positive" : raw < -0.15 ? "negative" : "neutral";
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    return toSentiment(o.label ?? o.overall ?? o.value ?? o.score);
  }
  if (typeof raw !== "string") return null;
  const s = raw.toLowerCase();
  if (/mix/.test(s)) return "mixed";
  if (/bull|positive|optimis/.test(s)) return "positive";
  if (/bear|negative|pessimis/.test(s)) return "negative";
  if (/neutral|flat/.test(s)) return "neutral";
  return null;
}

function toDate(raw: unknown): Date | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const ms = typeof raw === "number" ? (raw < 1e12 ? raw * 1000 : raw) : Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms) : null;
}

/** Markdown to plain sentences: headings, emphasis, links and bullets removed. */
export function plain(md: string): string {
  return md
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+.*$/gm, "")
    .replace(/[*_`]+/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The first `n` sentences, never more than `maxChars` (cut at a word, with an ellipsis). */
export function firstSentences(text: string, n: number, maxChars = 420): string {
  const sentences = text.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) ?? [text];
  let out = sentences.slice(0, n).join(" ").replace(/\s+/g, " ").trim();
  if (out.length > maxChars) out = `${out.slice(0, out.lastIndexOf(" ", maxChars - 1)).replace(/[,;:]$/, "")}…`;
  return out;
}

/** "Today", "Yesterday" or a short date, in the reader's terms. */
export function summaryAge(asOf: Date | null, now: Date): string | null {
  if (!asOf) return null;
  const day = (d: Date) => Math.floor((d.getTime() - d.getTimezoneOffset() * 60_000) / 86_400_000);
  const diff = day(now) - day(asOf);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  return asOf.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
