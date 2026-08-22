# VelozTrade

Full-stack retail trading platform (forex · crypto · stocks · commodities · indices CFDs) with an admin back office, KYC, deposit/withdrawal workflows, an on-chain USDT deposit scanner, and a multi-tier partner program. TypeScript end-to-end, deployed as a single container.

## Features

**Trading**
- ~75 instruments across five asset classes with per-class leverage (forex up to 1:1000, crypto 1:5)
- Market orders + pending orders: limit, stop, stop-limit, **trailing stop**
- Server-enforced SL/TP auto-execution, margin call monitoring, 50% stop-out engine
- Daily swap accrual (22:00 UTC, triple Wednesday for FX/commodities), tier-based commissions ($2 → $0/lot), price-alert emails
- Demo ($10k virtual) and real modes sharing one account

**Money movement**
- Manual deposits (admin-approved) and automated BSC/Polygon USDT deposit scanner (viem, admin-approved crediting)
- Withdrawal requests with atomic balance holds, KYC gating, partner principal locks
- **Immutable financial ledger** (`transactions` table) — every balance mutation writes an append-only audit row in the same transaction (Peatio-style account versioning): deposits, withdrawal holds/refunds, commissions, trade PnL, swaps, stop-outs, CPA/rev-share, admin adjustments

**Growth / ops**
- Partner program: referral codes, CPA bonuses (≥$250 qualifying deposit), tiered lot rebates + $3 parent override, revenue share, seeded-capital milestone unlocks, pending→approved commission runs with clawbacks — full IB/Sub-IB specification in [docs/ib-sub-ib-programme.md](./docs/ib-sub-ib-programme.md)
- Admin back office: users, balances, KYC review, deposit/withdrawal queues, force-close positions, partner management, ledger audit view
- Clerk authentication, Resend transactional email, Tawk live chat, WalletConnect wallet linking

## Architecture

```
pnpm monorepo (TypeScript 5.9, ESM)
├── lib/
│   ├── db/               Drizzle ORM schema (17 tables) + drizzle-kit push config
│   ├── api-spec/         OpenAPI 3 spec (source of truth for API contracts)
│   ├── api-zod/          Orval-generated Zod request/response schemas
│   └── api-client-react/ Orval-generated typed React Query client
├── artifacts/
│   ├── api-server/       Express 5 API + ws WebSocket server
│   │   └── src/
│   │       ├── routes/        20 route modules (positions, orders, account, admin, …)
│   │       ├── middlewares/   requireAuth, requireAdmin, rate limits (per-userId)
│   │       ├── ws/            price streamer (SL/TP, stop-out, swap, alerts jobs) + deposit scanner
│   │           └── lib/       instruments catalog, trading math, ledger helper, market data providers
│   ├── veloztrade/       React SPA — 27 pages, shadcn/ui, wouter, TanStack Query, RainbowKit
│   └── mockup-sandbox/   dev-only UI canvas tool
└── Dockerfile / render.yaml / DEPLOY.md · DEPLOY_RENDER.md
```

Single service serves the SPA, `/api`, `/config.js` runtime config, and `/ws` WebSocket on one port — keeping auth cookies, CSP, and same-origin WS simple.

### Market data model

Real anchor prices are pulled from TwelveData (primary, batched), Finnhub/CoinGecko (fallbacks) every 60 s and persisted to `price_snapshots`. Between fetches, a mean-reverting random-walk simulation ticks prices once per second so charts always move. Symbols unavailable upstream are seeded from persisted snapshots or hardcoded fallbacks.

> ⚠️ **This is a simulated-market platform by design.** Trades execute against server-generated prices, not an external liquidity provider. See [Roadmap](#roadmap).

## Local development

Requirements: Node ≥ 22, pnpm 10 (Corepack), PostgreSQL (or a Neon string).

```bash
corepack enable
pnpm install

# push schema to your database (dev shortcut — production uses auto-migrations)
DATABASE_URL="postgresql://…sslmode=require" pnpm --filter @workspace/db run push

# run everything locally
PORT=8080 DATABASE_URL="postgresql://…" \
CLERK_PUBLISHABLE_KEY=pk_test_… CLERK_SECRET_KEY=sk_test_… \
  pnpm --filter @workspace/api-server run dev
```

Frontend dev server (hot reload): `pnpm --filter @workspace/veloztrade run dev`

### Tests & checks

```bash
pnpm run typecheck                        # workspace-wide tsc --noEmit
pnpm --filter @workspace/api-server test  # vitest unit tests (instruments, trading math)
```

## Deployment

See **[DEPLOY.md](./DEPLOY.md)** (Koyeb + Neon + Clerk free tier) or **[DEPLOY_RENDER.md](./DEPLOY_RENDER.md)**. Docker builds a self-contained image serving API + SPA.

Key environment variables: `PORT`, `DATABASE_URL`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `ALLOWED_ORIGINS`, `ADMIN_EMAILS`, optional `TWELVEDATA_API_KEY`, `RESEND_API_KEY`, `PLATFORM_USDT_DEPOSIT_ADDRESS`, `BSC_RPC_URL`, `POLYGON_RPC_URL`, one-time `BOOTSTRAP_SECRET`.

First admin: set `BOOTSTRAP_SECRET`, `POST /api/admin/bootstrap` while signed in, then remove it — or set `publicMetadata: {"role":"admin"}` in Clerk. `ADMIN_EMAILS` (comma-separated) grants admin by email as a fallback.

## Security

- Security findings baseline & audit trail: **[security-findings.md](./security-findings.md)** (CORS fix, BOLA fix, dependency overrides, accepted risks)
- All user-owned queries filter by `clerkUserId`; admin routes behind `requireAdmin` (role metadata **or** allowlisted email) + rate limits
- Helmet CSP tuned for Clerk/Turnstile/WalletConnect; frame-ancestors none
- Rate limits keyed by userId on all mutating routes; strict IP limit on `/admin/bootstrap`
- Report vulnerabilities privately to the maintainers — do not open public issues for security bugs

## Roadmap

Informed by a survey of leading OSS trading platforms ([Peatio](https://github.com/hpyhacking/peatio), [Eclipse Tradista](https://github.com/eclipse-tradista/tradista), [hummingbot](https://github.com/hummingbot/hummingbot), [freqtrade](https://github.com/freqtrade/freqtrade)):

- [ ] **Real liquidity**: route execution to an LP/exchange via CCXT or a FIX bridge; keep the simulator as demo-mode engine
- [ ] **Double-entry ledger**: extend `transactions` into balanced double-entry postings (Peatio model) + reconciliation job vs `accounts.balance`
- [ ] **Regenerate API clients** after new endpoints (`pnpm --filter @workspace/api-spec run generate`) so `/account/transactions` gets typed frontend hooks
- [ ] Adopt `lib/tradingMath.ts` at all existing PnL/margin call sites (currently duplicated inline)
- [ ] Integration tests against a throwaway Postgres (route-level, supertest)
- [ ] Copy-trading backend (page exists; needs leader/follower position mirroring engine)
- [x] Versioned SQL migrations (`drizzle-kit generate`) auto-applied at container start by `dist/migrate.mjs` — no manual schema push
- [ ] Observability stack (OTel traces)

## License

MIT
