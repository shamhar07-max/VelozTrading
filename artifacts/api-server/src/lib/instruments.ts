export interface InstrumentDef {
  symbol: string;
  name: string;
  type: "forex" | "crypto" | "stocks" | "commodities" | "indices";
  category: string;
  pip: number;
  lotSize: number;
  buySwap: number;
  sellSwap: number;
}

export const INSTRUMENTS: InstrumentDef[] = [
  // Forex Majors — swap in USD/lot/day (negative = cost to hold)
  { symbol: "EUR/USD", name: "Euro / US Dollar",                type: "forex",       category: "Major",          pip: 0.0001, lotSize: 100000, buySwap: -0.50, sellSwap: -0.30 },
  { symbol: "GBP/USD", name: "British Pound / US Dollar",       type: "forex",       category: "Major",          pip: 0.0001, lotSize: 100000, buySwap: -0.80, sellSwap: -0.40 },
  { symbol: "USD/JPY", name: "US Dollar / Japanese Yen",        type: "forex",       category: "Major",          pip: 0.01,   lotSize: 100000, buySwap: -0.20, sellSwap: -0.60 },
  { symbol: "USD/CHF", name: "US Dollar / Swiss Franc",         type: "forex",       category: "Major",          pip: 0.0001, lotSize: 100000, buySwap: -0.30, sellSwap: -0.50 },
  { symbol: "AUD/USD", name: "Australian Dollar / US Dollar",   type: "forex",       category: "Major",          pip: 0.0001, lotSize: 100000, buySwap: -0.60, sellSwap: -0.20 },
  { symbol: "USD/CAD", name: "US Dollar / Canadian Dollar",     type: "forex",       category: "Major",          pip: 0.0001, lotSize: 100000, buySwap: -0.40, sellSwap: -0.30 },
  { symbol: "NZD/USD", name: "New Zealand Dollar / US Dollar",  type: "forex",       category: "Major",          pip: 0.0001, lotSize: 100000, buySwap: -0.50, sellSwap: -0.20 },
  // Forex Crosses
  { symbol: "EUR/GBP", name: "Euro / British Pound",            type: "forex",       category: "Cross",          pip: 0.0001, lotSize: 100000, buySwap: -0.40, sellSwap: -0.30 },
  { symbol: "EUR/JPY", name: "Euro / Japanese Yen",             type: "forex",       category: "Cross",          pip: 0.01,   lotSize: 100000, buySwap: -0.30, sellSwap: -0.50 },
  { symbol: "GBP/JPY", name: "British Pound / Japanese Yen",   type: "forex",       category: "Cross",          pip: 0.01,   lotSize: 100000, buySwap: -0.60, sellSwap: -0.40 },
  { symbol: "AUD/JPY", name: "Australian Dollar / Japanese Yen",type: "forex",       category: "Cross",          pip: 0.01,   lotSize: 100000, buySwap: -0.40, sellSwap: -0.35 },
  { symbol: "EUR/AUD", name: "Euro / Australian Dollar",        type: "forex",       category: "Cross",          pip: 0.0001, lotSize: 100000, buySwap: -0.55, sellSwap: -0.30 },
  { symbol: "EUR/CAD", name: "Euro / Canadian Dollar",          type: "forex",       category: "Cross",          pip: 0.0001, lotSize: 100000, buySwap: -0.45, sellSwap: -0.35 },
  { symbol: "EUR/CHF", name: "Euro / Swiss Franc",              type: "forex",       category: "Cross",          pip: 0.0001, lotSize: 100000, buySwap: -0.35, sellSwap: -0.40 },
  { symbol: "GBP/AUD", name: "British Pound / Australian Dollar",type: "forex",      category: "Cross",          pip: 0.0001, lotSize: 100000, buySwap: -0.70, sellSwap: -0.45 },
  { symbol: "GBP/CAD", name: "British Pound / Canadian Dollar", type: "forex",       category: "Cross",          pip: 0.0001, lotSize: 100000, buySwap: -0.60, sellSwap: -0.40 },
  { symbol: "GBP/CHF", name: "British Pound / Swiss Franc",     type: "forex",       category: "Cross",          pip: 0.0001, lotSize: 100000, buySwap: -0.55, sellSwap: -0.45 },
  { symbol: "GBP/NZD", name: "British Pound / New Zealand Dollar",type: "forex",     category: "Cross",          pip: 0.0001, lotSize: 100000, buySwap: -0.80, sellSwap: -0.50 },
  { symbol: "NZD/JPY", name: "New Zealand Dollar / Japanese Yen",type: "forex",      category: "Cross",          pip: 0.01,   lotSize: 100000, buySwap: -0.35, sellSwap: -0.30 },
  { symbol: "CHF/JPY", name: "Swiss Franc / Japanese Yen",      type: "forex",       category: "Cross",          pip: 0.01,   lotSize: 100000, buySwap: -0.25, sellSwap: -0.45 },
  { symbol: "CAD/JPY", name: "Canadian Dollar / Japanese Yen",  type: "forex",       category: "Cross",          pip: 0.01,   lotSize: 100000, buySwap: -0.30, sellSwap: -0.40 },
  // Forex Exotic (Indian-focused pairs)
  { symbol: "USD/INR", name: "US Dollar / Indian Rupee",        type: "forex",       category: "Exotic",         pip: 0.01,   lotSize: 100000, buySwap: -1.50, sellSwap: -0.80 },
  { symbol: "USD/SGD", name: "US Dollar / Singapore Dollar",    type: "forex",       category: "Exotic",         pip: 0.0001, lotSize: 100000, buySwap: -0.50, sellSwap: -0.30 },
  { symbol: "USD/TRY", name: "US Dollar / Turkish Lira",        type: "forex",       category: "Exotic",         pip: 0.0001, lotSize: 100000, buySwap: -2.00, sellSwap: -0.80 },
  { symbol: "USD/MXN", name: "US Dollar / Mexican Peso",        type: "forex",       category: "Exotic",         pip: 0.0001, lotSize: 100000, buySwap: -1.20, sellSwap: -0.60 },
  { symbol: "USD/ZAR", name: "US Dollar / South African Rand",  type: "forex",       category: "Exotic",         pip: 0.0001, lotSize: 100000, buySwap: -1.80, sellSwap: -0.70 },
  // Crypto — high funding rates
  { symbol: "BTC/USD",  name: "Bitcoin / US Dollar",            type: "crypto",      category: "Cryptocurrency", pip: 0.01,   lotSize: 1,      buySwap: -5.00, sellSwap: -5.00 },
  { symbol: "ETH/USD",  name: "Ethereum / US Dollar",           type: "crypto",      category: "Cryptocurrency", pip: 0.01,   lotSize: 1,      buySwap: -3.00, sellSwap: -3.00 },
  { symbol: "XRP/USD",  name: "Ripple / US Dollar",             type: "crypto",      category: "Cryptocurrency", pip: 0.0001, lotSize: 1,      buySwap: -1.00, sellSwap: -1.00 },
  { symbol: "SOL/USD",  name: "Solana / US Dollar",             type: "crypto",      category: "Cryptocurrency", pip: 0.01,   lotSize: 1,      buySwap: -2.00, sellSwap: -2.00 },
  { symbol: "ADA/USD",  name: "Cardano / US Dollar",            type: "crypto",      category: "Cryptocurrency", pip: 0.0001, lotSize: 1,      buySwap: -0.50, sellSwap: -0.50 },
  { symbol: "BNB/USD",  name: "Binance Coin / US Dollar",       type: "crypto",      category: "Cryptocurrency", pip: 0.01,   lotSize: 1,      buySwap: -2.00, sellSwap: -2.00 },
  { symbol: "DOGE/USD", name: "Dogecoin / US Dollar",           type: "crypto",      category: "Cryptocurrency", pip: 0.0001, lotSize: 1,      buySwap: -0.50, sellSwap: -0.50 },
  { symbol: "LTC/USD",  name: "Litecoin / US Dollar",           type: "crypto",      category: "Cryptocurrency", pip: 0.01,   lotSize: 1,      buySwap: -1.50, sellSwap: -1.50 },
  { symbol: "LINK/USD", name: "Chainlink / US Dollar",          type: "crypto",      category: "Cryptocurrency", pip: 0.001,  lotSize: 1,      buySwap: -1.20, sellSwap: -1.20 },
  { symbol: "DOT/USD",  name: "Polkadot / US Dollar",           type: "crypto",      category: "Cryptocurrency", pip: 0.001,  lotSize: 1,      buySwap: -1.00, sellSwap: -1.00 },
  { symbol: "AVAX/USD", name: "Avalanche / US Dollar",          type: "crypto",      category: "Cryptocurrency", pip: 0.01,   lotSize: 1,      buySwap: -2.00, sellSwap: -2.00 },
  { symbol: "MATIC/USD",name: "Polygon / US Dollar",            type: "crypto",      category: "Cryptocurrency", pip: 0.0001, lotSize: 1,      buySwap: -0.80, sellSwap: -0.80 },
  { symbol: "UNI/USD",  name: "Uniswap / US Dollar",            type: "crypto",      category: "Cryptocurrency", pip: 0.001,  lotSize: 1,      buySwap: -1.00, sellSwap: -1.00 },
  { symbol: "ATOM/USD", name: "Cosmos / US Dollar",             type: "crypto",      category: "Cryptocurrency", pip: 0.001,  lotSize: 1,      buySwap: -0.80, sellSwap: -0.80 },
  // Stocks — Technology
  { symbol: "AAPL",     name: "Apple Inc.",                     type: "stocks",      category: "Technology",     pip: 0.01,   lotSize: 1,      buySwap: -0.10, sellSwap: -0.05 },
  { symbol: "MSFT",     name: "Microsoft Corporation",          type: "stocks",      category: "Technology",     pip: 0.01,   lotSize: 1,      buySwap: -0.08, sellSwap: -0.04 },
  { symbol: "GOOGL",    name: "Alphabet Inc.",                  type: "stocks",      category: "Technology",     pip: 0.01,   lotSize: 1,      buySwap: -0.15, sellSwap: -0.06 },
  { symbol: "AMZN",     name: "Amazon.com Inc.",                type: "stocks",      category: "Consumer",       pip: 0.01,   lotSize: 1,      buySwap: -0.12, sellSwap: -0.05 },
  { symbol: "TSLA",     name: "Tesla Inc.",                     type: "stocks",      category: "Automotive",     pip: 0.01,   lotSize: 1,      buySwap: -0.20, sellSwap: -0.08 },
  { symbol: "NVDA",     name: "NVIDIA Corporation",             type: "stocks",      category: "Technology",     pip: 0.01,   lotSize: 1,      buySwap: -0.15, sellSwap: -0.06 },
  { symbol: "META",     name: "Meta Platforms Inc.",            type: "stocks",      category: "Technology",     pip: 0.01,   lotSize: 1,      buySwap: -0.10, sellSwap: -0.04 },
  { symbol: "AMD",      name: "Advanced Micro Devices Inc.",    type: "stocks",      category: "Technology",     pip: 0.01,   lotSize: 1,      buySwap: -0.12, sellSwap: -0.05 },
  { symbol: "INTC",     name: "Intel Corporation",              type: "stocks",      category: "Technology",     pip: 0.01,   lotSize: 1,      buySwap: -0.07, sellSwap: -0.04 },
  { symbol: "NFLX",     name: "Netflix Inc.",                   type: "stocks",      category: "Technology",     pip: 0.01,   lotSize: 1,      buySwap: -0.18, sellSwap: -0.07 },
  { symbol: "COIN",     name: "Coinbase Global Inc.",           type: "stocks",      category: "Technology",     pip: 0.01,   lotSize: 1,      buySwap: -0.25, sellSwap: -0.10 },
  { symbol: "PYPL",     name: "PayPal Holdings Inc.",           type: "stocks",      category: "Technology",     pip: 0.01,   lotSize: 1,      buySwap: -0.10, sellSwap: -0.04 },
  // Stocks — Finance
  { symbol: "JPM",      name: "JPMorgan Chase & Co.",           type: "stocks",      category: "Finance",        pip: 0.01,   lotSize: 1,      buySwap: -0.12, sellSwap: -0.05 },
  { symbol: "BAC",      name: "Bank of America Corp.",          type: "stocks",      category: "Finance",        pip: 0.01,   lotSize: 1,      buySwap: -0.08, sellSwap: -0.04 },
  { symbol: "V",        name: "Visa Inc.",                      type: "stocks",      category: "Finance",        pip: 0.01,   lotSize: 1,      buySwap: -0.12, sellSwap: -0.05 },
  { symbol: "MA",       name: "Mastercard Inc.",                type: "stocks",      category: "Finance",        pip: 0.01,   lotSize: 1,      buySwap: -0.12, sellSwap: -0.05 },
  // Stocks — Healthcare & Consumer
  { symbol: "JNJ",      name: "Johnson & Johnson",              type: "stocks",      category: "Healthcare",     pip: 0.01,   lotSize: 1,      buySwap: -0.09, sellSwap: -0.04 },
  { symbol: "PFE",      name: "Pfizer Inc.",                    type: "stocks",      category: "Healthcare",     pip: 0.01,   lotSize: 1,      buySwap: -0.06, sellSwap: -0.03 },
  { symbol: "DIS",      name: "The Walt Disney Company",        type: "stocks",      category: "Consumer",       pip: 0.01,   lotSize: 1,      buySwap: -0.09, sellSwap: -0.04 },
  { symbol: "KO",       name: "Coca-Cola Company",              type: "stocks",      category: "Consumer",       pip: 0.01,   lotSize: 1,      buySwap: -0.06, sellSwap: -0.03 },
  { symbol: "PEP",      name: "PepsiCo Inc.",                   type: "stocks",      category: "Consumer",       pip: 0.01,   lotSize: 1,      buySwap: -0.08, sellSwap: -0.04 },
  { symbol: "WMT",      name: "Walmart Inc.",                   type: "stocks",      category: "Consumer",       pip: 0.01,   lotSize: 1,      buySwap: -0.10, sellSwap: -0.04 },
  // Commodities
  { symbol: "XAU/USD",  name: "Gold / US Dollar",               type: "commodities", category: "Metals",         pip: 0.01,   lotSize: 100,    buySwap: -3.00, sellSwap: -1.00 },
  { symbol: "XAG/USD",  name: "Silver / US Dollar",             type: "commodities", category: "Metals",         pip: 0.001,  lotSize: 5000,   buySwap: -2.00, sellSwap: -0.50 },
  { symbol: "XPT/USD",  name: "Platinum / US Dollar",           type: "commodities", category: "Metals",         pip: 0.01,   lotSize: 50,     buySwap: -2.50, sellSwap: -0.80 },
  { symbol: "USOIL",    name: "Crude Oil (WTI)",                type: "commodities", category: "Energy",         pip: 0.01,   lotSize: 100,    buySwap: -2.00, sellSwap: -1.50 },
  { symbol: "UKOIL",    name: "Crude Oil (Brent)",              type: "commodities", category: "Energy",         pip: 0.01,   lotSize: 100,    buySwap: -2.00, sellSwap: -1.50 },
  { symbol: "NATGAS",   name: "Natural Gas",                    type: "commodities", category: "Energy",         pip: 0.001,  lotSize: 1000,   buySwap: -1.50, sellSwap: -1.00 },
  { symbol: "WHEAT",    name: "Wheat",                          type: "commodities", category: "Agricultural",   pip: 0.01,   lotSize: 100,    buySwap: -1.00, sellSwap: -0.50 },
  { symbol: "CORN",     name: "Corn",                           type: "commodities", category: "Agricultural",   pip: 0.01,   lotSize: 100,    buySwap: -1.00, sellSwap: -0.50 },
  // Indices — US
  { symbol: "SPX",      name: "S&P 500 Index",                  type: "indices",     category: "US",             pip: 0.01,   lotSize: 1,      buySwap: -0.30, sellSwap: -0.20 },
  { symbol: "DJI",      name: "Dow Jones Industrial Average",   type: "indices",     category: "US",             pip: 0.01,   lotSize: 1,      buySwap: -0.30, sellSwap: -0.20 },
  { symbol: "NDX",      name: "NASDAQ 100 Index",               type: "indices",     category: "US",             pip: 0.01,   lotSize: 1,      buySwap: -0.30, sellSwap: -0.20 },
  { symbol: "RUT",      name: "Russell 2000 Index",             type: "indices",     category: "US",             pip: 0.01,   lotSize: 1,      buySwap: -0.25, sellSwap: -0.18 },
  { symbol: "VIX",      name: "CBOE Volatility Index",          type: "indices",     category: "US",             pip: 0.01,   lotSize: 1,      buySwap: -0.20, sellSwap: -0.15 },
  // Indices — Europe & Asia
  { symbol: "DAX",      name: "DAX 40 Index",                   type: "indices",     category: "Europe",         pip: 0.01,   lotSize: 1,      buySwap: -0.30, sellSwap: -0.20 },
  { symbol: "UKX",      name: "FTSE 100 Index",                 type: "indices",     category: "Europe",         pip: 0.01,   lotSize: 1,      buySwap: -0.30, sellSwap: -0.20 },
  { symbol: "CAC40",    name: "CAC 40 Index (France)",          type: "indices",     category: "Europe",         pip: 0.01,   lotSize: 1,      buySwap: -0.25, sellSwap: -0.18 },
  { symbol: "IBEX35",   name: "IBEX 35 Index (Spain)",          type: "indices",     category: "Europe",         pip: 0.01,   lotSize: 1,      buySwap: -0.25, sellSwap: -0.18 },
  { symbol: "NI225",    name: "Nikkei 225 (Japan)",             type: "indices",     category: "Asia",           pip: 1,      lotSize: 1,      buySwap: -0.20, sellSwap: -0.15 },
  { symbol: "HSI",      name: "Hang Seng Index (Hong Kong)",    type: "indices",     category: "Asia",           pip: 1,      lotSize: 1,      buySwap: -0.25, sellSwap: -0.18 },
  { symbol: "NIFTY50",  name: "NIFTY 50 Index (India)",         type: "indices",     category: "Asia",           pip: 0.05,   lotSize: 1,      buySwap: -0.30, sellSwap: -0.20 },
  { symbol: "SENSEX",   name: "BSE SENSEX (India)",             type: "indices",     category: "Asia",           pip: 0.1,    lotSize: 1,      buySwap: -0.30, sellSwap: -0.20 },
];

