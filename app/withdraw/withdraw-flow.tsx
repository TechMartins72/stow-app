"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { dec, mul, toDecimalString } from "@/engine/decimal";
import { chainFamily, checkAddress, networkLabel, shortAddress } from "@/app/_lib/address";
import { formatDate, formatQty, formatUsd } from "@/app/_lib/format";
import { checkSendAmount } from "@/app/_lib/send-amount";
import type { Holding } from "@/app/_server/wallet";
import { LockIcon } from "@/app/_components/icons";
import { useToast } from "@/app/_components/toaster";
import { previewWithdrawAction, withdrawAction, type PreviewResult, type SendResult } from "./actions";
import { Busy } from "@/app/_components/spinner";

type Stage = "form" | "review" | "done";

export function WithdrawFlow({ holdings, initialAssetId }: { holdings: Holding[]; initialAssetId?: string }) {
  const sendable = holdings.filter((h) => chainFamily(h.chain));
  const [assetId, setAssetId] = useState((sendable.find((h) => h.assetId === initialAssetId) ?? sendable[0]).assetId);
  const [qty, setQty] = useState("");
  const [to, setTo] = useState("");
  const [touched, setTouched] = useState(false);
  const [stage, setStage] = useState<Stage>("form");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<SendResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, start] = useTransition();
  const toast = useToast();

  const h = sendable.find((x) => x.assetId === assetId)!;
  const family = chainFamily(h.chain)!;
  const network = networkLabel(h.chain);
  const amountError = checkSendAmount(qty, h.available, h.decimals, h.symbol);
  const addressError = checkAddress(family, to);
  const overFree = !amountError && dec(qty.trim()) > dec(h.accessible);
  const unit = (v: string) => `${formatQty(v, h.decimals)} ${h.symbol}`;

  function review() {
    setTouched(true);
    if (amountError || addressError) return;
    start(async () => {
      const p = await previewWithdrawAction({ assetId, qty, to });
      setPreview(p);
      setConfirmed(false);
      if (p.ok) setStage("review");
    });
  }

  function send() {
    start(async () => {
      const r = await withdrawAction({ assetId, qty, to });
      setResult(r);
      setStage("done");
      if (!r.ok) toast({ tone: "error", title: "Nothing was sent", body: r.message });
      else if (r.outcome === "blocked") toast({ tone: "info", title: "Blocked by your locks", body: "The app didn't sign it. Your funds stayed put." });
      else if (r.status === "failed") toast({ tone: "error", title: "Transfer failed", body: "The network rejected it; your funds stayed in your wallet." });
      else toast({ tone: "success", title: r.status === "pending" ? `${unit(r.qty)} on its way` : `Sent ${unit(r.qty)}`, body: `To ${shortAddress(to)} on ${network}.` });
    });
  }

  function reset(next?: Partial<{ qty: string }>) {
    setStage("form");
    setPreview(null);
    setResult(null);
    if (next?.qty !== undefined) setQty(next.qty);
  }

  // ---------- Done ----------
  if (stage === "done" && result) {
    if (!result.ok) return <ErrorPanel message={result.message} requestId={result.requestId} detail={result.detail} onBack={() => reset()} />;
    if (result.outcome === "blocked") {
      return <BlockedPanel reasons={result.reasons} blockers={h.blockers} accessible={h.accessible} unit={unit} onSendFree={() => reset({ qty: h.accessible })} onBack={() => reset()} />;
    }
    const pending = result.status === "pending";
    const failed = result.status === "failed";
    return (
      <section role="status" className="rounded-[24px] border border-border bg-surface-raised p-6 sm:p-8">
        <span
          className={`grid size-12 place-items-center rounded-full text-xl font-bold text-white ${failed ? "bg-critical" : pending ? "bg-warning" : "bg-positive"}`}
          aria-hidden
        >
          {failed ? "!" : pending ? "…" : "✓"}
        </span>
        <h2 className="display mt-4 text-2xl">{failed ? "The transfer failed" : pending ? "On its way" : "Sent"}</h2>
        <p className="mt-2 text-text-muted">
          {failed
            ? "The network rejected it, so your funds stayed in your wallet."
            : pending
              ? `${unit(result.qty)} is being confirmed on ${network}. This can take a few minutes.`
              : `${unit(result.qty)} went to ${shortAddress(to)} on ${network}.`}
        </p>
        {!failed ? (
          <dl className="mt-5 space-y-2 rounded-2xl bg-surface p-4 text-sm">
            <Row label="Amount" value={unit(result.qty)} />
            <Row label="Network fee" value={dec(result.fee || "0") > 0n ? unit(result.fee) : "None"} />
            <Row label="To" value={shortAddress(to)} />
            {result.txHash ? <Row label="Transaction" value={shortAddress(result.txHash)} /> : null}
          </dl>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          {result.explorerUrl ? (
            <a href={result.explorerUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-border px-4 py-3 text-sm font-semibold">
              View on explorer ↗
            </a>
          ) : null}
          <Link href="/" className="rounded-xl bg-primary px-[22px] py-3 text-sm font-semibold text-white hover:bg-primary-hover">
            Back to Home
          </Link>
        </div>
      </section>
    );
  }

  // ---------- Review ----------
  if (stage === "review" && preview?.ok) {
    if (!preview.allowed) {
      return (
        <BlockedPanel
          reasons={preview.reasons}
          blockers={preview.blockers}
          accessible={preview.accessible}
          unit={unit}
          onSendFree={() => reset({ qty: preview.accessible })}
          onBack={() => reset()}
        />
      );
    }
    const usd = formatUsd(toDecimalString(mul(dec(qty.trim()), dec(h.priceUsd)), 6));
    return (
      <section className="rounded-[24px] border border-border bg-surface-raised p-6 sm:p-8">
        <h2 className="display text-2xl">Check and send</h2>
        <div className="mt-5 rounded-2xl bg-hero p-5">
          <p className="text-sm font-semibold text-frame">You&apos;re sending</p>
          <p className="num display mt-1 text-[calc(32px*var(--fs))] leading-tight text-white">{unit(qty)}</p>
          <p className="num text-sm font-semibold text-frame">About {usd}</p>
        </div>
        <dl className="mt-4 space-y-2 rounded-2xl bg-surface p-4 text-sm">
          <Row label="To" value={<span className="break-all font-mono text-xs">{to.trim()}</span>} />
          <Row label="Network" value={network} />
          <Row label="Network fee" value="Shown after sending; usually a few cents" />
        </dl>
        <div className="mt-4 rounded-2xl bg-critical-bg p-4 text-sm">
          <p className="font-bold text-critical">Transfers can&apos;t be undone</p>
          <p className="mt-1 text-text">
            Make sure this is a {network} address that accepts {h.symbol}. Sending to the wrong network or address loses the funds.
          </p>
        </div>
        <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm font-semibold">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-5 accent-[var(--accent-primary)]" />
          I&apos;ve checked the address and network.
        </label>
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={() => reset()} disabled={busy} className="rounded-xl border border-border px-[22px] py-[15px] font-semibold disabled:opacity-60">
            Back
          </button>
          <button
            type="button"
            onClick={send}
            disabled={!confirmed || busy}
            className="flex-1 rounded-xl bg-primary px-[22px] py-[15px] font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <Busy>Sending…</Busy> : `Send ${unit(qty)}`}
          </button>
        </div>
      </section>
    );
  }

  // ---------- Form ----------
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        review();
      }}
      noValidate
      className="space-y-6"
    >
      <fieldset>
        <legend className="mb-3 text-sm font-semibold">What do you want to send?</legend>
        <div className="space-y-2">
          {sendable.map((x) => {
            const lockedHere = dec(x.locked) > 0n;
            return (
              <label
                key={x.assetId}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border bg-surface-raised p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${
                  x.assetId === assetId ? "border-primary ring-1 ring-primary" : "border-border"
                }`}
              >
                <input
                  type="radio"
                  name="asset"
                  className="sr-only"
                  checked={x.assetId === assetId}
                  onChange={() => {
                    setAssetId(x.assetId);
                    setQty("");
                    setTo("");
                    setTouched(false);
                  }}
                />
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-frame text-xs font-extrabold text-white" aria-hidden>
                  {x.symbol.slice(0, 4)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">
                    {x.name} <span className="text-xs font-semibold text-text-muted">· {networkLabel(x.chain)}</span>
                  </span>
                  <span className="num block text-sm text-text-muted">
                    {formatQty(x.accessible, x.decimals)} {x.symbol} free
                    {lockedHere ? ` · ${formatQty(x.locked, x.decimals)} locked` : ""}
                  </span>
                </span>
                {lockedHere ? <LockIcon className="size-4 text-locked" /> : null}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor="qty" className="block text-sm font-semibold">
          Amount
        </label>
        <div
          className={`mt-2 flex items-center gap-2 rounded-2xl border bg-surface-raised px-4 py-3 focus-within:outline-2 focus-within:outline-primary ${
            touched && amountError ? "border-critical" : "border-border"
          }`}
        >
          <input
            id="qty"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={qty}
            onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ""))}
            aria-invalid={touched && !!amountError}
            aria-describedby="qty-help"
            className="num display min-w-0 flex-1 bg-transparent text-3xl outline-none placeholder:text-text-muted/50"
          />
          <span className="font-bold text-text-muted">{h.symbol}</span>
          <button
            type="button"
            onClick={() => setQty(h.accessible)}
            disabled={dec(h.accessible) === 0n}
            className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary disabled:opacity-50"
          >
            Max free
          </button>
        </div>
        <p id="qty-help" aria-live="polite" className={`mt-2 text-sm ${touched && amountError ? "text-critical" : overFree ? "text-warning" : "text-text-muted"}`}>
          {touched && amountError
            ? amountError
            : overFree
              ? `${unit(h.locked)} of this is locked. Only ${unit(h.accessible)} is free to send.`
              : `${unit(h.accessible)} free to send.`}
        </p>
      </div>

      <div>
        <label htmlFor="to" className="block text-sm font-semibold">
          To ({network} address)
        </label>
        <input
          id="to"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={family === "solana" ? "e.g. 9xQeWv…VFin" : "0x…"}
          aria-invalid={touched && !!addressError}
          aria-describedby="to-help"
          className={`mt-2 w-full rounded-2xl border bg-surface-raised px-4 py-3.5 font-mono text-sm focus:outline-2 focus:outline-primary ${
            touched && addressError ? "border-critical" : "border-border"
          }`}
        />
        <p id="to-help" aria-live="polite" className={`mt-2 text-sm ${touched && addressError ? "text-critical" : "text-text-muted"}`}>
          {touched && addressError ? addressError : `Only send to a ${network} address that accepts ${h.symbol}.`}
        </p>
      </div>

      {preview && !preview.ok ? (
        <div role="alert" className="rounded-2xl border border-critical/30 bg-critical-bg p-4 text-sm">
          <p className="font-bold text-critical">{preview.message}</p>
          {preview.requestId || preview.detail ? (
            <details className="mt-1 text-text-muted">
              <summary className="cursor-pointer font-semibold">Details</summary>
              {preview.detail ? <p className="mt-1">{preview.detail}</p> : null}
              {preview.requestId ? (
                <p className="mt-1">
                  Request ID: <code className="num">{preview.requestId}</code>
                </p>
              ) : null}
            </details>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-primary px-[22px] py-[15px] font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
      >
        {busy ? <Busy>Checking…</Busy> : "Review"}
      </button>
    </form>
  );
}

function BlockedPanel({
  reasons,
  blockers,
  accessible,
  unit,
  onSendFree,
  onBack,
}: {
  reasons: string[];
  blockers: Holding["blockers"];
  accessible: string;
  unit: (v: string) => string;
  onSendFree: () => void;
  onBack: () => void;
}) {
  const canSendFree = dec(accessible) > 0n;
  return (
    <section role="alert" className="overflow-hidden rounded-[24px] border border-locked/30 bg-surface-raised">
      <div className="bg-locked p-6 text-white sm:p-8">
        <span className="grid size-12 place-items-center rounded-full bg-white/15" aria-hidden>
          <LockIcon className="size-6" />
        </span>
        <h2 className="display mt-4 text-2xl">Blocked by your locks</h2>
        <p className="mt-2 text-white/85">You asked the app to keep this money safe, so it won&apos;t sign this transfer. Nothing was sent.</p>
      </div>
      <div className="p-6 sm:p-8">
        <ul className="space-y-1 text-sm text-text-muted">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        {blockers.length > 0 ? (
          <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
            {blockers.map((b) => (
              <li key={b.lockId}>
                <Link href={`/vault/${b.lockId}`} className="flex items-center justify-between gap-3 p-4 hover:bg-surface">
                  <span>
                    <span className="block font-bold">{b.goalName}</span>
                    <span className="text-sm text-text-muted">
                      {b.nextReleaseAt && b.nextReleaseAmount
                        ? `Frees ${unit(b.nextReleaseAmount)} on ${formatDate(b.nextReleaseAt)}`
                        : "Locked"}
                    </span>
                  </span>
                  <span className="num text-sm font-bold">{unit(b.lockedAmount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={onBack} className="rounded-xl border border-border px-[22px] py-[15px] font-semibold">
            Change amount
          </button>
          {canSendFree ? (
            <button type="button" onClick={onSendFree} className="flex-1 rounded-xl bg-primary px-[22px] py-[15px] font-semibold text-white hover:bg-primary-hover">
              Send the free {unit(accessible)} instead
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ErrorPanel({ message, requestId, detail, onBack }: { message: string; requestId?: string; detail?: string; onBack: () => void }) {
  return (
    <section role="alert" className="rounded-[24px] border border-critical/30 bg-critical-bg p-6 sm:p-8">
      <h2 className="text-lg font-bold text-critical">{message}</h2>
      {requestId || detail ? (
        <details className="mt-2 text-sm text-text-muted">
          <summary className="cursor-pointer font-semibold">Details</summary>
          {detail ? <p className="mt-1">{detail}</p> : null}
          {requestId ? (
            <p className="mt-1">
              Request ID: <code className="num">{requestId}</code>
            </p>
          ) : null}
        </details>
      ) : null}
      <button type="button" onClick={onBack} className="mt-5 rounded-xl border border-border bg-surface-raised px-[22px] py-3 font-semibold">
        Back
      </button>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-text-muted">{label}</dt>
      <dd className="num text-right font-semibold">{value}</dd>
    </div>
  );
}
