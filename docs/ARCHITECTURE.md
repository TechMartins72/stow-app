# How Stow works

A closer look at the parts the [README](../README.md) summarises: how money is kept locked,
how a request travels through the app, what's stored, and why things are built this way.
Live app: [stow-app-ckbv.vercel.app](https://stow-app-ckbv.vercel.app).

## The idea in one sentence

True Markets holds each person's wallets but will only move money when a transaction carries
Stow's signature, so **Stow keeps money locked by refusing to sign**.

## Layers

| Layer | Folder | Knows about |
| --- | --- | --- |
| Money core | `engine/` | True Markets, signing, lock rules, decimal maths. No Next.js, no database driver. |
| Storage | `db/` | Postgres tables and the stores the engine and app use. |
| App | `app/` | Screens, server actions and loaders. Pure, tested rules live in `app/_lib/`; server-only code in `app/_server/`. |
| Practice Gateway | `mock-gateway/` | Same paths and shapes as True Markets; checks signatures; pretend balances. |

The engine has no framework imports, so its rules are tested directly, including the guard
end-to-end against an in-process mock Gateway.

## Accounts and wallets

1. A person signs in with Google (OpenID Connect, PKCE, state and nonce checked) or, in
   practice mode, an email link. Only the email address is kept; Google's tokens are discarded.
2. On first visit, `getCurrentUser` (`app/_server/current-user.ts`) asks True Markets to create
   a user with `external_ref_id` = Stow's own random user id (never the email). This is
   idempotent, so retrying is safe.
3. True Markets creates Solana and Base wallets for that user, registered to Stow's
   **signer public key**. People have no keys of their own: nothing moves without Stow's
   signature.
4. Sessions are an httpOnly `pv_session` cookie. The database stores only SHA-256 hashes of
   session and sign-in tokens.

## The money path

Every order and transfer takes the same route, and only `engine/signing/guard.ts` can sign:

1. **Create.** Ask True Markets for an order or transfer. This returns unsigned payloads and,
   for trades, a quote. Nothing moves yet.
2. **Check.** `checkAction` (`engine/vault/rules.ts`) compares the action with live balances,
   the person's locks *as of now*, and their guardrails. Possible refusals: money that's
   locked, perpetuals (always off), an asset outside the allowed list, a guardrail limit, or
   a price that moved more than 1% since the quote.
3. **Sign or refuse.**
   - Allowed: sign each payload (ECDSA P-256 over SHA-256), execute, then poll for the result
     (True Markets has no webhooks).
   - Refused: nothing is signed, the unsigned order simply expires, and the attempt is logged
     with the reasons. The person sees which plan was in the way.
4. **Log.** Every attempt goes in `action_log`, which feeds the Activity page.

A failure *after* submitting is an unknown outcome: the money may or may not have moved, so
it is never retried automatically.

The Advisor uses the same path with `actor: "advisor"`. Its suggestions are rebuilt on the
server from their id when approved, so the browser can't change what gets executed.

## Locks and budgets

- A lock is a list of **parts**, each with an amount and a release date. A savings goal is one
  part; a budget is several (for example four parts of 25%, a month apart).
- What's locked is always `lockedNow(lock, now)` (`engine/vault/schedule.ts`): the sum of the
  parts whose date hasn't come yet. There's no job that "releases" money; a part is simply no
  longer counted once its date passes.
- Release-in-parts budgets are for stablecoins only, so each part is worth what it says.
- New plans must start at least 7 days away (`app/_lib/lock-policy.ts`).

## Money maths

Amounts are decimal strings from the API and `bigint` fixed-point values (18 places) inside the
app (`engine/decimal.ts`). `Number()` and `parseFloat` are never used on money, so there are no
rounding surprises like `0.1 + 0.2`.

## What's stored

| Table | Holds |
| --- | --- |
| `users` | email, True Markets user id, risk profile, Advisor on/off |
| `sessions`, `login_tokens` | hashes only, with expiry |
| `locks` | name, asset, amount, schedule of parts |
| `guardrails` | optional per-person spending limits |
| `action_log` | every buy, sell and send asked for, by whom, and whether it was signed or refused |
| `app_settings` | whether this database serves practice or real money (it refuses the other) |

Balances and transaction history aren't copied: they're read live from True Markets on each
request. Row-level security is on with no policies, so Supabase's public Data API sees nothing;
the app connects as the table owner.

## AI features, kept away from money

- **Advisor:** deterministic rules (`app/_lib/advisor.ts`) from holdings, locks and risk profile.
  No AI picks the suggestions.
- **Ask Stow:** Claude answers from a read-only text snapshot of the person's own data, plus
  True Markets' public Market Data MCP server for market news. It has no tools that can move
  money; its answers are only displayed. 20 questions per person per day.
- **"Why it's moving":** True Markets' AI asset summaries, shown for context only. They never
  feed trades, quotes or the Advisor's choices.

## Decisions and why

| Decision | Why |
| --- | --- |
| Enforce locks by refusing to sign | There's no early-unlock button to press and no admin override to abuse. |
| One signing module | One place to review and test; every path goes through the same rules. |
| Locked amount computed from today's date | Nothing to forget to release; no background jobs. |
| Live balances, never cached | A lock check against stale balances could let locked money out. |
| Practice mode by default | Developers can't spend real money by accident; spending scripts also need `--yes`. |
| Google sign-in on the live site | Email links need a verified sending domain; Google works for anyone. |
| No True Markets Trading MCP server | It signs for a personal account outside the SigningGuard. |

## Testing

`npm test` runs Vitest over:
- money maths;
- lock, schedule and trade rules;
- the guard end-to-end against an in-process mock Gateway: refusals, budgets, price protection;
- sign-in (magic links, Google);
- activity building, the Advisor and the Ask Stow helpers;
- the privacy policy, which must match what the code actually asks Google for.

More background (API lessons, decisions, gotchas): [HANDOFF.md](HANDOFF.md).
