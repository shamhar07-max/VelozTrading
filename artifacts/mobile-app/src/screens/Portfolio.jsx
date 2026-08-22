import { useEffect, useState } from "react";
import { getPositions, getPendingOrders, getOrders, closePosition, cancelPendingOrder } from "../api";
import { Seg, Empty, fmt, pnlCls } from "../components";

export default function Portfolio({ prices, reloadKey }) {
  const [seg, setSeg] = useState("open");
  const [positions, setPositions] = useState(null);
  const [pending, setPending] = useState(null);
  const [orders, setOrders] = useState(null);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    const safe = (p) => p.then((r) => (Array.isArray(r) ? r : [])).catch(() => []);
    setPositions(await safe(getPositions()));
    setPending(await safe(getPendingOrders()));
    setOrders(await safe(getOrders()));
  }
  useEffect(() => { load(); }, [reloadKey]);

  async function doClose(pos) {
    const p = prices[pos.symbol];
    setBusyId(pos.id);
    try {
      await closePosition(pos.id, p ? { closePrice: pos.direction === "buy" ? (p.bid ?? p.price) : (p.ask ?? p.price) } : {});
    } finally { setBusyId(null); load(); }
  }
  async function doCancel(id) {
    setBusyId(id);
    try { await cancelPendingOrder(id); } finally { setBusyId(null); load(); }
  }

  return (
    <div>
      <Seg options={[{ id: "open", label: `Open (${positions?.length ?? "…"})` }, { id: "pending", label: "Pending" }, { id: "history", label: "History" }]} value={seg} onChange={setSeg} />

      {seg === "open" && (
        positions == null ? <div className="spinner" /> :
        positions.length === 0 ? <Empty>No open positions.<br /><span className="tiny">Place a trade from the Trade tab.</span></Empty> :
        positions.map((pos) => {
          const live = prices[pos.symbol];
          const open = parseFloat(pos.openPrice);
          const cur = live ? (pos.direction === "buy" ? (live.bid ?? live.price) : (live.ask ?? live.price)) : null;
          return (
            <div className="pos-card" key={pos.id}>
              <div className="pos-head">
                <div><strong>{pos.symbol}</strong><span className={"side-tag " + pos.direction}>{pos.direction.toUpperCase()}</span></div>
                <div style={{ textAlign: "right" }}>
                  <div className={"num " + pnlCls(pos.profit)} style={{ fontWeight: 900, fontSize: 16 }}>
                    {Number(pos.profit) >= 0 ? "+" : ""}${fmt(pos.profit)}
                  </div>
                  <div className="tiny">{fmt(pos.volume)} lots @ {open}</div>
                </div>
              </div>
              <div className="grid3 tiny num" style={{ marginBottom: 10 }}>
                <div><div className="stat k">Now</div><div className="stat v">{cur ? cur.toFixed(5) : open}</div></div>
                <div><div className="stat k">SL</div><div className="stat v">{pos.stopLoss ?? "—"}</div></div>
                <div><div className="stat k">TP</div><div className="stat v">{pos.takeProfit ?? "—"}</div></div>
              </div>
              <button className={"btn " + (pos.direction === "buy" ? "sell" : "buy")} disabled={busyId === pos.id} onClick={() => doClose(pos)}>
                {busyId === pos.id ? "Closing…" : "Close position"}
              </button>
            </div>
          );
        })
      )}

      {seg === "pending" && (
        pending == null ? <div className="spinner" /> :
        pending.length === 0 ? <Empty>No pending orders.</Empty> :
        pending.map((po) => (
          <div className="pos-card" key={po.id}>
            <div className="pos-head">
              <div><strong>{po.symbol}</strong><span className="side-tag dim" style={{ background: "rgba(132,142,156,.14)", color: "var(--text-dim)" }}>{(po.orderType ?? po.direction)?.toUpperCase?.() ?? po.direction}</span></div>
              <div className="tiny">{fmt(po.volume)} lots</div>
            </div>
            <div className="grid3 tiny num">
              <div><div className="stat k">Limit</div><div className="stat v">{fmt(po.limitPrice, 5)}</div></div>
              {po.stopPrice && <div><div className="stat k">Stop</div><div className="stat v">{fmt(po.stopPrice, 5)}</div></div>}
              <div><div className="stat k">SL / TP</div><div className="stat v">{po.stopLoss ?? "—"} / {po.takeProfit ?? "—"}</div></div>
            </div>
            <button className="btn ghost" style={{ marginTop: 10 }} disabled={busyId === po.id} onClick={() => doCancel(po.id)}>
              {busyId === po.id ? "Cancelling…" : "Cancel order"}
            </button>
          </div>
        ))
      )}

      {seg === "history" && (
        orders == null ? <div className="spinner" /> :
        orders.length === 0 ? <Empty>No closed trades yet.</Empty> :
        orders.map((o) => (
          <div key={o.id} className="li">
            <div className="grow">
              <div className="t1">{o.symbol} <span className={"side-tag " + o.direction}>{o.direction?.toUpperCase()}</span></div>
              <div className="t2">{fmt(o.volume)} lots · {o.openPrice} → {o.closePrice}{o.closeTime ? ` · ${new Date(o.closeTime).toLocaleDateString()}` : ""}</div>
            </div>
            <div className={"right num " + pnlCls(o.profit)} style={{ fontWeight: 800 }}>
              {Number(o.profit) >= 0 ? "+" : ""}${fmt(o.profit)}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
