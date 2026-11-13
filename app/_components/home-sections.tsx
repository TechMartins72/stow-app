import Link from "next/link";
import { ArrowRightIcon, LockIcon, PadlockMotif, PieIcon, PlusIcon, SparkIcon } from "./icons";
import { LoadingNote } from "./spinner";

/** Add funds, New plan, Invest, Withdraw. */
export function QuickActions() {
  const actions = [
    { label: "Add funds", icon: PlusIcon, primary: false, href: "/add-funds" },
    { label: "New plan", icon: LockIcon, primary: true, href: "/vault/new" },
    { label: "Invest", icon: PieIcon, primary: false, href: "/invest" },
    { label: "Withdraw", icon: ArrowRightIcon, primary: false, href: "/withdraw" },
  ];
  const base =
    "flex flex-col items-center gap-1.5 rounded-[20px] px-1 py-3.5 text-[calc(13px*var(--fs))] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:flex-row sm:justify-center sm:gap-2 sm:px-2 sm:text-sm";
  return (
    <section aria-label="Quick actions" className="grid grid-cols-4 gap-2 sm:gap-3">
      {actions.map(({ label, icon: Icon, primary, href }) => (
        <Link
          key={label}
          href={href}
          className={`${base} ${primary ? "bg-primary text-white hover:bg-primary-hover" : "border border-border bg-surface-raised text-text hover:border-text-muted/40"}`}
        >
          <Icon className="size-5" />
          {label}
        </Link>
      ))}
    </section>
  );
}

export function SectionHeading({ id, title, action }: { id?: string; title: string; action?: { label: string; href: string } }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 id={id} className="display text-xl">
        {title}
      </h2>
      {action ? (
        <Link href={action.href} className="-my-2 flex items-center gap-1 py-2 pl-2 text-sm font-semibold text-text-muted hover:text-text">
          {action.label} <ArrowRightIcon className="size-4" />
        </Link>
      ) : null}
    </div>
  );
}

/** Shown in the lock strip when the user has no locks yet. */
export function NoLocksCard() {
  return (
    <div className="relative overflow-hidden rounded-[20px] border border-dashed border-locked/40 bg-surface-raised p-6">
      <PadlockMotif className="pointer-events-none absolute -top-8 -right-8 size-40 text-locked/10" />
      <h3 className="relative text-base font-bold">Start a savings goal or a budget</h3>
      <ul className="relative mt-2 max-w-md space-y-1.5 text-sm text-text-muted">
        <li>
          <span className="font-semibold text-text">Savings goal:</span> put $500 away until your rent is due. It stays put until
          that date.
        </li>
        <li>
          <span className="font-semibold text-text">Budget:</span> lock $2,000 and get $500 back each month, like a salary to
          yourself.
        </li>
      </ul>
      <p className="relative mt-2 max-w-md text-sm text-text-muted">Until each date, the app refuses to move it, even if you ask.</p>
      <Link
        href="/vault/new"
        className="relative mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-[22px] py-[13px] text-sm font-semibold text-white hover:bg-primary-hover"
      >
        <LockIcon className="size-4" /> Start one
      </Link>
    </div>
  );
}

/** Points to the Advisor (shown only while it's switched on). */
export function AdvisorCard() {
  return (
    <section aria-labelledby="advisor-title" className="rounded-[20px] border border-border bg-surface-raised p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-hero/15 text-hero">
          <SparkIcon className="size-5" />
        </span>
        <div className="min-w-[12rem] flex-1">
          <h2 id="advisor-title" className="text-base font-bold">
            Advisor
          </h2>
          <p className="text-sm text-text-muted">Ideas to save more and stay on budget. Nothing happens until you approve.</p>
        </div>
        <Link href="/advisor" className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover">
          See suggestions
        </Link>
      </div>
      <ul className="mt-4 space-y-2 text-sm text-text-muted">
        <li className="flex gap-2">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-locked" aria-hidden />
          Follows the same rules you do. It can never touch your savings goals or budgets.
        </li>
        <li className="flex gap-2">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-locked" aria-hidden />
          No leverage, ever. You can switch it off any time.
        </li>
      </ul>
    </section>
  );
}

/** New user: no funds yet. Leads with the two ideas and the first step. */
export function FirstDepositCard({ practice }: { practice: boolean }) {
  return (
    <section className="relative overflow-hidden rounded-[24px] bg-hero p-6 sm:p-10">
      <PadlockMotif className="pointer-events-none absolute -right-10 -bottom-14 size-72 text-white/15" />
      <p className="relative text-sm font-bold text-frame">Your balance: $0.00</p>
      <h2 className="display relative mt-2 max-w-md text-[calc(34px*var(--fs))] leading-tight text-white sm:text-[44px]">
        Save it. Budget it.
      </h2>
      <p className="relative mt-3 max-w-md text-[calc(15px*var(--fs))] font-medium text-frame">
        Put money away for a goal, or pay it back to yourself a little each month like a salary. Add funds to start.
        {practice ? " You're in practice mode, so nothing here is real money." : ""}
      </p>
      <div className="relative mt-6 flex flex-wrap gap-3">
        <Link
          href="/add-funds"
          className="inline-flex items-center gap-2 rounded-xl bg-frame px-[22px] py-[15px] font-semibold text-white hover:bg-frame-raised"
        >
          <PlusIcon className="size-5" /> Add funds
        </Link>
        <Link href="/learn" className="inline-flex items-center gap-2 rounded-xl bg-white px-[22px] py-[15px] font-semibold text-frame hover:bg-white/90">
          How it works
        </Link>
      </div>
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
    <div aria-busy aria-label="Loading your savings" className="space-y-6">
      <LoadingNote label="Loading your savings" />
      <div className="h-[260px] animate-pulse rounded-[24px] bg-hero/40" />
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        <div className={`${block} h-16`} />
        <div className={`${block} h-16`} />
        <div className={`${block} h-16`} />
        <div className={`${block} h-16`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <div className={`${block} h-56`} />
          <div className={`${block} h-64`} />
        </div>
        <div className="space-y-6">
          <div className={`${block} h-48`} />
          <div className={`${block} h-48`} />
        </div>
      </div>
    </div>
  );
}
