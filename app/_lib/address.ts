// Destination address checks. Shared by the browser (instant feedback) and the
// server action (the real check). A wrong-network address is the most common
// way to lose a transfer, so the messages say which network is expected.

export type ChainFamily = "solana" | "evm";

const EVM_CHAINS = new Set(["base", "ethereum", "arbitrum", "optimism", "polygon"]);
const LABELS: Record<string, string> = { solana: "Solana", base: "Base", ethereum: "Ethereum", arbitrum: "Arbitrum", optimism: "Optimism", polygon: "Polygon" };

const SOLANA = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM = /^0x[0-9a-fA-F]{40}$/;

export function chainFamily(chain: string | null): ChainFamily | null {
  if (chain === "solana") return "solana";
  return chain && EVM_CHAINS.has(chain) ? "evm" : null;
}

export function networkLabel(chain: string | null): string {
  return chain ? (LABELS[chain] ?? chain) : "Unknown network";
}

/** Null when the address looks right for the family; otherwise what's wrong, in plain words. */
export function checkAddress(family: ChainFamily, raw: string): string | null {
  const address = raw.trim();
  if (!address) return "Paste the address you're sending to.";
  if (family === "solana") {
    if (EVM.test(address)) return "That's an Ethereum-style (0x…) address. This asset is on Solana, so it needs a Solana address.";
    return SOLANA.test(address) ? null : "That isn't a valid Solana address. Check you copied all of it.";
  }
  if (SOLANA.test(address)) return "That looks like a Solana address. This asset needs an address starting with 0x.";
  return EVM.test(address) ? null : "Addresses on this network start with 0x and have 40 more characters.";
}

export function shortAddress(address: string): string {
  const a = address.trim();
  return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}
