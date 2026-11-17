import http from "node:http";
import type { AddressInfo } from "node:net";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { getAssetSummary, marketContextLine } from "./market-summary";

// An in-process stand-in for True Markets' Market Data MCP server.
const calls: string[] = [];
let server: http.Server;
let url: string;

function stub() {
  const mcp = new McpServer({ name: "stub-marketdata", version: "0.0.1" });
  mcp.registerTool("get_asset_summary", { inputSchema: { symbol: z.string() } }, async ({ symbol }) => {
    calls.push(symbol);
    if (symbol === "NONE") return { content: [{ type: "text" as const, text: "No summary available for NONE." }] };
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            summary: `${symbol} fell after a large holder moved coins to an exchange. Volume rose sharply. Sentiment turned cautious.`,
            sentiment: "bearish",
            date: "2026-11-17T08:00:00Z",
          }),
        },
      ],
    };
  });
  return mcp;
}

beforeAll(async () => {
  server = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const mcp = stub();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => void transport.close());
    await mcp.connect(transport);
    await transport.handleRequest(req, res, body ? JSON.parse(body) : undefined);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

beforeEach(() => {
  process.env.MARKET_DATA_MCP_URL = url;
  delete process.env.ANTHROPIC_API_KEY;
  (globalThis as { __summaries?: Map<string, unknown> }).__summaries?.clear();
  calls.length = 0;
});

describe("getAssetSummary", () => {
  it("reads the summary over MCP, using BTC for cbBTC", async () => {
    const s = await getAssetSummary("cbBTC");
    expect(calls).toEqual(["BTC"]);
    expect(s?.text).toMatch(/^BTC fell after/);
    expect(s?.sentiment).toBe("negative");
    expect(s?.asOf?.toISOString()).toBe("2026-11-17T08:00:00.000Z");
  });

  it("caches, and shares one request between concurrent callers", async () => {
    await Promise.all([getAssetSummary("SOL"), getAssetSummary("sol")]);
    await getAssetSummary("SOL");
    expect(calls).toEqual(["SOL"]);
  });

  it("returns null when there is no summary", async () => {
    expect(await getAssetSummary("NONE")).toBeNull();
  });

  it("returns null, without throwing, when the server is unreachable", async () => {
    process.env.MARKET_DATA_MCP_URL = "http://127.0.0.1:9/mcp";
    expect(await getAssetSummary("ETH")).toBeNull();
  });
});

describe("marketContextLine", () => {
  it("without an Anthropic key, uses the summary's first sentence", async () => {
    const line = await marketContextLine("SOL", { id: "reduce-risk:x", title: "Sell 1 SOL for USDC", why: "Too much risk." });
    expect(line).toBe("SOL fell after a large holder moved coins to an exchange.");
  });

  it("is null when the asset has no summary", async () => {
    expect(await marketContextLine("NONE", { id: "x", title: "t", why: "w" })).toBeNull();
  });
});
