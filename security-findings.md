# VelozTrade Security Findings

**Audit date:** 2026-06-14  
**Scope:** Dependency audit, SAST scan, HoundDog dataflow scan, manual BOLA review of all API routes  
**Tools:** pnpm audit, Semgrep (SAST), HoundDog, manual code review

---

## Summary

| Category | Findings | Fixed | Remaining |
|---|---|---|---|
| Dependency CVEs | 6 | 4 | 2 (accepted risk) |
| BOLA (broken object-level authorization) | 1 | 1 | 0 |
| SAST (XSS / insecure comms) | 12 | 0 (all false positives) | 0 |
| HoundDog (privacy/dataflow) | 0 | — | 0 |

---

## 1. Dependency CVEs

### Fixed via pnpm overrides (added to root `package.json`)

| CVE / Advisory | Package | Severity | Path | Fix Applied |
|---|---|---|---|---|
| GHSA-58qx-3vcg-4xpx | `ws <8.20.1` | Moderate | wagmi → walletconnect → ws | Override `>=8.20.1` |
| Advisory #1119441 | `uuid <11.1.1` | — | @google-cloud/storage → uuid | Override `>=11.1.1` |
| Advisory #1119502 | `qs >=6.11.1 <=6.15.1` | High | express → qs | Override `>=6.15.2` |
| GHSA-g7r4-m6w7-qqqr | `esbuild >=0.17.0 <0.28.1` | High | api-server → esbuild | Override `>=0.28.1` |
| GHSA-g7r4-m6w7-qqqr | `esbuild >=0.27.3 <0.28.1` | High | api-server → esbuild | Override `>=0.28.1` |

### Remaining (accepted risk)

| CVE / Advisory | Package | Severity | Path | Mitigation |
|---|---|---|---|---|
| GHSA-g7r4-m6w7-qqqr | `esbuild` via `vite` | High (1) + Low (1) | mockup-sandbox → vite → esbuild | **Windows dev-server only** — exploit requires attacker to send requests to the Vite dev server on a Windows machine. VelozTrade runs on Linux and the mockup-sandbox is a dev-only canvas preview tool, never exposed in production. No action required. |

---

## 2. BOLA — Broken Object-Level Authorization

BOLA is the most critical class of API vulnerability for trading platforms: an authenticated user accessing or mutating another user's resource by guessing a numeric ID.

### Fixed

**`artifacts/api-server/src/routes/orders.ts` — `PATCH /orders/:id/journal`**

The `SELECT` query before the `UPDATE` correctly verified ownership:
```sql
WHERE id = :id AND clerkUserId = :userId  -- SELECT ✓
```
But the `UPDATE` query used only:
```sql
WHERE id = :id  -- UPDATE ✗ (missing clerkUserId)
```
This allowed any authenticated user to modify journal notes, strategy tags, and sentiment ratings on any other user's closed trade by guessing a numeric order ID.

**Fix:** Added `and(eq(ordersTable.clerkUserId, userId))` to the UPDATE WHERE clause.

### All Other Routes — CONFIRMED CLEAN

Every other route was audited. All queries that read or mutate user-owned records include a `clerkUserId = userId` filter:

| Route file | Endpoints | BOLA status |
|---|---|---|
| `positions.ts` | GET, POST, GET /:id, PATCH /:id, DELETE /:id | ✅ All use clerkUserId filter |
| `pendingOrders.ts` | GET, POST, DELETE /:id | ✅ All use clerkUserId filter |
| `account.ts` | GET, PATCH, POST /deposit-request, POST /withdrawal-request, POST /kyc-submission, POST /update-push-token | ✅ All use clerkUserId filter |
| `alerts.ts` | GET, POST, DELETE /:id, PATCH /:id/trigger | ✅ All use clerkUserId filter |
| `orders.ts` | GET, PATCH /:id/journal | ✅ Fixed (see above) |
| `watchlist.ts` | GET, POST, DELETE /:symbol | ✅ All use clerkUserId filter |
| `fundsHistory.ts` | GET | ✅ Uses clerkUserId filter |
| `notifications.ts` | GET /my-notifications | ✅ Uses clerkUserId filter |
| `cryptoDeposit.ts` | GET, POST /submit, POST /register-wallet | ✅ Uses clerkUserId filter |
| `admin.ts` | All /admin/* routes | ✅ Protected by `requireAdmin` middleware |
| `leaderboard.ts` | GET | ✅ Intentionally public (no user-specific mutations) |
| `calendar.ts` | GET | ✅ Public market calendar (no user data) |
| `dashboard.ts` | GET /summary | ✅ Uses clerkUserId filter |
| `storage.ts` | POST /request-url | ✅ Auth-gated, path-scoped by userId |

---

## 3. SAST Findings — All False Positives

Semgrep flagged 12 issues. All were triaged as false positives:

| Finding | File | Verdict |
|---|---|---|
| HTML in template string (×9) | `notifications.ts` | **False positive** — code already applies `escHtml()` to all user-supplied values before interpolation |
| Unencrypted HTTP request | ~~`objectStorage.ts:247`~~ | **Resolved** — legacy object-storage module deleted from the codebase |
| Insecure WebSocket `ws://` | `use-websocket.tsx:44` | **False positive** — code correctly uses `wss://` when `window.location.protocol === "https:"` and `ws://` only on plain HTTP (dev) |
| Unsafe dynamic method | `mockup-sandbox/App.tsx:40` | **Accepted** — canvas sandbox is a dev-only tool; the dynamic call is sandboxed and not user-facing in production |

---

## 4. HoundDog Dataflow Scan

**0 findings.** No privacy violations, secret leaks, or sensitive data flows detected.

---

## 5. Remaining Known Risks (not fixed in this audit)

These are known gaps to be addressed in a follow-up hardening task:

| Risk | Status | Task |
|---|---|---|
| Rate limiting not applied to all mutating routes (account PATCH, withdrawal, deposit-request) | Not fixed here | Task #22 (Security hardening) |
| `/admin/bootstrap` endpoint is unauthenticated — relies on "no admin exists yet" logic | Not fixed here | Task #22 |
| `ALLOWED_ORIGINS` CORS config must be set to production domain before go-live | Documented — no code change needed | Set `ALLOWED_ORIGINS=https://<your-domain>` in the deployment environment |

---

## Recommendations

1. **Before going live:** Set `ALLOWED_ORIGINS` in your deployment environment to your production domain (e.g. `https://<your-app>.koyeb.app`). Leaving it empty allows all origins.
2. **Complete Task #22** (security hardening) to add rate limits to remaining routes and remove the bootstrap endpoint.
3. **Re-run this audit** after any new route is added. Use this file as the baseline.
