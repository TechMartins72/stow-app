// Shows the vault rule end to end: lock part of the USDC, then try to move it.
// Against the live Gateway this only previews (nothing is created or signed).

import { createLock, releaseLock } from "../engine";
import { dec, mul, toDecimalString } from "../engine/decimal";
import { devUser, findAsset, mockFund, run, setup } from "./_lib";

const DEMO_ADDRESS = "DemoDestination1111111111111111111111111111";

run(async () => {
  const engine = setup();
  const user = await devUser(engine);
  const usdc = await findAsset(engine, "USDC", "solana");
  if (engine.config.mode === "mock") await mockFund(engine, user, usdc, "10");

  const balances = await engine.client.getBalances(user.gatewayUserId);
  const available = balances.find((b) => b.asset_id === usdc.id)?.available ?? "0";
  if (dec(available) <= 0n) throw new Error("No USDC to lock. Fund the wallet first.");

  const amount = toDecimalString(mul(dec(available), dec("0.6")), 6);
  const unlockAt = new Date(Date.now() + 30 * 86_400_000);
  const lock = await createLock(engine, user.gatewayUserId, {
    userId: user.id,
    assetId: usdc.id,
    symbol: "USDC",
    amount,
    unlockAt,
    goalName: "Demo goal",
  });
  console.log(`✓ locked ${lock.amount} USDC until ${unlockAt.toISOString().slice(0, 10)} (of ${available})`);

  const withdrawAll = {
    kind: "transfer" as const,
    actor: "user" as const,
    assetId: usdc.id,
    symbol: "USDC",
    productType: "spot" as const,
    debits: [{ assetId: usdc.id, symbol: "USDC", qty: available }],
    notionalUsd: available,
  };
  const decision = await engine.guard.preview(user, withdrawAll);
  console.log(`✓ withdraw all ${available} USDC → ${decision.allowed ? "ALLOWED (unexpected!)" : "blocked"}`);
  for (const v of decision.violations) console.log(`    ${v.rule}: ${v.message}`);

  if (engine.config.mode === "mock") {
    const outcome = await engine.guard.withdraw(user, { asset: usdc, qty: available, to: DEMO_ADDRESS, actor: "user" });
    console.log(`✓ guard.withdraw(all) → ${outcome.status}`);
    const accessible = toDecimalString(dec(available) - dec(lock.amount), 6);
    const ok = await engine.guard.withdraw(user, { asset: usdc, qty: accessible, to: DEMO_ADDRESS, actor: "user" });
    console.log(`✓ guard.withdraw(${accessible} accessible) → ${ok.status}`);
  }

  try {
    await releaseLock(engine, user.id, lock.id);
    console.log("✗ release before maturity succeeded (unexpected!)");
  } catch (err) {
    console.log(`✓ release before maturity refused: ${(err as Error).message}`);
  }
});
