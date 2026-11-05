// The demo seed against an in-process mock Gateway. Regression: a dev user
// whose wallet already held some balances (from the dev scripts) but no USDC
// made the seed's 1,200 USDC lock throw and crashed Home.

import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createMockGateway } from "@/mock-gateway/server";
import { createEngine, MemoryVaultStore, type Engine, type GuardUser } from "@/engine";
import { seedMockDemo } from "./demo-seed";

let server: Server;
let engine: Engine;

beforeAll(async () => {
  server = createMockGateway();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const apiBase = `http://localhost:${(server.address() as AddressInfo).port}`;
  const signerKeyFile = join(mkdtempSync(join(tmpdir(), "vault-seed-")), "signer-key.mock.json");
  engine = createEngine({ mode: "mock", apiBase, signerKeyFile }, new MemoryVaultStore());
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

async function newUser(ref: string): Promise<GuardUser> {
  const created = await engine.client.createUser(ref, engine.guard.signerPublicKey);
  return { id: `dev:${ref}`, gatewayUserId: created.user_id };
}

async function fund(user: GuardUser, symbol: string, amount: string) {
  const asset = (await engine.client.listAssets({ asset_class: "crypto,stock" })).find((a) => a.symbol === symbol)!;
  await fetch(`${engine.config.apiBase}/mock/fund`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await engine.tokens.getToken()}` },
    body: JSON.stringify({ user_id: user.gatewayUserId, asset_id: asset.id, amount }),
  });
}

const amounts = async (user: GuardUser) =>
  Object.fromEntries((await engine.client.getBalances(user.gatewayUserId)).map((b) => [b.symbol, b.available]));

describe("seedMockDemo", () => {
  it("funds an empty wallet and creates two locks", async () => {
    const user = await newUser("seed-empty");
    await seedMockDemo(engine, user);
    expect(await amounts(user)).toEqual({ USDC: "1850", SOL: "6.5", AAPLC: "3.2" });
    expect((await engine.store.listLocks(user.id)).map((l) => l.symbol).sort()).toEqual(["SOL", "USDC"]);
  });

  it("tops up a wallet that already holds some assets but no USDC", async () => {
    const user = await newUser("seed-partial");
    await fund(user, "SOL", "0.000001");
    await seedMockDemo(engine, user);
    expect(await amounts(user)).toEqual({ USDC: "1850", SOL: "6.5", AAPLC: "3.2" });
    expect(await engine.store.listLocks(user.id)).toHaveLength(2);
  });

  it("runs once: concurrent calls don't double-fund, later calls change nothing", async () => {
    const user = await newUser("seed-concurrent");
    await Promise.all([seedMockDemo(engine, user), seedMockDemo(engine, user), seedMockDemo(engine, user)]);
    await seedMockDemo(engine, user);
    expect((await amounts(user)).USDC).toBe("1850");
    expect(await engine.store.listLocks(user.id)).toHaveLength(2);
  });

  it("never throws; a seed problem is logged and the page carries on", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ghost: GuardUser = { id: "dev:ghost", gatewayUserId: "00000000-0000-4000-8000-00000000dead" };
    await expect(seedMockDemo(engine, ghost)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
