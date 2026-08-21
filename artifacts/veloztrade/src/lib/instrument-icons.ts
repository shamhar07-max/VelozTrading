/**
 * Instrument icon mapping — all sources are free/CDN-based
 *
 * Crypto  → spothq/cryptocurrency-icons (MIT)
 * Forex   → flagcdn.com (free, no key)
 * Stocks  → logo.dev (free tier, no key required for basic)
 * Others  → emoji badges
 */

export type IconSource =
  | { type: "img"; url: string; bg: string; pad?: number }
  | { type: "emoji"; emoji: string; bg: string };

// ── Crypto icons ──────────────────────────────────────────────────────────────
const CRYPTO_CDN = "https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color";
const CRYPTO_ICONS: Record<string, string> = {
  BTC:   `${CRYPTO_CDN}/btc.svg`,
  ETH:   `${CRYPTO_CDN}/eth.svg`,
  XRP:   `${CRYPTO_CDN}/xrp.svg`,
  SOL:   `${CRYPTO_CDN}/sol.svg`,
  ADA:   `${CRYPTO_CDN}/ada.svg`,
  BNB:   `${CRYPTO_CDN}/bnb.svg`,
  DOGE:  `${CRYPTO_CDN}/doge.svg`,
  LTC:   `${CRYPTO_CDN}/ltc.svg`,
  DOT:   `${CRYPTO_CDN}/dot.svg`,
  AVAX:  `${CRYPTO_CDN}/avax.svg`,
  MATIC: `${CRYPTO_CDN}/matic.svg`,
  USDT:  `${CRYPTO_CDN}/usdt.svg`,
  USDC:  `${CRYPTO_CDN}/usdc.svg`,
  LINK:  `${CRYPTO_CDN}/link.svg`,
  UNI:   `${CRYPTO_CDN}/uni.svg`,
  ATOM:  `${CRYPTO_CDN}/atom.svg`,
  XLM:   `${CRYPTO_CDN}/xlm.svg`,
  TRX:   `${CRYPTO_CDN}/trx.svg`,
  SHIB:  `${CRYPTO_CDN}/shib.svg`,
};

// ── Country flags for forex base currencies ───────────────────────────────────
// flagcdn.com — completely free, no API key
const FLAG_CDN = "https://flagcdn.com/w40";
const CURRENCY_FLAGS: Record<string, string> = {
  EUR: `${FLAG_CDN}/eu.png`,
  GBP: `${FLAG_CDN}/gb.png`,
  USD: `${FLAG_CDN}/us.png`,
  JPY: `${FLAG_CDN}/jp.png`,
  CHF: `${FLAG_CDN}/ch.png`,
  AUD: `${FLAG_CDN}/au.png`,
  CAD: `${FLAG_CDN}/ca.png`,
  NZD: `${FLAG_CDN}/nz.png`,
  SGD: `${FLAG_CDN}/sg.png`,
  HKD: `${FLAG_CDN}/hk.png`,
  NOK: `${FLAG_CDN}/no.png`,
  SEK: `${FLAG_CDN}/se.png`,
  DKK: `${FLAG_CDN}/dk.png`,
  TRY: `${FLAG_CDN}/tr.png`,
  ZAR: `${FLAG_CDN}/za.png`,
  MXN: `${FLAG_CDN}/mx.png`,
  PLN: `${FLAG_CDN}/pl.png`,
  CZK: `${FLAG_CDN}/cz.png`,
  HUF: `${FLAG_CDN}/hu.png`,
  CNY: `${FLAG_CDN}/cn.png`,
  INR: `${FLAG_CDN}/in.png`,
  BRL: `${FLAG_CDN}/br.png`,
  PKR: `${FLAG_CDN}/pk.png`,
};

// ── Stock logos via logo.dev (free, no auth needed for basic) ─────────────────
// Falls back to company initial badge on error (handled in component)
const stockLogo = (ticker: string) =>
  `https://img.logo.dev/ticker/${ticker.toLowerCase()}?token=pk_Wy_m1rqESKiJFzGFEL04Qg&format=png&size=64`;

// Known stock tickers
const STOCK_TICKERS = new Set([
  "AAPL","MSFT","GOOGL","AMZN","TSLA","NVDA","META","NFLX","AMD","INTC",
  "JPM","BAC","GS","WFC","MS","C","V","MA","PYPL",
  "WMT","KO","PEP","MCD","SBUX","NKE","DIS","COST",
  "JNJ","PFE","MRNA","ABBV","UNH","CVS",
  "XOM","CVX","BP","SHEL",
  "BABA","TSM","SONY","SAMSUNG","TM","NIO",
  "SPY","QQQ","GLD","SLV",
]);

