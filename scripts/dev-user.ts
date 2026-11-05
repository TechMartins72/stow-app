// Creates (or loads) the dev user and prints its wallet addresses.

import { devUser, run, setup } from "./_lib";

run(async () => {
  const engine = setup();
  const user = await devUser(engine);
  const state = await engine.client.createUser(user.externalRefId, engine.guard.signerPublicKey);
  console.log(`✓ user ${user.gatewayUserId} (${user.externalRefId})`);
  for (const wallet of state.wallets) console.log(`  ${wallet.chain_family.padEnd(7)} ${wallet.address}`);
  if (engine.config.mode === "live") {
    console.log("\nFund it with a few USDC on Solana (send on the Solana network only).");
  }
});
