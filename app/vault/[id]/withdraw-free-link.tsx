"use client";

import Link from "next/link";
import { useToast } from "@/app/_components/toaster";

const style = "mt-4 inline-flex rounded-xl border border-border px-4 py-2.5 font-semibold text-text hover:border-text-muted/40";

/**
 * Goes to Withdraw only when some of this asset is free. With nothing free, a
 * toast says so (and when money frees up) instead of opening a page that can only refuse.
 */
export function WithdrawFreeLink({ assetId, symbol, hasFree, nextFreeNote }: { assetId: string; symbol: string; hasFree: boolean; nextFreeNote: string }) {
  const toast = useToast();
  if (hasFree) {
    return (
      <Link href={`/withdraw?asset=${encodeURIComponent(assetId)}`} className={style}>
        Withdraw free {symbol}
      </Link>
    );
  }
  return (
    <button type="button" className={style} onClick={() => toast({ tone: "info", title: `No free ${symbol} to withdraw`, body: nextFreeNote })}>
      Withdraw free {symbol}
    </button>
  );
}
