// Canonical trading math shared by routes and background jobs.
// These functions are the single source of truth for the formulas that were
// previously inlined (and duplicated) across positions.ts, admin.ts and
// priceStreamer.ts. New call sites should use these instead of re-deriving.

export interface PnlInput {
  direction: "buy" | "sell";
  openPrice: number;
  closePrice: number;
  volume: number;
  lotSize: number;
}

/** Signed profit/loss in account currency for closing a position at closePrice. */
export function computePositionPnl({
  direction,
  openPrice,
  closePrice,
  volume,
  lotSize,
}: PnlInput): number {
  const raw =
    direction === "buy" ? closePrice - openPrice : openPrice - closePrice;
  return raw * volume * lotSize;
}

export interface MarginInput {
  price: number;
  volume: number;
  lotSize: number;
  leverage: number;
}

/** Margin locked by a position: notional ÷ leverage. */
export function computeRequiredMargin({
  price,
  volume,
  lotSize,
  leverage,
}: MarginInput): number {
  return (price * volume * lotSize) / leverage;
}

export interface MarginPositionsInput {
  balance: number;
  positions: Array<{
    direction: "buy" | "sell";
    openPrice: number;
    currentPrice: number;
    volume: number;
    lotSize: number;
    leverage: number;
  }>;
}

export interface MarginMetrics {
  floatingPnl: number;
  equity: number;
  usedMargin: number;
  freeMargin: number;
  /** Percentage — the stop-out engine force-closes at < 50%. */
  marginLevel: number;
}

export function computeMarginMetrics({
  balance,
  positions,
}: MarginPositionsInput): MarginMetrics {
  let floatingPnl = 0;
  let usedMargin = 0;
  for (const p of positions) {
    floatingPnl += computePositionPnl({
      direction: p.direction,
      openPrice: p.openPrice,
      closePrice: p.currentPrice,
      volume: p.volume,
      lotSize: p.lotSize,
    });
    usedMargin += computeRequiredMargin({
      price: p.currentPrice,
      volume: p.volume,
      lotSize: p.lotSize,
      leverage: p.leverage,
    });
  }
  const equity = balance + floatingPnl;
  const freeMargin = equity - usedMargin;
  const marginLevel = usedMargin > 0 ? (equity / usedMargin) * 100 : 0;
  return { floatingPnl, equity, usedMargin, freeMargin, marginLevel };
}
