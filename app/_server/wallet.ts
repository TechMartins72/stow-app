import "server-only";

import { dec, min, mul, toDecimalString, ZERO, type Dec } from "@/engine/decimal";
import { accessibleBalance, lockedNow, nextRelease, type BalanceItem, type Engine, type GuardUser } from "@/engine";

/** USD price per asset: stablecoins are 1, everything else from a sell quote for one unit. */
export async function priceMap(engine: Engine, user: GuardUser, balances: BalanceItem[]): Promise<Map<string, Dec>> {
  const entries = await Promise.all(
    balances.map(async (b): Promise<[string, Dec]> => {
      if (b.stable) return [b.asset_id, dec("1")];
      const quote = await engine.client.quote(user.gatewayUserId, { asset_id: b.asset_id, side: "sell", qty: "1", qty_unit: "base" });
      return [b.asset_id, dec(quote.notional)];
    }),
  );
  return new Map(entries);
}

export interface LockableAsset {
  assetId: string;
  symbol: string;
  name: string;
  chain: string | null;
  decimals: number;
  /** Stablecoins may be released in parts. */
  stable: boolean;
  /** Not already locked: what a new lock may take, or a withdrawal may send. */
  accessible: string;
  accessibleUsd: string;
  priceUsd: string;
}

/** A lock that holds part of an asset right now. */
export interface Blocker {
  lockId: string;
  goalName: string;
  lockedAmount: string;
  nextReleaseAt: Date | null;
  nextReleaseAmount: string | null;
}

export interface Holding extends LockableAsset {
  /** In the wallet and not held by a pending order. */
  available: string;
  /** Held by locks right now (capped at what the wallet holds). */
  locked: string;
  blockers: Blocker[];
}

const byUsdDesc = (a: { usd: Dec }, b: { usd: Dec }) => (b.usd > a.usd ? 1 : b.usd < a.usd ? -1 : 0);

/** Every asset the user holds, with how much is locked and by which locks. Largest value first. */
export async function loadHoldings(engine: Engine, user: GuardUser): Promise<Holding[]> {
  const [balances, locks] = await Promise.all([
    engine.client.getBalances(user.gatewayUserId),
    engine.store.listLocks(user.id),
  ]);
  const prices = await priceMap(engine, user, balances);
  const now = new Date();

  return balances
    .filter((b) => dec(b.available) > ZERO)
    .map((b) => {
      const decimals = b.decimals ?? 6;
      const { available, locked, accessible } = accessibleBalance(b.asset_id, { balances, locks, now });
      const price = prices.get(b.asset_id) ?? ZERO;
      const blockers = locks
        .filter((l) => l.assetId === b.asset_id && lockedNow(l, now) > ZERO)
        .map((l): Blocker => {
          const next = nextRelease(l, now);
          return {
            lockId: l.id,
            goalName: l.goalName ?? `${l.symbol} lock`,
            lockedAmount: toDecimalString(lockedNow(l, now)),
            nextReleaseAt: next?.releaseAt ?? null,
            nextReleaseAmount: next?.amount ?? null,
          };
        })
        .sort((x, y) => (x.nextReleaseAt?.getTime() ?? 0) - (y.nextReleaseAt?.getTime() ?? 0));
      const holding: Holding = {
        assetId: b.asset_id,
        symbol: b.symbol,
        name: b.name ?? b.symbol,
        chain: b.chain,
        decimals,
        stable: b.stable === true,
        available: toDecimalString(available, decimals),
        locked: toDecimalString(min(locked, available), decimals),
        accessible: toDecimalString(accessible, decimals),
        accessibleUsd: toDecimalString(mul(accessible, price), 6),
        priceUsd: toDecimalString(price, 6),
        blockers,
      };
      return { holding, usd: mul(available, price) };
    })
    .sort(byUsdDesc)
    .map(({ holding }) => holding);
}

/** Assets with something left to lock, largest free value first. */
export async function loadLockable(engine: Engine, user: GuardUser): Promise<LockableAsset[]> {
  const holdings = await loadHoldings(engine, user);
  return holdings
    .filter((h) => dec(h.accessible) > ZERO)
    .map((h) => {
      const asset: LockableAsset = {
        assetId: h.assetId,
        symbol: h.symbol,
        name: h.name,
        chain: h.chain,
        decimals: h.decimals,
        stable: h.stable,
        accessible: h.accessible,
        accessibleUsd: h.accessibleUsd,
        priceUsd: h.priceUsd,
      };
      return { asset, usd: dec(asset.accessibleUsd) };
    })
    .sort(byUsdDesc)
    .map(({ asset }) => asset);
}
