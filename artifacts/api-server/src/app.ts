import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Security headers — applied to all responses.
// CSP is calibrated for the VelozTrade React SPA:
//   - script-src  : self + Clerk JS CDN (dev & production proxy path)
//   - connect-src : self (REST + WS proxy) + Clerk FAPI + bare wss: for WS handshake
//   - img-src     : self + data: + CDNs for instrument icons, flags, QR codes
//   - style-src   : unsafe-inline required by Clerk components and shadcn/ui
//   - object-src  : none  — blocks Flash/plugin attack surface
//   - frame-ancestors: none — prevents clickjacking
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          // Clerk JS bundle CDN (dev instances load from here)
          "https://*.clerk.accounts.dev",
          // Clerk production CDN
          "https://clerk.com",
          "https://*.clerk.com",
          // Clerk custom domain for VelozTrade live keys
          "https://clerk.veloztrade.com",
          "https://*.veloztrade.com",
          "https://veloztrade.com",
          // Cloudflare Turnstile — Clerk's CAPTCHA provider for bot protection
          "https://challenges.cloudflare.com",
        ],
        // Clerk bot-protection CAPTCHA runs inside a Cloudflare Turnstile iframe.
        // Without frame-src the default-src 'self' fallback blocks it entirely.
        frameSrc: [
          "'self'",
          "https://challenges.cloudflare.com",
          "https://*.clerk.accounts.dev",
          "https://*.clerk.com",
          "https://clerk.veloztrade.com",
          "https://*.veloztrade.com",
        ],
        styleSrc: [
          "'self'",
          // Clerk UI components and shadcn/ui use inline styles
          "'unsafe-inline'",
          // Google Fonts stylesheet
          "https://fonts.googleapis.com",
        ],
        imgSrc: [
          "'self'",
          "data:",
          // Clerk user avatars + OAuth provider icons (Google, GitHub, etc.)
          "https://img.clerk.com",
          "https://clerk.veloztrade.com",
          "https://*.clerk.veloztrade.com",
          // Crypto currency icons (spothq/cryptocurrency-icons via jsDelivr)
          "https://cdn.jsdelivr.net",
          // Forex country flags
          "https://flagcdn.com",
          // Stock ticker logos
          "https://img.logo.dev",
          // QR codes for crypto deposit addresses
          "https://api.qrserver.com",
        ],
        // Clerk and WalletConnect create web workers from blob: URLs
        workerSrc: ["'self'", "blob:"],
        connectSrc: [
          "'self'",
          // WebSocket price stream (wss:// handshake + frames)
          "wss:",
          // Twelve Data market data API (live quotes, candles, batch prices)
          "https://api.twelvedata.com",
          // Fallback market data providers (server-side fetch)
          "https://api.finnhub.io",
          "https://api.coingecko.com",
          // Clerk Frontend API — dev instances
          "https://*.clerk.accounts.dev",
          // Clerk Frontend API — proxied production path is 'self', but
          // keep the canonical FAPI origin for environments without the proxy
          "https://frontend-api.clerk.dev",
          "https://clerk.com",
          "https://*.clerk.com",
          // Clerk custom domain (VelozTrade live keys)
          "https://clerk.veloztrade.com",
          "https://*.clerk.veloztrade.com",
          "https://veloztrade.com",
          "https://*.veloztrade.com",
          // Clerk telemetry (non-blocking but suppresses CSP noise)
          "https://clerk-telemetry.com",
          // Cloudflare Turnstile CAPTCHA (Clerk bot protection)
          "https://challenges.cloudflare.com",
          // Exchange rate data used in the app
          "https://api.exchangerate-api.com",
          // WalletConnect / Reown peer discovery, relay, and remote config
          "https://pulse.walletconnect.org",
          "https://api.web3modal.org",
          "https://*.walletconnect.com",
          "https://*.walletconnect.org",
          "wss://relay.walletconnect.com",
          "wss://*.walletconnect.com",
          "wss://*.walletconnect.org",
        ],
        fontSrc: [
          "'self'",
          // Google Fonts — actual font files served from here
          "https://fonts.gstatic.com",
        ],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    // Belt-and-suspenders for older browsers that don't honour CSP frame-ancestors
    frameguard: { action: "deny" },
    // Cross-origin policies — tighten once a CDN/subdomains are finalised
    crossOriginEmbedderPolicy: false,
    // Base Account (Coinbase) Smart Wallet requires COOP to be 'same-origin-allow-popups'
    // otherwise the SDK cannot communicate with its popup window.
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// FIX: Explicit CORS allowlist — origin:true with credentials:true allowed ANY site
// to make credentialed requests using the user's session cookie, which is a critical
// security vulnerability. Now restricted to known origins only.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl, mobile apps)
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Public endpoints — must be before Clerk so health probes and runtime config work
// without valid Clerk keys and without authentication. This is critical for
// local deploys with placeholder keys (pk_test_REPLACE_ME) and for Docker/Koyeb
// health checks that must return 200 even before Clerk is configured.
app.get("/api/healthz", (_req, res) => {
  // Runtime details make remote deployment debugging possible: if a probe or
  // browser reaches this route, the payload proves WHICH process answered.
  res.json({
    status: "ok",
    node: process.version,
    pid: process.pid,
    uptimeSec: Math.round(process.uptime()),
  });
});

