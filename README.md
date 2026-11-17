# Stow: save it, budget it

A savings and budgeting app on the [True Markets Gateway API](https://docs.truemarkets.co/gateway/).
Put dollars (USDC), crypto (SOL, ETH, Bitcoin) or tokenized stocks away until a date (a
**savings goal**), or pay money back to yourself in parts, like a salary (a **budget**:
for example 25% a month). Until each date, the app **refuses to sign** any payment, sale or
trade that would touch that money, even if you ask.

Built for True Markets' "Build the Next Fintech App" hackathon.

## How the money stays put

- Every user has their own True Markets wallets (Solana and Base). Every payment out needs
  a signature from this app's **SigningGuard** (`engine/signing/guard.ts`), the only code
  that holds the signer key.
- Before signing, the guard checks live balances against the user's locks
  (`engine/vault/`). If an order or transfer would dip into money that isn't free yet,
  it's simply never signed, and the user sees which plan stopped it.
- Budgets free each part on its date automatically; nothing has to be released.
- Trades re-quote and refuse to sign if the price moved more than 1%. A failure after
  submitting is treated as an unknown outcome and never retried automatically.
- An optional, rule-based Advisor suggests moves; it goes through the same guard and can be
  switched off.

## Run it locally

Node 24, npm 11. On Windows, run `npm` from PowerShell.

```bash
npm install
cp .env.example .env      # then fill it in
npm run mock              # practice True Markets on :4010 (keep running)
npm run db:migrate        # with DATABASE_URL set
npm run dev               # http://localhost:3000
```

Practice mode (`GATEWAY_MODE=mock`, the default) uses pretend money and offers a one-click
demo account. Other commands: `npm test`, `npm run typecheck`, `npm run lint`,
`npm run dev:catalog` (read-only check of the live True Markets catalog).

## Deploy to Vercel (real money)

1. **Database.** Use a Supabase project for live mode only. A database remembers whether it
   served practice or real money and refuses the other. Run `npm run db:migrate` against it.
2. **Signer key.** `npm run dev:signer-key` once, then **back the file up offline**. It can
   never be replaced, and every live account is tied to it.
3. **Import the repo** in Vercel. The function region is set to London (`vercel.json`,
   `lhr1`), next to a Supabase database in eu-west-2.
4. **Environment variables** (Project Settings → Environment Variables, Production):

   | Variable | Value |
   | --- | --- |
   | `GATEWAY_MODE` | `live` |
   | `TM_API_BASE` | `https://api.truemarkets.co` |
   | `TM_API_KEY` | the whole contents of the organization API key file (**Sensitive**) |
   | `SIGNER_KEY` | the whole contents of the signer key file (**Sensitive**) |
   | `DATABASE_URL` | the live database's Supabase transaction-pooler URL (port 6543) |
   | `APP_URL` | the deployment's address, e.g. `https://your-app.vercel.app` |
   | `RESEND_API_KEY` | a Resend API key (**Sensitive**) |
   | `EMAIL_FROM` | a sender on a domain verified in Resend, e.g. `Stow <hello@yourdomain.com>` |
   | `GOOGLE_CLIENT_ID` | optional: Google sign-in (see `.env.example`) |
   | `GOOGLE_CLIENT_SECRET` | optional: Google sign-in (**Sensitive**) |

   Vercel has no key files, so `TM_API_KEY` / `SIGNER_KEY` hold the files' contents;
   `TM_KEY_FILE` / `SIGNER_KEY_FILE` are for running locally.
5. **Sign-in.** "Continue with Google" works for anyone once the Google client is set up
   (no domain needed). Emailed links need a domain verified in Resend: its test sender
   only delivers to the account owner.
6. **Deploy**, sign in, and test with small amounts first: deposit a few dollars of USDC,
   buy $1 of SOL, lock $1, try to withdraw locked money (it must be refused).

On Vercel the app keeps no database connections open between requests
(`poolSize` in `db/client.ts`).

## Layout

- `engine/`: framework-free TypeScript: Gateway client, token minting, payload stamps,
  the SigningGuard, lock rules and release schedules, fixed-point money maths
- `db/`: Drizzle schema, migrations and stores (Supabase Postgres)
- `mock-gateway/`: a local stand-in for True Markets that verifies signatures
- `app/`: the Next.js app (Home, Portfolio, Invest, Vault, Activity, Advisor, Learn)
- `scripts/`: developer scripts

Educational project, not financial advice.
