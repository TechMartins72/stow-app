@AGENTS.md

# Portfolio Vault

A savings app on the True Markets Gateway API. Users lock funds (crypto, stablecoins, tokenized stocks) until a maturity date; the app refuses to co-sign anything that would move locked funds. Hackathon: "Build the Next Fintech App" (True Markets), submissions due 2026-11-29. Judged on UI/UX, production readiness and uniqueness.

Design document (screens, flows, design system, API mapping): https://claude.ai/artifact/MsyvazePUYWUAU1ybDBtN5

## Commands

- `npm run mock` - start the mock Gateway on http://localhost:4010 (default for everything below)
- `npm test` - unit tests plus end-to-end guard tests against an in-process mock
- `npm run typecheck`, `npm run lint`, `npm run build`
- `npm run dev` - Next.js app
- `npm run dev:user | dev:balances | dev:roundtrip | dev:lock-demo` - dev scripts (mock unless `GATEWAY_MODE=live`)
- `npm run dev:signer-key` - create the live signer key file (never overwrites)
- `npm run db:generate`, `npm run db:migrate` - Drizzle migrations (needs `DATABASE_URL`)

## Layout

- `engine/` - framework-free TypeScript, no Next.js imports
  - `gateway/` - typed HTTP client, token minting, error envelope
  - `signing/stamp.ts` - payload stamps; `signing/guard.ts` - the SigningGuard
  - `vault/rules.ts` - pure lock and guardrail checks; `vault/locks.ts` - create and release locks
  - `vault/schedule.ts` - release schedules (parts freed on their dates) and `lockedNow`
  - `decimal.ts` - fixed-point money math
- `db/` - Drizzle schema, migrations (`db/migrations`) and the Postgres `VaultStore`. Postgres is Supabase via the transaction pooler (port 6543, so `prepare: false`). Keep the `idle_timeout` / `max_lifetime` / `queue_timeout` settings in `db/client.ts`: without them, connections the pooler silently dropped made every signed-in page hang after a quiet spell. Every table has RLS on with no policies so Supabase's public Data API sees nothing; the app connects as the table owner. Without `DATABASE_URL` the app falls back to an in-memory store.
- `mock-gateway/` - local Gateway stand-in that verifies stamps
- `scripts/` - dev scripts (in-memory store)
- `app/` - Next.js UI: Home (`page.tsx`), New lock wizard (`vault/new/`), sign-in (`signin/`, `auth/verify/`); server loaders in `app/_server/`, shared lock policy in `app/_lib/lock-policy.ts`
  - Auth: passwordless magic links (`app/_server/auth-core.ts`, tested) and a `pv_session` cookie; only SHA-256s of tokens are stored. Links point at `APP_URL`, never the Host header, and land on a page that needs a click (mail scanners can't spend them). `proxy.ts` is an optimistic redirect; `getCurrentUser` (`app/_server/current-user.ts`) is the real check and creates the user's Gateway wallets (`external_ref_id` = our user id). Practice mode prints links to the server log and offers a one-click demo account.
  - Screens: Vault (`vault/`), Withdraw, Add funds, Invest (`invest/`, buy/sell and "buy and lock"), Activity, Advisor. Toasts via `useToast()` in client code, or `flash()` in a server action before a redirect.
  - Catalog (`app/_lib/catalog-policy.ts`, `npm run dev:catalog` prints the live one): the Invest tab shows only stocks on supported networks (Solana, Base) and approved crypto (SOL, ETH, cbBTC), hides anything not `tradeable`/`is_active`, and allows sell-only assets to be sold but not bought. Each network's cash is `cashFor()` (USDC, else the network's stablecoin, e.g. USDG on Robinhood Chain). Robinhood-chain stocks are deliberately off for now.
  - Market data is public (no token) and keyed by the catalog's `economic_asset_id`, not the Gateway asset id: `priceHistoryBatch` (one call for the list: price, 24h change, sparkline) and `candles` (charts). Display only: trades always use a fresh quote. Logos come from the catalog's `image.large` (allowed hosts in `next.config.ts`).
  - Trading (`app/_lib/trade-policy.ts`): $1.00 minimum, dollars and cents; a stock is paid with USDC on its own chain (Base for Coinbase tokenized stocks, ticker = symbol minus the trailing C). Every buy/sell passes `minQtyOut` = quote less 1%, and the guard refuses (`price_moved`) below it. A failure after submitting is an unknown outcome: never retry it automatically.
  - Advisor (`app/_lib/advisor.ts`): pure, deterministic suggestions from holdings, locks and the user's risk profile (`users.risk_profile`). Approval rebuilds the suggestion server-side from the id and executes through the guard with `actor: "advisor"`.
  - Gateway reads must stay live: the client sends `cache: "no-store"` and a fresh `AbortSignal`, because Next.js otherwise reuses identical GETs within one render.

## Money-safety rules (do not break these)

1. Only `engine/signing/guard.ts` may call `createStamper` or read the signer key. Every order and transfer goes create -> `checkAction` -> sign -> execute through the guard. Never add another path that signs payloads.
2. Locks are enforced by refusing to sign. Creating an order or transfer moves nothing; a blocked action is simply never signed.
3. A lock is a list of parts (`schedule`; a one-date lock is one part). Each part stays blocked until its `releaseAt` and then frees itself automatically: what is locked is always `lockedNow(lock, now)` from `engine/vault/schedule.ts`, never `lock.amount`. Release schedules are for stablecoins only. `releaseLock` is housekeeping and refuses before `unlockAt`.
4. The advisor goes through the same guard and rules as the user. Perps and leverage stay off.
5. Money is decimal strings and `engine/decimal.ts` bigints. Never `Number()` or `parseFloat` an amount.
6. Mock is the default. Real funds need `GATEWAY_MODE=live`, and dev scripts that spend also need `--yes`.
7. Secrets live in `.secrets/` (gitignored): the organization API key file and the signer key. Never commit, log or paste them.
8. Write the test for a rule before changing the rule.

## Gateway API facts

Docs index: https://docs.truemarkets.co/llms.txt - OpenAPI: https://docs.truemarkets.co/openapi/gateway.yaml

- Base URL `https://api.truemarkets.co`. Paths: `/v1/gateway/...`, users at `/v1/account/organizations/{org}/users`. A UAT sandbox exists at `https://api.uat.truemarkets.co` but may need allowlisting.
- Auth: sign `{key_id}.{unix_seconds}` with the org API key (ES256, r||s base64url) -> `POST /v1/auth/api-key/token`. Token lasts 1 hour, no refresh token; the organization id is in the JWT claim `tm.organization_id`.
- User calls send `TM-On-Behalf-Of: <user_id>`; org-wide calls (create user, org transactions) don't.
- Create user is idempotent per `external_ref_id`; a 503 means wallets aren't ready, so send the same request again. The signer key can never be rotated.
- Orders: market buys use `qty_unit: "quote"` (USDC to spend); DeFi sells use `qty_unit: "base"`. An empty `order_id` means no order was created; `quote.issues` says why.
- Stamps: sign each `payload` string exactly as returned (ECDSA P-256 SHA-256, DER hex), wrap `{publicKey, signature, scheme: "SIGNATURE_SCHEME_TK_API_P256"}`, base64url. Execute with `{signatures, auth_type: "api_key"}` in payload order.
- Errors: branch on `code` (`quote_stale`, `insufficient_balance`, `already_submitted`), fall back to `type`; never on `message`. Show `request_id` only under "Details".
- No webhooks: poll orders and transfers. Every live trade is real money; keep amounts small.
