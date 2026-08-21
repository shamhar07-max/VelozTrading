import { Router, type IRouter, type Request } from "express";
import { eq, and } from "drizzle-orm";
import { db, watchlistTable } from "@workspace/db";
import {
  GetWatchlistResponse,
  AddToWatchlistBody,
  RemoveFromWatchlistParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { accountRateLimit } from "../middlewares/rateLimit";
import { INSTRUMENT_MAP } from "../lib/instruments";
import { getBatchPrices, getQuote } from "../lib/twelvedata";

const router: IRouter = Router();

router.get("/watchlist", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;

  const items = await db
    .select()
    .from(watchlistTable)
    .where(eq(watchlistTable.clerkUserId, userId));

  if (items.length === 0) {
    res.json([]);
    return;
  }

  const symbols = items.map((i) => i.symbol);
  const prices = await getBatchPrices(symbols);

  const result = items.map((item) => {
    const instrument = INSTRUMENT_MAP.get(item.symbol);
    const price = prices.get(item.symbol) ?? null;
    const spread = instrument ? instrument.pip * 2 : 0.0001;
    return {
      symbol: item.symbol,
      name: instrument?.name ?? item.symbol,
      type: instrument?.type ?? "forex",
      price,
      change: null,
      changePercent: null,
      bid: price != null ? parseFloat((price - spread).toFixed(8)) : null,
      ask: price != null ? parseFloat((price + spread).toFixed(8)) : null,
      addedAt: item.addedAt.toISOString(),
    };
  });

  res.json(GetWatchlistResponse.parse(result));
});

router.post("/watchlist", requireAuth, accountRateLimit, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const parsed = AddToWatchlistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { symbol } = parsed.data;
  const instrument = INSTRUMENT_MAP.get(symbol);
  if (!instrument) {
    res.status(400).json({ error: "Unknown symbol" });
    return;
  }

  // FIX: Use INSERT ... ON CONFLICT DO NOTHING to handle the DB-level unique constraint
  // (clerkUserId, symbol) gracefully instead of a separate read-then-write check
  const [item] = await db
    .insert(watchlistTable)
    .values({ clerkUserId: userId, symbol })
    .onConflictDoNothing()
    .returning();

  // If already in watchlist, return 200 OK (idempotent)
  if (!item) {
    res.json({ symbol, name: instrument.name, type: instrument.type, price: null, change: null, changePercent: null, bid: null, ask: null, addedAt: new Date().toISOString() });
    return;
  }

  const quote = await getQuote(symbol);
  const price = quote ? parseFloat(quote.close) : null;
  const spread = instrument.pip * 2;

  res.status(201).json({
    symbol: item.symbol,
    name: instrument.name,
    type: instrument.type,
    price,
    change: quote ? parseFloat(quote.change) : null,
    changePercent: quote ? parseFloat(quote.percent_change) : null,
    bid: price != null ? parseFloat((price - spread).toFixed(8)) : null,
    ask: price != null ? parseFloat((price + spread).toFixed(8)) : null,
    addedAt: item.addedAt.toISOString(),
  });
});

router.delete("/watchlist/:symbol", requireAuth, accountRateLimit, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const rawSymbol = Array.isArray(req.params.symbol)
    ? req.params.symbol[0]
    : req.params.symbol;
  const params = RemoveFromWatchlistParams.safeParse({ symbol: decodeURIComponent(rawSymbol) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(watchlistTable)
    .where(
      and(
        eq(watchlistTable.clerkUserId, userId),
        eq(watchlistTable.symbol, params.data.symbol)
      )
    )
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Symbol not in watchlist" });
    return;
  }

  res.sendStatus(204);
});

export default router;
