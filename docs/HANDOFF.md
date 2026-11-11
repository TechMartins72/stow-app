# Portfolio Vault: handoff and project context

Read this first, then `CLAUDE.md` (project rules, kept short and binding). This file is the
long-form context: what we're building, why, what exists, how it fits together, what we
learned about the True Markets API, the decisions already made (and why), and what's next.

Last updated: 2026-11-11, at commit `cd85895` on branch `feat/scaffold` (clean tree, no git remote yet).

---

## 1. The product in one paragraph

**Portfolio Vault** is a savings app built on the **True Markets Gateway API**. Users hold
dollars (USDC), crypto (SOL, ETH, Bitcoin) and tokenized US stocks (Apple, NVIDIA, Tesla…) in
wallets True Markets creates for them. They can **lock** money until a date they choose, or
**release it in parts** like a salary to themselves (for example 25% a month). Until each date
the app **refuses to sign** any transaction that would move locked money, and refusing to sign
is the whole enforcement mechanism. It also has buying and selling (including "buy and lock"),
withdrawals, an activity timeline, and a rule-based Advisor that suggests moves the user approves.

> One-line pitch: *"A savings account for crypto, dollars and stocks, where the app itself
> refuses to let you break your own promise."*

**Persona:** Sandra wants to save 4,000 and receive 25% of it every month until it's all
released. She locks 4,000 USDC, chooses "release in parts, 25%, every month", and on each date
1,000 becomes spendable automatically. If she tries to withdraw more early, the guard refuses and
shows which lock is in the way.

**Look and feel:** modelled on PiggyVest's SafeLock (piggyvest.com/safelock): navy frame, bright
blue hero card, heavy rounded type, friendly copy. We borrow the style only: no PiggyVest name,
logo, illustrations or copy. Our own motif is a padlock inside a ring.

## 2. The hackathon

- **Event:** "Build the Next Fintech App" by True Markets (luma.com/93ou3edc). Docs: https://docs.truemarkets.co/gateway/
- **Submissions due 2026-11-29.** Winners announced Dec 14. Prizes $1000 / $500 / $250.
- **Judged on UI/UX, production readiness and uniqueness.** Every decision is weighed against these three.
- The user works **alone with Claude Code**. They chose: no CLI product (dev scripts and tests
  instead), web app only, locked-savings vault as the single focus.
- **Design doc** (screens, flows, design system, API mapping), written early as a Claude Doc:
  https://claude.ai/artifact/MsyvazePUYWUAU1ybDBtN5 (may not be reachable from another account;
  section 12 below summarises the design system).

## 3. Status

### Built and working (all against the mock Gateway; tested)

| Area | What exists | Main files |
|---|---|---|
| Engine | Typed Gateway client, org-token minting, error envelope, payload stamping, **SigningGuard**, lock and guardrail rules, release schedules, fixed-point decimals | `engine/` |
| Mock Gateway | Same paths and shapes as the real API, verifies stamps, practice funding, live-style catalog, market-data endpoints | `mock-gateway/server.ts` |
| Database | Supabase Postgres via Drizzle; users, sessions, login tokens, locks (with schedule), guardrails, action log; RLS on; 2 migrations | `db/` |
| Sign-in | Passwordless magic links (Resend), 30-day sessions, practice demo account, sign-out | `app/signin/`, `app/auth/verify/`, `app/_server/auth-core.ts`, `session.ts`, `current-user.ts` |
| Home | Balance hero (locked vs accessible), quick actions, lock cards, Advisor card, toasts | `app/page.tsx`, `app/_components/` |
| New lock | 4-step wizard: amount, unlock (all at once, or in parts), name, review | `app/vault/new/` |
| Vault | Lock list (active, released) and lock detail with release timeline | `app/vault/` |
| Withdraw | Send crypto out; address checks per network; "Blocked by your locks" screen listing the blocking locks | `app/withdraw/` |
| Add funds | Deposit addresses with QR codes per network; practice top-ups in mock mode | `app/add-funds/` |
| Invest | Live-catalog list (12 Base stocks + SOL, ETH, Bitcoin), logos, prices, 24h change, sparklines, biggest movers, charts (1D/1W/1M/1Y), About, buy/sell, **buy and lock** | `app/invest/`, `app/_server/market.ts`, `app/_lib/catalog-policy.ts` |
| Activity | One timeline: trades, sends, locks, releases, and attempts the guard refused | `app/activity/`, `app/_lib/activity.ts` |
| Advisor | Risk profile (Careful / Balanced / Growth), deterministic suggestions with reasons, guard pre-check, approve or dismiss, decision log | `app/advisor/`, `app/_lib/advisor.ts`, `app/_server/advisor.ts` |
| Toasts | Client `useToast()`, and `flash()` across server-action redirects | `app/_components/toaster.tsx`, `app/_server/flash.ts` |

