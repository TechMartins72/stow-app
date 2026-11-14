import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { ApiKeyTokenProvider } from "./token";

const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const apiKey = { key_id: "k", private_key: privateKey.export({ format: "jwk" }) };
const jwt = `x.${Buffer.from(JSON.stringify({ tm: { organization_id: "org-1" } })).toString("base64url")}.y`;

describe("ApiKeyTokenProvider on a flaky connection", () => {
  it("tries minting again when the connection fails: a token moves nothing", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const fakeFetch = (async () => {
      calls += 1;
      if (calls === 1) throw Object.assign(new TypeError("fetch failed"), { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } });
      return new Response(JSON.stringify({ access_token: jwt, expires_in: 3600 }), { status: 200 });
    }) as unknown as typeof fetch;
    const tokens = new ApiKeyTokenProvider("http://gateway.test", apiKey, fakeFetch);
    const minted = tokens.getToken();
    await vi.runAllTimersAsync();
    await expect(minted).resolves.toBe(jwt);
    expect(calls).toBe(2);
    expect(await tokens.getOrganizationId()).toBe("org-1");
    vi.useRealTimers();
  });
});
