import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";

type AuthedRequest = { userId?: string };

function makeHandler(message: string) {
  return (req: Request, res: Response) => {
    const userId = (req as Request & AuthedRequest).userId ?? "anon";
    req.log.warn({ userId, path: req.path }, "rate limit exceeded");
    res.status(429).json({ error: message });
  };
}

export const tradingRateLimit = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as typeof req & AuthedRequest).userId ?? "anon",
  validate: { keyGeneratorIpFallback: false, xForwardedForHeader: false },
  skip: (req) => req.method === "GET",
  handler: makeHandler("Too many requests — please wait before placing another order."),
});

export const depositRateLimit = rateLimit({
  windowMs: 60 * 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as typeof req & AuthedRequest).userId ?? "anon",
  validate: { keyGeneratorIpFallback: false, xForwardedForHeader: false },
  handler: makeHandler("Too many deposit requests — try again later."),
});

export const accountRateLimit = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as typeof req & AuthedRequest).userId ?? "anon",
  validate: { keyGeneratorIpFallback: false, xForwardedForHeader: false },
  skip: (req) => req.method === "GET",
  handler: makeHandler("Too many account update requests — please wait a moment."),
});

// Admin mutations — higher headroom since admins do batch operations, but still
// keyed by userId to prevent automated scripts abusing admin credentials.
export const adminRateLimit = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as typeof req & AuthedRequest).userId ?? "anon",
  validate: { keyGeneratorIpFallback: false, xForwardedForHeader: false },
  skip: (req) => req.method === "GET",
  handler: makeHandler("Too many admin requests — please slow down."),
});