**Quality bar today:** typecheck, lint and **128 tests in 19 files** all pass. Tests cover money
maths, lock and schedule rules, guard end-to-end against an in-process mock (including Sandra's
schedule and price protection), auth, catalog policy, advisor, activity, formatting and chart maths.

### Not built yet

- **AI savings-coach chat** (agreed in principle; design in section 10.1). Needs `ANTHROPIC_API_KEY`.
- **Passkeys** for instant sign-in without email.
- **Deployment** (plan: Vercel, EU region, near the Supabase database).
- **Live test with real money** (steps in section 9.3). Only read-only live calls have run so far.
- Settings page; change-email flow; bank on/off-ramps; Robinhood-chain stocks (USDG); sell-and-send; saved addresses.

### Commit history (oldest first)

1. `2c19513` Scaffold: engine, signing guard and mock Gateway
2. `150515e` Home screen with PiggyVest-inspired theme
3. `ccdf94e` New lock wizard and scheduled release (budgeting) locks
4. `399d586` Store users and locks in Supabase Postgres
5. `f8ac65e` Passwordless sign-up; keep Gateway reads live
6. `34a3793` Vault, Withdraw, Add funds, Invest, Activity, Advisor, toasts
7. `2445751` Invest tab shaped by the live catalog and market data
8. `cd85895` Fix hanging signed-in pages and false "link expired"

---

## 4. Running it

Windows 10, Node 24, npm 11. **Use PowerShell for `npm`/`npx`**: Git Bash's `npx` fails here
("Could not determine Node.js install directory").

```bash
npm install
npm run mock          # mock Gateway on http://localhost:4010 (keep running)
npm run dev           # app on http://localhost:3000
npm test              # 128 tests
npm run typecheck
npm run lint
npm run dev:catalog   # READ-ONLY live check: mints an org token, prints the live catalog
```

- **Practice mode is the default** (`GATEWAY_MODE=mock`). On `/signin`, **"Try it with practice
  money"** creates a demo account with about $3,529 of fake funds and two sample locks. In practice
  mode, sign-in links are also printed in the server terminal, so any email works without Resend.
- **Environment:** copy `.env.example` to `.env` (gitignored). Keys: `GATEWAY_MODE`,
  `MOCK_GATEWAY_URL`, `TM_API_BASE`, `TM_KEY_FILE`, `SIGNER_KEY_FILE`, `DEV_USER_REF`,
  `ROUNDTRIP_USDC`, `DATABASE_URL`, `APP_URL`, `RESEND_API_KEY`, `EMAIL_FROM`. Next will need
  `ANTHROPIC_API_KEY` for the AI coach.
- **Secrets** live in `.secrets/` (gitignored): `api-key.json` (the org API key: `key_id` plus a
  JWK `private_key`; it's in place and works), `signer-key.mock.json` (auto-created, practice
  only), `dev-state.json` (dev scripts). The **live signer key does not exist yet**; create it
  deliberately with `npm run dev:signer-key` and back it up.
