# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable

# Non-interactive corepack + pnpm (packageManager field pins pnpm@10.26.0)
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    CI=true

# Skip the ~150MB Chromium download — PDF export degrades gracefully without it;
# the /api/export-pdf route degrades gracefully without a browser binary.
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Frontend build-time config (public, non-secret values).
# The Clerk publishable key is NOT baked here — Express injects it at runtime
# via /config.js, so rotating keys doesn't require a rebuild.
ARG VITE_TAWK_PROPERTY_ID=6a20af1ba7b9da1c3462fbef
ARG VITE_TAWK_WIDGET_ID=1jq7qo14i
ARG VITE_WALLETCONNECT_PROJECT_ID=placeholder
ARG VITE_PLATFORM_USDT_DEPOSIT_ADDRESS=0xe284557913137BFe780276469C9319D653361bbd
ENV VITE_TAWK_PROPERTY_ID=$VITE_TAWK_PROPERTY_ID \
    VITE_TAWK_WIDGET_ID=$VITE_TAWK_WIDGET_ID \
    VITE_WALLETCONNECT_PROJECT_ID=$VITE_WALLETCONNECT_PROJECT_ID \
    VITE_PLATFORM_USDT_DEPOSIT_ADDRESS=$VITE_PLATFORM_USDT_DEPOSIT_ADDRESS

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json tsconfig.base.json ./
COPY lib ./lib
COPY artifacts ./artifacts

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/api-server run build \
 && pnpm --filter @workspace/veloztrade run build \
 && pnpm --filter @workspace/mobile-app run build

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production

# Full workspace node_modules: the esbuild bundle externalizes native modules,
# and pino transports load files at runtime.
COPY --from=build /app/node_modules ./node_modules
# pnpm installs workspace deps in per-package node_modules (symlinks into the
# root store). Externalized packages (e.g. puppeteer) resolve from here.
COPY --from=build /app/artifacts/api-server/node_modules ./artifacts/api-server/node_modules
COPY --from=build /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=build /app/artifacts/veloztrade/dist ./artifacts/veloztrade/dist
COPY --from=build /app/artifacts/mobile-app/dist ./artifacts/mobile-app/dist
# Versioned SQL migrations — applied automatically by dist/migrate.mjs at startup
COPY --from=build /app/lib/db/drizzle ./migrations

EXPOSE 8080
# Auto-migrate on boot, then start the server. Migrations are idempotent and
# guarded by a Postgres advisory lock, so restarts and replicas are safe.
# If the main server crashes at boot, the rescue diagnostic server takes the
# port so deployments always answer with the failure reason instead of a
# silent 503 (see railway.toml startCommand for the same chain).
CMD ["sh", "-c", "(node --enable-source-maps artifacts/api-server/dist/migrate.mjs || true) && { node --enable-source-maps artifacts/api-server/dist/index.mjs || node --enable-source-maps artifacts/api-server/dist/rescue.mjs; }"]
