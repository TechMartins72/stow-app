// Prints the dev user's balances.

import { devUser, run, setup } from "./_lib";

run(async () => {
  const engine = setup();
  const user = await devUser(engine);
  const balances = await engine.client.getBalances(user.gatewayUserId);
  if (balances.length === 0) {
    console.log("No balances yet. Fund the wallet first (npm run dev:user shows the addresses).");
    return;
  }
  for (const b of balances) {
    console.log(`  ${b.symbol.padEnd(8)} ${String(b.chain).padEnd(8)} available ${b.available.padStart(14)}  total ${b.total}`);
  }
});