- Without `DATABASE_URL` the app falls back to in-memory stores (data disappears on restart).
- A `.claude/launch.json` defines `app` (port 3000) and `app-alt` (3001) for the built-in browser
  preview. Next allows only one `next dev` per folder.

---

## 5. Architecture

### Layers

- **`engine/`**: framework-free TypeScript, no Next.js imports. Gateway client, tokens, stamps,
  the SigningGuard, pure rules, schedules, decimals. Everything money-related is decided here.
- **`db/`**: Drizzle schema, migrations, and the Postgres `VaultStore` (`store.ts`) and
  `AuthStore` (`auth-store.ts`). The engine depends on interfaces, with memory and Postgres
  implementations, which is why tests run without a database.
- **`app/`**: Next.js 16 App Router. Server components load data; server actions mutate; **the
  browser never talks to the database or to True Markets directly.**
  - `app/_lib/`: pure, tested product rules (lock policy, trade policy, catalog policy, advisor,
    activity, formatting, chart maths, addresses, toasts).
  - `app/_server/`: server-only loaders and helpers (engine singleton, session, current user,
    market, wallet, vault, activity, advisor, email, flash, demo seed).

### Identity: how a person maps to True Markets

```
sign-in:  email ──▶ users row ──▶ our UUID ──▶ pv_session cookie (only a SHA-256 is stored)
request:  cookie ──▶ UUID ──┬──▶ our DB: locks, guardrails, action log, risk profile
                             └──▶ users.gateway_user_id ──▶ True Markets: wallets, balances, trades
```

- **The email is only the lookup key at sign-in.** The UUID is the permanent identity, so a
  future email change keeps locks and wallets.
- **True Markets user:** created with `external_ref_id` = our UUID (never the email, so True
  Markets gets no personal data). The call is idempotent, so the same UUID always returns the same
  user and wallets. A 503 means "wallets not ready, retry".
- **Wallet addresses aren't stored.** They're fetched with the same idempotent call. Balances,
  orders and transfers are always fetched live.
- **User-scoped Gateway calls** send `TM-On-Behalf-Of: <gateway user id>`.

### Keys (users have no keys)

| Key | Holder | Purpose |
|---|---|---|
| **Org API key** (`.secrets/api-key.json`) | Our server | Signs `{key_id}.{unix_seconds}` (ES256, r‖s base64url) → `POST /v1/auth/api-key/token` → 1-hour access token with no refresh token. `engine/gateway/token.ts` caches it, renews 5 minutes before expiry, and re-mints on a 401. The org ID comes from the JWT claim `tm.organization_id`. |
| **Signer key** (P-256) | Our server, **only inside the SigningGuard** | The private half stamps each unsigned payload. The public half is registered as `signer_public_key` on every user at creation. **One key for the whole app today. It can never be rotated, and each user is bound to it forever.** Losing it means users' funds can never move again. |
| **Wallet keys** | True Markets (Turnkey, per the `SIGNATURE_SCHEME_TK_API_P256` scheme) | Hold and move funds on-chain. Act only on a valid stamp sent with our org token. |

**Production hardening still to do:** move the signer key into a KMS/HSM (it can sign but never
be exported); consider per-user signer keys (a leak hits one user, not all); keep a secure
offline backup. Practice mode auto-creates its own key; **live mode refuses to start without
`SIGNER_KEY_FILE`**. That's deliberate, so a lost file can't silently create a new key.

### The money path (never bypass it)

`create order/transfer → checkAction (rules) → sign (guard) → execute → poll`

- Creating an order or transfer moves nothing; **a blocked action is simply never signed.**
- **The guard re-checks everything against live balances and locks.** Approvals from the
  Advisor are rebuilt server-side from an ID and run as `actor: "advisor"`.
- **Every buy/sell passes `minQtyOut` = quote less 1%.** If the live quote is worse, the guard
  refuses with `price_moved`. This lesson comes from usetenth (section 7.3).
- **A failure after submitting means the outcome is unknown.** Never retry automatically; tell
  the user to check Activity.
