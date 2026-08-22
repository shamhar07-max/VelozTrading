import { logger } from "./logger";
import { toTwelveDataSymbol, INSTRUMENT_MAP } from "./instruments";
import { getCoinGeckoPrices } from "./coingecko";
import { getFinnhubQuotes, getFinnhubCandles, finnhubEnabled } from "./finnhub";

// TwelveData is the primary provider but no longer required at boot:
// when the key is missing or the provider is rate-limited/unavailable,
// crypto prices fall back to CoinGecko and everything else to Finnhub.
const API_KEY = process.env.TWELVEDATA_API_KEY ?? "";
const BASE_URL = "https://api.twelvedata.com";

const TD_TIMEOUT_MS = 15_000;      // default timeout for price/quote calls
const TD_CANDLES_TIMEOUT_MS = 20_000; // candles fetch can be larger — needs more headroom

export interface TwelveDataQuote {
  symbol: string;
  name: string;
  close: string;
  open: string;
  high: string;
  low: string;
  volume: string;
  change: string;
  percent_change: string;
  previous_close: string;
  bid?: string;
  ask?: string;
  timestamp: number;
  is_market_open?: boolean;
}

export interface TwelveDataCandle {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

class RateLimitError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super("TwelveData rate limited (429)");
    this.name = "RateLimitError";
  }
}

async function fetchTD(path: string, params: Record<string, string> = {}, timeoutMs = TD_TIMEOUT_MS): Promise<unknown> {
  if (!API_KEY) return null;

  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("apikey", API_KEY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("Retry-After") ?? "0", 10);
    throw new RateLimitError(retryAfter > 0 ? retryAfter * 1000 : 2_000);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.warn({ status: res.status, path, body: body.slice(0, 300) }, "TwelveData API error — will retry with backoff; if 429, free-tier quota is exhausted");
    return null;
  }
  const data = await res.json() as unknown;
  return data;
}

const TD_MAX_ATTEMPTS = 4;       // up to 3 retries (attempts 0-3)
const TD_RETRY_BASE_MS = 2_000;  // 2 s, 4 s, 8 s

async function fetchTDWithRetry(
  path: string,
  params: Record<string, string>,
  timeoutMs = TD_TIMEOUT_MS
): Promise<unknown> {
  for (let attempt = 0; attempt < TD_MAX_ATTEMPTS; attempt++) {
    try {
      return await fetchTD(path, params, timeoutMs);
    } catch (e) {
      if (e instanceof RateLimitError && attempt < TD_MAX_ATTEMPTS - 1) {
        const waitMs = Math.max(e.retryAfterMs, TD_RETRY_BASE_MS * Math.pow(2, attempt));
        logger.warn({ waitMs, attempt: attempt + 1 }, "TwelveData rate limited — backing off before retry");
        await delay(waitMs);
        continue;
      }
      throw e;
    }
  }
  return null;
}

export async function getQuote(symbol: string): Promise<TwelveDataQuote | null> {
  const tdSymbol = toTwelveDataSymbol(symbol);
  try {
    const data = await fetchTD("/quote", { symbol: tdSymbol }) as TwelveDataQuote & { code?: number };
    if (!data || data.code) return await getFallbackQuote(symbol);
    return data;
  } catch (e) {
    logger.error({ err: e, symbol }, "Failed to fetch quote");
    return getFallbackQuote(symbol);
  }
}

// Finnhub quote fallback — normalized to the TwelveData quote shape.
async function getFallbackQuote(symbol: string): Promise<TwelveDataQuote | null> {
  if (!finnhubEnabled()) return null;
  const fh = await getFinnhubQuotes([symbol]);
  const quote = fh.get(symbol);
  if (!quote) return null;
  return {
    symbol,
    name: INSTRUMENT_MAP.get(symbol)?.name ?? symbol,
    close: String(quote.price),
    open: String(quote.price),
    high: String(quote.price),
    low: String(quote.price),
    volume: "0",
    change: "0",
    percent_change: String(quote.changePercent),
    previous_close: String(quote.price),
    timestamp: Math.floor(Date.now() / 1000),
  };
}

// FIX: getPriceCached — consults the in-memory WebSocket priceCache first.
// This avoids burning TwelveData API credits on every REST request when the
// WebSocket streamer already has a fresh price (refreshed every 30 s).
// Falls back to a live TwelveData call only when the cache is cold.
let _priceCache: Map<string, { price: number; prevPrice: number }> | null = null;

export function setPriceCacheRef(cache: Map<string, { price: number; prevPrice: number }>) {
  _priceCache = cache;
}

