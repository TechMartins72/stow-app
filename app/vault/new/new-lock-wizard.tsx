"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { dec, mul, sum, toDecimalString } from "@/engine/decimal";
import type { Interval, Split } from "@/engine/vault/schedule";
import type { Tranche } from "@/engine/vault/types";
import { formatDate, formatQty, formatUsd } from "@/app/_lib/format";
import {
  checkGoalName,
  checkLockAmount,
  checkUnlockDate,
  daysUntil,
  GOAL_NAME_MAX,
  LOCK_MAX_DAYS,
  LOCK_MIN_DAYS,
  LOCK_PRESETS,
  planSchedule,
  SCHEDULE_INTERVALS,
  SCHEDULE_PERCENTS,
  unlockFromDateInput,
  unlockFromPreset,
} from "@/app/_lib/lock-policy";
import type { LockableAsset } from "@/app/_server/wallet";
import { LockIcon, PadlockMotif } from "@/app/_components/icons";
import { createLockAction, type CreateLockInput } from "./actions";
import { Busy } from "@/app/_components/spinner";

/** A date picked as "N days from now" (recomputed at submit) or a calendar date. */
type When = { kind: "preset"; days: number } | { kind: "date"; value: string };
type Mode = "once" | "parts";

const STEPS = ["Amount", "Plan", "Name", "Review"] as const;
const NAME_IDEAS = ["Rent", "Monthly budget", "Emergency fund", "New laptop", "School fees"];
const CHAIN_LABEL: Record<string, string> = { solana: "Solana", base: "Base", ethereum: "Ethereum" };
const FIRST_RELEASE_PRESETS = [
  { label: "In 1 week", days: 7 },
  { label: "In 2 weeks", days: 14 },
  { label: "In 1 month", days: 30 },
];

const resolve = (when: When, now: Date) => (when.kind === "preset" ? unlockFromPreset(when.days, now) : unlockFromDateInput(when.value));