- **No webhooks:** orders and transfers are polled.

### Locks and schedules (money-safety rule 3)

- **A lock is a list of parts** (`schedule`); a one-date lock is a single part.
- **Each part frees itself automatically on its `releaseAt`.** No release button.
- **What's locked is always `lockedNow(lock, now)`,** never `lock.amount`.
- **Release schedules are for stablecoins only,** so "25% a month" means a fixed value.
- **Parts round down** to the asset's decimals, and the last part takes the remainder, so they
  sum exactly.
- **Month-end dates clamp:** Jan 31 → Feb 28 → Mar 31.
- **Policy limits:** 7–1,000 days, and 2–52 parts.
- `releaseLock` is housekeeping only.

### Money maths

- **Amounts are decimal strings or `engine/decimal.ts` bigints (scale 18). Never `Number()` or
  `parseFloat` an amount.**
- **Display-only ratios** (percentages, chart coordinates) are computed in bigint first, then
  turned into small numbers.
- **Money columns in Postgres are `numeric(38,18)`,** read back as strings.

---

## 6. Next.js 16 gotchas (read `node_modules/next/dist/docs` before writing Next code)

- **`cacheComponents: true` is on.** Uncached data must sit inside `<Suspense>`. Call
  `await connection()` before reading the clock, cookies-derived data, or anything per-request.
  Otherwise you get a "blocking-prerender" / `new Date()` while prerendering error.
- **Client hooks that read the URL** (`usePathname`) in the root layout must be inside their own
  `<Suspense>`. The toaster's flash reader is set up this way.
- **Fetch reuse:** Next reuses identical GET fetches within one render, and in dev also across hot
  reloads. That caused balances read after a practice top-up to come back stale, the original
  "Only 0 USDC is available to lock" bug. Fixes:
  - **The Gateway client** sends `cache: "no-store"` and a fresh `AbortSignal` on every request.
  - **`next.config.ts`** sets `experimental.serverComponentsHmrCache: false`.
- **Middleware is now `proxy.ts`.** Ours is only an optimistic "no cookie → /signin" redirect;
  `getCurrentUser` is the real check.
- **Server actions need an `Origin` header** (CSRF protection). Plain-HTML forms with server
  actions work before hydration; that's used for sign-in, sign-out and the demo button.
- **Images:** `images.remotePatterns` allows `coin-images.coingecko.com` and `api.elbstream.com` only.
- **Route types:** `npm run typecheck` runs `next typegen` first (needed for `PageProps<...>`).

## 7. What we learned about True Markets (much of it isn't in the docs)

### 7.1 Live catalog (via `npm run dev:catalog`, read-only)

- **338 spot assets plus 42 perps.**
  - **Crypto:** 113 on Solana, 74 on Base, 20 on Robinhood Chain, a few on Hyperliquid and Arbitrum.
  - **Stocks:** **12 Coinbase tokenized stocks on Base** (paid with USDC on Base), **93
    Robinhood-chain stocks** (paid with **USDG**), and 14 centralized-venue entries with no chain.
- **Stablecoins:** USDC on Solana, Base, Arbitrum and Hyperliquid; PYUSD; USDG on Robinhood Chain.
- **Useful fields:**
  - `economic_asset_id`: the key for market data;
  - `tradeable`, `is_active`, and `status` (`active` or `sell_only`);
  - `icon` (tiny, about 25px) and `image.large` (use this one);
  - `description` (sometimes contains unfilled placeholders like `[Company]` and `[TICKER]`,
    plus a repeated "About X" heading; `cleanDescription()` tidies them);
  - `website`.
  - `market_data` holds only supply figures, **not prices**.
- **The 12 Base stocks** (all tradeable on 2026-11-07): Apple, Amazon, Alphabet, Meta, Microsoft,
  NVIDIA, Tesla, Palantir, Strategy, Micron, SanDisk, **SpaceX** (a private-company token; flat
  price; check with True Markets before featuring it).
