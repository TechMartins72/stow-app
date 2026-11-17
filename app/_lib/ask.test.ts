import { describe, expect, it } from "vitest";
import { ASK_LIMITS, accountContext, checkAskRequest, takeQuestion, type AskSnapshot } from "./ask";

describe("checkAskRequest", () => {
  it("accepts a conversation ending with the user's question", () => {
    const r = checkAskRequest({
      messages: [
        { role: "user", content: " Hi " },
        { role: "assistant", content: "Hello" },
        { role: "user", content: "How much can I spend?" },
      ],
    });
    expect(r).toEqual({
      ok: true,
      messages: [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello" },
        { role: "user", content: "How much can I spend?" },
      ],
    });
  });

  it("rejects empty, malformed, too-long or assistant-last requests", () => {
    expect(checkAskRequest({}).ok).toBe(false);
    expect(checkAskRequest({ messages: [] }).ok).toBe(false);
    expect(checkAskRequest({ messages: [{ role: "system", content: "x" }] }).ok).toBe(false);
    expect(checkAskRequest({ messages: [{ role: "user", content: 5 }] }).ok).toBe(false);
    expect(checkAskRequest({ messages: [{ role: "assistant", content: "x" }] }).ok).toBe(false);
    expect(checkAskRequest({ messages: [{ role: "user", content: "x".repeat(ASK_LIMITS.maxQuestionChars + 1) }] }).ok).toBe(false);
  });

  it("keeps only recent turns, starting on a question, with neighbours merged", () => {
    const long = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` }));
    const r = checkAskRequest({ messages: [...long, { role: "user", content: "again" }] });
    if (!r.ok) throw new Error(r.error);
    expect(r.messages.length).toBeLessThanOrEqual(ASK_LIMITS.maxHistory);
    expect(r.messages[0].role).toBe("user");
    expect(r.messages[0]).toEqual({ role: "user", content: "m20" });
    expect(r.messages.at(-1)).toEqual({ role: "user", content: "again" });
    for (let i = 1; i < r.messages.length; i++) expect(r.messages[i].role).not.toBe(r.messages[i - 1].role);
  });
});

describe("takeQuestion", () => {
  it("counts per user per UTC day and stops at the cap", () => {
    const counts = new Map();
    const day1 = new Date("2026-11-17T10:00:00Z");
    expect(takeQuestion(counts, "u1", day1, 2)).toBe(1);
    expect(takeQuestion(counts, "u1", day1, 2)).toBe(0);
    expect(takeQuestion(counts, "u1", day1, 2)).toBeNull();
    expect(takeQuestion(counts, "u2", day1, 2)).toBe(1);
    expect(takeQuestion(counts, "u1", new Date("2026-11-18T00:00:01Z"), 2)).toBe(1);
  });
});

describe("accountContext", () => {
  const snapshot: AskSnapshot = {
    mode: "mock",
    totalUsd: "1625.5",
    lockedUsd: "650",
    accessibleUsd: "975.5",
    holdings: [
      { ticker: "SOL", name: "Solana", network: "Solana", bucket: "crypto", qty: "6.5", lockedQty: "4", valueUsd: "975", change24h: { pct: 4.41 } },
      { ticker: "USDC", name: "USD Coin", network: "Base", bucket: "cash", qty: "650.5", lockedQty: "0", valueUsd: "650.5", change24h: null },
    ],
    locks: [
      {
        goalName: "Rent",
        symbol: "USDC",
        amount: "1200",
        lockedAmount: "900",
        lockedUsd: "900",
        unlockAt: new Date("2027-02-01T00:00:00Z"),
        parts: 4,
        partsReleased: 1,
        next: { releaseAt: new Date("2026-12-01T00:00:00Z"), amount: "300" },
      },
    ],
    advisorEnabled: true,
    activity: [{ at: new Date("2026-11-16T12:00:00Z"), title: "Bought SOL", detail: "$50.00 of SOL", status: "done" }],
  };

  it("summarises balances, locks and activity in plain text", () => {
    const text = accountContext(snapshot, new Date("2026-11-17T09:00:00Z"));
    expect(text).toContain("Today is 2026-11-17. Account mode: practice (fake money).");
    expect(text).toContain("Total value $1,625.50: $650.00 locked, $975.50 free to use.");
    expect(text).toContain("- Solana (SOL, crypto, on Solana): 6.5 worth $975.00, 4 of it locked, +4.41% in 24h");
    expect(text).toContain("- USD Coin (USDC, cash, on Base): 650.5 worth $650.50");
    expect(text).toContain('- "Rent": budget paid out in 4 parts (1 released so far), 900 of 1,200 USDC still locked ($900.00), fully unlocked on 2027-02-01; next release 300 USDC on 2026-12-01');
    expect(text).toContain("- 2026-11-16: Bought SOL. $50.00 of SOL (done)");
  });

  it("says when there is nothing yet", () => {
    const text = accountContext({ ...snapshot, holdings: [], locks: [], activity: null }, new Date());
    expect(text).toContain("Holdings:\n- none yet");
    expect(text).toContain("(locks):\n- none");
  });
});
