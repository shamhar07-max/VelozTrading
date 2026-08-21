// FIX: formatPrice now reads decimal precision from a centralised lookup rather than a
// brittle if-else chain that must be updated every time a new instrument is added.
const DECIMALS_MAP: Record<string, number> = {
  // Forex
  EURUSD: 5, GBPUSD: 5, AUDUSD: 5, NZDUSD: 5, USDCAD: 5, USDCHF: 5,
  USDJPY: 3, EURJPY: 3, GBPJPY: 3,
  EURGBP: 5,
  // Crypto
  BTCUSD: 2, ETHUSD: 2, SOLUSD: 2, BNBUSD: 2,
  XRPUSD: 4, ADAUSD: 4,
  // Stocks
  AAPL: 2, MSFT: 2, GOOGL: 2, AMZN: 2, TSLA: 2, NVDA: 2, META: 2,
  // Commodities
  XAUUSD: 2, XAGUSD: 3, USOIL: 2, UKOIL: 2,
  // Indices
  SPX: 2, DJI: 2, NDX: 2, DAX: 2, UKX: 2,
};

export function toKey(symbol: string): string {
  return symbol.replace(/\//g, "");
}

export function formatPrice(price: number | null | undefined, symbol: string): string {
  if (price == null || isNaN(price)) return "—";
  const key = symbol.toUpperCase().replace(/\//g, "");
  const decimals = DECIMALS_MAP[key] ?? 5;
  return price.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPriceDecimals(symbol: string): number {
  const key = symbol.toUpperCase().replace(/\//g, "");
  return DECIMALS_MAP[key] ?? 5;
}

export function getInstrumentCategory(type: string): string {
  const map: Record<string, string> = {
    forex: "Forex",
    crypto: "Crypto",
    stocks: "Stocks",
    commodities: "Commodities",
    indices: "Indices",
  };
  return map[type] ?? type;
}

// Map flat WebSocket keys back to slash-format for icon lookups
const KEY_TO_DISPLAY: Record<string, string> = {
  EURUSD: "EUR/USD", GBPUSD: "GBP/USD", AUDUSD: "AUD/USD", NZDUSD: "NZD/USD",
  USDCAD: "USD/CAD", USDCHF: "USD/CHF", USDJPY: "USD/JPY", EURJPY: "EUR/JPY",
  GBPJPY: "GBP/JPY", EURGBP: "EUR/GBP",
  BTCUSD: "BTC/USD", ETHUSD: "ETH/USD", SOLUSD: "SOL/USD", BNBUSD: "BNB/USD",
  XRPUSD: "XRP/USD", ADAUSD: "ADA/USD",
  XAUUSD: "XAU/USD", XAGUSD: "XAG/USD",
};

export function toDisplaySymbol(key: string): string {
  return KEY_TO_DISPLAY[key.toUpperCase()] ?? key;
}
