import Link from "next/link";
import { ArrowRightIcon, LockIcon, PadlockMotif, PlusIcon, ScaleIcon, SparkIcon } from "./icons";

/** Add funds, New lock, Rebalance. Actions without a flow yet stay disabled. */
export function QuickActions() {
  const actions = [
    { label: "Add funds", icon: PlusIcon, primary: false, href: null },
    { label: "New lock", icon: LockIcon, primary: true, href: "/vault/new" },
    { label: "Rebalance", icon: ScaleIcon, primary: false, href: null },
  ];
  const base =
    "flex flex-col items-center gap-2 rounded-[20px] px-2 py-4 text-sm font-semibold transition sm:flex-row sm:justify-center sm:py-3.5";
  return (
    <section aria-label="Quick actions" className="grid grid-cols-3 gap-3">
      {actions.map(({ label, icon: Icon, primary, href }) => {
        const look = primary
          ? "bg-primary text-white hover:bg-primary-hover"
          : "border border-border bg-surface-raised text-text";
        return href ? (
          <Link key={label} href={href} className={`${base} ${look} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}>
            <Icon className="size-5" />
            {label}
          </Link>
        ) : (
          <button key={label} type="button" disabled title="Coming soon" className={`${base} ${look} cursor-not-allowed opacity-60`}>
            <Icon className="size-5" />
            {label}
          </button>
        );
      })}
    </section>
  );
}

/** Shown once after a lock is created. */
export function LockedBanner({ goalName, detail }: { goalName: string; detail: string }) {
  return (
    <div role="status" className="flex items-center gap-3 rounded-[20px] bg-frame p-4 text-frame-text">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-hero text-white">
        <LockIcon className="size-5" />
      </span>
      <p className="text-sm">
        <span className="font-bold">“{goalName}” is locked.</span>{" "}
        <span className="text-frame-muted">{detail}</span>
      </p>
    </div>
  );
}

export function SectionHeading({ id, title, action }: { id?: string; title: string; action?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 id={id} className="display text-xl">
        {title}
      </h2>
      {action ? (
        <span className="flex items-center gap-1 text-sm font-semibold text-text-muted" title="Coming soon">
          {action} <ArrowRightIcon className="size-4" />
        </span>
      ) : null}
    </div>
  );
}

/** Shown in the lock strip when the user has no locks yet. */
export function NoLocksCard() {
  return (
    <div className="relative overflow-hidden rounded-[20px] border border-dashed border-locked/40 bg-surface-raised p-6">
      <PadlockMotif className="pointer-events-none absolute -top-8 -right-8 size-40 text-locked/10" />
      <h3 className="relative text-base font-bold">Lock some savings away</h3>
      <p className="relative mt-1 max-w-md text-sm text-text-muted">
        Pick an amount and a date. Until then, the app refuses to move it, even if you ask. For example: lock $500 until
        your rent is due.
      </p>
      <Link
        href="/vault/new"
        className="relative mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-[22px] py-[13px] text-sm font-semibold text-white hover:bg-primary-hover"
      >
        <LockIcon className="size-4" /> Create a lock
      </Link>
    </div>
  );
}

/** Advisor isn't built yet, so the feed explains what it will do. */
export function AdvisorCard() {
  return (
    <section aria-labelledby="advisor-title" className="rounded-[20px] border border-border bg-surface-raised p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-hero/15 text-hero">
          <SparkIcon className="size-5" />
        </span>
        <div>
          <h2 id="advisor-title" className="text-base font-bold">
            Advisor is off
          </h2>
          <p className="text-sm text-text-muted">It will suggest small, rule-checked moves with a one-line reason.</p>
        </div>
      </div>
      <ul className="mt-4 space-y-2 text-sm text-text-muted">
        <li className="flex gap-2">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-locked" aria-hidden />
          Follows the same locks and limits you do. It can never touch locked funds.
        </li>
        <li className="flex gap-2">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-locked" aria-hidden />
          No leverage, ever.
        </li>
      </ul>
    </section>
  );
}

/** New user: no funds yet, so this is the only content. */
export function FirstDepositCard({ practice }: { practice: boolean }) {
  return (
    <section className="relative overflow-hidden rounded-[24px] bg-hero p-6 sm:p-10">
      <PadlockMotif className="pointer-events-none absolute -right-10 -bottom-14 size-72 text-white/15" />
      <h2 className="display relative max-w-md text-[34px] leading-tight text-white sm:text-[44px]">
        Your money, locked.
      </h2>
      <p className="relative mt-3 max-w-md text-[15px] font-medium text-frame">
        Add funds, choose a date, and we&apos;ll keep them safe from impulse spending until then.
        {practice ? " You're in practice mode, so nothing here is real money." : ""}
      </p>
      <button
        type="button"
        disabled
        title="Coming soon"
        className="relative mt-6 inline-flex items-center gap-2 rounded-xl bg-frame px-[22px] py-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-90"
      >
        <PlusIcon className="size-5" /> Add funds
      </button>
    </section>
  );
}

export function GatewayErrorCard({
  reason,
  mode,
  requestId,
}: {
  reason: "gateway_unreachable" | "gateway_error";
  mode: "mock" | "live";
  requestId?: string;
}) {
  const unreachable = reason === "gateway_unreachable";
  return (
    <section role="alert" className="rounded-[20px] border border-critical/30 bg-critical-bg p-6">
      <h2 className="text-lg font-bold text-critical">
        {unreachable ? "We can't reach your wallet right now" : "Something went wrong loading your savings"}
      </h2>
      <p className="mt-1 text-sm text-text">
        Your funds are safe; nothing moves without the app signing. Try again in a moment.
      </p>
      {unreachable && mode === "mock" ? (
        <p className="mt-3 text-sm text-text-muted">
          Developer note: start the mock Gateway with <code className="rounded bg-surface-raised px-1.5 py-0.5">npm run mock</code>.
        </p>
      ) : null}
      {requestId ? (
        <details className="mt-3 text-sm text-text-muted">
          <summary className="cursor-pointer font-semibold">Details</summary>
          <p className="mt-1">
            Request ID: <code className="num">{requestId}</code>
          </p>
        </details>
      ) : null}
    </section>
  );
}

export function HomeSkeleton() {
  const block = "animate-pulse rounded-[20px] bg-border/60";
  return (
    <div aria-busy aria-label="Loading your savings" className="space-y-8">
      <div className="h-[260px] animate-pulse rounded-[24px] bg-hero/40" />
      <div className="grid grid-cols-3 gap-3">
        <div className={`${block} h-16`} />
        <div className={`${block} h-16`} />
        <div className={`${block} h-16`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={`${block} h-48`} />
        <div className={`${block} h-48`} />
      </div>
    </div>
  );
}