- **Coinbase stock tickers end in "C"** (AAPLC is AAPL). Base stock names in the live catalog are
  already clean ("Apple").

### 7.2 Market Data API (public, no token)

- **Keyed by the catalog's `economic_asset_id`, not the Gateway asset `id`.** The docs don't say
  this; passing the Gateway ID gives "symbol not found".
- `GET /v1/defi/market/prices?asset_id=` returns 30s / 1h / 4h / 24h candles. The current price is
  the 30-second close; the 24h change is the 24-hour open vs. close.
- `GET /v1/defi/market/prices/history/batch?asset_ids=a,b,c&window=1d&resolution=1h` returns
  `{results:[{asset_id, symbol, points:[{t, price}]}]}`. **One call for the whole list.**
- `GET /v1/defi/market/prices/candles?asset_id=&window=&resolution=` returns `{candles:[{t, open,
  high, low, close}]}`. Windows look like `1d`, `7d`, `1M`, `12M`; resolutions like `15m`, `2h`,
  `1d`, `7d`.
- **Prices are decimal strings.** Market data is for display only; trades use fresh quotes.

### 7.3 Lessons from usetenth (a live True Markets Telegram app; reference repo at `../usetenth-main`)

- **$1.00 minimum per order,** entered as dollars and cents.
- **Refuse if the price moves more than 1%** between the quote shown and signing.
- **Write the order record before signing;** use idempotency keys.
- **Timeouts and 5xx after submitting are unknown outcomes:** never retry automatically.
- **Tokenized stocks are quoted in their chain's own stablecoin.** Robinhood-chain sales pay out in USDG.
- **Caveat:** usetenth uses the account-level Trading/DeFi API, not the Gateway, so confirm the
  details above in a live Gateway test.

### 7.4 Still unknown: ask at True Markets office hours

1. Can tokenized stocks be **sent to or received from outside wallets**? (Withdraw is crypto-only
   until we know.)
2. Is **native ETH** or any Ethereum-mainnet deposit supported?
3. Can True Markets **convert USDC to USDG**, and can users deposit on Robinhood Chain from common
   exchanges? (This gates the 93 Robinhood stocks.)
4. Can USDC move **between Solana and Base** for the user? (Most people hold USDC on Solana;
   stocks need it on Base.)
5. **KYC** per user: needed, and who does it?
6. **Supported countries:** how should `/assets/availability` be used?
7. **UAT sandbox access** (`https://api.uat.truemarkets.co`) for testing without real money.
8. Stock **market hours**, minimums and fees; how SpaceX is priced.
9. Recommended **signer-key setup:** one per org vs. per user; KMS?

---

## 8. Decisions already made (don't relitigate without reason)

| Decision | Why |
|---|---|
| Locked-savings vault only; web app; no CLI | Focus for a solo builder; judged on UI |
| PiggyVest SafeLock style, own motif | Familiar "safe savings" look; uniqueness through our own mark |
| **Users never hold keys; the server signs through the guard** | Otherwise locks couldn't be enforced |
| **All releases are automatic** (one-date locks too) | "Receive it every month" means automatic; nothing moves anyway, money just becomes spendable |
| **Release schedules for stablecoins only** | A fixed share of a volatile asset isn't a budget |
| Magic links, no passwords; 30-day sessions | Safer, modern; passkeys planned for instant sign-in |
| Rejected: "log in by checking the email against the DB" | Typing an email proves nothing |
| Invest shows 12 Base stocks + SOL, ETH, cbBTC only | Savings app, not a meme-coin casino; only networks with deposit, withdraw and cash supported end to end |
| **Robinhood-chain stocks off for the demo** | USDG on a third network adds friction and unknowns; the code reads cash per network from the catalog, so they're quick to switch on later |
| Withdraw is crypto only | Unclear whether stocks may leave True Markets |
| **Advisor is rule-based and deterministic** | Predictable, testable, explainable; an LLM may phrase things, never decide |
| AI savings coach: AI explains and recommends, never moves money or does maths | Safety and trust; detailed in 10.1 |
| Practice (mock) mode is the default; live needs `GATEWAY_MODE=live`, and spending scripts need `--yes` | Every live trade is real money |

