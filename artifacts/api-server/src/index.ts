import http from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { setupWebSocket } from "./ws/priceStreamer";
import { setupDepositScanner } from "./ws/depositScanner";

// ── Boot safety nets ────────────────────────────────────────────────────────
// A silent death here looks identical to a port mismatch from the platform's
// health checker ("service unavailable" retry loop with empty logs). Route
// EVERY fatal path through stderr so deploys always fail with a reason.
process.on("uncaughtException", (err) => {
  console.error("[boot:fatal] uncaughtException:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("[boot:fatal] unhandledRejection:", reason);
});

console.log("[boot] starting — node", process.version);

// PORT is injected by every platform (Railway, Render, Koyeb, Docker).
// Default to 8080 (the image's EXPOSE) instead of crashing when a host
// forgets to inject it — a silent-looking "service unavailable" health-check
// loop is far worse than listening on a sane default.
const rawPort = process.env["PORT"] ?? "8080";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = http.createServer(app);

setupWebSocket(server);
setupDepositScanner(logger);

console.log("[boot] imports ok, binding server…");

// ── Port strategy ───────────────────────────────────────────────────────────
// Platforms differ in how they decide which port to health-check:
//   - Render/Koyeb/Docker respect EXPOSE (8080) or inject PORT
//   - Railway probes its configured Target Port, DEFAULTING TO 80 for
//     Dockerfile services and injecting NO PORT env var.
// A single-port bind therefore boot-loops deploys whenever those disagree.
// Solution: always bind the primary port, PLUS an auxiliary listener on the
// conventional probe port (TARGET_PORT env or 80). Whichever door the
// platform knocks on, someone answers.
const auxPortRaw = process.env.TARGET_PORT ?? "80";
const auxPort = Number(auxPortRaw);

function listenAux(target: number): void {
  if (!Number.isInteger(target) || target <= 0 || target === port) return;
  const aux = http.createServer(app);
  aux.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EACCES") {
      console.log(`[boot] auxiliary port ${target} not permitted in this environment — skipping`);
      return;
    }
    console.log(`[boot] auxiliary port ${target} unavailable (${err.message}) — skipping`);
  });
  aux.listen(target, "0.0.0.0", () => {
    console.log(`VelozTrade also listening on http://0.0.0.0:${target} (platform probe compatibility)`);
  });
}

server.listen(port, "0.0.0.0", () => {
  // Plain-text line (in addition to the structured pino entry) so the bound
  // port is unmistakable when scanning platform deploy logs for the value
  // that must match the platform's health-check/probe target port.
  console.log(`VelozTrade listening on http://0.0.0.0:${port} (PORT=${rawPort})`);
  logger.info({ port }, "Server listening");
  listenAux(auxPort);
});

server.on("error", (err) => {
  logger.error({ err }, "Server error");
  process.exit(1);
});
