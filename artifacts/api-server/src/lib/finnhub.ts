import { logger } from "./logger";
import { INSTRUMENT_MAP } from "./instruments";

const API_KEY = process.env.FINNHUB_API_KEY ?? "";
const BASE_URL = "https://api.finnhub.io/api/v1";
const FH_TIMEOUT_MS = 10_000;
const FH_MAX_ATTEMPTS = 3;

export function finnhubEnabled(): boolean {
  return API_KEY.length > 0;
}

// Map internal symbols to Finnhub quote symbols:
//   - stocks  : plain ticker (AAPL)
//   - forex   : OANDA:EUR_USD (underscore pair)
//   - crypto  : BINANCE:BTCUSDT
//   - indices : ^GSPC etc.
//   - commodities: OANDA:XAU_USD / WTI_USD / BCO_USD / NATGAS_USD ...
export function toFinnhubSymbol(symbol: string): string | null {
  const inst = INSTRUMENT_MAP.get(symbol);
  const type = inst?.type ?? "stocks";

  const map: Record<string, string> = {
    "USOIL":   "OANDA:WTI_USD",
    "UKOIL":   "OANDA:BCO_USD",
    "NATGAS":  "OANDA:NATGAS_USD",
    "WHEAT":   "OANDA:WHEAT_USD",
    "CORN":    "OANDA:CORN_USD",
    "XPT/USD": "OANDA:XPT_USD",
    "XAU/USD": "OANDA:XAU_USD",
    "XAG/USD": "OANDA:XAG_USD",
    "SPX":     "^GSPC",
    "DJI":     "^DJI",
    "NDX":     "^NDX",
    "RUT":     "^RUT",
    "VIX":     "^VIX",
    "DAX":     "^GDAXI",
    "UKX":     "^FTSE",
    "CAC40":   "^FCHI",
    "IBEX35":  "^IBEX",
    "NI225":   "^N225",
    "HSI":     "^HSI",
    "NIFTY50": "^NSEI",
    "SENSEX":  "^BSESN",
  };
  if (map[symbol]) return map[symbol]!;

  if (type === "forex") return `OANDA:${symbol.replace("/", "_")}`;
  if (type === "crypto") return `BINANCE:${symbol.replace("/", "")}`;
  if (type === "stocks") return symbol;
  return null;
}

interface FinnhubQuote {
  c: number;  // current price
  d: number;  // change
  dp: number; // percent change
  h: number;
  l: number;
  o: number;
  pc: number; // previous close
  t: number;
}

export interface FinnhubCandle {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

const FH_INTERVAL_MAP: Record<string, string> = {
  "1min": "1",
  "5min": "5",
  "15min": "15",
  "30min": "30",
  "1h": "60",
  "4h": "240",
  "1day": "D",
  "1week": "W",
};

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function fetchFinnhub(path: string, params: Record<string, string>): Promise<unknown | null> {
  if (!API_KEY) return null;
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("token", API_KEY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  for (let attempt = 0; attempt < FH_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(FH_TIMEOUT_MS) });
      if (res.status === 429) {
        await delay(1_000 * (attempt + 1));
        continue;
      }
      if (!res.ok) {
        logger.warn({ status: res.status, path }, "Finnhub API error");
        return null;
      }
      return await res.json() as unknown;
    } catch (err) {
      logger.error({ err, path }, "Finnhub request failed");
      return null;
    }
  }
  return null;
}

async function fetchQuote(symbol: string): Promise<FinnhubQuote | null> {
  const fhSymbol = toFinnhubSymbol(symbol);
  if (!fhSymbol) return null;
  const data = await fetchFinnhub("/quote", { symbol: fhSymbol }) as FinnhubQuote | null;
  if (!data || typeof data.c !== "number" || data.c <= 0) return null;
  return data;
}

// Fetch quotes for many symbols, paced under the free-tier 60 req/min cap.
export async function getFinnhubQuotes(
  symbols: string[]
): Promise<Map<string, { price: number; changePercent: number }>> {
  const result = new Map<string, { price: number; changePercent: number }>();
  if (!finnhubEnabled() || symbols.length === 0) return result;

  for (let i = 0; i < symbols.length; i++) {
    if (i > 0) await delay(1_050); // ~57 req/min — stays under the 60/min free cap
    const symbol = symbols[i]!;
    const quote = await fetchQuote(symbol);
    if (quote) {
      result.set(symbol, { price: quote.c, changePercent: quote.dp });
    }
  }
  if (result.size > 0) {
    logger.info({ count: result.size }, "Finnhub fallback quotes fetched");
  }
  return result;
}

// Candles fallback — maps TwelveData intervals onto Finnhub resolutions.
export async function getFinnhubCandles(
  symbol: string,
  interval: string,
  outputsize: number
): Promise<FinnhubCandle[]> {
  const fhSymbol = toFinnhubSymbol(symbol);
  const resolution = FH_INTERVAL_MAP[interval];
  if (!fhSymbol || !resolution) return [];

  const inst = INSTRUMENT_MAP.get(symbol);
  const type = inst?.type ?? "stocks";
  const endpoint =
    type === "crypto" ? "/crypto/candles" :
    type === "forex" || type === "commodities" ? "/forex/candles" :
    "/stock/candles";

  const to = Math.floor(Date.now() / 1000);
  const from = to - outputsize * 3600 * 24 * 2; // over-fetch; Finnhub caps history per resolution
  const data = await fetchFinnhub(endpoint, {
    symbol: fhSymbol,
    resolution,
    from: String(from),
    to: String(to),
  }) as { s?: string; t?: number[]; o?: number[]; h?: number[]; l?: number[]; c?: number[]; v?: number[] } | null;

  if (!data || data.s !== "ok" || !data.t || !data.c) return [];

  const candles: FinnhubCandle[] = [];
  for (let i = 0; i < data.t.length; i++) {
    const open = data.o?.[i];
    const close = data.c[i]!;
    if (open == null || close <= 0) continue;
    candles.push({
      datetime: new Date(data.t[i]! * 1000).toISOString(),
      open: String(open),
      high: String(data.h?.[i] ?? open),
      low: String(data.l?.[i] ?? open),
      close: String(close),
      volume: String(data.v?.[i] ?? 0),
    });
  }
  return candles.slice(-outputsize);
}