# VelozTrade — Free Hosting Deployment Guide

Target stack (verified $0/month as of 2026):

| Component | Service | Free tier |
|-----------|---------|-----------|
| App (API + WebSocket + frontend) | **Koyeb** | 1 web service, always-on, native WebSocket, no spin-down |
| PostgreSQL | **Neon** | 0.5 GB storage, autosuspend |
| Auth | **Clerk** dev instance | 10k MAU |
| Market data | TwelveData / Finnhub / CoinGecko | 800 credits/day / 60 req/min / keyless |

**Architecture: single Koyeb service.** Express already serves the built React SPA,
`/config.js` runtime config, and the `/ws` WebSocket on one port — so auth cookies,
WebSocket same-origin, and CSP all keep working with zero split-hosting complexity.
A Cloudflare Pages split deployment is documented at the bottom as an optional upgrade.

---

## Step 1 — Neon database

1. Sign up at https://neon.com (GitHub login works)
2. Create project → region close to Koyeb region (e.g. AWS us-east-1)
3. Copy the **pooled** connection string (Dashboard → Connection Details → toggle "Pooled"):
   `postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require`

## Step 2 — Push the DB schema (one-time, from your machine)

```bash
cd Veloz-Trade   # repo root
DATABASE_URL="postgresql://...pooler...neondb?sslmode=require" \
  pnpm --filter @workspace/db run push
```

## Step 3 — Push to GitHub

The folder is not a git repo yet:

```bash
git init
git add -A
git commit -m "Prepare for Koyeb deployment"
git remote add origin git@github.com:<you>/veloz-trade.git
git push -u origin main
```

(Or create the repo on github.com first and push there.)

## Step 4 — Clerk app

1. https://dashboard.clerk.com → Create application (free dev instance)
2. Copy **Publishable key** (`pk_test_...`) and **Secret key** (`sk_test_...`)

## Step 5 — Koyeb service

1. https://app.koyeb.com → Create Web Service → GitHub repo
2. Builder: **Dockerfile** (repo root)
3. Instance: **Free**
4. Port: `8080`
5. Health check: HTTP `/api/healthz`
6. Add environment variables (below) → Deploy

First build takes ~5–10 min (pnpm install + esbuild + vite build).

### Environment variables

| Variable | Required | Value |
|----------|----------|-------|
| `PORT` | ✅ | `8080` |
| `DATABASE_URL` | ✅ | Neon pooled connection string |
| `CLERK_PUBLISHABLE_KEY` | ✅ | `pk_test_...` |
| `CLERK_SECRET_KEY` | ✅ | `sk_test_...` |
| `TWELVEDATA_API_KEY` | recommended | primary market data (800 credits/day free) |
| `FINNHUB_API_KEY` | optional | fallback provider (60 req/min free) |
| `ALLOWED_ORIGINS` | recommended | `https://<your-app>.koyeb.app` |
| `APP_URL` | recommended | `https://<your-app>.koyeb.app` (used in emails) |
| `ADMIN_NOTIFICATION_EMAIL` | recommended | your email |
| `RESEND_API_KEY` | recommended | from resend.com (free 100 emails/day) — enables transactional emails |
| `RESEND_FROM_EMAIL` | optional | defaults to `onboarding@resend.dev` |
| `PLATFORM_USDT_DEPOSIT_ADDRESS` | if deposits used | your USDT (BSC/Polygon) address |
| `BSC_RPC_URL` | if deposits used | e.g. a public BSC RPC endpoint |
| `POLYGON_RPC_URL` | if deposits used | public Polygon RPC endpoint |
| `BOOTSTRAP_SECRET` | first run only | strong random value; remove after granting admin |
| `LOG_LEVEL` | optional | `info` |

CoinGecko crypto fallback needs no key.

### First admin grant

With `BOOTSTRAP_SECRET` set:

```bash
curl -X POST https://<your-app>.koyeb.app/api/admin/bootstrap \
  -H "Authorization: Bearer <BOOTSTRAP_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"clerkUserId":"user_..."}'
```

Then **remove** `BOOTSTRAP_SECRET` from env. Alternative: set Clerk metadata
directly in the Clerk dashboard (Users → your user → Public metadata:
`{"role":"admin"}`).

---

## Feature notes on Koyeb free tier

| Feature | Status | Fix |
|---------|--------|-----|
| Emails (alerts, admin notify) | Works via direct Resend API (`RESEND_API_KEY`); skipped with a warning if unset | — |
| KYC document uploads | Removed (no file-storage backend) — KYC submits text data only; add S3/R2 integration if you need document images | Integrate S3/R2 |
| PDF export (`/api/export-pdf`) | Broken (no Chromium in image) | Add Chromium to Dockerfile if needed |
| Crypto deposit scanner | Works (`BSC_RPC_URL`/`POLYGON_RPC_URL` set) | — |

---

## Optional upgrade — Cloudflare Pages split deployment

Serve only static assets from Cloudflare Pages (unlimited bandwidth) and keep the
API on Koyeb. The code is already wired for this:

- Frontend reads `VITE_API_URL` (REST base) and `VITE_WS_URL` (WebSocket base) at build time
- Backend CORS honors `ALLOWED_ORIGINS`

1. Cloudflare Pages → connect the same GitHub repo
2. Build command: `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @workspace/veloztrade run build`
3. Output directory: `artifacts/veloztrade/dist/public`
4. Env vars (build): `VITE_API_URL=https://<your-app>.koyeb.app`, `VITE_WS_URL=wss://<your-app>.koyeb.app`,
   plus `VITE_CLERK_PUBLISHABLE_KEY=pk_test_...`
5. On Koyeb set `ALLOWED_ORIGINS=https://<project>.pages.dev`

Note: with split origins, Clerk session cookies may not reach the API cross-site;
if authenticated calls return 401, stay on the single-service deployment or add
Bearer-token auth (`setAuthTokenGetter`) to the frontend.

## Custom domain (optional)

Point a Cloudflare-managed domain at the Koyeb service (CNAME to the Koyeb
endpoint) for free CDN + SSL in front of the app.
