import { useEffect, useState } from "react";
import { getDashboardSummary, getWatchlist, getDashboardActivity } from "../api";
import { IconDown, IconUp, IconWallet, IconLayers, IconStar, IconBell } from "../icons";
import { fmt, pnlCls } from "../components";

export default function Home({ prices, instruments, onTrade, navigate, notifCount }) {
  const [sum, setSum] = useState(null);
  const [watch, setWatch] = useState([]);
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    getDashboardSummary().then(setSum).catch(() => {});
    getWatchlist().then((w) => setWatch(Array.isArray(w) ? w : [])).catch(() => {});
    getDashboardActivity().then((a) => setActivity(Array.isArray(a) ? a.slice(0, 4) : [])).catch(() => {});
  }, []);

  const movers = useMemoMovers(instruments, prices);

  return (
    <div>
      {/* Equity hero */}
      <div className="card hero">
        <div className="row-split">
          <div>
            <div className="stat k">EQUITY · {sum?.isDemoMode ? "DEMO" : "REAL"}</div>
            <div className="big num">${fmt(sum?.equity)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className={"num " + pnlCls(sum?.floatingPnl)} style={{ fontWeight: 900, fontSize: 15 }}>
              {sum?.floatingPnl >= 0 ? "+" : ""}${fmt(sum?.floatingPnl)}
            </div>
            <div className="tiny">Floating P&L</div>
          </div>
        </div>
        <div className="grid3" style={{ marginTop: 14 }}>
          <div className="stat"><div className="k">Balance</div><div className="v num">${fmt(sum?.balance, 0)}</div></div>
          <div className="stat"><div className="k">Free margin</div><div className="v num">${fmt(sum?.freeMargin, 0)}</div></div>
          <div className="stat"><div className="k">Margin lvl</div><div className="v num">{fmt(sum?.marginLevel, 0)}%</div></div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="quick-actions">
        <button className="qa" onClick={() => (window.location.href = "/deposit")}><IconDown /><span>Deposit</span></button>
        <button className="qa" onClick={() => (window.location.href = "/withdraw")}><IconUp /><span>Withdraw</span></button>
        <button className="qa" onClick={() => navigate("watchlist")}><IconStar /><span>Watchlist</span></button>
        <button className="qa" onClick={() => navigate("notifications")}>
          <span style={{ position: "relative", display: "inline-flex" }}>
            <IconBell />
            {notifCount > 0 && <span className="dot" style={{ position: "absolute", top: -2, right: -3 }} />}
          </span>
          <span>Alerts</span>
        </button>
      </div>

      {/* Market movers */}
      <div className="card-title" style={{ margin: "6px 0 10px" }}>Market movers</div>
      <div className="movers">
        {movers.map((m) => (
          <button key={m.symbol} className="mover" onClick={() => onTrade(m.symbol)}>
            <div className="s">{m.symbol}</div>
            <div className="n">{m.name}</div>
            <div className="p num">{m.price != null ? fmt(m.price, m.price >= 100 ? 1 : 4) : "—"}</div>
            <div className={"c num " + pnlCls(m.changePercent)}>
              {m.changePercent >= 0 ? "▲" : "▼"} {Math.abs(m.changePercent ?? 0).toFixed(2)}%
            </div>
          </button>
        ))}
        {movers.length === 0 && <div className="tiny">Fetching live prices…</div>}
      </div>

      {/* Watchlist preview */}
      {watch.length > 0 && (
        <>
          <div className="card-title" style={{ margin: "14px 0 10px" }}>My watchlist</div>
          {watch.slice(0, 5).map((w) => {
            const sym = w.symbol ?? w;
            const inst = instruments.find((i) => i.symbol === sym);
            const p = prices[sym];
            return (
              <div key={sym} className="mkt-row" onClick={() => onTrade(sym)} role="button">
                <div className="symicon">{(inst?.type === "crypto" ? "₿" : sym[0]) ?? "?"}</div>
                <div style={{ textAlign: "left" }}>
                  <div className="mkt-name">{sym}</div>
                  <div className="mkt-sub">{inst?.name ?? ""}</div>
                </div>
                <div />
                <div className="mkt-price num">
                  {p ? fmt(p.price, p.price >= 100 ? 1 : 4) : "—"}
                  <div className={"mkt-chg num " + pnlCls(p?.changePercent)}>
                    {p ? `${(p.changePercent ?? 0) >= 0 ? "▲" : "▼"} ${Math.abs(p.changePercent ?? 0).toFixed(2)}%` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Recent activity */}
      {activity.length > 0 && (
        <>
          <div className="card-title" style={{ margin: "14px 0 8px" }}>Recent activity</div>
          {activity.map((a, idx) => (
            <div key={idx} className="li">
              <div className="grow">
                <div className="t1">{a.symbol ?? a.type} <span className="tiny">{a.status ?? ""}</span></div>
                <div className="t2">{a.direction ? a.direction.toUpperCase() + " · " : ""}{a.volume ?? a.amount ?? ""} {new Date(a.openTime ?? a.createdAt ?? Date.now()).toLocaleDateString()}</div>
              </div>
              {a.profit != null && (
                <div className={"right num " + pnlCls(a.profit)} style={{ fontWeight: 800 }}>
                  {Number(a.profit) >= 0 ? "+" : ""}${fmt(a.profit)}
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function useMemoMovers(instruments, prices) {
  const [seen, setSeen] = useState(null);
  useEffect(() => { /* recompute on price updates */ }, [prices]);
  return useMemoMoversCalc(instruments, prices);
}
function useMemoMoversCalc(instruments, prices) {
  return instruments
    .map((i) => ({ ...i, price: prices[i.symbol]?.price ?? null, changePercent: prices[i.symbol]?.changePercent ?? i.changePercent ?? 0 }))
    .filter((i) => i.price != null)
    .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
    .slice(0, 8);
}
