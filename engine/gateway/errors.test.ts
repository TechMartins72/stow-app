import { describe, expect, it } from "vitest";
import { GatewayError, isNetworkFailure } from "./errors";

const fetchFailed = (code: string) => Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("x"), { code }) });

describe("isNetworkFailure", () => {
  it("recognises a connection that couldn't be made or was cut", () => {
    for (const code of ["UND_ERR_CONNECT_TIMEOUT", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ECONNRESET", "ETIMEDOUT", "UND_ERR_SOCKET", "ENETUNREACH"]) {
      expect(isNetworkFailure(fetchFailed(code)), code).toBe(true);
    }
  });

  it("is not fooled by an answer from True Markets or an unrelated error", () => {
    expect(isNetworkFailure(new GatewayError(500, { type: "internal", message: "x" }))).toBe(false);
    expect(isNetworkFailure(new Error("boom"))).toBe(false);
    expect(isNetworkFailure(Object.assign(new Error("db"), { code: "QUERY_TIMEOUT" }))).toBe(false);
    expect(isNetworkFailure(null)).toBe(false);
  });
});
