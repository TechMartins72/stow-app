// End to end against the mock Gateway: real token minting, real stamps, and
// the mock refuses any signature that doesn't verify.

import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMockGateway } from "../../mock-gateway/server";
import { GatewayClient } from "../gateway/client";
import { ApiKeyTokenProvider } from "../gateway/token";
import type { Asset } from "../gateway/types";
import { createLock, releaseLock } from "../vault/locks";
import { MemoryVaultStore } from "../vault/store";
import { generateKeyPairSync } from "node:crypto";
import { generateSignerKey } from "./keys";
import { SigningGuard, type GuardUser } from "./guard";

let server: Server;
let client: GatewayClient;
let baseUrl: string;
let token: string;
let assets: Asset[];
const DEST = "Dest1111111111111111111111111111111111111111";

const asset = (symbol: string, chain: string) => assets.find((a) => a.symbol === symbol && a.chain === chain)!;

async function fund(user: GuardUser, a: Asset, amount: string) {
  const res = await fetch(`${baseUrl}/mock/fund`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ user_id: user.gatewayUserId, asset_id: a.id, amount }),
  });
  expect(res.ok).toBe(true);
}

async function newUser(ref: string, now = () => new Date("2026-11-05T12:00:00Z")) {
  const store = new MemoryVaultStore();
  const guard = new SigningGuard({ client, store, signerPrivateKeyHex: generateSignerKey().signer_private_key, now });
  const created = await client.createUser(ref, guard.signerPublicKey);
  const user: GuardUser = { id: `app-${ref}`, gatewayUserId: created.user_id };
  return { store, guard, user };
}

beforeAll(async () => {
  server = createMockGateway();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const tokens = new ApiKeyTokenProvider(baseUrl, { key_id: "test", private_key: privateKey.export({ format: "jwk" }) });
  client = new GatewayClient(baseUrl, tokens);
  token = await tokens.getToken();
  assets = [...(await client.listAssets({ asset_class: "crypto,stock" })), ...(await client.listAssets({ product_type: "perp" }))];
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe("SigningGuard against the mock Gateway", () => {
  it("buys and sells with a valid signature", async () => {
    const { guard, user } = await newUser("roundtrip");
    await fund(user, asset("USDC", "solana"), "10");

    const buy = await guard.placeMarketOrder(user, { asset: asset("SOL", "solana"), side: "buy", amount: "3", actor: "user" });
    expect(buy.status).toBe("executed");
    if (buy.status !== "executed") return;
    expect(buy.result.status).toBe("complete");

    const sell = await guard.placeMarketOrder(user, {
      asset: asset("SOL", "solana"),
      side: "sell",
      amount: buy.result.executed_qty!,
      actor: "user",
    });
    expect(sell.status).toBe("executed");
  });

  it("refuses to sign anything that touches locked funds", async () => {
    const { guard, store, user } = await newUser("locker");
    const usdc = asset("USDC", "solana");
    await fund(user, usdc, "10");
    await createLock({ client, store, now: () => new Date("2026-11-05T12:00:00Z") }, user.gatewayUserId, {
      userId: user.id,
      assetId: usdc.id,
      symbol: "USDC",
      amount: "6",
      unlockAt: new Date("2027-06-01T00:00:00Z"),
    });

    const withdrawAll = await guard.withdraw(user, { asset: usdc, qty: "10", to: DEST, actor: "user" });
    expect(withdrawAll).toMatchObject({ status: "blocked", violations: [{ rule: "locked" }] });

    // 4 accessible, so a 5 USDC buy (plus fee) is blocked too.
    const bigBuy = await guard.placeMarketOrder(user, { asset: asset("SOL", "solana"), side: "buy", amount: "5", actor: "advisor" });
    expect(bigBuy).toMatchObject({ status: "blocked", violations: [{ rule: "locked" }] });

    const ok = await guard.withdraw(user, { asset: usdc, qty: "4", to: DEST, actor: "user" });
    expect(ok.status).toBe("executed");

    const balances = await client.getBalances(user.gatewayUserId);
    expect(balances.find((b) => b.asset_id === usdc.id)?.available).toBe("6");
    expect(store.log.map((e) => e.outcome)).toEqual(["blocked", "blocked", "executed"]);
  });

  it("releases a lock only after its unlock date", async () => {
    let now = new Date("2026-11-05T12:00:00Z");
    const { store, user } = await newUser("release", () => now);
    const usdc = asset("USDC", "solana");
    await fund(user, usdc, "5");
    const lock = await createLock({ client, store, now: () => now }, user.gatewayUserId, {
      userId: user.id,
      assetId: usdc.id,
      symbol: "USDC",
      amount: "5",
      unlockAt: new Date("2026-12-01T00:00:00Z"),
    });

    await expect(releaseLock({ store, now: () => now }, user.id, lock.id)).rejects.toThrow("opens on 2026-12-01");
    now = new Date("2026-12-01T00:00:00Z");
    await expect(releaseLock({ store, now: () => now }, user.id, lock.id)).resolves.toMatchObject({ status: "released" });
  });

  it("won't lock more than is accessible", async () => {
    const { store, user } = await newUser("overlock");
    const usdc = asset("USDC", "solana");
    await fund(user, usdc, "5");
    const deps = { client, store, now: () => new Date("2026-11-05T12:00:00Z") };
    const input = { userId: user.id, assetId: usdc.id, symbol: "USDC", amount: "3", unlockAt: new Date("2027-01-01T00:00:00Z") };
    await createLock(deps, user.gatewayUserId, input);
    await expect(createLock(deps, user.gatewayUserId, input)).rejects.toThrow("Only 2 USDC");
  });

  it("never creates a perp order while leverage is off", async () => {
    const { guard, user } = await newUser("perps");
    await fund(user, asset("USDC", "solana"), "10");
    const outcome = await guard.placeMarketOrder(user, { asset: asset("BTC-PERP", "hypercore-perp"), side: "buy", amount: "5", actor: "advisor" });
    expect(outcome).toMatchObject({ status: "blocked", violations: [{ rule: "perps_disabled" }] });
  });

  it("enforces the daily limit across trades", async () => {
    const { guard, store, user } = await newUser("daily");
    await fund(user, asset("USDC", "solana"), "20");
    await store.setGuardrails(user.id, { allowPerps: false, maxDailySpendUsd: "5" });
    const sol = asset("SOL", "solana");
    expect((await guard.placeMarketOrder(user, { asset: sol, side: "buy", amount: "3", actor: "user" })).status).toBe("executed");
    expect(await guard.placeMarketOrder(user, { asset: sol, side: "buy", amount: "3", actor: "user" })).toMatchObject({
      status: "blocked",
      violations: [{ rule: "daily_limit" }],
    });
  });

  it("returns not_created when the wallet can't fund a buy", async () => {
    const { guard, user } = await newUser("broke");
    const outcome = await guard.placeMarketOrder(user, { asset: asset("SOL", "solana"), side: "buy", amount: "1", actor: "user" });
    expect(outcome).toEqual({ status: "not_created", issues: ["Insufficient balance"] });
  });
});
