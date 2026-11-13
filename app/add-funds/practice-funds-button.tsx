"use client";

import { useTransition } from "react";
import { useToast } from "@/app/_components/toaster";
import { addPracticeFundsAction } from "./actions";
import { Busy } from "@/app/_components/spinner";

export function PracticeFundsButton({ assetId, label }: { assetId: string; label: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await addPracticeFundsAction(assetId);
          toast(
            result.ok
              ? { tone: "success", title: `Added ${result.amount} practice ${result.symbol}`, body: "It's in your wallet now.", href: "/", linkLabel: "See balance" }
              : { tone: "error", title: "Couldn't add practice funds", body: result.message },
          );
        })
      }
      className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:border-text-muted/40 disabled:opacity-60"
    >
      {pending ? <Busy>Adding…</Busy> : label}
    </button>
  );
}
