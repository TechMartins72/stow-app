import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy · Stow",
  description:
    "What Stow stores about you, why, who else is involved, and how to have it deleted.",
};

// Public (not behind sign-in; see proxy.ts). Linked from Google's sign-in screen, the
// landing page and the sign-in page. Keep it in step with db/schema.ts and the cookies
// the app sets: it must describe what the code actually does.

const UPDATED = "19 November 2026";

export default function PrivacyPage() {
  const contact = process.env.CONTACT_EMAIL?.trim();
  return (
    <div className="min-h-dvh bg-surface text-text">
      <header className="bg-frame text-frame-text">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link
            href="/welcome"
            className="flex items-center gap-2.5"
            aria-label="Stow, home"
          >
            <Image
              src="/brand/stow-icon.svg"
              alt=""
              width={30}
              height={30}
              unoptimized
            />
            <span className="wordmark text-[calc(16px*var(--fs))]">Stow</span>
          </Link>
          <Link
            href="/signin"
            className="text-sm font-semibold text-frame-muted hover:text-frame-text"
          >
            Open Stow
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-14 sm:py-20">
        <p className="text-xs font-bold tracking-[0.14em] text-primary uppercase dark:text-hero">
          Privacy
        </p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">
          What we keep, and why.
        </h1>
        <p className="mt-4 text-lg text-text-muted">
          Stow is a savings and budgeting app built on True Markets. We keep as
          little about you as we can to make it work. We don&apos;t sell your
          data, show ads, or use tracking or analytics tools.
        </p>
        <p className="mt-2 text-sm text-text-muted">Last updated {UPDATED}.</p>

        <div className="mt-12 space-y-10">
          <Section title="What we store">
            <ul className="space-y-3">
              <Item title="Your email address">
                To sign you in and to recognise your account. If you continue
                with Google, we ask Google for your email address only: not your
                name, photo, contacts or anything else.
              </Item>
              <Item title="Your plans">
                Your savings goals and budgets: their names, amounts, assets and
                dates. This is what lets the app refuse to move that money
                early.
              </Item>
              <Item title="A record of what you asked for">
                Each buy, sell or send you (or the Advisor) asked for, its size,
                and whether it went through or was refused, with the reason. It
                powers your Activity page.
              </Item>
              <Item title="Your settings">
                Your risk profile for the Advisor, and whether the Advisor is
                on.
              </Item>
              <Item title="Sign-in records">
                Which browsers are signed in, and one-time sign-in links. We
                store only a scrambled fingerprint (a hash) of each, never the
                link or session itself.
              </Item>
            </ul>
          </Section>

          <Section title="Google user data" id="google-user-data">
            <ul className="space-y-3">
              <Item title="What we access">
                If you choose &ldquo;Continue with Google&rdquo;, Google tells
                us your email address only, and that Google has verified it: not
                your name, photo, contacts, Gmail, Drive or anything else in
                your Google account.
              </Item>
              <Item title="How we use it">
                Only to sign you in and to recognise your Stow account. Nothing
                else.
              </Item>
              <Item title="How we store it">
                Your email address is stored with your Stow account in our
                database (Supabase, in London). We don&apos;t keep anything else
                Google sends: once your email is confirmed, the rest is
                discarded.
              </Item>
              <Item title="Who we share it with">
                No one. We do not sell, rent or share it, we don&apos;t use it
                for advertising, and we don&apos;t use it to train AI models.
                Our hosting and database providers (Vercel and Supabase) process
                it only to run Stow for you.
              </Item>
              <Item title="Deleting it">
                Delete your account yourself (see &ldquo;Keeping and deleting
                it&rdquo; below) and your email is deleted with it. You can also
                remove Stow&apos;s access to your Google account at any time in
                <a
                  href="https://myaccount.google.com/connections"
                  className="font-semibold text-primary hover:underline dark:text-hero"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  your Google account settings
                </a>
                .
              </Item>
            </ul>
            <p className="mt-4">
              Stow&apos;s use and transfer of information received from Google
              APIs adheres to the
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                className="font-semibold text-primary hover:underline dark:text-hero"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
          </Section>

          <Section title="Your money and wallets">
            Your wallets on Solana and Base are created and held through{" "}
            <a
              href="https://truemarkets.co"
              className="font-semibold text-primary hover:underline dark:text-hero"
              target="_blank"
              rel="noopener noreferrer"
            >
              True Markets
            </a>
            , which keeps your balances and transaction history. We send them a
            random account number for you, not your email. Their own terms and
            privacy policy apply to the money in your wallets. Deposits, trades
            and sends are also recorded on public blockchains, as with any
            crypto wallet.
          </Section>

          <Section title="Who else is involved">
            <ul className="space-y-2">
              <li>
                <span className="font-semibold">True Markets</span>: wallets,
                trading and transfers.
              </li>
              <li>
                <span className="font-semibold">Google</span>: only if you
                choose &ldquo;Continue with Google&rdquo;, to confirm your email
                address.
              </li>
              <li>
                <span className="font-semibold">Resend</span>: sends sign-in
                emails, if you use an email link.
              </li>
              <li>
                <span className="font-semibold">Vercel</span> (hosting) and{" "}
                <span className="font-semibold">Supabase</span> (our database,
                in London): where the app runs and your Stow data is stored.
              </li>
            </ul>
          </Section>

          <Section title="Cookies">
            We use three, all needed for the app to work, none for tracking: one
            that keeps you signed in (up to 30 days), one that lasts ten minutes
            while you sign in with Google, and one that shows a short message
            after an action (30 seconds). The Advisor also remembers, in your
            browser only, which suggestions you dismissed.
          </Section>

          <Section title="Keeping and deleting it" id="deleting">
            We keep your Stow data while you have an account. You can delete
            your account yourself at any time: open the profile menu at the top
            right of the app and choose{" "}
            <span className="font-semibold text-text">Delete account</span>. It
            deletes your account, email, plans, Activity history and every
            sign-in straight away. Money must be withdrawn first, and nothing
            locked can be deleted before its date, so no money is ever stranded.
            If you can&apos;t sign in any more,{" "}
            {contact ? (
              <>
                to have it deleted, email{" "}
                <a
                  href={`mailto:${contact}`}
                  className="font-semibold text-primary hover:underline dark:text-hero"
                >
                  {contact}
                </a>{" "}
                from the address you sign in with.
              </>
            ) : (
              <>
                to have it deleted, contact us from the address you sign in
                with.
              </>
            )}{" "}
            Records that True Markets or a blockchain keep are outside our
            control.
          </Section>

          <Section title="Please note">
            Stow is a project built for True Markets&apos; &ldquo;Build the Next
            Fintech App&rdquo; hackathon. It handles real money, so start with
            small amounts. Nothing in the app is financial advice.
          </Section>
        </div>
      </main>

      <footer className="border-t border-border px-6 py-8 text-sm text-text-muted">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <span>© 2026 Stow</span>
          <Link href="/welcome" className="font-semibold hover:text-text">
            About Stow
          </Link>
        </div>
      </footer>
    </div>
  );
}

function Section({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="display text-2xl">{title}</h2>
      <div className="mt-3 leading-relaxed text-text-muted">{children}</div>
    </section>
  );
}

function Item({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="rounded-[20px] border border-border bg-surface-raised p-4">
      <p className="font-bold text-text">{title}</p>
      <p className="mt-1">{children}</p>
    </li>
  );
}
