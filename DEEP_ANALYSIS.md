# VelozTrade Platform — Comprehensive Technical & Architectural Analysis

**Date:** March 2025
**Scope:** Repository-wide audit (Backend API, Trading Engine, Financial Ledger, Partner Program, On-Chain Scanner, Database Schema, Security Architecture, Frontend SPA, Build & Deployment Pipeline)

---

## 1. Executive Summary

VelozTrade is a full-stack retail trading platform supporting multi-asset CFDs (forex, crypto, stocks, commodities, indices), an admin back-office, multi-tier IB/Sub-IB partner program, manual and automated crypto deposit workflows, and server-enforced trading risk management.

### Key Architectural Strengths
- **Single-Container Monorepo Architecture:** Clean monorepo structure (`pnpm` + TypeScript 5.9 ESM) where Express 5, WebSocket streamer, and React SPA are served on a single port—eliminating cross-domain CORS issues and simplifying auth cookie handling.
- **Append-Only Financial Ledger (`transactions` table):** Account balance mutations write immutable audit rows with version numbers and balance snapshots (Peatio-inspired pattern).
- **TypeScript End-to-End Type Safety:** OpenAPI spec as source-of-truth generates Zod schemas (`api-zod`) and React Query hooks (`api-client-react`).
- **Comprehensive Partner Program Specification:** Supports IB and Sub-IB tiers, CPA bonuses with qualifying thresholds ($250 deposit), volume-tiered lot rebates, parent overrides, seeded capital locks, and idempotent pending → approved run workflows with clawback support.

---

## 2. Architecture & Subsystem Breakdown

### 2.1 Workspace Structure
```
pnpm monorepo
├── lib/
│   ├── db/               Drizzle ORM schema (17 tables) + PostgreSQL migration runner
│   ├── api-spec/         OpenAPI 3 spec (YAML source of truth)
│   ├── api-zod/          Orval-generated Zod request/response validation schemas
│   └── api-client-react/ Orval-generated typed TanStack Query client hooks
├── artifacts/
│   ├── api-server/       Express 5 server, WebSocket price streamer, crypto deposit scanner
│   ├── veloztrade/       React 19 SPA (shadcn/ui, Tailwind v4, wouter, RainbowKit, WalletConnect)
│   ├── mockup-sandbox/   Development UI component preview tool
│   ├── mobile-app/       Mobile application prototype
│   └── app-windows/      Electron desktop application wrapper
└── scripts/              Utility and operational scripts
```

---

## 3. Database Schema & Financial Ledger Analysis

### 3.1 Schema Design (`lib/db/src/schema.ts`)
The database contains **17 PostgreSQL tables** managed via Drizzle ORM:
1. `accounts` (real/demo balances, leverage, referred partner IDs, locked principal)
2. `positions` (open trades, entry prices, leverage, SL/TP levels, swap accruals)
3. `orders` (pending limit, stop, stop-limit, trailing stop orders)
4. `transactions` (append-only financial ledger)
5. `price_snapshots` (OHLC / market price persistence)
6. `price_alerts` (user price alerts)
7. `deposits` & `withdrawals` (money movement requests & state machine)
8. `kyc_records` (identity verification docs and statuses)
9. `partners`, `referrals`, `partner_commissions`, `partner_milestones` (IB/Sub-IB affiliate engine)
10. `crypto_deposit_addresses`, `scanned_blocks` (on-chain USDT scanner tracking)
11. `copy_trading_leaders`, `copy_trading_followers` (copy-trading metadata)
12. `notifications` (user notification log)

### 3.2 Ledger Integrity
- Every balance mutation (deposit approval, withdrawal hold/fulfillment/reversal, commission payout, trade close PnL, swap debit/credit, stop-out execution, admin adjustment) writes an audit row to `transactions`.
- Uses `recordTransaction` helper inside Drizzle database transactions (`tx`).
- Each entry records `account_version`, `balance_before`, `balance_after`, `type`, `amount`, and reference metadata.

---

## 4. Trading Engine, Math & Market Execution

