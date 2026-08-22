import { useEffect, useState } from "react";
import { getWatchlist, removeFromWatchlist } from "../api";
import { Empty } from "../components";

export default function Watchlist({ prices, instruments, onTrade }) {
  const [items, setItems] = useState(null);

  function load() {
    getWatchlist().then((w) => setItems(Array.isArray(w) ? w : [])).catch(() => setItems([]));
  }
  useEffect(() => { load(); }, []);

  async function remove(sym) {
    setItems((xs) => xs.filter((x) => (x.symbol ?? x) !== sym));
    try { await removeFromWatchlist(sym); } catch { load(); }
  }

  if (items == null) return <div className="spinner" />;
  return (
    <div>
      {items.length === 0 && <Empty>Your watchlist is empty.<br /><span className="tiny">Star instruments in Markets to add them here.</span></Empty>}
      {items.map((w) => {
        const sym = w.symbol ?? w;
        const inst = instruments.find((i) => i.symbol === sym);
        const p = prices[sym];
        const up = (p?.changePercent ?? 0) >= 0;
        return (
          <div key={sym} className="mkt-row">
            <div style={{ textAlign: "left", minWidth: 0, cursor: "pointer", flex: 1 }} onClick={() => onTrade(sym)}>
              <div className="mkt-name">{sym}</div>
              <div className="mkt-sub">{inst?.name ?? ""}</div>
            </div>
            <div className="mkt-price num">
              {p ? fmt2(p.price) : "—"}
              <div className={"mkt-chg num " + (up ? "up" : "down")}>
                {p ? `${up ? "▲" : "▼"} ${Math.abs(p.changePercent ?? 0).toFixed(2)}%` : ""}
              </div>
            </div>
            <button className="iconbtn" onClick={() => remove(sym)} aria-label="Remove"><span style={{ fontSize: 16 }}>✕</span></button>
          </div>
        );
      })}
    </div>
  );
}
function fmt2(p) {
  if (p >= 1000) return p.toLocaleString("en-US", { maximumFractionDigits: 1 });
  return p.toFixed(p >= 10 ? 2 : 4);
}
