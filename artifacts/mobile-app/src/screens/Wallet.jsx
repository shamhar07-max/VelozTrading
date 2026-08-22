import { useEffect, useState } from "react";
import { getAccount, patchAccount, getFundsHistory } from "../api";
import { Empty, fmt, pnlCls } from "../components";

export default function Wallet() {
  const [acc, setAcc] = useState(null);
  const [funds, setFunds] = useState(null);
  const [busy, setBusy] = useState(false);

  function load() {
    getAccount().then(setAcc).catch(() => {});
    getFundsHistory().then((f) => setFunds(Array.isArray(f) ? f : [])).catch(() => setFunds([]));
  }
  useEffect(() => { load(); }, []);

  async function toggleDemo() {
    if (!acc) return;
    setBusy(true);
    try {
      const updated = await patchAccount({ isDemoMode: !acc.isDemoMode });
      setAcc((a) => ({ ...a, ...updated }));
    } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="card hero">
        <div className="row-split">
          <div>
            <div className="stat k">{acc?.isDemoMode ? "DEMO BALANCE" : "REAL BALANCE"}</div>
            <div className="big num">
              ${fmt(acc ? (acc.isDemoMode ? acc.demoBalance : acc.balance) : null)}
            </div>
          </div>
          <span className={"demo-pill " + (acc?.isDemoMode ? "on" : "off")}>{acc?.isDemoMode ? "PRACTICE" : "LIVE"}</span>
        </div>
      </div>

      <button className="li" style={{ marginBottom: 12 }} onClick={toggleDemo} disabled={busy}>
        <div className="grow"><div className="t1">Practice mode</div><div className="t2">Trade with virtual $10,000 — no risk</div></div>
        <span className={"toggle" + (acc?.isDemoMode ? " on" : "")}><i /></span>
      </button>

      <div className="quick-actions" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
        <button className="qa" onClick={() => (window.location.href = "/deposit")}><IconDown2 /><span>Deposit funds</span></button>
        <button className="qa" onClick={() => (window.location.href = "/withdraw")}><IconUp2 /><span>Withdraw</span></button>
      </div>

      <div className="card-title" style={{ margin: "10px 0 8px" }}>Funds history</div>
      {funds == null ? <div className="spinner" /> :
       funds.length === 0 ? <Empty>No transactions yet.</Empty> :
       funds.map((f, i) => (
        <div key={i} className="fund">
          <div>
            <div className="t1" style={{ fontSize: 13.5, fontWeight: 700 }}>{f.type ?? f.method ?? "Transaction"}</div>
            <div className="tiny">{new Date(f.createdAt ?? Date.now()).toLocaleString()}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className={"num " + pnlCls(f.amount)} style={{ fontWeight: 800 }}>
              {Number(f.amount) >= 0 ? "+" : ""}${fmt(f.amount)}
            </div>
            {f.status && <span className={"badge " + (f.status === "approved" || f.status === "completed" ? "ok" : f.status === "pending" ? "warn" : "dim")}>{f.status}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
function IconDown2(p) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>; }
function IconUp2(p) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>; }
