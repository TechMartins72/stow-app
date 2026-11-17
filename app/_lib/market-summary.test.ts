import { describe, expect, it } from "vitest";
import { firstSentences, parseSummary, plain, summaryAge, summarySymbol, toSentiment } from "./market-summary";

const LONG = "Solana rose after a large exchange listed new SOL products. Trading volume doubled. Analysts expect more volatility this week.";

describe("summarySymbol", () => {
  it("uses Bitcoin's symbol for Coinbase-wrapped BTC", () => {
    expect(summarySymbol("cbBTC")).toBe("BTC");
    expect(summarySymbol(" sol ")).toBe("SOL");
  });
});

describe("parseSummary", () => {
  it("reads JSON text with summary, sentiment and date fields", () => {
    const r = parseSummary({
      content: [{ type: "text", text: JSON.stringify({ symbol: "SOL", summary: `## Today\n**${LONG}**`, sentiment: "Bullish", date: "2026-11-17" }) }],
    });
    expect(r?.text).toBe(LONG);
    expect(r?.sentiment).toBe("positive");
    expect(r?.asOf?.toISOString().slice(0, 10)).toBe("2026-11-17");
  });

  it("prefers structured content and unwraps a data envelope", () => {
    const r = parseSummary({ structuredContent: { data: { analysis: LONG, sentiment: { score: -0.6 } } }, content: [] });
    expect(r?.text).toBe(LONG);
    expect(r?.sentiment).toBe("negative");
  });

  it("accepts plain text", () => {
    expect(parseSummary({ content: [{ type: "text", text: LONG }] })?.text).toBe(LONG);
  });

  it("hides errors, empty answers and 'no data' replies", () => {
    expect(parseSummary({ isError: true, content: [{ type: "text", text: LONG }] })).toBeNull();
    expect(parseSummary({ content: [] })).toBeNull();
    expect(parseSummary({ content: [{ type: "text", text: "No summary available for XYZ at this time." }] })).toBeNull();
    expect(parseSummary({ content: [{ type: "text", text: "{}" }] })).toBeNull();
    expect(parseSummary(null)).toBeNull();
  });
});

describe("toSentiment", () => {
  it("maps labels and scores", () => {
    expect(toSentiment("mixed signals")).toBe("mixed");
    expect(toSentiment("Bearish")).toBe("negative");
    expect(toSentiment(0.05)).toBe("neutral");
    expect(toSentiment("unknown")).toBeNull();
  });
});

describe("text helpers", () => {
  it("strips markdown links and bullets", () => {
    expect(plain("- See [the report](https://x.y) _now_")).toBe("See the report now");
  });

  it("keeps the first sentences and caps the length", () => {
    expect(firstSentences(LONG, 2)).toBe("Solana rose after a large exchange listed new SOL products. Trading volume doubled.");
    const cut = firstSentences("word ".repeat(200), 1, 50);
    expect(cut.length).toBeLessThanOrEqual(50);
    expect(cut.endsWith("…")).toBe(true);
  });

  it("dates summaries relative to now", () => {
    const now = new Date(2026, 10, 17, 15);
    expect(summaryAge(new Date(2026, 10, 17, 1), now)).toBe("Today");
    expect(summaryAge(new Date(2026, 10, 16, 23), now)).toBe("Yesterday");
    expect(summaryAge(new Date(2026, 10, 10), now)).toBe("Nov 10");
    expect(summaryAge(null, now)).toBeNull();
  });
});
