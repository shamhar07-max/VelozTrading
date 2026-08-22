import { useEffect, useState } from "react";
import { getAccount, patchAccount } from "../api";
import { IconChevronR } from "../icons2";

const LEVERAGES = [10, 25, 50, 100, 200, 500];

export default function Profile({ clerk, onLogout }) {
  const [acc, setAcc] = useState(null);
  const user = clerk?.user;
  useEffect(() => { getAccount().then(setAcc).catch(() => {}); }, []);

  async function setLeverage(l) {
    const old = acc?.leverage;
    setAcc((a) => ({ ...a, leverage: l }));
    try { await patchAccount({ leverage: l }); }
    catch { setAcc((a) => ({ ...a, leverage: old })); }
  }

  const name = user ? [user.firstName, user.lastName].filter(Boolean).join(" ") : acc?.mockName ?? "Trader";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  return (
    <div>
      <div className="card hero" style={{ textAlign: "center", padding: "24px 16px" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg,var(--brand),var(--violet))",
          display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px",
          fontSize: 26, fontWeight: 900, color: "#fff" }}>
          {(name[0] ?? "V").toUpperCase()}
        </div>
        <div style={{ fontWeight: 900, fontSize: 17 }}>{name}</div>
        <div className="tiny">{email}</div>
        <span className={"badge " + (acc?.kycStatus === "verified" ? "ok" : acc?.kycStatus === "pending" ? "warn" : "dim")}
          style={{ display: "inline-block", marginTop: 8 }}>
          KYC · {(acc?.kycStatus ?? "unverified").toUpperCase()}
        </span>
      </div>

      <div className="card">
        <div className="card-title">Default leverage</div>
        <div className="grid3">
          {LEVERAGES.map((l) => (
            <button key={l} className={"chip" + (acc?.leverage === l ? " on" : "")} style={{ textAlign: "center" }}
              onClick={() => setLeverage(l)}>1:{l}</button>
          ))}
        </div>
        <p className="tiny" style={{ marginTop: 8 }}>Applies to new positions. Actual margin per asset class varies.</p>
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "4px 14px", marginBottom: 12 }}>
        <a className="li" href="/ib"><div className="grow"><div className="t1">IB Panel</div><div className="t2">Introducing-broker desk</div></div><IconChevronR className="chev" /></a>
        <a className="li" href="/partner"><div className="grow"><div className="t1">Partner Portal</div><div className="t2">Full partner dashboard</div></div><IconChevronR className="chev" /></a>
        <a className="li" href="/notifications"><div className="grow"><div className="t1">Notifications</div></div><IconChevronR className="chev" /></a>
        <a className="li" href="/support"><div className="grow"><div className="t1">Support & Live chat</div></div><IconChevronR className="chev" /></a>
      </div>

      <button className="btn ghost" onClick={onLogout}>Sign out</button>
      <p className="tiny" style={{ textAlign: "center", marginTop: 12 }}>VelozTrade Mobile v1.0 · FSCA 51748</p>
    </div>
  );
}
