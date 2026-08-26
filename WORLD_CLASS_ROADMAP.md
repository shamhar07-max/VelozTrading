# VelozTrade — World-Class CFD Platform Vision & Actionable Roadmap

**Document ID:** VEL-ROADMAP-2026-V1
**Date:** August 2026
**Classification:** Strategic Engineering Blueprint & Implementation Roadmap

---

## Executive Summary & Architectural Vision

VelozTrade is currently an enterprise-ready, full-stack retail trading platform built with a modern TypeScript monorepo architecture:
- **Frontend:** React SPA powered by Vite, Tailwind CSS, shadcn/ui, wouter, TanStack Query, and RainbowKit (`artifacts/veloztrade`).
- **Backend API:** Express 5 REST and WebSocket server (`artifacts/api-server`).
- **Data & Storage:** PostgreSQL database managed via Drizzle ORM (`lib/db`).
- **Contracts & Specs:** OpenAPI 3 specification (`lib/api-spec`), Orval-generated Zod schemas (`lib/api-zod`), and typed React Query client (`lib/api-client-react`).

To evolve VelozTrade from a simulated retail engine into an institutional-grade, world-class CFD trading venue, this document outlines an actionable 4-pillar blueprint covering liquidity routing, high-frequency execution, pro-level charting/dealing UI, institutional accounting, multi-currency sub-accounts, and automated compliance.

---

## Pillar 1: Architectural & Execution Engine Focus

### 1.1 ECN / STP Liquidity Routing & Hybrid Book Execution
- **A-Book Pass-Through:** Integrate real Liquidity Providers (LPs) via standard FIX Protocol (FIX 4.4 / 5.0) engine and CCXT REST/WS connectors for crypto venues.
- **Smart Order Router (SOR):** Implement hybrid A/B-Book execution rules based on client risk profiling, position volume, asset class volatility, and internal toxicity scoring.
- **B-Book Internal Warehousing:** Retain internal matching engine for low-latency retail flow with automated net-hedging thresholds on LP venues.

### 1.2 High-Frequency Market & Streaming Engine
- **Sub-10ms Tick Streaming:** Transition market data distribution to binary WebSockets (Protobuf / FlatBuffers) and gRPC internal microservices for order placement.
- **Level 2 / Level 3 Depth of Market (DOM):** Broadcast order book aggregated depth across price levels; provide DOM ladder visualization on the frontend.
- **Slippage & Market Impact Simulation:** Implement realistic execution slippage models based on DOM order depth and market volatility.

### 1.3 Dynamic Tiered Leverage & Risk Rules
- **Dynamic Tiered Leverage Decay:** Automatically scale down allowable leverage based on position lot volume (e.g., FX 1:1000 up to 5.0 lots, 1:500 for 5.01–20.0 lots, 1:200 above 20 lots).
- **Server-Enforced Negative Balance Protection (NBP):** Ensure atomic stop-out liquidation prevents negative account equity, zeroing balance automatically if extreme gaps occur.

---

## Pillar 2: Pro Trading UI / UX & Charting

### 2.1 TradingView Technical Analysis Library Integration
- **Full Charting Suite:** Upgrade from basic lightweight charts to TradingView Technical Analysis Library with 100+ technical indicators, multi-timeframe analysis, and drawing tools.
- **PineScript Runner Integration:** Provide custom indicator loading and execution overlay on client charts.
- **Multi-Chart Grids:** Enable 2x2 and 4x4 split grid views for multi-asset monitoring.

### 2.2 Pro Trading Workspace & Dealing Tools
- **One-Click Chart Trading:** Place, modify, and drag Stop Loss / Take Profit lines directly on the chart interface.
- **Monetary SL/TP Risk Calculator:** Interactive order form calculating exact USD risk, percentage of account equity, and risk-to-reward ratio before order placement.
- **Pro Dealing Themes & Hotkeys:** Customizable dealing keybindings (e.g., `Shift+B` for Buy, `Shift+S` for Sell, `Esc` to cancel pending orders) and dark/lightDealing UI themes.

### 2.3 Algorithmic Strategy Runner & Backtesting Sandbox
- **In-Browser Backtester:** JavaScript/Python strategy sandbox enabling historical backtesting against tick data snapshots.
- **Automated Bot Execution:** WebWorker-isolated bot execution engine connected to WebSocket order routes.

---

## Pillar 3: Institutional Accounting, Multi-Currency & Compliance

### 3.1 Double-Entry Accounting Engine
- **Balanced Postings Model:** Extend existing append-only financial ledger (`transactions` table) into balanced double-entry Debit/Credit ledger postings (Peatio model).
- **Automated Reconciliation Cron Jobs:** Scheduled nightly jobs verifying `SUM(debits) == SUM(credits)` across user balances, LP clearing accounts, and platform treasury.

### 3.2 Multi-Currency Sub-Accounts & Instant Exchange
- **Multi-Currency Wallets:** Allow users to open and hold sub-accounts in USD, EUR, GBP, JPY, USDT, and BTC.
- **Instant Internal Exchange:** Live rate conversion between sub-accounts with zero slippage and configurable exchange markup.

### 3.3 Automated KYC & RegTech Compliance
- **Sumsub / Persona Integration:** Automated identity verification, liveness checks, proof of address, and PEP/sanctions screening.
- **Regulatory Reporting Exports:** Automated export engines for MiFID II / EMIR transaction reporting compliance formats (CSV/XML).

---

## Pillar 4: Phased Actionable Roadmap & Execution Timeline

| Phase | Core Deliverable | Key Engineering Artifacts | Timeline |
|---|---|---|---|
| **Phase 1** | Standalone Strategy Blueprint & Documentation | `WORLD_CLASS_ROADMAP.md` complete | Month 1 |
| **Phase 2** | Double-Entry Ledger & Multi-Currency Schema | Drizzle migrations for balanced double-entry & sub-accounts | Month 2 |
| **Phase 3** | Pro Dealing UX & TradingView Integration | TradingView TA library, monetary risk calculator, hotkeys | Month 3–4 |
| **Phase 4** | ECN/FIX LP Router & Binary Tick Engine | FIX engine, binary WS tick streamer, DOM order book | Month 5–6 |

---

## Summary & Next Steps

This document serves as the master blueprint for scaling VelozTrade into an institutional-grade CFD platform. All future development sprints can reference this roadmap for architectural decisions and phase milestones.
