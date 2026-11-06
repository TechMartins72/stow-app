import "server-only";

import type { Asset, Engine, GuardUser } from "@/engine";
import { createLock } from "@/engine";
import { dec, toDecimalString, ZERO } from "@/engine/decimal";

const DAY = 86_400_000;

/**
 * Mock only: gives the dev user some balances and two locks so the screens
 * have something to show. Runs once per vault store (when the user has no
 * locks yet). Set MOCK_SEED=off to see the new-user state.
 *
 * The mock may already hold balances for this user from the dev scripts, so
 * each asset is topped up to its demo amount rather than funded from zero.
 * A seed problem is logged and never breaks the page.
 */
export function seedMockDemo(engine: Engine, user: GuardUser): Promise<void> {
  if (engine.config.mode !== "mock" || process.env.MOCK_SEED === "off") return Promise.resolve();
  // Concurrent requests for the same user share one seeding run, so funds and locks aren't added twice.
  const g = globalThis as typeof globalThis & { __mockSeeds?: Map<string, Promise<void>> };
  const running = (g.__mockSeeds ??= new Map());
  let run = running.get(user.id);
  if (!run) {
    run = seed(engine, user)
      .catch((err) => console.warn("[demo-seed] skipped:", err instanceof Error ? err.message : err))
      .finally(() => running.delete(user.id));
    running.set(user.id, run);
  }
  return run;
}

async function seed(engine: Engine, user: GuardUser): Promise<void> {
  if ((await engine.store.listLocks(user.id)).length > 0) return;

  const assets = await engine.client.listAssets({ asset_class: "crypto,stock" });
  const find = (symbol: string, chain: string) => assets.find((a) => a.symbol === symbol && a.chain === chain);
  const usdc = find("USDC", "solana");
  const sol = find("SOL", "solana");
  const aapl = find("AAPLC", "base");
  if (!usdc || !sol || !aapl) return;

  await topUp(engine, user, [
    [usdc, "1850"],
    [sol, "6.5"],
    [aapl, "3.2"],
  ]);

  const now = Date.now();
  // Locks are created "in the past" so the progress rings show some progress.
  const deps = (ago: number) => ({ client: engine.client, store: engine.store, now: () => new Date(now - ago * DAY) });
  await createLock(deps(48), user.gatewayUserId, {
    userId: user.id,
    assetId: usdc.id,
    symbol: "USDC",
    amount: "1200",
    unlockAt: new Date(now + 142 * DAY),
    goalName: "Rent for 2027",
  });
  await createLock(deps(300), user.gatewayUserId, {
    userId: user.id,
    assetId: sol.id,
    symbol: "SOL",
    amount: "4",
    unlockAt: new Date(now + 24 * DAY),
    goalName: "New laptop",
  });
}

/** Credits each asset up to at least `target` in the mock wallet. */
async function topUp(engine: Engine, user: GuardUser, targets: [Asset, string][]): Promise<void> {
  const balances = await engine.client.getBalances(user.gatewayUserId);
  for (const [asset, target] of targets) {
    const held = balances.find((b) => b.asset_id === asset.id)?.available ?? "0";
    const missing = dec(target) - dec(held);
    if (missing > ZERO) await mockCredit(engine, user, asset.id, toDecimalString(missing));
  }
}

/** Mock only: adds practice funds to the user's wallet, like an incoming deposit. */
export async function mockCredit(engine: Engine, user: GuardUser, assetId: string, amount: string): Promise<void> {
  if (engine.config.mode !== "mock") throw new Error("Practice funds only exist in practice mode");
  const res = await fetch(`${engine.config.apiBase}/mock/fund`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await engine.tokens.getToken()}` },
    body: JSON.stringify({ user_id: user.gatewayUserId, asset_id: assetId, amount }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Mock funding failed: ${res.status}`);
}
