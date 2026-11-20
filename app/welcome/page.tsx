import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRightIcon,
  CalendarIcon,
  ChatIcon,
  LockIcon,
  PadlockMotif,
  SparkIcon,
} from "@/app/_components/icons";
import { BudgetScene } from "./_components/budget-scene";
import { GuardScene } from "./_components/guard-scene";
import { HeroScene } from "./_components/hero-scene";
import { ActivityScene, AssetStrip, Reveal } from "./_components/reveals";
import { Roadmap } from "./_components/roadmap";
import { SavingsScene } from "./_components/savings-scene";

export const metadata: Metadata = {
  title: "Stow · Save it. Budget it.",
  description:
    "Put money away for a goal, or pay it back to yourself each month like a salary. Until each date, Stow refuses to move it, even if you ask. Dollars, crypto and tokenized stocks.",
};

const APP = "/signin";

const NAV = [
  { href: "#savings", label: "Savings goals" },
  { href: "#budgets", label: "Budgets" },
  { href: "#safety", label: "How it says no" },
  { href: "#ask", label: "Ask Stow" },
  { href: "#roadmap", label: "Roadmap" },
  { href: "#faq", label: "Questions" },
];

const FAQ = [
  {
    q: "Is this real money?",
    a: "Yes. Stow runs on True Markets, and you hold real US dollars (USDC), crypto and tokenized stocks. Start small: a few dollars is enough to try a goal and a budget.",
  },
  {
    q: "Where is my money kept?",
    a: "In your own wallets on Solana and Base, made for you when you sign up. Every payment out needs Stow's signature, and Stow won't sign one that touches a plan before its date.",
  },
  {
    q: "Can I take money out of a goal early?",
    a: "No, and that's the point. Choose dates you can live with. Money that isn't in a plan stays free to spend, send or invest whenever you like.",
  },
  {
    q: "How does a budget pay me?",
    a: "You put an amount in once and choose how often to be paid, for example 25% a month. On each date that part frees itself and becomes spendable. You don't have to do anything.",
  },
  {
    q: "What does the Advisor do?",
    a: "It suggests ways to save more and stay on budget. Nothing happens until you approve, it follows the same rules you do, it never uses leverage, and you can switch it off.",
  },
  {
    q: "What is Ask Stow?",
    a: "A chat that answers questions about your money in Stow, using your own balances, goals and budgets plus live market data from True Markets. It's powered by Claude, an AI model from Anthropic. It explains but never acts: it can't move money or trade, it isn't financial advice, and it can make mistakes, so check anything important.",
  },
];

