# Deploying VelozTrade — Railway / Render / Vercel

| Platform | API + WebSocket + background jobs | Verdict |
|---|---|---|
| **Railway** | ✅ Always-on Docker, native WS | **Best single-platform fit** (~$5/mo hobby) |
| **Render** | ⚠️ Works, but `free` plan sleeps after 15 min idle → breaks price stream / SL-TP engine. Use `starter` ($7/mo) | Good paid option; blueprint included (`render.yaml`) |
| **Vercel** | ❌ Impossible for the backend — serverless has no persistent process: no WebSocket server, no `setInterval` jobs (SL/TP, stop-out, deposit scanner) | Frontend-only split hosting at most |

The app is one Node process serving SPA + REST + `/ws` on a single port — any always-on container host runs it unchanged via the root `Dockerfile`.

---

## Option A — Railway (recommended)

1. Push this repo to GitHub (done — `shamhar07-max/VelozTrading`).
2. https://railway.app → **New Project → Deploy from GitHub repo** → select `VelozTrading`.
   Railway reads `railway.toml` (Dockerfile build, health check `/api/healthz`) automatically.
3. Create the database first (Neon free tier, permanent): https://neon.com → copy the **pooled** string
   `postgresql://…ep-xxx-pooler….aws.neon.tech/neondb?sslmode=require`
4. In Railway → your service → **Variables**, add:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Neon pooled string |
   | `CLERK_PUBLISHABLE_KEY` | `pk_test_…` from dashboard.clerk.com |
   | `CLERK_SECRET_KEY` | `sk_test_…` |
   | `ADMIN_EMAILS` | `you@example.com` |
   | `ALLOWED_ORIGINS` | `https://<your-app>.up.railway.app` (set AFTER you have the domain) |
   | `TWELVEDATA_API_KEY` | optional but recommended (real anchor prices) |

5. **Networking → Generate Domain** (Railway injects `PORT` automatically — no config needed).
6. Wait for the health check to pass (`/api/healthz`).

### One-time schema push (from your machine)

```bash
cd VelozTrading
DATABASE_URL="<same neon pooled string>" pnpm --filter @workspace/db run push
```

(The runtime image ships no source/drizzle-kit on purpose — schema changes are a controlled local step.)

### First admin

```bash
curl -X POST https://<your-app>.up.railway.app/api/admin/bootstrap \
  -H "Authorization: Bearer <BOOTSTRAP_SECRET or generated value>" \
  -H "Content-Type: application/json" -d '{"clerkUserId":"user_…"}'
```
Then delete `BOOTSTRAP_SECRET` from Railway variables. (Or set Clerk metadata `{"role":"admin"}` directly.)

---

## Option B — Render

1. https://dashboard.render.com → **New → Blueprint** → connect `VelozTrading`.
   Render reads `render.yaml`.
2. Fill the prompted variables: `DATABASE_URL` (Neon), Clerk keys, `ADMIN_EMAILS`, then deploy.
3. After first deploy set `ALLOWED_ORIGINS=https://<app>.onrender.com`.
4. Run the same schema push + bootstrap steps as above.

> Free plan caveats baked into `render.yaml`: it sleeps after 15 min idle and its free Postgres expires in 30 days — upgrade the service to **starter** for real use; keep Neon for the DB.

---

## Option C — Vercel (frontend only)

Vercel cannot host this API (no long-running process ⇒ no WebSocket, no trading-engine timers). Two workable shapes:

1. **Not recommended:** split deploy — static SPA on Vercel + API still on Railway/Render.
   - Build command: `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @workspace/veloztrade run build`
   - Output dir: `artifacts/veloztrade/dist/public`
   - Env (build time): `VITE_API_URL=https://<api-host>`, `VITE_WS_URL=wss://<api-host>`, `VITE_CLERK_PUBLISHABLE_KEY=pk_test_…`
   - On the API host: add the Vercel domain to `ALLOWED_ORIGINS`
   - ⚠️ Known issue (documented in DEPLOY.md): Clerk cookies may not flow cross-origin → 401s unless you switch the frontend to Bearer-token auth.
2. **Better:** keep everything on one always-on host (Railway/Render/Koyeb). Vercel adds nothing here but cost and cookie complexity.

---

## Post-deploy checklist (all platforms)

- [ ] `/api/healthz` returns `{"status":"ok"}`
- [ ] Schema pushed (`transactions` table exists)
- [ ] Admin granted; `BOOTSTRAP_SECRET` removed
- [ ] `ALLOWED_ORIGINS` = exact production origin (never empty with real users)
- [ ] Prices streaming on `/ws`; demo account tradable end-to-end
- [ ] Real-money features OFF until licensing/compliance questions are resolved (see README Roadmap)
