import { useEffect, useState } from "react";
import { IconDown, IconUp, IconWallet, IconLayers, IconShield } from "../icons";

export default function Account({ onLogout }) {
  const [acc, setAcc] = useState(null);
  const [ib, setIb] = useState(null);

  useEffect(() => {
    fetch("/api/account", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null)).then(setAcc);
    fetch("/api/ib/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null)).then(setIb);
  }, []);

  if (!acc) return <div className="spinner" />;
  const kycBadge =
    acc.kycStatus === "verified" ? { cls: "ok", txt: "KYC VERIFIED" } :
    acc.kycStatus === "pending"  ? { cls: "warn", txt: "KYC PENDING" } : { cls: "dim", txt: "KYC REQUIRED" };

  return (
    <div>
      <div className="card hero">
        <div className="row-split">
          <div>
            <div className="stat k">Equity (real)</div>
            <div className="big num">${Number(acc.balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
          </div>
          <span className={"badge " + kycBadge.cls}>{kycBadge.txt}</span>
        </div>
        <div className="grid3" style={{ marginTop: 14 }}>
          <div className="stat"><div className="k">Free margin</div><div className="v num">${Number(acc.freeMargin).toFixed(0)}</div></div>
          <div className="stat"><div className="k">Floating P&L</div><div className={"v num " + pnl(acc.floatingPnl)}>${Number(acc.floatingPnl).toFixed(0)}</div></div>
          <div className="stat"><div className="k">Demo balance</div><div className="v num">${Number(acc.demoBalance).toFixed(0)}</div></div>
        </div>
      </div>

      {ib && (
        <div className="card">
          <div className="card-title"><IconLayers /> IB Partner · {ib.referralCode}</div>
          <div className="grid3">
            <div className="stat"><div className="k">Clients</div><div className="v num">{ib.totalClients}</div></div>
            <div className="stat"><div className="k">Book AUM</div><div className="v num">${Number(ib.totalAum).toLocaleString("en-US",{maximumFractionDigits:0})}</div></div>
            <div className="stat"><div className="k">Sub-IBs</div><div className="v num">{ib.subIbCount}</div></div>
          </div>
        </div>
      )}

      <div className="quick-actions">
        <button className="qa" onClick={() => (window.location.href = "/deposit")}><IconDown /><span>Deposit</span></button>
        <button className="qa" onClick={() => (window.location.href = "/withdraw")}><IconUp /><span>Withdraw</span></button>
        <button className="qa" onClick={() => (window.location.href = "/funds-history")}><IconWallet /><span>Funds</span></button>
        <button className="qa" onClick={() => (window.location.href = "/partner")}><IconShield /><span>Partner</span></button>
      </div>

      <button className="btn ghost" onClick={onLogout}>Sign out of VelozTrade</button>
      <p className="tiny" style={{ textAlign: "center", marginTop: 14 }}>
        FSCA License No. 51748 · Negative balance protection<br />
        CFDs are complex instruments — capital at risk.
      </p>
    </div>
  );
}
function pnl(v) { return v >= 0 ? "up" : "down"; }