const __dirnameForConfig = path.dirname(fileURLToPath(import.meta.url));
const runtimeConfig = {
  clerkPublishableKey: process.env.CLERK_PUBLISHABLE_KEY ?? "",
};
const configJs = `window.__VELOZTRADE_CONFIG__ = ${JSON.stringify(runtimeConfig)};`;

app.get("/config.js", (_req, res) => {
  res.setHeader("Content-Type", "application/javascript");
  res.send(configJs);
});

const clerkPubKeyRaw = process.env.CLERK_PUBLISHABLE_KEY ?? "";
const hasValidClerkKey =
  (clerkPubKeyRaw.startsWith("pk_test_") || clerkPubKeyRaw.startsWith("pk_live_")) &&
  !clerkPubKeyRaw.includes("REPLACE_ME") &&
  clerkPubKeyRaw.length > 20;

if (hasValidClerkKey) {
  // Use Clerk's default env-based config — it reads CLERK_SECRET_KEY and
  // CLERK_PUBLISHABLE_KEY from process.env. Don't use publishableKeyFromHost
  // here (that helper is for the frontend's <ClerkProvider> and requires a
  // hostname for pk_live_ keys, causing "Host must not be empty" on the backend).
  app.use(clerkMiddleware());
} else {
  logger.warn(
    "CLERK_PUBLISHABLE_KEY missing or placeholder — Clerk auth disabled. Set real keys from dashboard.clerk.com for full auth. Health check and static assets remain available.",
  );
  app.use((_req, _res, next) => next());
}

app.use("/api", router);

// ── Serve the React frontend (production) ───────────────────────────────────
// The Vite build writes the SPA to artifacts/veloztrade/dist/public/.
// Resolve relative to this compiled file so the path is correct regardless
// of the working directory when the server is started.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(__dirname, "../../veloztrade/dist/public");
// index: false — prevents express.static from auto-serving index.html for GET /
// so that the SPA fallback below can inject the runtime config into it first.
app.use(express.static(frontendDist, { index: false }));

// (runtimeConfig and /config.js already defined above before Clerk — see public endpoints section)

// SPA fallback — all non-API routes return index.html so client-side routing works.
// Injects <script src="/config.js"> before </head> so the runtime config is
// available before the app bundle runs.
// Express 5 / path-to-regexp v8 requires a named wildcard parameter syntax.
app.get("/{*path}", (_req, res) => {
  const indexPath = path.join(frontendDist, "index.html");
  try {
    const html = fs.readFileSync(indexPath, "utf-8");
    const injected = html.replace(
      "</head>",
      `<script src="/config.js"></script></head>`,
    );
    res.setHeader("Content-Type", "text/html");
    res.send(injected);
  } catch {
    res.status(404).send("Not found");
  }
});

export default app;
