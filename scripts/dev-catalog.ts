// Read-only check of the live True Markets setup:
//   1. mints an organization access token with TM_KEY_FILE (proves the API key works),
//   2. prints the organization id from the token,
//   3. lists what can be traded: crypto and tokenized stocks, by network.
// Creates no users, needs no signer key, signs nothing, moves no money.
// Never prints the token or any key material.
//
//   npm run dev:catalog            summary + first stocks
//   npm run dev:catalog -- --all   every asset

import { GatewayClient } from "../engine/gateway/client";
import { ApiKeyTokenProvider, loadApiKeyFile } from "../engine/gateway/token";
import type { Asset } from "../engine/gateway/types";

const SHOW_STOCKS = 40;

const tickerOf = (a: Asset) => {
  const s = a.symbol.toUpperCase();
  return a.asset_class === "stock" && a.chain === "base" && s.endsWith("C") ? s.slice(0, -1) : s;
};
const cleanName = (n: string) =>
  n.replace(/\s*[•·]\s*Robinhood Token$/i, "").replace(/\s*\(Coinbase Tokenized Stock\)$/i, "").trim();

async function main() {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env file; rely on the environment.
  }
  const keyFile = process.env.TM_KEY_FILE;
  if (!keyFile) throw new Error("Set TM_KEY_FILE in .env (e.g. TM_KEY_FILE=.secrets/api-key.json)");
  const base = process.env.TM_API_BASE ?? "https://api.truemarkets.co";
  const showAll = process.argv.includes("--all");

  console.log(`True Markets: ${base}  (read-only)`);
  const tokens = new ApiKeyTokenProvider(base, loadApiKeyFile(keyFile));
  await tokens.getToken();
  console.log("✓ API key accepted, access token minted (not shown)");
  console.log(`  Organization id: ${await tokens.getOrganizationId()}`);

  const client = new GatewayClient(base, tokens);
  const [spot, perps] = await Promise.all([
    client.listAssets({ asset_class: "crypto,stock" }),
    client.listAssets({ product_type: "perp" }).catch(() => [] as Asset[]),
  ]);

  // Which fields the live catalog actually returns, so the app can be checked against them.
  const fields = [...new Set(spot.flatMap((a) => Object.keys(a)))].sort();
  console.log(`\nCatalog fields: ${fields.join(", ")}`);

  const groups = new Map<string, Asset[]>();
  for (const a of spot) {
    const key = `${a.asset_class ?? "?"} on ${a.chain ?? "no chain"} (${a.venue ?? "?"})`;
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  console.log(`\n${spot.length} spot assets, ${perps.length} perpetuals (perps stay off in this app)`);
  for (const [key, list] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${String(list.length).padStart(4)}  ${key}`);
  }

  const crypto = spot.filter((a) => a.asset_class !== "stock");
  console.log(`\nCrypto (${crypto.length}):`);
  for (const a of crypto.sort((x, y) => x.symbol.localeCompare(y.symbol))) {
    console.log(`  ${a.symbol.padEnd(10)} ${String(a.chain).padEnd(12)} ${a.stable ? "stablecoin  " : "            "}${a.name ?? ""}`);
  }

  const stocks = spot.filter((a) => a.asset_class === "stock").sort((x, y) => tickerOf(x).localeCompare(tickerOf(y)));
  const shown = showAll ? stocks : stocks.slice(0, SHOW_STOCKS);
  console.log(`\nTokenized stocks (${stocks.length}${showAll || stocks.length <= SHOW_STOCKS ? "" : `, first ${SHOW_STOCKS}; --all for every one`}):`);
  for (const a of shown) {
    console.log(`  ${tickerOf(a).padEnd(8)} ${a.symbol.padEnd(10)} ${String(a.chain).padEnd(12)} ${cleanName(a.name ?? "")}`);
  }
}

main().catch((err) => {
  // Error messages from the API carry no secrets; never print the key file or token.
  console.error("\n✗", err instanceof Error ? err.message : err);
  if (err?.requestId) console.error(`  request_id: ${err.requestId}`);
  process.exit(1);
});