### 4.1 Canonical Math (`lib/tradingMath.ts`)
- **Position PnL:** $\text{PnL} = (\text{ClosePrice} - \text{OpenPrice}) \times \text{Volume} \times \text{LotSize}$ for buys (reversed for sells).
- **Required Margin:** $\text{Margin} = \frac{\text{Price} \times \text{Volume} \times \text{LotSize}}{\text{Leverage}}$.
- **Margin Metrics & Risk Engine:**
  $$\text{Equity} = \text{Balance} + \text{Floating PnL}$$
  $$\text{Free Margin} = \text{Equity} - \text{Used Margin}$$
  $$\text{Margin Level (\%)} = \left(\frac{\text{Equity}}{\text{Used Margin}}\right) \times 100$$
- **Stop-Out Engine:** Automatically triggers forced position liquidation when `Margin Level < 50%`.

### 4.2 Price Streaming & Order Processing (`artifacts/api-server/src/ws/priceStreamer.ts`)
- Runs a 1-second interval loop broadcasting ticks across ~75 instruments.
- External anchor prices refreshed every 60s from TwelveData (fallback to Finnhub/CoinGecko).
- Mean-reverting random walk generates realistic sub-second tick noise between upstream fetches.
- Background worker evaluates SL/TP triggers, trailing stop adjustments, pending order executions, margin calls, and daily swap fees (22:00 UTC, triple Wednesday).

---

## 5. Partner / IB / Sub-IB Commission Engine

### 5.1 Architecture (`artifacts/api-server/src/lib/partnerProgram.ts`)
- **Qualification & CPA:** Triggered on approved deposits $\ge \$250$. Writes `pending` commission rows; guarded against double payouts per client via `referrals.cpaPaid`.
- **Volume Rebates & Overrides:**
  - Standard IB lot rebate: Tiered based on monthly volume ($2.00 to $5.00/lot).
  - Sub-IB parent override: $3.00/lot split to parent IB when Sub-IB clients trade.
- **Run Lifecycle:**
  - Accruals write `pending` rows.
  - End-of-month or admin-triggered `approveCommissionRun` atomically moves `pending` $\to$ `approved`, credits trading balance & commission wallet, and logs ledger transactions.
  - `reverseCommission` supports pending cancellation and approved line clawbacks.

---

## 6. On-Chain USDT Deposit Scanner

### 6.1 Scanner Workflow (`artifacts/api-server/src/ws/depositScanner.ts`)
- Uses `viem` to scan EVM chains (BSC, Polygon) for `Transfer` events on USDT ERC20/BEP20 contracts to platform deposit addresses.
- Maintains `scanned_blocks` table to track progress and handle chain reorgs safely.
- Auto-detects matching user deposit records or creates pending crypto deposit records for admin crediting review.

---

## 7. Security, Access Control & Quality Assessment

### 7.1 Authentication & Authorization
- **Authentication:** Clerk integration (`@clerk/express`) with custom session verification middleware (`requireAuth`).
- **RBAC:** `requireAdmin` middleware checks Clerk public metadata `role === "admin"` or `ADMIN_EMAILS` allowlist.
- **BOLA / IDOR Prevention:** User-facing queries strictly bind `clerkUserId` from session context rather than client payload params.

### 7.2 Safety Controls & Defensive Design
- Strict rate limiting on mutating routes (`rateLimit` per user ID) and dedicated IP rate limiting on `/admin/bootstrap`.
- Helmet HTTP security headers configured with Content Security Policy (CSP), frame-ancestors block, and strict CORS handling.

---

## 8. Technical Debt & Strategic Roadmap Recommendations

1. **Double-Entry Ledger Extension:** Evolve single-entry `transactions` table into balanced double-entry debit/credit postings with automated balance reconciliation background workers.
2. **External LP Bridge / CCXT / FIX Engine:** Provide real liquidity routing fallback alongside the existing simulated tick engine.
3. **Trading Math Unification:** Standardize remaining legacy inline PnL calculations across older API endpoints to strictly invoke `computeMarginMetrics` / `computePositionPnl`.
4. **Integration & E2E Test Suite:** Expand Vitest coverage with Postgres test container integration tests for order execution routes and deposit workflows.

---

## 9. Conclusion

The VelozTrade codebase exhibits strong software engineering standards with a modular ESM monorepo layout, explicit transactional ledger accounting, strict TypeScript type checking, and robust risk management math. All automated workspace typechecks and unit tests pass cleanly.
