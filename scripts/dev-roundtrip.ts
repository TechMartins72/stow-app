// Buys a small amount of SOL with USDC, then sells it back, through the
// SigningGuard. The go-live checklist's "run a round trip" step.

import type { GuardOutcome, OrderDetail } from "../engine";
import { devUser, findAsset, mockFund, requireConfirmation, run, setup } from "./_lib";

const SPEND_USDC = process.env.ROUNDTRIP_USDC ?? "1";

function report(label: string, outcome: GuardOutcome<OrderDetail>): OrderDetail {
  if (outcome.status === "blocked") throw new Error(`${label} blocked: ${outcome.violations.map((v) => v.message).join(" ")}`);
  if (outcome.status === "not_created") throw new Error(`${label} not created: ${outcome.issues.join(", ")}`);
  const order = outcome.result;
  console.log(`✓ ${label.padEnd(5)} ${order.status}  ${order.executed_qty ?? "?"} SOL  order ${order.order_id}`);
  if (order.explorer_url) console.log(`  ${order.explorer_url}`);
  return order;
}

run(async () => {
  const engine = setup();
  requireConfirmation(engine, `buy ${SPEND_USDC} USDC of SOL and sell it back`);
  const user = await devUser(engine);
  const sol = await findAsset(engine, "SOL", "solana");
  if (engine.config.mode === "mock") await mockFund(engine, user, await findAsset(engine, "USDC", "solana"), "5");

  const buy = report("buy", await engine.guard.placeMarketOrder(user, { asset: sol, side: "buy", amount: SPEND_USDC, actor: "user" }));
  if (buy.status !== "complete" || !buy.executed_qty) throw new Error(`Buy ended ${buy.status}; not selling.`);

  report("sell", await engine.guard.placeMarketOrder(user, { asset: sol, side: "sell", amount: buy.executed_qty, actor: "user" }));
  console.log("\nRound trip complete. Check it in the console's transactions too.");
});