---

## 9. Known issues and gotchas

1. **Slow pages in dev** (1–15s): several round trips per page to the Supabase server in Europe
   and to the mock. Deploying near the database and a speed pass (reuse the wallet lookup,
   parallelise queries) should fix most of it.
2. **Database connections:** keep `idle_timeout`, `max_lifetime` and `queue_timeout` in
   `db/client.ts`. Without them, connections the Supabase pooler had dropped made every signed-in
   page hang after a quiet spell (overnight). That was the root cause of the false "link expired"
   reports. The pooler is on port 6543, so `prepare: false`.
3. **Resend test sender** (`onboarding@resend.dev`) delivers only to the Resend account owner's
   address. Verify a domain and change `EMAIL_FROM` before judges sign up.
4. **The built-in browser pane must be visible** for client JavaScript to hydrate; when hidden,
   screenshots time out and buttons don't respond. Read pages with `get_page_text` or by fetching
   the HTML instead.
5. **On Windows, stopping a background `npm` task** can leave its child `node` running. Check
   ports 3000 and 4010 before starting servers. **Never kill the user's own servers;** they often
   run `npm run dev` and `npm run mock` themselves.
6. **Practice data:** the mock's prices are fixed (for example Apple $220 vs. about $343 live). The
   mock deliberately marks SanDisk sell-only and Micron untradeable to exercise those paths (live,
   both are tradeable). Restarting the mock forgets users; the app re-creates them in mock mode.
7. **Test accounts in the database:** a few demo users (`demo-…@demo.invalid`) and a test user
   (`sandra@example.com`) with old sessions and links. Harmless; clean up before launch.
8. **Advisor "first stock" suggestion** only appears when the user has USDC on Base; most users
   will have Solana USDC (see 7.4, question 4).

### 9.3 Live test steps (user runs these; real money)

1. The org API key is already in `.secrets/api-key.json`, and `TM_KEY_FILE` is set.
2. Run `npm run dev:signer-key`, then **back up the file**.
3. Set `GATEWAY_MODE=live` and `SIGNER_KEY_FILE=.secrets/signer-key.json` in `.env`.
4. Run `npm run dev:user`, then fund the shown Solana address with about $3 USDC.
5. Run `npm run dev:roundtrip -- --yes` (buys about $1 of SOL and sells it back).

---

## 10. What's next (priority order, as agreed with the user)

### 10.1 AI savings-coach chat (next feature; agreed in principle)

