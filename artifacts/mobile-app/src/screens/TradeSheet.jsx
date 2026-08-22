import { useEffect, useMemo, useState } from "react";

export default function TradeSheet({ instrument, price, onClose, onDone }) {
  const isCrypto = instrument.type === "crypto";
  const [side, setSide] = useState("buy");
  const [lots, setLots] = useState("0.01");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(null);

  // live executable price
  const exec = useMemo(() => {
    if (!price) return null;
    return side === "buy" ? (price.ask ?? price.price) : (price.bid ?? price.price);
  }, [price, side]);

  async function submit() {
    setBusy(true); setErr(null);
    try {
      const body = {
        symbol: instrument.symbol,
        direction: side,
        volume: parseFloat(lots),
      };
      if (sl) body.stopLoss = parseFloat(sl);
      if (tp) body.takeProfit = parseFloat(tp);
      const res = await fetch("/api/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setOk(data);
    } catch (e) {
      if (e.message === "AUTH") { window.location.href = "/sign-in?redirect_url=/m/"; return; }
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const lotsNum = parseFloat(lots) || 0;
  const notional = exec && lotsNum ? exec * lotsNum * (instrument.lotSize || 1) : 0;

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="row-split" style={{ marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 17 }}>{instrument.symbol}</div>
            <div className="tiny">{instrument.name}</div>
          </div>
          <div className="num" style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{exec ? exec.toFixed(instrument.pip >= 1 ? 2 : 5) : "…"}</div>
            <div className="tiny">{side === "buy" ? "ASK" : "BID"}</div>
          </div>
        </div>

        {!ok ? (
          <>
            <div className="seg">
              <button className={side === "buy" ? "on-buy" : ""} onClick={() => setSide("buy")}>BUY / LONG</button>
              <button className={side === "sell" ? "on-sell" : ""} onClick={() => setSide("sell")}>SELL / SHORT</button>
            </div>

            <div className="field">
              <label>Volume (lots)</label>
              <div className="lot-stepper">
                <button onClick={() => setLots((v) => Math.max(isCrypto ? 0.01 : 0.01, (parseFloat(v) || 0.01) - (isCrypto ? 0.01 : 0.01)).toString())}>−</button>
                <input
                  type="number" inputMode="decimal" step={isCrypto ? 0.01 : 0.01} min="0.01" max="100"
                  value={lots} onChange={(e) => setLots(e.target.value)}
                />
                <button onClick={() => setLots((v) => ((parseFloat(v) || 0) + (isCrypto ? 0.01 : 0.01)).toString())}>+</button>
              </div>
              {notional > 0 && (
                <div className="tiny num" style={{ marginTop: 6 }}>
                  Notional ≈ ${notional.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  {" · "}Margin ≈ ${(notional / (isCrypto ? 5 : instrument.type === "forex" ? 1000 : 10)).toLocaleString("en-US",{maximumFractionDigits:2})}
                </div>
              )}
            </div>

            <div className="grid2">
              <div className="field"><label>Stop loss</label>
                <input className="inp num" inputMode="decimal" placeholder="Optional" value={sl} onChange={(e)=>setSl(e.target.value)} /></div>
              <div className="field"><label>Take profit</label>
                <input className="inp num" inputMode="decimal" placeholder="Optional" value={tp} onChange={(e)=>setTp(e.target.value)} /></div>
            </div>

            {err && <div className="badge err" style={{ display:"block", padding:"10px 12px", marginBottom:12 }}>{err}</div>}

            <button className={"btn " + side} disabled={busy || !exec || lotsNum <= 0} onClick={submit}>
              {busy ? "Placing…" : `${side === "buy" ? "Buy" : "Sell"} ${lots || "—"} lots @ ${exec ? exec.toFixed(5) : "—"}`}
            </button>
            <button className="btn ghost" style={{ marginTop: 8 }} onClick={onClose}>Cancel</button>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "14px 4px" }}>
            <div style={{ fontSize: 40 }}>✅</div>
            <div style={{ fontWeight: 900, fontSize: 18, margin: "6px 0 4px" }}>Order filled</div>
            <div className="tiny num">{side.toUpperCase()} {lots} lots {instrument.symbol} @ {ok.openPrice ?? exec}</div>
            <button className="btn primary" style={{ marginTop: 16 }} onClick={() => { onDone?.(); onClose(); }}>View position</button>
          </div>
        )}
      </div>
    </>
  );
}