export async function getPrice(symbol: string): Promise<{ price: number; bid: number; ask: number } | null> {
  // Try cache first
  if (_priceCache) {
    const cached = _priceCache.get(symbol);
    if (cached) {
      const price = cached.price;
      const instrument = INSTRUMENT_MAP.get(symbol);
      const spread = instrument ? instrument.pip * 2 : 0.0001;
      return {
        price,
        bid: parseFloat((price - spread).toFixed(8)),
        ask: parseFloat((price + spread).toFixed(8)),
      };
    }
  }

  // Cache cold — fetch from TwelveData
  const tdSymbol = toTwelveDataSymbol(symbol);
  try {
    const data = await fetchTD("/price", { symbol: tdSymbol }) as { price?: string; code?: number };
    if (!data || data.code || !data.price) return await getFallbackPrice(symbol);
    const price = parseFloat(data.price);
    const spreadFactor = symbol.includes("/") ? 0.00005 : 0.0002;
    return {
      price,
      bid: parseFloat((price * (1 - spreadFactor)).toFixed(8)),
      ask: parseFloat((price * (1 + spreadFactor)).toFixed(8)),
    };
  } catch (e) {
    logger.error({ err: e, symbol }, "Failed to fetch price");
    return getFallbackPrice(symbol);
  }
}

// Fallback chain for a single symbol: CoinGecko (crypto, keyless) → Finnhub.
async function getFallbackPrice(symbol: string): Promise<{ price: number; bid: number; ask: number } | null> {
  const instrument = INSTRUMENT_MAP.get(symbol);
  const spreadFactor = symbol.includes("/") ? 0.00005 : 0.0002;

  if (instrument?.type === "crypto") {
    const cg = await getCoinGeckoPrices([symbol]);
    const price = cg.get(symbol);
    if (price) {
      return {
        price,
        bid: parseFloat((price * (1 - spreadFactor)).toFixed(8)),
        ask: parseFloat((price * (1 + spreadFactor)).toFixed(8)),
      };
    }
  }

  if (finnhubEnabled()) {
    const fh = await getFinnhubQuotes([symbol]);
    const quote = fh.get(symbol);
    if (quote) {
      const price = quote.price;
      return {
        price,
        bid: parseFloat((price * (1 - spreadFactor)).toFixed(8)),
        ask: parseFloat((price * (1 + spreadFactor)).toFixed(8)),
      };
    }
  }
  return null;
}

// Candle cache — avoids burning API credits on every interval/symbol switch.
// TTL varies by interval: short intervals (≤15m) cache for 3 min; longer for 10 min.
interface CandleCacheEntry {
  candles: TwelveDataCandle[];
  fetchedAt: number;
}
const candleCache = new Map<string, CandleCacheEntry>();

function candleCacheTtl(interval: string): number {
  if (interval === "1min" || interval === "5min") return 3 * 60 * 1000;
  if (interval === "15min" || interval === "30min") return 5 * 60 * 1000;
  return 10 * 60 * 1000; // 1h, 4h, 1day, 1week
}

export async function getCandles(
  symbol: string,
  interval: string = "1h",
  outputsize: number = 100
): Promise<TwelveDataCandle[]> {
  const cacheKey = `${symbol}:${interval}:${outputsize}`;
  const cached = candleCache.get(cacheKey);
  const ttl = candleCacheTtl(interval);
  if (cached && Date.now() - cached.fetchedAt < ttl) {
    logger.info({ symbol, interval }, "Candles served from cache");
    return cached.candles;
  }

  const tdSymbol = toTwelveDataSymbol(symbol);
  let candles: TwelveDataCandle[] = cached?.candles ?? [];

  try {
    const data = await fetchTD("/time_series", {
      symbol: tdSymbol,
      interval,
      outputsize: String(outputsize),
    }, TD_CANDLES_TIMEOUT_MS) as { values?: TwelveDataCandle[]; code?: number };

    if (data && !data.code && data.values) {
      candles = [...data.values].reverse();
      candleCache.set(cacheKey, { candles, fetchedAt: Date.now() });
      return candles;
    }
  } catch (e) {
    logger.error({ err: e, symbol }, "Failed to fetch candles");
  }

  // Fallback: Finnhub candles (stocks/forex/crypto/commodities)
  if (candles.length === 0) {
    const fhCandles = await getFinnhubCandles(symbol, interval, outputsize);
    if (fhCandles.length > 0) {
      candles = fhCandles;
      candleCache.set(cacheKey, { candles, fetchedAt: Date.now() });
    }
  }
  return candles;
}

const TD_BATCH_SIZE = 30; // TwelveData allows up to 30 symbols per request on free/basic plans
const TD_BATCH_DELAY_MS = 200; // delay between chunks to avoid rate-limiting

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

