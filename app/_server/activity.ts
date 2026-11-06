import "server-only";

import { buildActivity, type ActivityItem } from "@/app/_lib/activity";
import { tickerOf } from "@/app/_lib/trade-policy";
import { getCurrentUser } from "./current-user";
import { getEngine } from "./engine";
import { gatewayFailure, type GatewayFailure } from "./gateway-failure";

export async function loadActivity(): Promise<{ ok: true; items: ActivityItem[] } | GatewayFailure> {
  const engine = getEngine();
  try {
    const user = await getCurrentUser(engine);
    const [page, log, locks, catalog] = await Promise.all([
      engine.client.listTransactions(user.gatewayUserId, { limit: 50 }),
      engine.store.listLog(user.id, 100),
      engine.store.listLocks(user.id),
      engine.client.listAssets({ asset_class: "crypto,stock" }),
    ]);
    const tickers = Object.fromEntries(catalog.map((a) => [a.symbol, tickerOf({ symbol: a.symbol, chain: a.chain, asset_class: a.asset_class })]));
    return { ok: true, items: buildActivity({ transactions: page.data, log, locks, now: new Date(), tickers }) };
  } catch (err) {
    return gatewayFailure(engine, err);
  }
}
