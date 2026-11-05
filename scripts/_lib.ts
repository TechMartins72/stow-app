// Shared setup for the dev scripts. Scripts use an in-memory vault store, so
// locks and guardrails last for one run only.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createEngine, loadEngineConfig, MemoryVaultStore, type Asset, type Engine, type GuardUser } from "../engine";

const STATE_FILE = ".secrets/dev-state.json";

export function setup(): Engine {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env file; rely on the environment.
  }
  const engine = createEngine(loadEngineConfig(), new MemoryVaultStore());
  console.log(`Gateway: ${engine.config.mode.toUpperCase()} (${engine.config.apiBase})`);
  return engine;
}

/** Real money moves only when the command line says --yes. */
export function requireConfirmation(engine: Engine, what: string) {
  if (engine.config.mode === "live" && !process.argv.includes("--yes")) {
    console.error(`\nThis spends real funds: ${what}.\nRun it again with --yes to continue.`);
    process.exit(1);
  }
}

/** Creates the dev user on first run and remembers it per mode. */
export async function devUser(engine: Engine): Promise<GuardUser & { externalRefId: string }> {
  const externalRefId = process.env.DEV_USER_REF ?? "dev_user_1";
  const user = await engine.client.createUser(externalRefId, engine.guard.signerPublicKey);
  const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : {};
  state[engine.config.mode] = { externalRefId, gatewayUserId: user.user_id, wallets: user.wallets };
  mkdirSync(".secrets", { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  return { id: `dev:${externalRefId}`, gatewayUserId: user.user_id, externalRefId };
}

export async function findAsset(engine: Engine, symbol: string, chain: string): Promise<Asset> {
  const assets = await engine.client.listAssets({ asset_class: "crypto,stock" });
  const asset = assets.find((a) => a.symbol === symbol && a.chain === chain);
  if (!asset) throw new Error(`${symbol} on ${chain} is not in the asset catalog`);
  return asset;
}

/** Mock only: credits the user's wallet. */
export async function mockFund(engine: Engine, user: GuardUser, asset: Asset, amount: string) {
  if (engine.config.mode !== "mock") throw new Error("mockFund only works against the mock Gateway");
  const res = await fetch(`${engine.config.apiBase}/mock/fund`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await engine.tokens.getToken()}` },
    body: JSON.stringify({ user_id: user.gatewayUserId, asset_id: asset.id, amount }),
  });
  if (!res.ok) throw new Error(`Mock funding failed: ${await res.text()}`);
}

export function run(main: () => Promise<void>) {
  main().catch((err) => {
    console.error("\n✗", err instanceof Error ? err.message : err);
    if (err?.requestId) console.error(`  request_id: ${err.requestId} (send this to support@truemarkets.co)`);
    if (err?.cause?.code === "ECONNREFUSED") console.error("  Is the mock Gateway running? Start it with: npm run mock");
    process.exit(1);
  });
}
