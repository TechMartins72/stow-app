import "server-only";

import type { Engine, GuardUser } from "@/engine";
import { createLock } from "@/engine";

const DAY = 86_400_000;

/**
 * Mock only: gives the dev user some balances and two locks so the screens
 * have something to show. Runs when the mock wallet is empty or the store has
 * no locks. Set MOCK_SEED=off to see the new-user state.
 */
export function seedMockDemo(engine: Engine, user: GuardUser): Promise<void> {
  if (engine.config.mode !== "mock" || process.env.MOCK_SEED === "off") return Promise.resolve();
  // Concurrent requests share one seeding run, so funds and locks aren't added twice.
  const g = globalThis as typeof globalThis & { __mockSeed?: Promise<void> };
  g.__mockSeed ??= seed(engine, user).finally(() => {
    g.__mockSeed = undefined;
  });
  return g.__mockSeed;
}

async function seed(engine: Engine, user: GuardUser): Promise<void> {
  const [balances, locks, assets] = await Promise.all([
    engine.client.getBalances(user.gatewayUserId),
    engine.store.listLocks(user.id),
    engine.client.listAssets({ asset_class: "crypto,stock" }),
  ]);
  const find = (symbol: string, chain: string) => assets.find((a) => a.symbol === symbol && a.chain === chain);
  const usdc = find("USDC", "solana");
  const sol = find("SOL", "solana");
  const aapl = find("AAPLC", "base");
  if (!usdc || !sol || !aapl) return;

  if (balances.length === 0) {
    const token = await engine.tokens.getToken();
    for (const [asset, amount] of [
      [usdc, "1850"],
      [sol, "6.5"],
      [aapl, "3.2"],
    ] as const) {
      const res = await fetch(`${engine.config.apiBase}/mock/fund`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_id: user.gatewayUserId, asset_id: asset.id, amount }),
      });
      if (!res.ok) throw new Error(`Mock funding failed: ${res.status}`);
    }
  }

  if (locks.length === 0) {
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
}
