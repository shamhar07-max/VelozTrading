import { useMemo } from "react";
import { Empty } from "../components";

// Signals v1: momentum derived from live feed — strongest movers both ways,
// with a naive trend read. Real analyst signals land in a later release.
export default function Signals({ prices, instruments, onTrade }) {
  const rows = useMemo(() => {
    return instruments
      .map((i) => ({ ...i, price: prices[i.symbol]?.price ?? null, chg: prices[i.symbol]?.changePercent ?? 0 }))
      .filter((r) => r.price != null && Math.abs(r.chg) > 0.05)
      .sort((a, b) => Math.abs(b.chg) - Math.abs(a.chg))
      .slice(0, 10);
  }, [prices, instruments]);

  return (
    <div>
      <div className="card-title">Momentum signals · live</div>
      {rows.length === 0 && <Empty>Waiting for live price movement…</Empty>}
      {rows.map((r) => {
        const bull = r.chg > 0;
        return (
          <div key={r.symbol} className="mkt-row" onClick={() => onTrade(r.symbol)} role="button">
            <div className={"symicon"} style={{ color: bull ? "var(--up)" : "var(--down)", borderColor: bull ? "rgba(14,203,129,.4)" : "rgba(246,70,93,.4)" }}>
              {bull ? "▲" : "▼"}
            </div>
            <div style={{ textAlign: "left", minWidth: 0 }}>
              <div className="mkt-name">{r.symbol}</div>
              <div className="mkt-sub">{bull ? "Bullish momentum" : "Bearish momentum"}</div>
            </div>
            <div className="mkt-price num">{r.price.toFixed(r.pip >= 1 ? 2 : 4)}</div>
            <div className={"num " + (bull ? "up" : "down")} style={{ fontWeight: 900, fontSize: 13.5 }}>
              {bull ? "+" : ""}{r.chg.toFixed(2)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}
