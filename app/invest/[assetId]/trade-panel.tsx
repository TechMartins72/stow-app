"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { dec } from "@/engine/decimal";
import { networkLabel } from "@/app/_lib/address";
import { formatDate, formatQty, formatUsd } from "@/app/_lib/format";
import { LOCK_PRESETS, unlockFromPreset } from "@/app/_lib/lock-policy";
import {
  checkBuyAmount,
  checkSellQty,
  minOrderUsd,
  QUOTE_TTL_MS,
} from "@/app/_lib/trade-policy";
import type { MarketAsset, PayingWith } from "@/app/_server/market";
import { LockIcon } from "@/app/_components/icons";
import { useToast } from "@/app/_components/toaster";
import {
  buyAction,
  quoteBuyAction,
  quoteSellAction,
  sellAction,
  type BuyQuote,
  type SellQuote,
  type TradeResult,
} from "../actions";
import { Busy } from "@/app/_components/spinner";

type Side = "buy" | "sell";
const QUICK = ["5", "25", "100"];
/** Renewals of an expired quote in a row before the panel waits for a tap. */
const MAX_AUTO_RENEWALS = 3;

export function TradePanel({
  asset,
  paying,
}: {
  asset: MarketAsset;
  paying: PayingWith | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const buyable = asset.tradability === "buy_sell";
  const [side, setSide] = useState<Side>(buyable ? "buy" : "sell");
  const [amount, setAmount] = useState("");
  const [qty, setQty] = useState("");
  const [buyQuote, setBuyQuote] = useState<BuyQuote | null>(null);
  const [sellQuote, setSellQuote] = useState<SellQuote | null>(null);
  const [lockIt, setLockIt] = useState(false);
  const [lockDays, setLockDays] = useState(365);
  const [result, setResult] = useState<TradeResult | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, start] = useTransition();

  const quote = side === "buy" ? buyQuote : sellQuote;
  const quotedAt = quote?.ok ? quote.quotedAt : 0;
  const secondsLeft = quote?.ok
    ? Math.max(0, Math.ceil((quotedAt + QUOTE_TTL_MS - now) / 1000))
    : 0;
  const expired = quote?.ok === true && secondsLeft === 0;

  // Expired quotes renew themselves ("Getting a new quote…"), a few times in a row at most,
  // so an idle page doesn't fetch quotes forever. Any tap of the button resets the count.
  const autoRenewals = useRef(0);

  // Tick once a second while a quote is on screen, so its countdown is honest; on expiry, renew.
  useEffect(() => {
    if (!quote?.ok) return;
    const expiresAt = quote.quotedAt + QUOTE_TTL_MS;
    const t = setInterval(() => {
      const at = Date.now();
      setNow(at);
      if (at >= expiresAt) {
        clearInterval(t);
        if (autoRenewals.current < MAX_AUTO_RENEWALS) {
          autoRenewals.current += 1;
          getQuote(true);
        }
      }
    }, 1000);
    return () => clearInterval(t);
    // getQuote is recreated every render; the quote it renews is the one this timer belongs to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote]);

  const freeUsdc = paying?.free ?? "0";
  const minUsd = minOrderUsd(asset);
  const buyError = checkBuyAmount(amount, freeUsdc, minUsd);
  const sellError = asset.priceUsd
    ? checkSellQty(
        qty,
        asset.free,
        asset.decimals,
        asset.priceUsd,
        asset.ticker,
        minUsd,
      )
    : "No price right now.";
  const canSell = dec(asset.free) > 0n;
  const cash = paying?.symbol ?? "USDC";
  const network = networkLabel(asset.chain);

  function switchSide(s: Side) {
    setSide(s);
    setResult(null);
    setBuyQuote(null);
    setSellQuote(null);
  }

  function getQuote(auto = false) {
    if (!auto) autoRenewals.current = 0;
    setResult(null);
    start(async () => {
      if (side === "buy")
        setBuyQuote(await quoteBuyAction({ assetId: asset.assetId, amount }));
      else setSellQuote(await quoteSellAction({ assetId: asset.assetId, qty }));
      setNow(Date.now());
    });
  }

  function confirm() {
    if (!quote?.ok || expired) return;
    start(async () => {
      const r =
        side === "buy" && buyQuote?.ok
          ? await buyAction({
              assetId: asset.assetId,
              amount,
              minQtyOut: buyQuote.minQtyOut,
              lock: lockIt ? { days: lockDays, goalName: "" } : null,
            })
          : sellQuote?.ok
            ? await sellAction({
                assetId: asset.assetId,
                qty,
                minQtyOut: sellQuote.minQtyOut,
              })
            : null;
      if (!r) return;
      setResult(r);
      setBuyQuote(null);
      setSellQuote(null);
      announce(r);
      router.refresh();
    });
  }

  function announce(r: TradeResult) {
    if (!r.ok)
      return toast({
        tone: "error",
        title: side === "buy" ? "Nothing was bought" : "Nothing was sold",
        body: r.message,
      });
    if (r.outcome === "blocked")
      return toast({ tone: "info", title: "Not signed", body: r.reasons[0] });
    if (r.status === "failed")
      return toast({
        tone: "error",
        title: "The order failed",
        body: "Your funds stayed in your wallet.",
      });
    const what = `${formatQty(r.qty, asset.decimals)} ${asset.ticker}`;
    if (side === "sell")
      return toast({
        tone: "success",
        title: r.status === "pending" ? `Selling ${what}` : `Sold ${what}`,
        href: "/activity",
        linkLabel: "View activity",
      });
    if (r.lock) {
      return toast({
        tone: "success",
        title: `Bought and locked ${what}`,
        body: `Locked until ${formatDate(new Date(r.lock.unlockAt))}.`,
        href: `/vault/${r.lock.id}`,
        linkLabel: "View lock",
      });
    }
    toast({
      tone: "success",
      title: r.status === "pending" ? `Buying ${what}` : `Bought ${what}`,
      body: r.lockError,
      href: "/activity",
      linkLabel: "View activity",
    });
  }

  return (
    <section className="overflow-hidden rounded-[24px] border border-border bg-surface-raised">
      <div
        role="tablist"
        aria-label="Buy or sell"
        className="grid grid-cols-2 border-b border-border"
      >
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            role="tab"
            type="button"
            aria-selected={side === s}
            disabled={s === "buy" && !buyable}
            title={
              s === "buy" && !buyable
                ? "New buys are paused for this asset"
                : undefined
            }
            onClick={() => switchSide(s)}
            className={`py-3.5 text-sm font-bold capitalize disabled:cursor-not-allowed disabled:opacity-40 ${side === s ? "border-b-2 border-primary text-primary" : "text-text-muted hover:text-text"}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="p-5 sm:p-6">
        {side === "buy" ? (
          <>
            <label htmlFor="amount" className="block text-sm font-semibold">
              Amount to spend
            </label>
            <div className="mt-2 flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 focus-within:outline-2 focus-within:outline-primary">
              <span className="display text-3xl text-text-muted">$</span>
              <input
                id="amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value.replace(/[^\d.]/g, ""));
                  setBuyQuote(null);
                }}
                className="num display min-w-0 flex-1 bg-transparent text-3xl outline-none placeholder:text-text-muted/50"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setAmount(v);
                    setBuyQuote(null);
                  }}
                  className="rounded-full border border-border px-3.5 py-1.5 text-sm font-semibold hover:border-text-muted/40"
                >
                  ${v}
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-text-muted">
              Paid with {cash} on {network}:{" "}
              <span className="num font-semibold text-text">
                {formatUsd(freeUsdc)}
              </span>{" "}
              free. Minimum order {formatUsd(minUsd)}.{" "}
              {dec(freeUsdc) < dec(minUsd) ? (
                <Link
                  href="/add-funds"
                  className="font-semibold text-primary hover:underline"
                >
                  Add {cash} on {network}
                </Link>
              ) : null}
            </p>
            {amount && buyError ? (
              <p className="mt-2 text-sm text-critical">{buyError}</p>
            ) : null}

            <fieldset className="mt-5 rounded-2xl border border-border p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={lockIt}
                  onChange={(e) => setLockIt(e.target.checked)}
                  className="mt-1 size-5 accent-[var(--accent-locked)]"
                />
                <span>
                  <span className="flex items-center gap-1.5 font-bold">
                    <LockIcon className="size-4 text-locked" /> Buy and lock
                  </span>
                  <span className="block text-sm text-text-muted">
                    {asset.assetClass === "stock"
                      ? "Lock the shares as soon as they arrive, so they can't be sold on impulse."
                      : `Lock the ${asset.ticker} as soon as it arrives, so it can't be sold on impulse.`}
                  </span>
                </span>
              </label>
              {lockIt ? (
                <div
                  className="mt-3 flex flex-wrap gap-2"
                  role="radiogroup"
                  aria-label="Lock for"
                >
                  {LOCK_PRESETS.map((p) => (
                    <button
                      key={p.days}
                      type="button"
                      role="radio"
                      aria-checked={lockDays === p.days}
                      onClick={() => setLockDays(p.days)}
                      className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold ${lockDays === p.days ? "border-locked bg-locked text-white" : "border-border"}`}
                    >
                      {p.label}
                    </button>
                  ))}
                  <p className="w-full text-sm text-text-muted">
                    Unlocks on{" "}
                    {formatDate(unlockFromPreset(lockDays, new Date()))}.
                  </p>
                </div>
              ) : null}
            </fieldset>
          </>
        ) : canSell ? (
          <>
            <label htmlFor="qty" className="block text-sm font-semibold">
              Shares to sell
            </label>
            <div className="mt-2 flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 focus-within:outline-2 focus-within:outline-primary">
              <input
                id="qty"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={qty}
                onChange={(e) => {
                  setQty(e.target.value.replace(/[^\d.]/g, ""));
                  setSellQuote(null);
                }}
                className="num display min-w-0 flex-1 bg-transparent text-3xl outline-none placeholder:text-text-muted/50"
              />
              <span className="font-bold text-text-muted">{asset.ticker}</span>
              <button
                type="button"
                onClick={() => {
                  setQty(asset.free);
                  setSellQuote(null);
                }}
                className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary"
              >
                Max free
              </button>
            </div>
            <p className="mt-3 text-sm text-text-muted">
              {formatQty(asset.free, asset.decimals)} {asset.ticker} free
              {dec(asset.locked) > 0n
                ? ` · ${formatQty(asset.locked, asset.decimals)} locked and can't be sold`
                : ""}
              . You&apos;ll receive {cash} on {network}.
            </p>
            {qty && sellError ? (
              <p className="mt-2 text-sm text-critical">{sellError}</p>
            ) : null}
          </>
        ) : (
          <p className="text-text-muted">
            {dec(asset.locked) > 0n
              ? `All your ${asset.ticker} is locked, so there's nothing free to sell.`
              : `You don't own any ${asset.ticker} yet.`}
          </p>
        )}

        {/* Quote */}
        {quote && !quote.ok ? (
          <div
            role="alert"
            className="mt-5 rounded-2xl bg-critical-bg p-4 text-sm"
          >
            <p className="font-bold text-critical">{quote.message}</p>
          </div>
        ) : null}

        {quote?.ok ? (
          <div className="mt-5 rounded-2xl bg-surface p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">Live quote</p>
              <span
                className={`num rounded-full px-2.5 py-0.5 text-xs font-bold ${expired ? "bg-critical-bg text-critical" : secondsLeft <= 5 ? "bg-warning-bg text-warning" : "bg-hero/15 text-hero"}`}
                aria-live="polite"
              >
                {expired ? (
                  busy ? (
                    <Busy>Getting a new quote…</Busy>
                  ) : (
                    "Expired"
                  )
                ) : (
                  `${secondsLeft}s`
                )}
              </span>
            </div>
            <dl className="mt-3 space-y-1.5 text-sm">
              {buyQuote?.ok && side === "buy" ? (
                <>
                  <Row
                    label="You get"
                    value={`≈ ${formatQty(buyQuote.shares, 6)} ${asset.ticker}`}
                  />
                  <Row label="Price" value={formatUsd(buyQuote.priceUsd)} />
                  <Row label="Fee" value={formatUsd(buyQuote.feeUsd)} />
                  <Row
                    label="Total"
                    value={formatUsd(buyQuote.totalUsd)}
                    strong
                  />
                </>
              ) : null}
              {sellQuote?.ok && side === "sell" ? (
                <>
                  <Row label="Price" value={formatUsd(sellQuote.priceUsd)} />
                  <Row label="Fee" value={formatUsd(sellQuote.feeUsd)} />
                  <Row
                    label="You receive"
                    value={`≈ ${formatUsd(sellQuote.proceedsUsd)} ${cash}`}
                    strong
                  />
                </>
              ) : null}
            </dl>
            <p className="mt-3 text-xs text-text-muted">
              If the price moves more than 1% against you before signing, the
              app refuses the order and nothing is traded.
            </p>
          </div>
        ) : null}

        {result ? (
          <ResultNote
            result={result}
            side={side}
            ticker={asset.ticker}
            decimals={asset.decimals}
          />
        ) : null}

        {side === "sell" && !canSell ? null : (
          <div className="mt-5 flex gap-3">
            {quote?.ok && !expired ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    side === "buy" ? setBuyQuote(null) : setSellQuote(null)
                  }
                  disabled={busy}
                  className="rounded-xl border border-border px-[22px] py-[15px] font-semibold disabled:opacity-60"
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={confirm}
                  disabled={busy}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-[22px] py-[15px] font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
                >
                  {side === "buy" && lockIt ? (
                    <LockIcon className="size-5" />
                  ) : null}
                  {busy ? (
                    <Busy>Placing order…</Busy>
                  ) : side === "buy" ? (
                    lockIt ? (
                      "Buy and lock"
                    ) : (
                      "Buy now"
                    )
                  ) : (
                    "Sell now"
                  )}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => getQuote()}
                disabled={busy || (side === "buy" ? !!buyError : !!sellError)}
                className="flex-1 rounded-xl bg-primary px-[22px] py-[15px] font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? (
                  <Busy>
                    {expired ? "Getting a new quote…" : "Getting a quote…"}
                  </Busy>
                ) : expired ? (
                  "Get a new quote"
                ) : (
                  "Get a quote"
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function ResultNote({
  result,
  side,
  ticker,
  decimals,
}: {
  result: TradeResult;
  side: Side;
  ticker: string;
  decimals: number;
}) {
  if (!result.ok) {
    return (
      <div role="alert" className="mt-5 rounded-2xl bg-critical-bg p-4 text-sm">
        <p className="font-bold text-critical">{result.message}</p>
        {result.requestId || result.detail ? (
          <details className="mt-1 text-text-muted">
            <summary className="cursor-pointer font-semibold">Details</summary>
            {result.detail ? (
              <p className="mt-1 break-words">{result.detail}</p>
            ) : null}
            {result.requestId ? (
              <p className="mt-1">
                Request ID: <code className="num">{result.requestId}</code>
              </p>
            ) : null}
          </details>
        ) : null}
      </div>
    );
  }
  if (result.outcome === "blocked") {
    return (
      <div
        role="alert"
        className="mt-5 rounded-2xl border border-locked/30 p-4 text-sm"
      >
        <p className="flex items-center gap-1.5 font-bold text-locked">
          <LockIcon className="size-4" /> The app didn&apos;t sign this
        </p>
        <ul className="mt-1 text-text-muted">
          {result.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
    );
  }
  const what = `${formatQty(result.qty, decimals)} ${ticker}`;
  return (
    <div role="status" className="mt-5 rounded-2xl bg-positive/10 p-4 text-sm">
      <p className="font-bold text-positive">
        {result.status === "failed"
          ? "The order failed; nothing changed."
          : result.status === "pending"
            ? `Order placed for ${what}; confirming…`
            : side === "buy"
              ? `Bought ${what}`
              : `Sold ${what}`}
      </p>
      {result.lock ? (
        <p className="mt-1">
          Locked until {formatDate(new Date(result.lock.unlockAt))}.{" "}
          <Link
            href={`/vault/${result.lock.id}`}
            className="font-semibold text-primary hover:underline"
          >
            View lock
          </Link>
        </p>
      ) : null}
      {result.lockError ? (
        <p className="mt-1 text-warning">{result.lockError}</p>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-text-muted">{label}</dt>
      <dd className={`num ${strong ? "font-bold" : "font-semibold"}`}>
        {value}
      </dd>
    </div>
  );
}
