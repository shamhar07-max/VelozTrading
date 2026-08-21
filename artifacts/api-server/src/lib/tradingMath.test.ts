import { describe, it, expect } from "vitest";
import { computePositionPnl, computeRequiredMargin, computeMarginMetrics } from "./tradingMath";

describe("computePositionPnl", () => {
  it("long position profits when price rises", () => {
    expect(
      computePositionPnl({ direction: "buy", openPrice: 100, closePrice: 101, volume: 2, lotSize: 1 })
    ).toBeCloseTo(2);
  });

  it("short position profits when price falls", () => {
    expect(
      computePositionPnl({ direction: "sell", openPrice: 100, closePrice: 99, volume: 1, lotSize: 1 })
    ).toBeCloseTo(1);
  });

  it("applies contract lot size (100k forex standard lot)", () => {
    const pnl = computePositionPnl({
      direction: "buy",
      openPrice: 1.1,
      closePrice: 1.1005,
      volume: 1,
      lotSize: 100_000,
    });
    expect(pnl).toBeCloseTo(50); // 5 pips × $10/pip
  });

  it("is symmetric — same prices reversed direction negate PnL", () => {
    const a = computePositionPnl({ direction: "buy", openPrice: 50, closePrice: 55, volume: 3, lotSize: 10 });
    const b = computePositionPnl({ direction: "sell", openPrice: 50, closePrice: 55, volume: 3, lotSize: 10 });
    expect(a).toBeCloseTo(-b);
  });
});

describe("computeRequiredMargin", () => {
  it("divides notional by leverage", () => {
    // €100k notional at 1:1000 → $100 margin
    expect(computeRequiredMargin({ price: 1.1, volume: 1, lotSize: 100_000, leverage: 1000 })).toBeCloseTo(110);
    // 1 BTC at 1:5 → 20% of notional
    expect(computeRequiredMargin({ price: 60_000, volume: 1, lotSize: 1, leverage: 5 })).toBeCloseTo(12_000);
  });
});

describe("computeMarginMetrics", () => {
  it("equity = balance + floating PnL; free margin = equity − used margin", () => {
    const m = computeMarginMetrics({
      balance: 10_000,
      positions: [
        { direction: "buy" as const, openPrice: 100, currentPrice: 110, volume: 1, lotSize: 1, leverage: 10 },
      ],
    });
    expect(m.floatingPnl).toBeCloseTo(10);
    expect(m.equity).toBeCloseTo(10_010);
    expect(m.usedMargin).toBeCloseTo(11); // 110 notional ÷ 10 leverage
    expect(m.freeMargin).toBeCloseTo(9_999);
    expect(m.marginLevel).toBeCloseTo((10_010 / 11) * 100);
  });

  it("margin level is 0 when no margin is used", () => {
    const m = computeMarginMetrics({ balance: 500, positions: [] });
    expect(m.marginLevel).toBe(0);
    expect(m.equity).toBe(500);
  });

  it("stop-out threshold math: engine force-closes when level < 50% (documented invariant)", () => {
    // Equity 55 on 100 used margin → 55% level → no stop-out
    const safe = computeMarginMetrics({
      balance: 50,
      positions: [
        { direction: "buy" as const, openPrice: 100, currentPrice: 105, volume: 1, lotSize: 1, leverage: 1 },
      ],
    });
    expect(safe.marginLevel).toBeGreaterThan(50);

    // Equity 40 on 90 used margin → 44% level → below stop-out threshold
    const unsafe = computeMarginMetrics({
      balance: 50,
      positions: [
        { direction: "buy" as const, openPrice: 100, currentPrice: 90, volume: 1, lotSize: 1, leverage: 1 },
      ],
    });
    expect(unsafe.marginLevel).toBeLessThan(50);
  });
});
