import http from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { setupWebSocket } from "./ws/priceStreamer";
import { setupDepositScanner } from "./ws/depositScanner";

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

server.listen(port, () => {
  // Plain-text line (in addition to the structured pino entry) so the bound
  // port is unmistakable when scanning platform deploy logs for the value
  // that must match the platform's health-check/probe target port.
  console.log(`VelozTrade listening on http://0.0.0.0:${port} (PORT=${rawPort})`);
  logger.info({ port }, "Server listening");
});

server.on("error", (err) => {
  logger.error({ err }, "Server error");
  process.exit(1);
});