export async function getBatchPrices(symbols: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (symbols.length === 0) return result;

  const chunks = chunkArray(symbols, TD_BATCH_SIZE);

  for (let ci = 0; ci < chunks.length; ci++) {
    if (ci > 0) await delay(TD_BATCH_DELAY_MS);
    const chunk = chunks[ci]!;
    const tdSymbols = chunk.map(toTwelveDataSymbol);
    try {
      const data = await fetchTDWithRetry("/price", { symbol: tdSymbols.join(",") }) as
        | Record<string, { price?: string; code?: number }>
        | { price?: string; code?: number };

      if (!data) continue;

      if (chunk.length === 1 && "price" in (data as object)) {
        const single = data as { price?: string };
        if (single.price) {
          result.set(chunk[0]!, parseFloat(single.price));
        }
      } else {
        const batch = data as Record<string, { price?: string; code?: number }>;
        for (let i = 0; i < chunk.length; i++) {
          const tdSym = tdSymbols[i]!;
          const sym = chunk[i]!;
          const entry = batch[tdSym];
          if (entry?.price) {
            result.set(sym, parseFloat(entry.price));
          }
        }
      }
    } catch (e) {
      logger.error({ err: e, chunkIndex: ci }, "Failed to fetch batch prices chunk");
    }
  }

  // Fallback pass: fill symbols TwelveData could not serve.
  // CoinGecko first (one keyless request covers all crypto), then Finnhub.
  const missing = symbols.filter((s) => !result.has(s));
  if (missing.length > 0) {
    const cryptoMissing = missing.filter((s) => INSTRUMENT_MAP.get(s)?.type === "crypto");
    if (cryptoMissing.length > 0) {
      const cg = await getCoinGeckoPrices(cryptoMissing);
      for (const [symbol, price] of cg.entries()) result.set(symbol, price);
    }
    const stillMissing = symbols.filter((s) => !result.has(s));
    if (stillMissing.length > 0 && finnhubEnabled()) {
      const fh = await getFinnhubQuotes(stillMissing);
      for (const [symbol, quote] of fh.entries()) result.set(symbol, quote.price);
    }
    const filled = missing.length - symbols.filter((s) => !result.has(s)).length;
    if (filled > 0) {
      logger.info({ filled, requested: missing.length }, "Fallback providers filled missing batch prices");
    }
  }
  return result;
}

export async function getBatchQuotes(
  symbols: string[]
): Promise<Map<string, { price: number; changePercent: number }>> {
  const result = new Map<string, { price: number; changePercent: number }>();
  if (symbols.length === 0) return result;

  const chunks = chunkArray(symbols, TD_BATCH_SIZE);

  for (let ci = 0; ci < chunks.length; ci++) {
    if (ci > 0) await delay(TD_BATCH_DELAY_MS);
    const chunk = chunks[ci]!;
    const tdSymbols = chunk.map(toTwelveDataSymbol);
    try {
      const data = await fetchTDWithRetry("/quote", { symbol: tdSymbols.join(",") }) as
        | (TwelveDataQuote & { code?: number })
        | Record<string, TwelveDataQuote & { code?: number }>;

      if (!data) continue;

      if (chunk.length === 1) {
        const single = data as TwelveDataQuote & { code?: number };
        if (single.close && !single.code) {
          result.set(chunk[0]!, {
            price: parseFloat(single.close),
            changePercent: parseFloat(single.percent_change || "0"),
          });
        }
      } else {
        const batch = data as Record<string, TwelveDataQuote & { code?: number }>;
        for (let i = 0; i < chunk.length; i++) {
          const tdSym = tdSymbols[i]!;
          const sym = chunk[i]!;
          const entry = batch[tdSym];
          if (entry?.close && !entry.code) {
            result.set(sym, {
              price: parseFloat(entry.close),
              changePercent: parseFloat(entry.percent_change || "0"),
            });
          }
        }
      }
    } catch (e) {
      logger.error({ err: e, chunkIndex: ci }, "Failed to fetch batch quotes chunk");
    }
  }

  // Fallback pass: Finnhub first (keeps changePercent), then CoinGecko (crypto only).
  const missing = symbols.filter((s) => !result.has(s));
  if (missing.length > 0) {
    let filled = 0;
    const fhMissing = missing.filter((s) => INSTRUMENT_MAP.get(s)?.type !== "crypto");
    if (fhMissing.length > 0 && finnhubEnabled()) {
      const fh = await getFinnhubQuotes(fhMissing);
      for (const [symbol, quote] of fh.entries()) {
        result.set(symbol, quote);
        filled++;
      }
    }
    const stillMissing = symbols.filter((s) => !result.has(s));
    const cgMissing = stillMissing.filter((s) => INSTRUMENT_MAP.get(s)?.type === "crypto");
    if (cgMissing.length > 0) {
      const cg = await getCoinGeckoPrices(cgMissing);
      for (const [symbol, price] of cg.entries()) {
        result.set(symbol, { price, changePercent: 0 });
        filled++;
      }
    }
    if (filled > 0) {
      logger.info({ filled, requested: missing.length }, "Fallback providers filled missing batch quotes");
    }
  }
  return result;
}
