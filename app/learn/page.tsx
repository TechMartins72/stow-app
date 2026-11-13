import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/app/_components/app-shell";
import { CalendarIcon, LockIcon, PadlockMotif, PieIcon, PlusIcon, SparkIcon } from "@/app/_components/icons";

export const metadata: Metadata = {
  title: "How it works · Stow",
  description: "Savings goals, budgets that pay you back, and why the app refuses to break your promise.",
};

// Static explainer. Not behind sign-in (see proxy.ts), so it can be linked from anywhere.

const card = "rounded-[20px] border border-border bg-surface-raised";

const STEPS = [
  { title: "Add money", body: "Send USDC, SOL, ETH or Bitcoin to your own wallet, or buy stocks inside the app." },
  { title: "Choose a plan", body: "A savings goal (all on one date) or a budget (a set amount paid back to you on a schedule)." },
  { title: "We say no", body: "Until each date, the app refuses to sign anything that would move that money. Even if you ask." },
  { title: "It frees itself", body: "On each date the money becomes free to spend automatically. No button, no waiting." },
];

const FAQ = [
  {
    q: "Can I break a savings goal or budget early?",
    a: "No. That's the point: it protects you from impulse spending. Keep some money free for emergencies, and use a budget if you want regular access.",
  },
  {
    q: "Does locking move my money somewhere else?",
    a: "No. It stays in your own wallet, in your name. The app simply refuses to sign any payment, sale or trade that would take it out before its date.",
  },
  {
    q: "Why do budgets only work with dollars (USDC)?",
    a: "A budget promises a fixed amount each time, like $500 a month. With crypto or stocks the price moves, so 25% of it could be worth much less next month. Savings goals work with everything.",
  },
  {
    q: "What happens to stocks or crypto I save?",
    a: "You keep them and their price keeps moving, up or down. The lock holds the number of shares or coins, not a dollar amount, and they can't be sold until the date.",
  },
  {
    q: "Who holds my money?",
    a: "True Markets creates wallets for you and keeps them. They act only on a payment our app has signed, and our app checks your savings goals and budgets before it signs anything.",
  },
  {
    q: "What is practice mode?",
    a: "Pretend money for trying the app. Everything works the same, nothing is real. Practice mode shows a badge on your balance.",
  },
  {
    q: "Is the Advisor financial advice?",
    a: "No. It's a set of simple, explained rules that suggest ways to save more and keep your budget on track. Nothing happens unless you approve, and you can switch it off.",
  },
];

