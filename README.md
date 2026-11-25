# Stow: save it, budget it

**Try it: [stow-app-ckbv.vercel.app](https://stow-app-ckbv.vercel.app)**  ·  About page: [/welcome](https://stow-app-ckbv.vercel.app/welcome)  ·  Privacy: [/privacy](https://stow-app-ckbv.vercel.app/privacy)

Stow is a savings and budgeting app built on the [True Markets Gateway API](https://docs.truemarkets.co/gateway/).
You put money away and Stow keeps it there. Until the date you chose, **the app refuses to
sign** any payment, sale or trade that would touch that money, even if you ask it to.

- **Savings goals.** Lock dollars (USDC), crypto (SOL, ETH, Bitcoin) or tokenized US stocks
  until a date. "Holiday fund, until 1 June."
- **Budgets that pay you.** Lock dollars and get them back in parts, like a salary to
  yourself: for example 25% a month. Each part frees itself on its date.
- **Invest, then lock.** Buy tokenized stocks and crypto from $1, or "buy and lock" in one step.
- **Advisor and Ask Stow.** Rule-based suggestions you approve, and a chat that answers
  questions about your own money. Neither can move money on its own.

Built for True Markets' "Build the Next Fintech App" hackathon (November 2026).
Educational project, not financial advice.

---

## For testers

> **The live site uses real money.** Every deposit, trade and send is real. Start with a few dollars.

1. Open [stow-app-ckbv.vercel.app](https://stow-app-ckbv.vercel.app) and choose **Continue with Google**.
   A new account and its wallets (Solana and Base) are created for you.
2. **Add funds.** The Add funds page shows your deposit addresses with QR codes. Send a few
   dollars of USDC on Solana or Base (on the right network). Deposits appear in Activity.
3. **Lock some.** Vault → **New savings goal or budget**: a savings goal (one date) or a budget (paid back in parts).
   Plans must be at least 7 days away.
4. **Try to break it.** Withdraw or sell the locked money. Stow refuses, names the plan in the
   way, and records the refused attempt in Activity. Nothing is signed, so nothing moves.
5. **Invest.** Buy $1 of a stock or SOL, or use "buy and lock".
6. **Ask Stow.** Open the **Ask Stow** button at the bottom right and ask "When does my money free up?"

**Limits worth knowing**

| What | Limit |
| --- | --- |
| Smallest trade | $1.00 |
| Price protection | A trade is refused if the price moves more than 1% before it's signed |
| Smallest withdrawal | $5 of SOL, USDT or USDC on Solana (True Markets' minimum) |
| Withdrawals | Crypto and dollars only; tokenized stocks can't be sent out yet |
| Budgets (release in parts) | Stablecoins only |
| Ask Stow | 20 questions per person per day |

Want to look around without real money? Run it locally in **practice mode** (below): pretend
money and a one-click demo account.

---

## How it works

Each person gets their own True Markets wallets. True Markets will only move money when a
transaction carries this app's signature, and only one piece of code can make that
signature: the **SigningGuard**.

```
  You ask:  "send 20 USDC"            True Markets
      │                                    ▲
      ▼                                    │ signed: executes
  Stow creates the order or transfer ──────┤
      │   (nothing moves yet)              │ not signed: never happens
      ▼                                    │
  SigningGuard: live balances − locked now ≥ amount?
      ├─ yes → sign → execute ─────────────┘
      └─ no  → refuse, explain which plan is in the way, log the attempt
```

- **Locks are enforced by refusing to sign.** There's no "unlock" button to press early, and
  no admin override. The Advisor goes through the same guard as you.
- **Budgets free themselves.** A budget is a list of parts, each with its own date. What's
  locked is always worked out from today's date, so nothing has to be released by hand.
- **Trades are re-quoted at signing.** If the price moved more than 1%, the guard refuses.
  A failure after submitting is treated as an unknown outcome and never retried automatically.
- **Money maths never uses floating point.** Amounts are decimal strings and fixed-point bigints.

More detail, including the data model and the reasons behind each decision: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Stack

| Layer | Choice |
| --- | --- |
| App | [Next.js 16](https://nextjs.org) (App Router, Server Components, server actions), React 19, TypeScript |
| Styling and motion | Tailwind CSS 4; GSAP 3 on the landing page (respects "reduce motion") |
| Money and wallets | True Markets Gateway API: wallets, quotes, orders, transfers, market data |
| Signing | ECDSA P-256 payload stamps, made only by `engine/signing/guard.ts` |
| Database | Supabase Postgres via Drizzle ORM and postgres.js (transaction pooler) |
| Sign-in | Google (OpenID Connect with PKCE); email magic links via Resend as a fallback |
| AI | Groq (`openai/gpt-oss-120b`) for Ask Stow and the Advisor's market line, plus True Markets' Market Data MCP server for market news |
| Validation | Zod |
| Tests | Vitest: money maths, lock rules, the guard end-to-end against a mock Gateway, auth, privacy policy |
| Hosting | Vercel (Dublin, `dub1`), near the Supabase database (London, eu-west-2). Not London: True Markets refuses stock trades from UK IPs |

---

## Run it locally

Node 22 or newer, npm. On Windows, run `npm` from PowerShell.

```bash
npm install
cp .env.example .env      # fill it in; mock mode needs very little
npm run mock              # practice True Markets on http://localhost:4010 (keep it running)
npm run dev               # http://localhost:3000
```

**Practice mode** (`GATEWAY_MODE=mock`, the default) uses pretend money, prints sign-in links
to the terminal and offers **Try it with practice money** on the sign-in page. Without
`DATABASE_URL` it keeps everything in memory.

| Command | What it does |
| --- | --- |
| `npm test` | All tests, including the guard against an in-process mock Gateway |
| `npm run typecheck`, `npm run lint`, `npm run build` | Checks and production build |
| `npm run db:migrate` | Apply database migrations (needs `DATABASE_URL`) |
| `npm run dev:catalog` | Print the live True Markets catalog (read-only) |
| `npm run dev:signer-key` | Create the live signer key file once (never overwrites) |

---

## Deploy your own (real money)

1. **Database.** A Supabase project used for live mode only (a database refuses to serve both
   practice and real money). Run `npm run db:migrate` against it.
2. **Signer key.** `npm run dev:signer-key` once, then **back the file up offline**. It can't
   be replaced, and every live account is tied to it.
3. **Import the repo in Vercel** and set these Production environment variables:

   | Variable | Value |
   | --- | --- |
   | `GATEWAY_MODE` | `live` |
   | `TM_API_BASE` | `https://api.truemarkets.co` |
   | `TM_API_KEY` | the contents of the organization API key file (**Sensitive**) |
   | `SIGNER_KEY` | the contents of the signer key file (**Sensitive**) |
   | `DATABASE_URL` | Supabase transaction-pooler URL (port 6543) |
   | `APP_URL` | the site's address, e.g. `https://your-app.vercel.app` (no trailing slash) |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth web client; redirect URI `APP_URL` + `/auth/google/callback` (secret **Sensitive**) |
   | `CONTACT_EMAIL` | shown on the privacy page for deletion requests |
   | `GROQ_API_KEY` | optional: turns on Ask Stow (**Sensitive**) |
   | `RESEND_API_KEY`, `EMAIL_FROM` | optional: email sign-in links (needs a domain verified in Resend) |

4. **Deploy, then test with small amounts:** deposit a few dollars of USDC, buy $1 of SOL,
   lock $1, and try to withdraw the locked dollar. It must be refused.

With Google set up, the live sign-in page shows Google only. The email link stays in
practice mode and comes back automatically if Google isn't configured.

---

## Project layout

```
engine/         Framework-free TypeScript: the money core
  gateway/        typed True Markets client, token minting, error envelope
  signing/        payload stamps and the SigningGuard (the only code that signs)
  vault/          lock rules, release schedules, creating and releasing locks
  decimal.ts      fixed-point money maths
db/             Drizzle schema, migrations and Postgres stores
mock-gateway/   local stand-in for True Markets that verifies signatures
app/            Next.js app
  welcome/        landing page          privacy/     privacy policy
  page.tsx        Home                  vault/       goals and budgets
  invest/         buy, sell, buy & lock withdraw/    send out
  add-funds/      deposit addresses     activity/    one timeline
  advisor/        suggestions           portfolio/   holdings
  _lib/           pure, tested rules    _server/     loaders, auth, sessions
scripts/        developer scripts
docs/           architecture and handoff notes
```

---

## Roadmap

**Before submission (29 November 2026)**
- Demo video (2–3 minutes): lock → try to withdraw → refused with the reason → buy and lock → Activity.
- Keep the Ask Stow daily limit in the database, so it survives restarts.

**Next**
- **Reminders** when a part of a budget frees up or a goal matures (email or push).
- **Settings:** risk profile, spending guardrails (daily and single-trade limits), change email.
- **Saved addresses** with a 24-hour cooldown for new ones, so a stolen session can't drain free money quickly.
- **Recurring saving:** "put $20 away every Friday" into an existing goal.
- **Passkeys** for one-tap sign-in.

**Later**
- **Mobile apps** (iPhone and Android), starting with an installable web app.
- **Bank deposits and withdrawals** (cash on and off ramps) as True Markets adds them.
- **Shared goals:** save together with a partner or family, each person's share still locked.
- **More assets and networks**, such as Robinhood Chain stocks paid in USDG.
- **Hardened key custody:** keep the signer key in a cloud key service, plus an external review of the SigningGuard.

---

Educational project, not financial advice. Built on the True Markets Gateway API.
