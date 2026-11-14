import { describe, expect, it, vi } from "vitest";
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

describe("GatewayClient market data", () => {
  it("asks for a batch of price histories by economic asset id, without a token", async () => {
    const seen: { url: string; auth: string | null }[] = [];
    const fakeFetch = (async (url: URL, init: RequestInit) => {
      seen.push({ url: String(url), auth: new Headers(init.headers).get("Authorization") });
      return new Response(JSON.stringify({ window: "1d", resolution: "1h", results: [{ asset_id: "e1", symbol: "SOL", points: [{ t: "x", price: "89.4" }] }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const client = new GatewayClient("http://gateway.test", tokens, fakeFetch);

    const series = await client.priceHistoryBatch(["e1", "e2"], "1d", "1h");
    expect(series[0]).toMatchObject({ symbol: "SOL", points: [{ price: "89.4" }] });
    const url = new URL(seen[0].url);
    expect(url.pathname).toBe("/v1/defi/market/prices/history/batch");
    expect(url.searchParams.get("asset_ids")).toBe("e1,e2");
    expect(url.searchParams.get("window")).toBe("1d");
    expect(seen[0].auth).toBeNull();
  });

  it("skips the call when there's nothing to ask for", async () => {
    const fakeFetch = (async () => {
      throw new Error("should not be called");
    }) as unknown as typeof fetch;
    expect(await new GatewayClient("http://gateway.test", tokens, fakeFetch).priceHistoryBatch([], "1d", "1h")).toEqual([]);
  });
});

describe("GatewayClient on a flaky connection", () => {
  // What Node's fetch throws when the connection can't be opened (seen live 2026-11-14).
  const connectTimeout = () =>
    Object.assign(new TypeError("fetch failed"), {
      cause: Object.assign(new Error("Connect Timeout Error"), { code: "UND_ERR_CONNECT_TIMEOUT" }),
    });

  function flaky(failures: number) {
    const calls: string[] = [];
    const fakeFetch = (async (url: URL, init: RequestInit) => {
      calls.push(`${init.method} ${new URL(String(url)).pathname}`);
      if (calls.length <= failures) throw connectTimeout();
      return new Response(JSON.stringify({ data: [], qty: "1", price: "1", notional: "1", fee: "0" }), { status: 200 });
    }) as unknown as typeof fetch;
    return { calls, client: new GatewayClient("http://gateway.test", tokens, fakeFetch) };
  }

  it("retries a read when the connection fails, then succeeds", async () => {
    vi.useFakeTimers();
    const { calls, client } = flaky(2);
    const done = client.getBalances("u1");
    await vi.runAllTimersAsync();
    await expect(done).resolves.toEqual([]);
    expect(calls).toHaveLength(3);
    vi.useRealTimers();
  });

  it("retries a price quote too: it moves nothing", async () => {
    vi.useFakeTimers();
    const { calls, client } = flaky(1);
    const done = client.quote("u1", { asset_id: "sol", side: "buy", qty: "1", qty_unit: "quote" });
    await vi.runAllTimersAsync();
    await expect(done).resolves.toMatchObject({ qty: "1" });
    expect(calls).toEqual(["POST /v1/gateway/quotes", "POST /v1/gateway/quotes"]);
    vi.useRealTimers();
  });

  it("gives up after three tries and passes the connection error on", async () => {
    vi.useFakeTimers();
    const { calls, client } = flaky(10);
    const done = client.getBalances("u1");
    const settled = expect(done).rejects.toMatchObject({ cause: { code: "UND_ERR_CONNECT_TIMEOUT" } });
    await vi.runAllTimersAsync();
    await settled;
    expect(calls).toHaveLength(3);
    vi.useRealTimers();
  });

  it("never resends an order or a transfer by itself: the outcome would be unknown", async () => {
    const order = flaky(1);
    await expect(order.client.createOrder("u1", { asset_id: "sol", side: "buy", type: "market", qty: "1", qty_unit: "quote" })).rejects.toThrow("fetch failed");
    expect(order.calls).toEqual(["POST /v1/gateway/orders"]);

    const transfer = flaky(1);
    await expect(transfer.client.createTransfer("u1", { asset_id: "usdc", qty: "1", qty_unit: "base", to: "x" })).rejects.toThrow("fetch failed");
    expect(transfer.calls).toEqual(["POST /v1/gateway/transfers"]);
  });
});