**The idea:** a chat where the user describes a plan for their free and locked money ("I want to
spend $400 on a phone this weekend"). The coach answers:
- **with a verdict:** 🟢 Good idea / 🟡 Think twice / 🔴 Not now;
- **with two or three reasons** using the user's real numbers;
- **with alternatives** as tappable **action cards** (e.g. "Wait until Dec 5, when $1,000
  unlocks", "Lock $200 as a phone fund").

Quick-start chips; it lives on the Advisor page plus a chat button on Home.

**Design rules (agreed):**
- **The AI never does maths.** Read-only tools compute exact numbers with engine decimals:
  - a **snapshot**: free, locked and upcoming releases;
  - a **plan simulator**: "spend $X of free USDC → what's left, when money frees up".

  The AI explains the results.
- **The AI never signs or moves money.** Action cards come from a fixed allow-list (create a lock,
  a reminder, possibly a small sale). They're rebuilt and validated server-side and go through the
  SigningGuard only when the user taps Approve. It can't break locks.
- **A savings coach, not a stock picker.** For "should I buy Tesla?" it talks about risk and
  timing, not predictions. Label answers "Educational, not financial advice".
- **Send minimal data:** amounts, assets, lock names and dates only. No email, addresses or keys.
- **Structured output** for the verdict and the card IDs; a per-user daily message cap; session
  history; **fall back to the rule-based Advisor** when there's no key or the AI is down.
- **Model:** Claude Opus 5.5 (`claude-opus-5-5`) with the server-side refusal fallback on. About
  2–5 cents per message with tool calls. Use the official `@anthropic-ai/sdk`; read the
  `claude-api` skill before writing it.

### 10.2 Then, roughly in this order

1. **Passkeys** (WebAuthn) for one-tap sign-in; magic links stay as the fallback and for recovery.
2. **Deploy** to Vercel (EU region) with production env vars; verify a Resend domain; keep
   practice mode until the live test passes.
3. **Live test** (9.3) and fixes from real-API surprises.
4. **Speed pass.**
5. **Settings:** risk profile, guardrails (daily and single-trade limits), change email.
6. **Sell and send;** saved addresses with a 24-hour cooldown for new ones.
7. If office hours say it's easy: **Robinhood-chain stocks with USDG**.
8. **Polish, hide "Soon" items, the demo video** (2–3 minutes), and the submission.

**Demo story for judges:** lock savings → watch the countdown or a scheduled release → try to
withdraw locked money and get refused, with the reason → buy a stock and lock it → the Advisor or
AI coach suggests a safer move → everything shows in Activity.

---

## 11. Working with this user

- **Solo builder,** not deeply technical on infrastructure. Explain plainly and briefly, in
  everyday words, and define terms.
- **Commits only when asked** (they say "Commit the working tree changes with a sensible message").
  Sometimes they commit themselves.
- **Often tests in the browser themselves;** give them a short test script when useful.
- **Secrets:** never ask for or echo passwords or keys. They once pasted a database password in
  chat; remind them gently to keep secrets in `.env` / `.secrets/` only. Check key files by shape
  (field names), never by value.
- **Commit attribution line:** `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Repo rules** in `CLAUDE.md` are binding, especially the 8 money-safety rules and "write the
  test for a rule before changing the rule".

---

## 12. Design system (summary of the design doc)

- **Colour tokens** (light / dark): `frame` #060F21 navy (header, sidebar); `surface` #F0F5FC /
  #0B1529; `surface-raised` #FFFFFF / #13203A; `text` #122231; `text-muted` #3D4F60;
  `accent-primary` royal blue #0935D1 (buttons, links); `hero` sky blue #0089FF (balance card,
  accessible share); `accent-locked` deep blue #00259B (locks); `positive` and `negative` for
  gains and losses only, always paired with a sign and an arrow; `warning` amber; `critical` red.
  White text on the sky-blue hero only at 24px+ bold.
- **Type:** Plus Jakarta Sans. Display weight 800, tight tracking; tabular numerals for every amount.
- **Shapes:** radius 24 for hero cards and sheets, 20 for cards, 12 for buttons and inputs.
  Buttons are 15×22 padding, 600 weight.
- **Layout:** navy frame, light content, one loud blue hero card on Home; soft depth (1px
  borders, one soft shadow on hero cards and sheets); friendly headlines, exact numbers.
- **Accessibility:** focus moves to step headings in wizards; `aria-live` for errors and toasts;
  charts have text summaries; meaning never relies on colour alone; works at 375px mobile with a
  bottom tab bar.

## 13. Glossary

- **Gateway:** True Markets' API for apps that hold users' wallets (per-user Solana and EVM wallets, orders, transfers).
- **Quote:** a short-lived price for one specific trade (amount out, price, fee, issues). Executing a stale one fails with `quote_stale`.
- **Payload / stamp:** the Gateway returns unsigned payloads; we sign each one (a "stamp") and send them back to execute.
- **SigningGuard:** the only code allowed to sign; checks every rule first.
- **Accessible vs. locked:** wallet balance minus what locks hold right now = accessible (spendable).
- **Practice mode:** the mock Gateway with fake money (`GATEWAY_MODE=mock`).
- **cbBTC:** Coinbase's wrapped Bitcoin on Base; shown in the app as "Bitcoin".
