# Deploy VelozTrade free — Render (Docker, single service)

This repo already has a `Dockerfile` that builds API + frontend together and serves both on `:8080`.
Render's free tier builds the Docker remotely (no local Docker needed) and gives you a free Postgres.

## 1-click via dashboard (recommended)

1. Push this folder to GitHub (see step 0 below)
2. https://dashboard.render.com → New → Blueprint → connect your GitHub repo → `render.yaml` is auto-detected
3. Render creates:
   - `veloztrade` web service (Docker, `healthCheckPath: /api/healthz`, free)
   - `veloztrade-db` Postgres (free, 90-day expiry, auto-renew by redeploy)
4. In Render dashboard → `veloztrade` → Environment → add:
   ```
   ***REMOVED***
   ***REMOVED***
   # optional:
   # TWELVEDATA_API_KEY=
   # FINNHUB_API_KEY=
   ```
   `DATABASE_URL` and `PORT` are already set from `render.yaml`.
5. Deploy → logs show `Server listening port:8080` + `Loaded persisted prices`
6. Open `https://veloztrade-xxxx.onrender.com` → sign in via Clerk (custom domain `clerk.veloztrade.com` is whitelisted in CSP at `artifacts/api-server/src/app.ts:27`).

## 0. Push to GitHub (first time)

```bash
cd ~/veloztrade-platform/vtmp
git init
git add -A
git commit -m "VelozTrade — Render ready (Docker + live Clerk keys, CSP fix for clerk.veloztrade.com)"
git branch -M main
gh repo create veloztrade --public --source=. --remote=origin --push
# or manually: create empty repo on github.com, then:
# git remote add origin git@github.com:<you>/veloztrade.git
# git push -u origin main
```

## Local Docker test (optional, if you have Docker)

```bash
docker build -t veloztrade .
docker run -p 8080:8080 \
  -e DATABASE_URL=postgresql://veloz:veloz_local_dev@host.docker.internal:5432/veloztrade \
-e ***REMOVED***
-e ***REMOVED***
  veloztrade
```

## Koyeb + Neon alternative (also free, no credit card, always-on)

See `DEPLOY.md` already in repo: Koyeb free web service + Neon Postgres pooled URL. Same env vars.

## Vercel note

Vercel is serverless — it can't host the persistent WebSocket price streamer (`ws/priceStreamer.ts`). Use Vercel only for frontend static if you split the stack; keep API on Render/Koyeb.