// ── Commodities ───────────────────────────────────────────────────────────────
const COMMODITY_ICONS: Record<string, { emoji: string; bg: string }> = {
  XAU:     { emoji: "🥇", bg: "#78350f" },
  XAG:     { emoji: "🪙", bg: "#334155" },
  USOIL:   { emoji: "🛢️", bg: "#1c1917" },
  UKOIL:   { emoji: "🛢️", bg: "#1c1917" },
  WTI:     { emoji: "🛢️", bg: "#1c1917" },
  BRENT:   { emoji: "🛢️", bg: "#292524" },
  GAS:     { emoji: "🔥", bg: "#3b1a6b" },
  WHEAT:   { emoji: "🌾", bg: "#78350f" },
  CORN:    { emoji: "🌽", bg: "#a16207" },
  COPPER:  { emoji: "🔶", bg: "#92400e" },
  NATGAS:  { emoji: "🔥", bg: "#3b1a6b" },
  PLATINUM:{ emoji: "💎", bg: "#1e293b" },
  PALLADIUM:{ emoji: "⚗️", bg: "#0f2a3f" },
  COCOA:   { emoji: "🍫", bg: "#3d2614" },
  COFFEE:  { emoji: "☕", bg: "#3d1a0a" },
  SUGAR:   { emoji: "🍬", bg: "#7c2d12" },
  COTTON:  { emoji: "🌱", bg: "#14532d" },
};

// ── Indices ───────────────────────────────────────────────────────────────────
const INDEX_ICONS: Record<string, { emoji: string; bg: string }> = {
  SPX:  { emoji: "🇺🇸", bg: "#0f2240" },
  SP500:{ emoji: "🇺🇸", bg: "#0f2240" },
  DJI:  { emoji: "🏛️", bg: "#0f2240" },
  NDX:  { emoji: "💻", bg: "#0f1f40" },
  NAS100:{ emoji: "💻", bg: "#0f1f40" },
  DAX:  { emoji: "🇩🇪", bg: "#1a1a2e" },
  UKX:  { emoji: "🇬🇧", bg: "#0d1b2e" },
  FTSE: { emoji: "🇬🇧", bg: "#0d1b2e" },
  CAC:  { emoji: "🇫🇷", bg: "#0d162e" },
  NKY:  { emoji: "🇯🇵", bg: "#2e0d0d" },
  N225: { emoji: "🇯🇵", bg: "#2e0d0d" },
  HSI:  { emoji: "🇭🇰", bg: "#2e0d0d" },
  ASX:  { emoji: "🇦🇺", bg: "#0d1a2e" },
  AUS200:{ emoji: "🇦🇺", bg: "#0d1a2e" },
  VIX:  { emoji: "⚡", bg: "#1a0d2e" },
  IBEX: { emoji: "🇪🇸", bg: "#1a0d1a" },
  SMI:  { emoji: "🇨🇭", bg: "#1a0d0d" },
  STOXX:{ emoji: "🇪🇺", bg: "#0d1a2e" },
};

// ─────────────────────────────────────────────────────────────────────────────
export function getInstrumentIcon(symbol: string): IconSource {
  if (!symbol) return { type: "emoji", emoji: "📈", bg: "#1e293b" };

  const upper = symbol.toUpperCase().trim();

  // ── Slash-format pairs: EUR/USD, BTC/USD, XAU/USD ──────────────────────────
  if (upper.includes("/")) {
    const [base] = upper.split("/");

    // Crypto base?
    if (CRYPTO_ICONS[base]) {
      return { type: "img", url: CRYPTO_ICONS[base], bg: "#0f172a", pad: 8 };
    }
    // Currency flag (forex)?
    if (CURRENCY_FLAGS[base]) {
      return { type: "img", url: CURRENCY_FLAGS[base], bg: "#1e3a5f", pad: 0 };
    }
    // Commodity metal (XAU, XAG)?
    if (COMMODITY_ICONS[base]) {
      return { type: "emoji", ...COMMODITY_ICONS[base] };
    }
    // Generic pair fallback
    return { type: "emoji", emoji: "💱", bg: "#1e293b" };
  }

  // ── No slash — could be stock, index, commodity, or flat crypto ────────────

  // Flat crypto (e.g. BTCUSD from WS keys)
  for (const [ticker, url] of Object.entries(CRYPTO_ICONS)) {
    if (upper === ticker || upper === `${ticker}USD` || upper === `${ticker}USDT`) {
      return { type: "img", url, bg: "#0f172a", pad: 8 };
    }
  }

  // Stock ticker
  if (STOCK_TICKERS.has(upper)) {
    return { type: "img", url: stockLogo(upper), bg: "#0f172a", pad: 6 };
  }

  // Index
  if (INDEX_ICONS[upper]) {
    return { type: "emoji", ...INDEX_ICONS[upper] };
  }

  // Commodity
  if (COMMODITY_ICONS[upper]) {
    return { type: "emoji", ...COMMODITY_ICONS[upper] };
  }

  // Flat forex pair like EURUSD → extract base
  if (upper.length === 6) {
    const base = upper.slice(0, 3);
    const quote = upper.slice(3, 6);
    if (CURRENCY_FLAGS[base]) {
      return { type: "img", url: CURRENCY_FLAGS[base], bg: "#1e3a5f", pad: 0 };
    }
    if (CRYPTO_ICONS[base]) {
      return { type: "img", url: CRYPTO_ICONS[base], bg: "#0f172a", pad: 8 };
    }
  }

  // Last resort: emoji
  return { type: "emoji", emoji: "📊", bg: "#1e293b" };
}