export const INSTRUMENT_MAP = new Map(INSTRUMENTS.map((i) => [i.symbol, i]));

export const LEVERAGE_BY_TYPE: Record<InstrumentDef["type"], number> = {
  forex: 1000,
  crypto: 5,
  stocks: 10,
  commodities: 100,
  indices: 10,
};

export interface TierBenefit {
  commissionPerLot: number;
  spreadMultiplier: number;
  label: string;
  withdrawalSLA: string;
  minDeposit: number;
}

export const TIER_CONFIG: Record<string, TierBenefit> = {
  real:     { commissionPerLot: 2.00, spreadMultiplier: 1.00, label: "Standard",  withdrawalSLA: "1–3 business days", minDeposit: 0 },
  silver:   { commissionPerLot: 1.50, spreadMultiplier: 0.95, label: "Silver",    withdrawalSLA: "12–24 hours",        minDeposit: 250 },
  gold:     { commissionPerLot: 1.00, spreadMultiplier: 0.90, label: "Gold",      withdrawalSLA: "6–12 hours",         minDeposit: 2500 },
  platinum: { commissionPerLot: 0.50, spreadMultiplier: 0.85, label: "Platinum",  withdrawalSLA: "1–6 hours",          minDeposit: 10000 },
  vip:      { commissionPerLot: 0.00, spreadMultiplier: 0.80, label: "VIP",       withdrawalSLA: "< 1 hour",           minDeposit: 50000 },
};