export default function LearnPage() {
  return (
    <AppShell active="/learn">
      <article className="mx-auto max-w-4xl space-y-10">
        <header className="relative overflow-hidden rounded-[24px] bg-hero p-6 sm:p-10">
          <PadlockMotif className="pointer-events-none absolute -right-10 -bottom-14 size-64 text-white/15" />
          <p className="relative text-sm font-bold text-frame">How Stow works</p>
          <h1 className="display relative mt-2 max-w-lg text-[calc(34px*var(--fs))] leading-tight text-white sm:text-[46px]">Save it. Budget it. Keep your promise.</h1>
          <p className="relative mt-3 max-w-lg text-[calc(15px*var(--fs))] font-medium text-frame">
            Put money away for something that matters, or pay it back to yourself a little at a time. Either way, the app won&apos;t let
            you break your own plan.
          </p>
        </header>

        <section aria-labelledby="two-ways">
          <h2 id="two-ways" className="display mb-4 text-2xl">
            Two ways to use your vault
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className={`${card} p-6`}>
              <span className="grid size-11 place-items-center rounded-full bg-locked/10 text-locked dark:bg-locked/30 dark:text-frame-text" aria-hidden>
                <LockIcon className="size-5" />
              </span>
              <p className="mt-4 text-xs font-bold tracking-wide text-locked uppercase dark:text-frame-muted">Savings goal</p>
              <h3 className="display mt-1 text-xl">Put it away until a date</h3>
              <p className="mt-2 text-sm text-text-muted">
                Choose an amount and a date between 7 days and about 3 years away. All of it frees up on that date.
              </p>
              <p className="mt-4 rounded-2xl bg-surface p-4 text-sm">
                <span className="font-bold">Example:</span> Ada saves $1,200 for next year&apos;s rent. It stays put until 1 April,
                however tempting that sale is.
              </p>
              <p className="mt-3 text-xs text-text-muted">Works with dollars, crypto and stocks.</p>
            </div>
            <div className={`${card} p-6`}>
              <span className="grid size-11 place-items-center rounded-full bg-hero/15 text-hero" aria-hidden>
                <CalendarIcon className="size-5" />
              </span>
              <p className="mt-4 text-xs font-bold tracking-wide text-hero uppercase">Budget</p>
              <h3 className="display mt-1 text-xl">Pay yourself on a schedule</h3>
              <p className="mt-2 text-sm text-text-muted">
                Lock a sum and choose how much comes back, and how often: every week, two weeks or month. Each part frees itself on
                its date.
              </p>
              <p className="mt-4 rounded-2xl bg-surface p-4 text-sm">
                <span className="font-bold">Example:</span> Sandra locks $4,000 and gets 25% ($1,000) back each month. If she tries to
                spend next month&apos;s money early, the app says no.
              </p>
              <p className="mt-3 text-xs text-text-muted">Dollars (USDC) only, so each part is a fixed amount.</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="steps">
          <h2 id="steps" className="display mb-4 text-2xl">
            How the app keeps your promise
          </h2>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className={`${card} p-5`}>
                <span className="num grid size-8 place-items-center rounded-full bg-primary text-sm font-bold text-white" aria-hidden>
                  {i + 1}
                </span>
                <h3 className="mt-3 font-bold">{s.title}</h3>
                <p className="mt-1 text-sm text-text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 rounded-2xl bg-warning-bg p-4 text-sm">
            <span className="font-bold text-warning">Why it works: </span>
            every payment from your wallet needs our app&apos;s signature. Before signing, it checks your savings goals and budgets. If a
            payment would dip into money that isn&apos;t free yet, it&apos;s simply never signed, and you see which plan stopped it.
          </p>
        </section>

        <section aria-labelledby="more" className="grid gap-4 md:grid-cols-3">
          <h2 id="more" className="sr-only">
            More you can do
          </h2>
          <div className={`${card} p-5`}>
            <PlusIcon className="size-6 text-hero" />
            <h3 className="mt-3 font-bold">Add and withdraw</h3>
            <p className="mt-1 text-sm text-text-muted">
              Each person gets a Solana and a Base wallet. Withdraw free money any time; saved and budgeted money waits for its date.
            </p>
          </div>
          <div className={`${card} p-5`}>
            <PieIcon className="size-6 text-hero" />
            <h3 className="mt-3 font-bold">Invest, then save it</h3>
            <p className="mt-1 text-sm text-text-muted">
              Buy tokenized stocks like Apple or NVIDIA, or SOL, ETH and Bitcoin, and lock them straight away with &ldquo;buy and
              lock&rdquo;.
            </p>
          </div>
          <div className={`${card} p-5`}>
            <SparkIcon className="size-6 text-hero" />
            <h3 className="mt-3 font-bold">An optional Advisor</h3>
            <p className="mt-1 text-sm text-text-muted">
              Suggests ways to save more and stay on budget, with reasons. It follows your rules, acts only when you approve, and can
              be switched off.
            </p>
          </div>
        </section>

        <section aria-labelledby="faq">
          <h2 id="faq" className="display mb-4 text-2xl">
            Questions
          </h2>
          <div className={`${card} divide-y divide-border overflow-hidden`}>
            {FAQ.map((f) => (
              <details key={f.q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold">
                  {f.q}
                  <span className="text-text-muted transition group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-2 text-sm text-text-muted">{f.a}</p>
              </details>
            ))}
          </div>
          <p className="mt-3 text-xs text-text-muted">Educational information, not financial advice.</p>
        </section>

        <section className="flex flex-col items-start gap-4 rounded-[24px] bg-frame p-6 text-frame-text sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <h2 className="display text-2xl">Ready to make a plan?</h2>
            <p className="mt-1 text-sm text-frame-muted">Start with a savings goal or a budget. It takes about a minute.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/vault/new" className="rounded-xl bg-hero px-[22px] py-[15px] font-semibold text-white hover:opacity-90">
              Start a plan
            </Link>
            <Link href="/add-funds" className="rounded-xl border border-white/25 px-[22px] py-[15px] font-semibold hover:bg-frame-raised">
              Add funds
            </Link>
          </div>
        </section>
      </article>
    </AppShell>
  );
}
