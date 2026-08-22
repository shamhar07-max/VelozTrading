// Rescue server — last line of defense for deployments.
//
// If index.mjs crashes at boot (missing/malformed env vars, DB unreachable,
// unexpected module error), the startCommand falls back to this server so
// the platform port STILL answers. Curling the deployment then reveals the
// boot failure category directly, instead of an opaque 503 with empty logs.
//
// It intentionally NEVER prints or returns secret values — only presence.

import http from "http";

const PORT = Number(process.env.PORT ?? "8080");

function flag(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify(
      {
        status: "rescue",
        message:
          "Main application failed to boot — this diagnostic server took its place. Check env var presence below and platform logs.",
        node: process.version,
        pid: process.pid,
        uptimeSec: Math.round(process.uptime()),
        envPresent: {
          DATABASE_URL: flag("DATABASE_URL"),
          CLERK_PUBLISHABLE_KEY: flag("CLERK_PUBLISHABLE_KEY"),
          CLERK_SECRET_KEY: flag("CLERK_SECRET_KEY"),
          CLERK_PUBLISHABLE_KEY_IS_PLACEHOLDER: (
            process.env.CLERK_PUBLISHABLE_KEY ?? ""
          ).includes("REPLACE_ME"),
          ADMIN_EMAILS: flag("ADMIN_EMAILS"),
          ALLOWED_ORIGINS: flag("ALLOWED_ORIGINS"),
          TWELVEDATA_API_KEY: flag("TWELVEDATA_API_KEY"),
        },
      },
      null,
      2,
    ) + "\n",
  );
});

function listen(port: number, label: string): void {
  const s = port === PORT ? server : http.createServer((_q, r) => server.handle(_q, r));
  s.on("error", (err: NodeJS.ErrnoException) => {
    console.log(`[rescue] port ${port} unavailable (${err.code ?? err.message}) — skipping`);
  });
  s.listen(port, "0.0.0.0", () => {
    console.log(`[rescue] listening on 0.0.0.0:${port} ${label}`);
  });
}

listen(PORT, "(primary)");
listen(Number(process.env.TARGET_PORT ?? "80"), "(probe compatibility)");
