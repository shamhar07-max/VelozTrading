import { Router, type IRouter } from "express";
import { INSTRUMENTS, INSTRUMENT_MAP, toInstrumentSymbol } from "../lib/instruments";
import { getQuote, getBatchPrices } from "../lib/twelvedata";
import {
  ListInstrumentsResponse,
  GetQuoteResponse,
  GetCandlesResponse,
  GetMarketMoversResponse,
} from "@workspace/api-zod";
import { getCandles as fetchCandles } from "../lib/twelvedata";
import { priceCache, changePercentCache } from "../ws/priceStreamer";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/instruments", async (req, res): Promise<void> => {
  const type = req.query.type as string | undefined;
  const search = (req.query.search as string | undefined)?.toLowerCase();

  let list = INSTRUMENTS;
  if (type) list = list.filter((i) => i.type === type);
  if (search)
    list = list.filter(
      (i) =>
        i.symbol.toLowerCase().includes(search) ||
        i.name.toLowerCase().includes(search)
    );

  const result = list.map((i) => {
    const cached = priceCache.get(i.symbol);
    const changePercent = changePercentCache.get(i.symbol) ?? null;
    return {
      ...i,
      spread: i.pip * 2,
      currentPrice: cached?.price ?? null,
      changePercent: changePercent,
    };
  });

  res.json(ListInstrumentsResponse.parse(result));
});

// FIX: quote and candles require auth — previously public, burning API credits for anonymous visitors
router.get("/instruments/:symbol/quote", requireAuth, async (req, res): Promise<void> => {
  const rawSymbol = Array.isArray(req.params.symbol)
    ? req.params.symbol[0]
    : req.params.symbol;
  const symbol = toInstrumentSymbol(decodeURIComponent(rawSymbol));
  const instrument = INSTRUMENT_MAP.get(symbol);

  if (!instrument) {
    res.status(404).json({ error: "Symbol not found" });
    return;
  }

  const quote = await getQuote(symbol);
  if (!quote) {
    res.status(404).json({ error: "Quote unavailable" });
    return;
  }

  const price = parseFloat(quote.close || "0");
  const change = parseFloat(quote.change || "0");
  const changePercent = parseFloat(quote.percent_change || "0");
  const spread = instrument.pip * 2;

  res.json(
    GetQuoteResponse.parse({
      symbol,
      bid: parseFloat((price - spread).toFixed(8)),
      ask: parseFloat((price + spread).toFixed(8)),
      price,
      change,
      changePercent,
      high: quote.high ? parseFloat(quote.high) : null,
      low: quote.low ? parseFloat(quote.low) : null,
      volume: quote.volume ? parseFloat(quote.volume) : null,
      timestamp: new Date(quote.timestamp * 1000).toISOString(),
    })
  );
});

router.get("/candles", requireAuth, async (req, res): Promise<void> => {
  const rawSymbol = req.query.symbol as string;
  const interval = (req.query.interval as string) || "1h";
  const outputsize = parseInt((req.query.outputsize as string) || "500", 10);

  if (!rawSymbol) {
    res.status(400).json({ error: "symbol is required" });
    return;
  }

  const symbol = toInstrumentSymbol(rawSymbol);
  const candles = await fetchCandles(symbol, interval, outputsize);
  res.json(
    GetCandlesResponse.parse(
      candles.map((c) => {
        const vol = parseFloat(c.volume);
        return {
          datetime: c.datetime,
          open: parseFloat(c.open),
          high: parseFloat(c.high),
          low: parseFloat(c.low),
          close: parseFloat(c.close),
          volume: isNaN(vol) ? 0 : vol,
        };
      })
    )
  );
});

router.get("/market/movers", async (req, res): Promise<void> => {
  const subset = INSTRUMENTS.filter((i) =>
    ["EUR/USD", "BTC/USD", "AAPL", "XAU/USD", "ETH/USD", "GBP/USD", "NVDA", "SPX"].includes(i.symbol)
  );

  const withPrices = subset.map((i) => {
    const cached = priceCache.get(i.symbol);
    const changePercent = changePercentCache.get(i.symbol) ?? 0;
    return {
      ...i,
      spread: i.pip * 2,
      currentPrice: cached?.price ?? null,
      changePercent,
    };
  });

  if (withPrices.every((i) => i.currentPrice === null)) {
    const freshPrices = await getBatchPrices(subset.map((i) => i.symbol));
    const result = subset.map((i) => ({
      ...i,
      spread: i.pip * 2,
      currentPrice: freshPrices.get(i.symbol) ?? null,
      changePercent: changePercentCache.get(i.symbol) ?? 0,
    }));
    const sorted = [...result].sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0));
    res.json(GetMarketMoversResponse.parse({ gainers: sorted.slice(0, 4), losers: sorted.slice(-4).reverse() }));
    return;
  }

  const sorted = [...withPrices].sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0));
  res.json(GetMarketMoversResponse.parse({
    gainers: sorted.slice(0, 4),
    losers: sorted.slice(-4).reverse(),
  }));
});

export default router;
