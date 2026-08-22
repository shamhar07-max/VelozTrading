import { useEffect, useState } from "react";

function pnlClass(v) { return v >= 0 ? "up" : "down"; }

export default function Positions({ prices, reloadKey }) {
  const [positions, setPositions] = useState(null);
  const [orders, setOrders] = useState(null);
  const [closing, setClosing] = useState(null);

  async function load() {
    try {
      const [p, o] = await Promise.all([
        fetch("/api/positions", { credentials: "include" }).then((r) => (r.ok ? r.json() : [])),
        fetch("/api/orders?limit=20", { credentials: "include" }).then((r) => {
          if (!r.ok) return [];
          return r.json().then((d) => d.items ?? d);
        }),
      ]);
      setPositions(Array.isArray(p) ? p : []);
      setOrders(Array.isArray(o) ? o : []);
    } catch { setPositions([]); setOrders([]); }
  }
  useEffect(() => { load(); }, [reloadKey]);

  async function close(pos) {
    const p = prices[pos.symbol];
    const closePrice = pos.direction === "buy" ? (p?.bid ?? null) : (p?.ask ?? null);
    setClosing(pos.id);
    try {
      await fetch(`/api/positions/${pos.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(closePrice ? { closePrice } : {}),
      });
    } finally { setClosing(null); load(); }
  }

  if (positions == null) return <div className="spinner" />;

  return (
    <div>
      <div className="card-title" style={{ margin: "2px 0 10px" }}>Open positions ({positions.length})</div>
      {positions.length === 0 && (
        <div className="card"><div className="empty">No open positions.<br /><span className="tiny">Tap any instrument in Markets to place a trade.</span></div></div>
      )}

      {positions.map((pos) => {
        const live = prices[pos.symbol];
        const open = parseFloat(pos.openPrice);
        const vol = parseFloat(pos.volume);
        const cur = live ? (pos.direction === "buy" ? (live.bid ?? live.price) : (live.ask ?? live.price)) : null;
        // server already returns profit; recompute only when we have live price
        const shownPnl = pos.profit ?? 0;
        return (
          <div className="pos-card" key={pos.id}>
            <div className="pos-head">
              <div>
                <strong>{pos.symbol}</strong>
                <span className={"side-tag " + pos.direction}>{pos.direction.toUpperCase()}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className={"num " + pnlClass(shownPnl)} style={{ fontWeight: 900, fontSize: 16 }}>
                  {shownPnl >= 0 ? "+" : ""}${Number(shownPnl).toFixed(2)}
                </div>
                <div className="tiny">{vol} lots @ {open}</div>
              </div>
            </div>
            <div className="grid3 tiny num" style={{ marginBottom: 10 }}>
              <div><div className="stat k">Now</div><div className="stat v">{cur ? cur.toFixed(5) : open}</div></div>
              <div><div className="stat k">SL</div><div className="stat v">{pos.stopLoss ?? "—"}</div></div>
              <div><div className="stat k">TP</div><div className="stat v">{pos.takeProfit ?? "—"}</div></div>
            </div>
            <button className={"btn " + (pos.direction === "buy" ? "sell" : "buy")} disabled={closing === pos.id}
              onClick={() => close(pos)}>
              {closing === pos.id ? "Closing…" : `Close position`}
            </button>
          </div>
        );
      })}

      <div className="card-title" style={{ margin: "18px 0 10px" }}>Recent orders</div>
      {(orders ?? []).slice(0, 12).map((o) => (
        <div key={o.id} className="mkt-row" style={{ gridTemplateColumns: "1fr auto auto", padding: "10px 12px" }}>
          <div>
            <div className="mkt-name">{o.symbol} <span className={"side-tag " + o.direction}>{o.direction?.toUpperCase()}</span></div>
            <div className="tiny">{o.volume} lots · {o.openPrice} → {o.closePrice}</div>
          </div>
          <div />
          <div className={"num " + pnlClass(parseFloat(o.profit))} style={{ fontWeight: 800 }}>
            {parseFloat(o.profit) >= 0 ? "+" : ""}{o.profit}
          </div>
        </div>
      ))}
    </div>
  );
}