export default function WelcomePage() {
  return (
    <div className="overflow-x-clip bg-surface text-base text-text max-sm:[--fs:0.81]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-frame/85 text-frame-text backdrop-blur-md">
        <nav
          aria-label="Main"
          className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6"
        >
          <Link
            href="/welcome"
            className="flex items-center gap-2.5"
            aria-label="Stow, home"
          >
            <Image
              src="/brand/stow-icon-animated.svg"
              alt=""
              width={34}
              height={34}
              unoptimized
              priority
            />
            <span className="wordmark text-[calc(16px*var(--fs))]">Stow</span>
          </Link>
          <ul className="ml-auto hidden items-center gap-6 text-sm font-semibold whitespace-nowrap text-frame-muted lg:flex">
            {NAV.map((n) => (
              <li key={n.href}>
                <a
                  href={n.href}
                  className="hover:text-frame-text transition-all duration-200"
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
          <Link
            href={APP}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover lg:ml-0 transition-all duration-200"
          >
            Open Stow
          </Link>
        </nav>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden bg-frame text-frame-text">
          <PadlockMotif className="pointer-events-none absolute -top-24 -left-24 size-[28rem] text-white/[0.04]" />
          <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-6 pt-14 pb-20 lg:grid-cols-[1.05fr_1fr] lg:pt-20 lg:pb-28">
            <Reveal>
              <p
                data-reveal
                className="inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-1.5 text-xs font-semibold text-frame-muted"
              >
                <span className="size-1.5 rounded-full bg-hero" /> Savings and
                budgeting, on True Markets
              </p>
              <h1
                data-reveal="0.1"
                className="display mt-6 text-[calc(46px*var(--fs))] leading-[1.02] sm:text-6xl lg:text-7xl"
              >
                Save it.
                <br />
                <span className="text-hero">Budget it.</span>
              </h1>
              <p
                data-reveal="0.2"
                className="mt-6 max-w-lg text-lg text-frame-muted"
              >
                Put money away for a goal, or pay it back to yourself a little
                each month, like a salary. Until each date, Stow refuses to move
                it.{" "}
                <span className="font-semibold text-frame-text">
                  Even if you ask.
                </span>
              </p>
              <div data-reveal="0.3" className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={APP}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-semibold text-white hover:bg-primary-hover"
                >
                  Open Stow <ArrowRightIcon className="size-4" />
                </Link>
                <a
                  href="#how"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-6 py-3.5 font-semibold hover:bg-white/5"
                >
                  See how it works
                </a>
              </div>
              {/* <p data-reveal="0.35" className="mt-4 flex items-center gap-2 text-sm text-frame-muted">
                <PhoneIcon className="size-4 text-hero" /> iPhone and Android apps coming soon. <br /> Stow works in your phone&apos;s browser today.
              </p> */}
              <ul
                data-reveal="0.4"
                className="mt-10 grid max-w-lg gap-3 text-sm text-frame-muted sm:grid-cols-3"
              >
                <li>
                  <span className="block font-bold text-frame-text">
                    Dollars, crypto, stocks
                  </span>
                  USDC, SOL, ETH, Bitcoin and US stocks
                </li>
                <li>
                  <span className="block font-bold text-frame-text">
                    Your own wallets
                  </span>
                  On Solana and Base
                </li>
                <li>
                  <span className="block font-bold text-frame-text">
                    Plans that hold
                  </span>
                  Locked money is never signed away
                </li>
              </ul>
            </Reveal>
            <HeroScene />
          </div>
        </section>

        {/* Two ways */}
        <section id="how" className="scroll-mt-16 px-6 py-20 lg:py-28">
          <Reveal className="mx-auto max-w-6xl">
            <SectionIntro
              eyebrow="Two ways to stow"
              title={
                <>
                  A goal to save for.
                  <br /> A budget that pays you.
                </>
              }
            />
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              <WayCard
                href="#savings"
                tone="locked"
                icon={<LockIcon className="size-5" />}
                kind="Savings goal"
                title="Money that waits for its date"
                body="Put $500 away until rent is due, or a holiday fund until summer. It stays put until the day you chose."
                example="$500 until 15 Dec"
              />
              <WayCard
                href="#budgets"
                tone="hero"
                icon={<CalendarIcon className="size-5" />}
                kind="Budget"
                title="Pay yourself like a salary"
                body="Lock $2,000 and get $500 back on the first of each month. Overspend this month and next month's money is still safe."
                example="$500 a month, 4 months"
                delay="0.1"
              />
            </div>
          </Reveal>
        </section>

        {/* Savings goals */}
        <section
          id="savings"
          className="scroll-mt-16 bg-surface-raised px-6 py-20 lg:py-28"
        >
          <div className="mx-auto max-w-6xl">
            <SavingsScene
              intro={
                <Reveal>
                  <SectionIntro
                    eyebrow="Savings goals"
                    eyebrowClass="text-locked dark:text-hero"
                    title="Put it away. It stays put."
                    body="Three steps, and the hard part (not spending it) is done for you."
                  />
                </Reveal>
              }
            />
          </div>
        </section>

        {/* Budgets */}
        <section id="budgets" className="scroll-mt-16 px-6 py-20 lg:py-28">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <SectionIntro
                eyebrow="Budgets"
                eyebrowClass="text-hero"
                title="Your money, paid back in parts."
                body="A budget is a plan for money you already have. Stow hands it to you a portion at a time, on the dates you choose."
              />
            </Reveal>
            <div className="mt-12">
              <BudgetScene />
            </div>
          </div>
        </section>

        {/* Safety */}
        <section
          id="safety"
          className="scroll-mt-16 bg-surface-raised px-6 py-20 lg:py-28"
        >
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <SectionIntro
                eyebrow="How it says no"
                title="A plan you can't talk yourself out of."
                body="Every payment, sale or trade needs Stow's signature. Before it signs, it checks your plans. If the money isn't free yet, it simply never signs."
              />
            </Reveal>
            <div className="mt-12">
              <GuardScene />
            </div>
            <Reveal className="mt-10 grid gap-4 sm:grid-cols-3">
              <Fact
                icon={<LockIcon className="size-5" />}
                title="Locks hold, even for you"
                body="There's no override button. Each part frees itself on its date."
              />
              <Fact
                icon={<ArrowRightIcon className="size-5" />}
                title="Fair prices"
                body="Every trade is priced again just before it goes through. If the price moved more than 1%, it stops."
                delay="0.1"
              />
              <Fact
                icon={<SparkIcon className="size-5" />}
                title="An Advisor on your side"
                body="Optional ideas to save more. It follows your rules, never uses leverage, and can be switched off."
                delay="0.2"
              />
            </Reveal>
          </div>
        </section>

        {/* Ask Stow */}
        <section id="ask" className="scroll-mt-16 px-6 py-20 lg:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
              <Reveal>
                <SectionIntro
                  eyebrow="Ask Stow"
                  eyebrowClass="text-hero"
                  title="Questions about your money, answered."
                  body="Ask in plain words. Ask Stow reads your own balances, goals and budgets, checks live market data from True Markets, and explains what's going on."
                />
              </Reveal>
              <AskExample />
            </div>
            <Reveal className="mt-10 grid gap-4 sm:grid-cols-3">
              <Fact
                icon={<CalendarIcon className="size-5" />}
                title="Knows your plans"
                body="What's free to spend, what's locked, and when each part unlocks."
              />
              <Fact
                icon={<SparkIcon className="size-5" />}
                title="Live market data"
                body="Prices and daily news summaries from True Markets."
                delay="0.1"
              />
              <Fact
                icon={<LockIcon className="size-5" />}
                title="Explains, never acts"
                body="It can't move money or trade, and it isn't financial advice."
                delay="0.2"
              />
            </Reveal>
          </div>
        </section>

        {/* What you can stow + Activity */}
        <section className="px-6 py-20 lg:py-28">
          <Reveal className="mx-auto max-w-6xl">
            <SectionIntro
              eyebrow="Dollars, crypto and stocks"
              title="Stow whatever you hold."
              body="Save in dollars, or buy and lock crypto and tokenized US stocks for a date, all in one place."
            />
          </Reveal>
          <div className="mx-auto mt-10 max-w-6xl">
            <AssetStrip />
          </div>
          <div className="mx-auto mt-20 grid max-w-6xl grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <Reveal>
              <SectionIntro
                eyebrow="Activity"
                title="Every move, in one place."
                body="Money in, trades, locks, pay-outs, and anything Stow refused, with the reason. Deposits link to the public blockchain record."
              />
            </Reveal>
            <ActivityScene />
          </div>
        </section>

        {/* Roadmap */}
        <section
          id="roadmap"
          className="scroll-mt-16 border-t border-border px-6 py-20 lg:py-28"
        >
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <SectionIntro
                eyebrow="Where Stow is going"
                title="Built to keep your promises. Here's what's next."
                body="What works today, what we're building now, and where we're heading. No dates: we'd rather ship it than promise it."
              />
            </Reveal>
            <div className="mt-12">
              <Roadmap />
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section
          id="faq"
          className="scroll-mt-16 bg-surface-raised px-6 py-20 lg:py-28"
        >
          <div className="mx-auto max-w-3xl">
            <Reveal>
              <SectionIntro eyebrow="Questions" title="Good to know." />
            </Reveal>
            <Reveal className="mt-8 divide-y divide-border rounded-[20px] border border-border bg-surface">
              {FAQ.map((f) => (
                <details key={f.q} data-reveal className="group px-5 py-1">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-bold [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span
                      className="grid size-7 shrink-0 place-items-center rounded-full border border-border text-text-muted transition group-open:rotate-45"
                      aria-hidden
                    >
                      +
                    </span>
                  </summary>
                  <p className="pb-5 text-text-muted">{f.a}</p>
                </details>
              ))}
            </Reveal>
          </div>
        </section>

        {/* Closing call to action */}
        <section className="relative overflow-hidden bg-frame px-6 py-20 text-frame-text lg:py-28">
          <PadlockMotif className="pointer-events-none absolute -right-20 -bottom-24 size-[26rem] text-white/[0.05]" />
          <Reveal className="relative mx-auto max-w-3xl text-center">
            <Image
              data-reveal
              src="/brand/stow-mark-animated.svg"
              alt=""
              width={120}
              height={120}
              unoptimized
              className="mx-auto size-28"
            />
            <h2 data-reveal="0.1" className="display mt-6 text-4xl sm:text-5xl">
              Put your first dollars away.
            </h2>
            <p
              data-reveal="0.2"
              className="mx-auto mt-4 max-w-xl text-lg text-frame-muted"
            >
              Sign in with your email, add a few dollars, and start a savings
              goal or a budget in under a minute.
            </p>
            <Link
              data-reveal="0.3"
              href={APP}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-4 font-semibold text-white hover:bg-primary-hover"
            >
              Open Stow <ArrowRightIcon className="size-4" />
            </Link>
            <div data-reveal="0.4" className="mt-12">
              <p className="text-sm font-semibold text-frame-muted">
                The mobile app is on its way
              </p>
              <ul className="mt-3 flex flex-wrap justify-center gap-3">
                <StoreBadge platform="iPhone" />
                <StoreBadge platform="Android" />
              </ul>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-frame px-6 py-10 text-sm text-frame-muted">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2.5">
              <Image
                src="/brand/stow-icon.svg"
                alt=""
                width={28}
                height={28}
                unoptimized
              />
              <span className="wordmark text-frame-text">Stow</span>
            </div>
            <p>
              Built on the True Markets Gateway. An educational project, not
              financial advice.
            </p>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-frame-text">
              Privacy
            </Link>
            <Link
              href={APP}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-frame-text hover:underline"
            >
              Open the app →
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionIntro({
  eyebrow,
  title,
  body,
  eyebrowClass = "text-primary dark:text-hero",
}: {
  eyebrow: string;
  title: React.ReactNode;
  body?: string;
  eyebrowClass?: string;
}) {
  return (
    <div className="max-w-2xl">
      <p
        data-reveal
        className={`text-xs font-bold tracking-[0.14em] uppercase ${eyebrowClass}`}
      >
        {eyebrow}
      </p>
      <h2
        data-reveal="0.05"
        className="display mt-3 text-3xl sm:text-4xl lg:text-5xl"
      >
        {title}
      </h2>
      {body ? (
        <p data-reveal="0.1" className="mt-4 text-lg text-text-muted">
          {body}
        </p>
      ) : null}
    </div>
  );
}

function WayCard(props: {
  href: string;
  tone: "locked" | "hero";
  icon: React.ReactNode;
  kind: string;
  title: string;
  body: string;
  example: string;
  delay?: string;
}) {
  const locked = props.tone === "locked";
  return (
    <a
      data-reveal={props.delay ?? "0"}
      href={props.href}
      className={`group relative block overflow-hidden rounded-[24px] p-7 transition hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        locked ? "bg-locked text-white" : "bg-hero text-white"
      }`}
    >
      <PadlockMotif className="pointer-events-none absolute -right-10 -bottom-12 size-48 text-white/10 transition group-hover:rotate-6" />
      <span className="relative grid size-11 place-items-center rounded-full bg-white/15">
        {props.icon}
      </span>
      <p className="relative mt-6 text-xs font-bold tracking-[0.14em] text-white/75 uppercase">
        {props.kind}
      </p>
      <h3 className="display relative mt-1 text-2xl">{props.title}</h3>
      <p className="relative mt-2 max-w-sm text-white/85">{props.body}</p>
      <span className="num relative mt-6 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold">
        {props.example}{" "}
        <ArrowRightIcon className="size-4 transition group-hover:translate-x-0.5" />
      </span>
    </a>
  );
}

/** An illustrative Ask Stow conversation (labelled as an example; not live data). */
function AskExample() {
  const bubble =
    "max-w-[88%] rounded-[20px] px-4 py-3 text-[15px] leading-relaxed";
  return (
    <Reveal>
      <figure
        data-reveal="0.1"
        className="rounded-[24px] border border-border bg-surface-raised p-5 shadow-[0_24px_60px_-30px_rgba(6,15,33,0.35)] sm:p-6"
      >
        <figcaption className="flex items-center gap-2 text-xs font-semibold text-text-muted">
          <ChatIcon className="size-4 text-hero" /> Example conversation
        </figcaption>
        <ol className="mt-4 flex flex-col gap-3">
          <li className="flex justify-end">
            <p className={`${bubble} rounded-br-md bg-primary text-white`}>
              When does my next money unlock?
            </p>
          </li>
          <li className="flex">
            <p
              className={`${bubble} rounded-bl-md border border-border bg-surface`}
            >
              Your Rent budget pays you next: $300 on December 1. Two more parts
              of $300 follow, the last on February 1.
            </p>
          </li>
          <li className="flex justify-end">
            <p className={`${bubble} rounded-br-md bg-primary text-white`}>
              Why is Solana up today?
            </p>
          </li>
          <li className="flex">
            <span className="rounded-full bg-hero/10 px-3 py-1 text-xs font-semibold">
              Checked True Markets market data
            </span>
          </li>
          <li className="flex">
            <p
              className={`${bubble} rounded-bl-md border border-border bg-surface`}
            >
              SOL is up about 4% today, and True Markets&apos; news summary
              points to busier trading across crypto. You hold 6.5 SOL; 4 of it
              is locked in a goal until March.
            </p>
          </li>
        </ol>
      </figure>
    </Reveal>
  );
}

function Fact({
  icon,
  title,
  body,
  delay = "0",
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  delay?: string;
}) {
  return (
    <div
      data-reveal={delay}
      className="rounded-[20px] border border-border bg-surface p-5"
    >
      <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary dark:text-hero">
        {icon}
      </span>
      <p className="mt-4 font-bold">{title}</p>
      <p className="mt-1 text-sm text-text-muted">{body}</p>
    </div>
  );
}

/** Not a link yet: the apps aren't out. Says so on the badge itself. */
function StoreBadge({ platform }: { platform: "iPhone" | "Android" }) {
  return (
    <li
      aria-label={`Stow for ${platform}: coming soon`}
      className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 py-2.5 pr-4 pl-3 text-left"
    >
      <PhoneIcon className="size-6 text-hero" />
      <span>
        <span className="block text-[calc(11px*var(--fs))] font-semibold text-frame-muted">
          Coming soon
        </span>
        <span className="block font-bold text-frame-text">
          Stow for {platform}
        </span>
      </span>
    </li>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="6" y="2.5" width="12" height="19" rx="3" />
      <path d="M10.5 18.5h3" />
    </svg>
  );
}
