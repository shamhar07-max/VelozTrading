import { useEffect, useMemo, useState } from "react";
import { openPosition } from "../api";
import { fmt } from "../components";
import CandleChart from "../components/Chart.jsx";

export default function TradeScreen({ instruments, prices, initialSymbol, onOpened }) {
  const [sym, setSym] = useState(initialSymbol ?? "EUR/USD");
  const [side, setSide] = useState("buy");
  const [lots, setLots] = useState("0.01");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [okMsg, setOkMsg] = useState(null);
  const [pickOpen, setPickOpen] = useState(false);

  const inst = instruments.find((i) => i.symbol === sym) ?? instruments[0];
  const p = prices[sym];

  useEffect(() => { if (initialSymbol) setSym(initialSymbol); }, [initialSymbol]);

  const exec = useMemo(() => {
    if (!p) return null;
    return side === "buy" ? (p.ask ?? p.price) : (p.bid ?? p.price);
  }, [p, side]);

  async function submit() {
    setBusy(true); setErr(null); setOkMsg(null);
    try {
      const body = { symbol: sym, direction: side, volume: parseFloat(lots) };
      if (sl) body.stopLoss = parseFloat(sl);
      if (tp) body.takeProfit = parseFloat(tp);
      await openPosition(body);
      setOkMsg(`${side === "buy" ? "Bought" : "Sold"} ${lots} lots ${sym}`);
      onOpened?.();
    } catch (e) {
      if (e.message === "AUTH") { window.location.href = "/sign-in?redirect_url=/m/"; return; }
      setErr(e.message);
    } finally { setBusy(false); }
  }

  const lotsNum = parseFloat(lots) || 0;
  const lev = inst ? ({ crypto: 5, forex: 1000, commodities: 100 }[inst.type] ?? 10) : 100;
  const notional = exec && lotsNum ? exec * lotsNum * (inst?.lotSize || 1) : 0;
  const margin = notional / lev;
  const decimals = inst ? (inst.pip >= 1 ? 2 : inst.pip >= 0.01 ? 3 : 5) : 5;

  return (
    <div>
      {/* Symbol picker */}
      <button className="inp" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}
        onClick={() => setPickOpen(!pickOpen)}>
        <span style={{ fontWeight: 900, fontSize: 17 }}>{sym}</span>
        <span className="tiny">{pickOpen ? "close ▲" : "change ▼"}</span>
      </button>
      {pickOpen && (
        <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 12, marginBottom: 10 }}>
          {instruments.map((i) => (
            <button key={i.symbol} className="li" style={{ padding: "10px 14px" }}
              onClick={() => { setSym(i.symbol); setPickOpen(false); }}>
              <div className="grow"><div className="t1">{i.symbol}</div><div className="t2">{i.name}</div></div>
              {prices[i.symbol] && <div className="num" style={{ fontWeight: 700 }}>{fmt(prices[i.symbol].price, i.pip >= 1 ? 2 : 5)}</div>}
            </button>
          ))}
        </div>
      )}

      {/* Chart */}
      <CandleChart symbol={sym} />

      {/* Live quote */}
      <div style={{ textAlign: "center", margin: "2px 0 8px" }}>
        <span className={"num " + ((p?.changePercent ?? 0) >= 0 ? "up" : "down")} style={{ fontWeight: 800, fontSize: 15 }}>
          {p ? fmt(p.price, decimals) : "…"} {(p?.changePercent ?? 0) >= 0 ? "▲" : "▼"}{Math.abs(p?.changePercent ?? 0).toFixed(2)}%
        </span>
      </div>

      <div className="big-quote">
        <div className="quote-box bid"><div className="lbl">SELL / BID</div><div className="v num">{p ? fmt(p.bid ?? (p.price - inst?.pip * 2), decimals) : "…"}</div></div>
        <div className="quote-box ask"><div className="lbl">BUY / ASK</div><div className="v num">{p ? fmt(p.ask ?? (p.price + inst?.pip * 2), decimals) : "…"}</div></div>
      </div>

      <div className="seg">
        <button className={side === "buy" ? "on-buy" : ""} onClick={() => setSide("buy")}>BUY / LONG</button>
        <button className={side === "sell" ? "on-sell" : ""} onClick={() => setSide("sell")}>SELL / SHORT</button>
      </div>

      <div className="field">
        <label>Volume (lots)</label>
        <div className="lot-stepper">
          <button onClick={() => setLots((v) => Math.max(0.01, (parseFloat(v) || 0.01) - 0.01).toString())}>−</button>
          <input type="number" inputMode="decimal" step="0.01" min="0.01" max="100" value={lots} onChange={(e) => setLots(e.target.value)} />
          <button onClick={() => setLots((v) => ((parseFloat(v) || 0) + 0.01).toFixed(2))}>+</button>
        </div>
        <div className="pill-scroll" style={{ marginTop: 8 }}>
          {[0.01, 0.05, 0.1, 0.5, 1].map((v) => (
            <button key={v} className={"spill" + (parseFloat(lots) === v ? " on" : "")} onClick={() => setLots(v.toFixed(2))}>{v}</button>
          ))}
        </div>
        {notional > 0 && (
          <div className="tiny num" style={{ marginTop: 6 }}>
            Notional ≈ ${fmt(notional, 0)} · Margin (1:{lev}) ≈ ${fmt(margin, 2)}
          </div>
        )}
      </div>

      <div className="grid2">
        <div className="field"><label>Stop loss</label>
          <input className="inp num" inputMode="decimal" placeholder="Optional" value={sl} onChange={(e) => setSl(e.target.value)} /></div>
        <div className="field"><label>Take profit</label>
          <input className="inp num" inputMode="decimal" placeholder="Optional" value={tp} onChange={(e) => setTp(e.target.value)} /></div>
      </div>

      {err && <div className="badge err" style={{ display: "block", padding: "10px 12px", marginBottom: 12 }}>{err}</div>}
      {okMsg && <div className="badge ok" style={{ display: "block", padding: "10px 12px", marginBottom: 12 }}>✓ {okMsg} — see Portfolio tab</div>}

      <button className={"btn " + side} disabled={busy || !exec || lotsNum <= 0} onClick={submit}>
        {busy ? "Placing order…" : `${side === "buy" ? "Buy" : "Sell"} ${lots || "—"} lots${exec ? ` @ ${exec.toFixed(decimals)}` : ""}`}
      </button>

      <p className="tiny" style={{ textAlign: "center", marginTop: 12 }}>
        Leverage 1:{lev} · Margin call 100% · Stop-out 50% · Swap applies overnight
      </p>
    </div>
  );
}
