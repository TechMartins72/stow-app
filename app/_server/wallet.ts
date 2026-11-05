import "server-only";

import { dec, mul, toDecimalString, ZERO, type Dec } from "@/engine/decimal";
import { accessibleBalance, type BalanceItem, type Engine, type GuardUser } from "@/engine";

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
  /** Not already locked: what a new lock may take. */
  accessible: string;
  accessibleUsd: string;
  priceUsd: string;
}

/** Assets the user holds with something left to lock, largest USD value first. */
export async function loadLockable(engine: Engine, user: GuardUser): Promise<LockableAsset[]> {
  const [balances, locks] = await Promise.all([
    engine.client.getBalances(user.gatewayUserId),
    engine.store.listLocks(user.id),
  ]);
  const prices = await priceMap(engine, user, balances);
  const now = new Date();

  const rows = balances.map((b) => {
    const { accessible } = accessibleBalance(b.asset_id, { balances, locks, now });
    const price = prices.get(b.asset_id) ?? ZERO;
    const usd = mul(accessible, price);
    const asset: LockableAsset = {
      assetId: b.asset_id,
      symbol: b.symbol,
      name: b.name ?? b.symbol,
      chain: b.chain,
      decimals: b.decimals ?? 6,
      stable: b.stable === true,
      accessible: toDecimalString(accessible, b.decimals ?? 6),
      accessibleUsd: toDecimalString(usd, 6),
      priceUsd: toDecimalString(price, 6),
    };
    return { asset, usd };
  });
  return rows
    .filter(({ asset }) => dec(asset.accessible) > ZERO)
    .sort((a, b) => (b.usd > a.usd ? 1 : b.usd < a.usd ? -1 : 0))
    .map(({ asset }) => asset);
}
