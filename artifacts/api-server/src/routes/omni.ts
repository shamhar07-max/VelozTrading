import { Router, type IRouter } from "express";
import { getOmniBatchPrices, getOmniBatchQuotes } from "../lib/omniPrice";
import { INSTRUMENTS } from "../lib/instruments";

const router: IRouter = Router();

// Never falls off: every handler catches and still returns synthetic data via omni layer.
// No auth required — these are public market data endpoints, but rate-limited.

router.get("/omni/health", async (_req, res) => {
  const start = Date.now();
  const probe = await getOmniBatchPrices(["EUR/USD", "BTC/USD", "AAPL"]);
  res.json({
    status: "ok",
    latencyMs: Date.now() - start,
    probe: Object.fromEntries(probe),
    instruments: INSTRUMENTS.length,
    message: "Omni route live — aggregates Yahoo/Binance/currency-api/CoinGecko/TwelveData/Finnhub + synthetic fallback",
  });
});

router.get("/omni/price/:symbol", async (req, res): Promise<void> => {
  const symbol = decodeURIComponent(req.params.symbol as string);
  const map = await getOmniBatchPrices([symbol]);
  const price = map.get(symbol);
  if (price == null) { res.status(404).json({ error: "Unknown symbol" }); return; }
  res.json({ symbol, price, timestamp: new Date().toISOString(), source: "omni" });
});

router.get("/omni/quotes", async (req, res): Promise<void> => {
  const raw = String(req.query.symbols ?? "");
  const symbols = raw.split(",").map(s => s.trim()).filter(Boolean);
  if (symbols.length === 0 || symbols.length > 100) {
    res.status(400).json({ error: "Provide ?symbols=EUR/USD,BTC/USD,... (1-100)" });
    return;
  }
  const quotes = await getOmniBatchQuotes(symbols);
  res.json({
    count: quotes.size,
    quotes: Object.fromEntries(quotes),
    timestamp: new Date().toISOString(),
  });
});

router.get("/omni/prices", async (req, res): Promise<void> => {
  const raw = String(req.query.symbols ?? "");
  const symbols = raw ? raw.split(",").map(s => s.trim()).filter(Boolean) : INSTRUMENTS.map(i => i.symbol);
  const prices = await getOmniBatchPrices(symbols);
  res.json({
    count: prices.size,
    prices: Object.fromEntries(prices),
    timestamp: new Date().toISOString(),
  });
});

export default router;
