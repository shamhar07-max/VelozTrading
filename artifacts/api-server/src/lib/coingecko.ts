import { logger } from "./logger";

const BASE_URL = "https://api.coingecko.com/api/v3";
const CG_TIMEOUT_MS = 10_000;

// Symbol → CoinGecko asset id. CoinGecko's free /simple/price endpoint needs
// no API key and returns all requested ids in a single request, which makes
// it the cheapest fallback for the crypto symbols in the instrument list.
const SYMBOL_TO_ID: Record<string, string> = {
  "BTC/USD": "bitcoin",
  "ETH/USD": "ethereum",
  "XRP/USD": "ripple",
  "SOL/USD": "solana",
  "ADA/USD": "cardano",
  "BNB/USD": "binancecoin",
  "DOGE/USD": "dogecoin",
  "LTC/USD": "litecoin",
  "LINK/USD": "chainlink",
  "DOT/USD": "polkadot",
  "AVAX/USD": "avalanche-2",
  "MATIC/USD": "polygon",
  "UNI/USD": "uniswap",
  "ATOM/USD": "cosmos",
};

export function toCoinGeckoId(symbol: string): string | null {
  return SYMBOL_TO_ID[symbol] ?? null;
}

export async function getCoinGeckoPrices(symbols: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const idsBySymbol = new Map<string, string>();
  for (const symbol of symbols) {
    const id = toCoinGeckoId(symbol);
    if (id) idsBySymbol.set(symbol, id);
  }
  if (idsBySymbol.size === 0) return result;

  try {
    const ids = [...new Set(idsBySymbol.values())].join(",");
    const url = new URL(`${BASE_URL}/simple/price`);
    url.searchParams.set("ids", ids);
    url.searchParams.set("vs_currencies", "usd");

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(CG_TIMEOUT_MS) });
    if (!res.ok) {
      logger.warn({ status: res.status }, "CoinGecko API error");
      return result;
    }

    const data = await res.json() as Record<string, { usd?: number }>;
    for (const [symbol, id] of idsBySymbol.entries()) {
      const price = data[id]?.usd;
      if (price && price > 0) result.set(symbol, price);
    }
    if (result.size > 0) {
      logger.info({ count: result.size }, "CoinGecko fallback prices fetched");
    }
  } catch (err) {
    logger.error({ err }, "CoinGecko fetch failed");
  }
  return result;
}