export function NewLockWizard({ assets, nowIso }: { assets: LockableAsset[]; nowIso: string }) {
  const now = new Date(nowIso);
  const [step, setStep] = useState(0);
  const [assetId, setAssetId] = useState(assets[0].assetId);
  const [amount, setAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [mode, setMode] = useState<Mode>("once");
  const [once, setOnce] = useState<When>({ kind: "preset", days: 90 });
  const [split, setSplit] = useState<Split>({ kind: "percent", percent: "25" });
  const [every, setEvery] = useState<Interval>("month");
  const [first, setFirst] = useState<When>({ kind: "preset", days: 30 });
  const [goalName, setGoalName] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [serverError, setServerError] = useState<{ message: string; requestId?: string } | null>(null);
  const [submitting, startSubmit] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to each step's heading so screen readers announce the new step.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const asset = assets.find((a) => a.assetId === assetId) ?? assets[0];
  const total = amount.trim();
  const amountError = checkLockAmount(total, asset.accessible, asset.decimals);
  const valueUsd = amountError ? null : toDecimalString(mul(dec(total), dec(asset.priceUsd)), 6);

  // One date
  const onceAt = resolve(once, now);
  const onceError = onceAt ? checkUnlockDate(onceAt, now) : "Pick a date.";

  // In parts
  const firstAt = resolve(first, now);
  const plan =
    mode === "parts" && !amountError
      ? firstAt
        ? planSchedule({ stable: asset.stable, total, decimals: asset.decimals, firstAt, every, split }, now)
        : { error: "Pick the date of the first release." }
      : null;
  const schedule: Tranche[] | null = plan && "schedule" in plan ? plan.schedule : null;
  const unlockError = mode === "once" ? onceError : plan && "error" in plan ? plan.error : null;
  const finalAt = mode === "once" ? onceAt : (schedule?.at(-1)?.releaseAt ?? null);

  const nameError = checkGoalName(goalName);
  const stepError = [amountError, unlockError, nameError, understood ? null : "Tick the box to confirm."][step];
  const minDate = unlockFromPreset(LOCK_MIN_DAYS, now).toISOString().slice(0, 10);
  const maxDate = unlockFromPreset(LOCK_MAX_DAYS, now).toISOString().slice(0, 10);

  function chooseAsset(a: LockableAsset) {
    setAssetId(a.assetId);
    setAmount("");
    setAmountTouched(false);
    if (!a.stable) setMode("once");
  }

  function next() {
    if (step === 0) setAmountTouched(true);
    if (stepError) return;
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    setServerError(null);
    startSubmit(async () => {
      // "N days from now" is measured from the moment of locking, not from when the page loaded.
      const at = new Date();
      const unlock: CreateLockInput["unlock"] =
        mode === "once"
          ? { kind: "once", unlockAt: resolve(once, at)!.toISOString() }
          : { kind: "parts", firstAt: resolve(first, at)!.toISOString(), every, split };
      const result = await createLockAction({ assetId, amount: total, unlock, goalName });
      // Success redirects; we only get here on a failure.
      if (result && !result.ok) setServerError({ message: result.message, requestId: result.requestId });
    });
  }

  const qty = (v: string) => `${formatQty(v, asset.decimals)} ${asset.symbol}`;

  return (
    <div className="mx-auto w-full max-w-xl">
      {/* Progress */}
      <ol className="mb-8 grid grid-cols-4 gap-2" aria-label="Steps">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? "step" : undefined}>
            <div className={`h-1.5 rounded-full ${i <= step ? "bg-locked" : "bg-border"}`} />
            <span className={`mt-2 block text-xs font-semibold ${i === step ? "text-text" : "text-text-muted"}`}>{label}</span>
          </li>
        ))}
      </ol>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
        noValidate
      >
        {step === 0 ? (
          <section>
            <StepHeading ref={headingRef} title="What do you want to lock?" hint="Only what isn't already locked is shown." />
            <fieldset>
              <legend className="sr-only">Asset</legend>
              <div className="space-y-2">
                {assets.map((a) => (
                  <label
                    key={a.assetId}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border bg-surface-raised p-4 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${
                      a.assetId === assetId ? "border-locked ring-1 ring-locked" : "border-border hover:border-text-muted/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="asset"
                      value={a.assetId}
                      checked={a.assetId === assetId}
                      onChange={() => chooseAsset(a)}
                      className="sr-only"
                    />
                    <AssetBadge symbol={a.symbol} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">
                        {a.name}{" "}
                        {a.chain ? <span className="text-xs font-semibold text-text-muted">· {CHAIN_LABEL[a.chain] ?? a.chain}</span> : null}
                      </span>
                      <span className="num block text-sm text-text-muted">
                        {formatQty(a.accessible, a.decimals)} {a.symbol} available
                      </span>
                    </span>
                    <span className="num text-sm font-semibold">{formatUsd(a.accessibleUsd)}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label htmlFor="amount" className="mt-6 block text-sm font-semibold">
              Amount to lock
            </label>
            <div
              className={`mt-2 flex items-center gap-2 rounded-2xl border bg-surface-raised px-4 py-3 focus-within:outline-2 focus-within:outline-primary ${
                amountTouched && amountError ? "border-critical" : "border-border"
              }`}
            >
              <input
                id="amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                onBlur={() => amount && setAmountTouched(true)}
                aria-invalid={amountTouched && !!amountError}
                aria-describedby="amount-help"
                className="num display min-w-0 flex-1 bg-transparent text-3xl outline-none placeholder:text-text-muted/50"
              />
              <span className="font-bold text-text-muted">{asset.symbol}</span>
              <button
                type="button"
                onClick={() => {
                  setAmount(asset.accessible);
                  setAmountTouched(true);
                }}
                className="rounded-lg bg-locked/10 px-2.5 py-1 text-xs font-bold text-locked dark:bg-locked/30 dark:text-frame-text"
              >
                Max
              </button>
            </div>
            <p id="amount-help" aria-live="polite" className={`mt-2 text-sm ${amountTouched && amountError ? "text-critical" : "text-text-muted"}`}>
              {amountTouched && amountError ? amountError : valueUsd ? `About ${formatUsd(valueUsd)} today` : " "}
            </p>
          </section>
        ) : null}

        {step === 1 ? (
          <section>
            <StepHeading ref={headingRef} title="Savings goal or budget?" hint={`Putting away ${qty(total)}.`} />

            <div role="radiogroup" aria-label="Plan type" className="grid grid-cols-2 gap-1 rounded-2xl bg-border/60 p-1">
              <Segment checked={mode === "once"} onClick={() => setMode("once")} title="Savings goal" sub="All of it on one date" />
              <Segment
                checked={mode === "parts"}
                onClick={() => asset.stable && setMode("parts")}
                disabled={!asset.stable}
                title="Budget"
                sub={asset.stable ? "Paid back to you in parts" : "Dollars (USDC) only"}
              />
            </div>

            {mode === "once" ? (
              <div className="mt-6">
                <fieldset>
                  <legend className="mb-3 text-sm font-semibold">Free it up on</legend>
                  <div className="grid grid-cols-2 gap-3">
                    {LOCK_PRESETS.map((p) => (
                      <Choice
                        key={p.days}
                        selected={once.kind === "preset" && once.days === p.days}
                        onClick={() => setOnce({ kind: "preset", days: p.days })}
                        title={p.label}
                        sub={formatDate(unlockFromPreset(p.days, now))}
                      />
                    ))}
                  </div>
                </fieldset>
                <DateField
                  id="unlock-date"
                  label="Or pick a date"
                  min={minDate}
                  max={maxDate}
                  value={once.kind === "date" ? once.value : ""}
                  onChange={(value) => setOnce({ kind: "date", value })}
                />
                <p aria-live="polite" className={`mt-3 text-sm ${onceError && once.kind === "date" && once.value ? "text-critical" : "text-text-muted"}`}>
                  {onceAt && !onceError
                    ? `All of it unlocks on ${formatDate(onceAt)}, in ${daysUntil(onceAt, now)} days.`
                    : once.kind === "date" && once.value
                      ? onceError
                      : " "}
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                <fieldset>
                  <legend className="mb-3 text-sm font-semibold">Pay me back each time</legend>
                  <div className="flex flex-wrap gap-2">
                    {SCHEDULE_PERCENTS.map((p) => (
                      <Pill key={p} selected={split.kind === "percent" && split.percent === p} onClick={() => setSplit({ kind: "percent", percent: p })}>
                        {p}%
                      </Pill>
                    ))}
                    <Pill selected={split.kind === "fixed"} onClick={() => setSplit({ kind: "fixed", amount: split.kind === "fixed" ? split.amount : "" })}>
                      Fixed amount
                    </Pill>
                  </div>
                  {split.kind === "fixed" ? (
                    <div className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-surface-raised px-4 py-3 focus-within:outline-2 focus-within:outline-primary">
                      <label htmlFor="fixed-amount" className="sr-only">
                        Amount per release
                      </label>
                      <input
                        id="fixed-amount"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="0"
                        value={split.amount}
                        onChange={(e) => setSplit({ kind: "fixed", amount: e.target.value.replace(/[^\d.]/g, "") })}
                        className="num min-w-0 flex-1 bg-transparent text-xl font-bold outline-none"
                      />
                      <span className="font-bold text-text-muted">{asset.symbol} each time</span>
                    </div>
                  ) : null}
                </fieldset>

                <fieldset>
                  <legend className="mb-3 text-sm font-semibold">Every</legend>
                  <div className="flex flex-wrap gap-2">
                    {SCHEDULE_INTERVALS.map((i) => (
                      <Pill key={i.value} selected={every === i.value} onClick={() => setEvery(i.value)}>
                        {i.label}
                      </Pill>
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="mb-3 text-sm font-semibold">First pay-out</legend>
                  <div className="flex flex-wrap gap-2">
                    {FIRST_RELEASE_PRESETS.map((p) => (
                      <Pill key={p.days} selected={first.kind === "preset" && first.days === p.days} onClick={() => setFirst({ kind: "preset", days: p.days })}>
                        {p.label}
                      </Pill>
                    ))}
                  </div>
                  <DateField
                    id="first-date"
                    label="Or pick a date"
                    min={minDate}
                    max={maxDate}
                    value={first.kind === "date" ? first.value : ""}
                    onChange={(value) => setFirst({ kind: "date", value })}
                  />
                </fieldset>

                {schedule ? (
                  <div className="rounded-2xl border border-border bg-surface-raised p-4">
                    <p className="text-sm font-bold">
                      {schedule.length} pay-outs, the last on {formatDate(schedule.at(-1)!.releaseAt)}
                    </p>
                    <ScheduleList schedule={schedule} total={total} unit={asset.symbol} decimals={asset.decimals} />
                  </div>
                ) : plan && "error" in plan ? (
                  <p role="alert" className="text-sm text-critical">
                    {plan.error}
                  </p>
                ) : null}
              </div>
            )}
          </section>
        ) : null}

        {step === 2 ? (
          <section>
            <StepHeading
              ref={headingRef}
              title={mode === "parts" ? "What's this budget for?" : "What are you saving for?"}
              hint="A name helps you keep the promise."
            />
            <label htmlFor="goal" className="sr-only">
              Lock name
            </label>
            <input
              id="goal"
              value={goalName}
              maxLength={GOAL_NAME_MAX}
              onChange={(e) => setGoalName(e.target.value)}
              placeholder="e.g. Rent for 2027"
              className="w-full rounded-2xl border border-border bg-surface-raised px-4 py-4 text-lg font-semibold focus:outline-2 focus:outline-primary"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {NAME_IDEAS.map((idea) => (
                <Pill key={idea} selected={goalName === idea} onClick={() => setGoalName(idea)}>
                  {idea}
                </Pill>
              ))}
            </div>
          </section>
        ) : null}

        {step === 3 && finalAt && valueUsd ? (
          <section>
            <StepHeading ref={headingRef} title="Check and lock" />
            <div className="relative overflow-hidden rounded-[24px] bg-hero p-6">
              <PadlockMotif className="pointer-events-none absolute -right-8 -bottom-10 size-48 text-white/15" />
              <p className="relative text-sm font-semibold text-frame">{goalName.trim()}</p>
              <p className="num display relative mt-1 text-[calc(34px*var(--fs))] leading-tight text-white">{qty(total)}</p>
              <p className="num relative text-sm font-semibold text-frame">About {formatUsd(valueUsd)} today</p>
              <dl className="relative mt-5 grid grid-cols-2 gap-4 border-t border-frame/15 pt-4 text-frame">
                {schedule ? (
                  <>
                    <div>
                      <dt className="text-xs font-semibold">First release</dt>
                      <dd className="font-bold">{formatDate(schedule[0].releaseAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold">Then</dt>
                      <dd className="num font-bold">
                        {schedule.length - 1} more, every {SCHEDULE_INTERVALS.find((i) => i.value === every)!.noun}
                      </dd>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <dt className="text-xs font-semibold">Unlocks on</dt>
                      <dd className="font-bold">{formatDate(finalAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold">Locked for</dt>
                      <dd className="num font-bold">{daysUntil(finalAt, now)} days</dd>
                    </div>
                  </>
                )}
              </dl>
            </div>

            {schedule ? (
              <div className="mt-4 rounded-2xl border border-border bg-surface-raised p-4">
                <p className="text-sm font-bold">Release schedule</p>
                <ScheduleList schedule={schedule} total={total} unit={asset.symbol} decimals={asset.decimals} />
              </div>
            ) : null}

            <ul className="mt-5 space-y-2 text-sm" aria-label="Checks">
              <Check>
                {qty(total)} of your {qty(asset.accessible)} is free to lock
              </Check>
              <Check>
                {schedule ? `Every release is ${LOCK_MIN_DAYS}–${LOCK_MAX_DAYS} days away` : `The date is ${LOCK_MIN_DAYS}–${LOCK_MAX_DAYS} days away`}
              </Check>
              <Check>No money moves. We only stop it from leaving.</Check>
            </ul>

            <div className="mt-5 rounded-2xl bg-warning-bg p-4 text-sm text-text">
              <p className="font-bold text-warning">This is a real commitment</p>
              <p className="mt-1">
                {schedule
                  ? `Each part unlocks by itself on its date. Until then, the app will refuse to withdraw, sell or trade it, even if you ask, and so will the advisor. Early exit isn't available.`
                  : `It unlocks by itself on ${formatDate(finalAt)}. Until then, the app will refuse to withdraw, sell or trade these ${asset.symbol}, even if you ask, and so will the advisor. Early exit isn't available.`}
              </p>
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={understood}
                onChange={(e) => setUnderstood(e.target.checked)}
                className="mt-0.5 size-5 accent-[var(--accent-locked)]"
              />
              {schedule
                ? `I understand I can only use each part from its release date, the last on ${formatDate(finalAt)}.`
                : `I understand I can't use this money until ${formatDate(finalAt)}.`}
            </label>

            {serverError ? (
              <div role="alert" className="mt-4 rounded-2xl border border-critical/30 bg-critical-bg p-4 text-sm">
                <p className="font-bold text-critical">{serverError.message}</p>
                {serverError.requestId ? (
                  <details className="mt-1 text-text-muted">
                    <summary className="cursor-pointer font-semibold">Details</summary>
                    Request ID: <code className="num">{serverError.requestId}</code>
                  </details>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {/* Footer */}
        <div className="mt-8 flex items-center gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              disabled={submitting}
              className="rounded-xl border border-border bg-surface-raised px-[22px] py-[15px] font-semibold disabled:opacity-60"
            >
              Back
            </button>
          ) : null}
          <button
            type="submit"
            disabled={submitting || (step === 3 && !understood)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-[22px] py-[15px] font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {step === 3 ? <LockIcon className="size-5" /> : null}
            {step < 3 ? "Continue" : submitting ? <Busy>Locking…</Busy> : `Lock ${qty(total || "0")}`}
          </button>
        </div>
        {step === 2 && nameError && goalName ? <p className="mt-2 text-sm text-critical">{nameError}</p> : null}
      </form>
    </div>
  );
}

/** Dates and amounts of each release, with the running share unlocked. Long lists are shortened. */
function ScheduleList({ schedule, total, unit, decimals }: { schedule: Tranche[]; total: string; unit: string; decimals: number }) {
  const totalDec = dec(total);
  const rows = schedule.map((t, i) => {
    const released = sum(schedule.slice(0, i + 1).map((p) => dec(p.amount)));
    // A display percentage, not an amount.
    const pct = totalDec > 0n ? Number((released * 1000n) / totalDec) / 10 : 0;
    return { i, t, pct };
  });
  const shown = rows.length > 7 ? [...rows.slice(0, 5), null, rows.at(-1)!] : rows;
  return (
    <ol className="mt-3 divide-y divide-border text-sm">
      {shown.map((row, k) =>
        row ? (
          <li key={row.i} className="flex items-center justify-between gap-3 py-2">
            <span className="flex items-center gap-2">
              <span className="num grid size-6 place-items-center rounded-full bg-locked/10 text-[calc(11px*var(--fs))] font-bold text-locked dark:bg-locked/30 dark:text-frame-text">
                {row.i + 1}
              </span>
              {formatDate(row.t.releaseAt)}
            </span>
            <span className="num font-semibold">
              {formatQty(row.t.amount, decimals)} {unit} <span className="font-normal text-text-muted">· {row.pct}%</span>
            </span>
          </li>
        ) : (
          <li key={`gap-${k}`} className="py-2 text-center text-text-muted">
            … {rows.length - 6} more …
          </li>
        ),
      )}
    </ol>
  );
}

function StepHeading({ ref, title, hint }: { ref: React.Ref<HTMLHeadingElement>; title: string; hint?: string }) {
  return (
    <div className="mb-5">
      <h2 ref={ref} tabIndex={-1} className="display text-[calc(26px*var(--fs))] leading-tight outline-none">
        {title}
      </h2>
      {hint ? <p className="num mt-1 text-sm text-text-muted">{hint}</p> : null}
    </div>
  );
}

function Segment({ checked, onClick, title, sub, disabled }: { checked: boolean; onClick: () => void; title: string; sub: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-disabled={disabled}
      onClick={onClick}
      className={`rounded-xl px-3 py-2.5 text-left transition ${checked ? "bg-locked text-white shadow-sm" : "hover:bg-surface-raised/60"} ${
        disabled ? "cursor-not-allowed opacity-60" : ""
      }`}
    >
      <span className="block font-bold">{title}</span>
      <span className={`block text-xs ${checked ? "text-white/85" : "text-text-muted"}`}>{sub}</span>
    </button>
  );
}

function Choice({ selected, onClick, title, sub }: { selected: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        selected ? "border-locked bg-locked text-white" : "border-border bg-surface-raised hover:border-text-muted/40"
      }`}
    >
      <span className="block font-bold">{title}</span>
      <span className={`text-sm ${selected ? "text-white/85" : "text-text-muted"}`}>{sub}</span>
    </button>
  );
}

function Pill({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
        selected ? "border-locked bg-locked text-white" : "border-border bg-surface-raised hover:border-text-muted/40"
      }`}
    >
      {children}
    </button>
  );
}

function DateField({
  id,
  label,
  min,
  max,
  value,
  onChange,
}: {
  id: string;
  label: string;
  min: string;
  max: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <>
      <label htmlFor={id} className="mt-4 block text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        type="date"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-2xl border border-border bg-surface-raised px-4 py-3 font-semibold focus:outline-2 focus:outline-primary"
      />
    </>
  );
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <svg viewBox="0 0 20 20" className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden>
        <circle cx="10" cy="10" r="9" fill="currentColor" opacity=".15" />
        <path d="m6 10.5 2.5 2.5L14 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span>{children}</span>
    </li>
  );
}

function AssetBadge({ symbol }: { symbol: string }) {
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-frame text-xs font-extrabold text-white" aria-hidden>
      {symbol.slice(0, 4)}
    </span>
  );
}
