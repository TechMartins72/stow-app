import { describe, expect, it } from "vitest";
import { GatewayClient } from "./client";
import type { TokenProvider } from "./token";

const tokens: TokenProvider = {
  getToken: async () => "t",
  getOrganizationId: async () => "org",
  invalidate: () => {},
};

describe("GatewayClient freshness", () => {
  it("never lets a framework reuse or cache a read: balances must be live", async () => {
    // Next.js memoizes identical GETs within one render and caches fetches across
    // dev reloads. A balance read after funding must not get the earlier answer.
    const calls: RequestInit[] = [];
    let n = 0;
    const fakeFetch = (async (_url: URL, init: RequestInit) => {
      calls.push(init);
      n += 1;
      return new Response(JSON.stringify({ data: [{ asset_id: "a", available: String(n) }] }), { status: 200 });
    }) as unknown as typeof fetch;

    const client = new GatewayClient("http://gateway.test", tokens, fakeFetch);
    await client.getBalances("u1");
    const second = await client.getBalances("u1");

    expect(second[0].available).toBe("2");
    for (const init of calls) {
      expect(init.cache).toBe("no-store");
      expect(init.signal).toBeInstanceOf(AbortSignal);
    }
    expect(calls[0].signal).not.toBe(calls[1].signal);
  });
});