export function toTwelveDataSymbol(symbol: string): string {
  const map: Record<string, string> = {
    "USOIL":   "WTI/USD",
    "UKOIL":   "BRENT/USD",
    "NATGAS":  "NATGAS/USD",
    "WHEAT":   "WHEAT/USD",
    "CORN":    "CORN/USD",
    "XPT/USD": "XPT/USD",
    "CAC40":   "CAC40:INDX",
    "IBEX35":  "IBEX35:INDX",
    "NI225":   "N225:INDX",
    "HSI":     "HSI:INDX",
    "NIFTY50": "NIFTY50:NSE",
    "SENSEX":  "BSESN:NSE",
    "RUT":     "RUT:INDX",
    "VIX":     "VIX:CBOE",
  };
  return map[symbol] ?? symbol;
}

export function toInstrumentSymbol(rawSymbol: string): string {
  if (INSTRUMENT_MAP.has(rawSymbol)) return rawSymbol;
  for (const sym of INSTRUMENT_MAP.keys()) {
    if (sym.replace(/\//g, "") === rawSymbol.replace(/\//g, "")) return sym;
  }
  return rawSymbol;
}

// `now` is injectable for deterministic unit tests; defaults to wall-clock UTC.
export function isMarketOpen(symbol: string, now: Date = new Date()): boolean {
  const inst = INSTRUMENT_MAP.get(symbol);
  if (!inst) return true;

  if (inst.type === "crypto") return true;

  const day = now.getUTCDay();
  const h = now.getUTCHours();
  const m = now.getUTCMinutes();
  const mins = h * 60 + m;

  if (day === 0 || day === 6) {
    if (inst.type === "forex" || inst.type === "stocks" || inst.type === "indices") return false;
    return true;
  }

  if (inst.type === "forex" || inst.type === "commodities") return true;

  if (inst.type === "stocks" || inst.category === "US") {
    return mins >= 13 * 60 + 30 && mins < 20 * 60;
  }

  if (inst.category === "Europe") {
    return mins >= 7 * 60 && mins < 16 * 60 + 30;
  }

  return true;
}
