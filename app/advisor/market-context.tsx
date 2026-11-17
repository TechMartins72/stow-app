import { connection } from "next/server";
import { marketContextLine } from "@/app/_server/market-summary";

/**
 * A muted line of market news under an Advisor suggestion. Display only: the
 * suggestion itself comes from the Advisor's rules and is unchanged by this.
 * Renders nothing when True Markets has no summary for the asset.
 */
export async function MarketContext({ ticker, suggestion }: { ticker: string; suggestion: { id: string; title: string; why: string } }) {
  await connection();
  const line = await marketContextLine(ticker, suggestion);
  if (!line) return null;
  return (
    <p className="mt-2 border-l-2 border-hero/40 pl-3 text-sm text-text-muted">
      <span className="font-semibold text-text">Market context:</span> {line}{" "}
      <span className="text-xs">(True Markets news summary)</span>
    </p>
  );
}
