import { describe, it, expect } from "vitest";
import {
  INSTRUMENTS,
  INSTRUMENT_MAP,
  LEVERAGE_BY_TYPE,
  TIER_CONFIG,
  isMarketOpen,
  toInstrumentSymbol,
  toTwelveDataSymbol,
} from "./instruments";

describe("instrument catalog integrity", () => {
  it("has unique symbols", () => {
    const symbols = INSTRUMENTS.map((i) => i.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
  });

  it("every instrument has positive pip and lot size", () => {
    for (const inst of INSTRUMENTS) {
      expect(inst.pip).toBeGreaterThan(0);
      expect(inst.lotSize).toBeGreaterThan(0);
      expect(INSTRUMENT_MAP.get(inst.symbol)).toBe(inst);
    }
  });

  it("covers all five asset classes with known leverage", () => {
    const types = new Set(INSTRUMENTS.map((i) => i.type));
    expect([...types].sort()).toEqual(["commodities", "crypto", "forex", "indices", "stocks"]);
    for (const t of types) expect(LEVERAGE_BY_TYPE[t]).toBeGreaterThan(0);
  });

  it("tier config improves monotonically with deposit requirements", () => {
    const tiers = ["real", "silver", "gold", "platinum", "vip"];
    let prevCommission = Infinity;
    let prevMinDeposit = -Infinity;
    for (const t of tiers) {
      const cfg = TIER_CONFIG[t]!;
      expect(cfg.commissionPerLot).toBeLessThanOrEqual(prevCommission);
      expect(cfg.minDeposit).toBeGreaterThanOrEqual(prevMinDeposit);
      prevCommission = cfg.commissionPerLot;
      prevMinDeposit = cfg.minDeposit;
    }
    expect(TIER_CONFIG["vip"]!.commissionPerLot).toBe(0);
  });
});

describe("isMarketOpen", () => {
  // Wed 2026-08-19 (weekday), Sat 2026-08-22 (weekend) — all times UTC
  const wed = (h: number, m = 0) => new Date(Date.UTC(2026, 7, 19, h, m));
  const sat = (h: number, m = 0) => new Date(Date.UTC(2026, 7, 22, h, m));

  it("crypto trades 24/7 including weekends", () => {
    expect(isMarketOpen("BTC/USD", wed(3))).toBe(true);
    expect(isMarketOpen("BTC/USD", sat(3))).toBe(true);
  });

  it("forex closes on weekends, open on weekdays at any hour", () => {
    expect(isMarketOpen("EUR/USD", sat(12))).toBe(false);
    expect(isMarketOpen("EUR/USD", wed(3))).toBe(true);
    expect(isMarketOpen("EUR/USD", wed(21))).toBe(true);
  });

  it("commodities follow weekend rule but no intraday session", () => {
    expect(isMarketOpen("XAU/USD", sat(12))).toBe(true);
    expect(isMarketOpen("XAU/USD", wed(2))).toBe(true);
  });

  it("US stocks & US indices trade 13:30–20:00 UTC on weekdays", () => {
    expect(isMarketOpen("AAPL", wed(13, 29))).toBe(false);
    expect(isMarketOpen("AAPL", wed(13, 30))).toBe(true);
    expect(isMarketOpen("AAPL", wed(19, 59))).toBe(true);
    expect(isMarketOpen("AAPL", wed(20, 0))).toBe(false);
    expect(isMarketOpen("SPX", wed(14))).toBe(true);
    expect(isMarketOpen("AAPL", sat(14))).toBe(false);
  });

  it("European indices trade 07:00–16:30 UTC on weekdays", () => {
    expect(isMarketOpen("DAX", wed(6, 59))).toBe(false);
    expect(isMarketOpen("DAX", wed(7, 0))).toBe(true);
    expect(isMarketOpen("DAX", wed(16, 29))).toBe(true);
    expect(isMarketOpen("DAX", wed(16, 30))).toBe(false);
  });

  it("unknown symbols default to open (fail-open like production behaviour)", () => {
    expect(isMarketOpen("NOPE/USD", wed(3))).toBe(true);
  });
});

describe("symbol mapping", () => {
  it("round-trips TwelveData routing symbols", () => {
    expect(toTwelveDataSymbol("USOIL")).toBe("WTI/USD");
    expect(toTwelveDataSymbol("VIX")).toBe("VIX:CBOE");
    expect(toTwelveDataSymbol("EUR/USD")).toBe("EUR/USD");
  });

  it("resolves slashed and unslashed variants back to catalog symbols", () => {
    expect(toInstrumentSymbol("BTCUSD")).toBe("BTC/USD");
    expect(toInstrumentSymbol("BTC/USD")).toBe("BTC/USD");
    expect(toInstrumentSymbol("UNKNOWN")).toBe("UNKNOWN");
  });
});
