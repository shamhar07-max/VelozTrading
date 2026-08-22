import { useMemo, useState, useEffect, useRef } from "react";
import { IconSearch } from "../icons";

const CATS = ["All", "Forex", "Crypto", "Stocks", "Commodities", "Indices"];

function fmtPrice(p) {
  if (p >= 1000) return p.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (p >= 10) return p.toFixed(2);
  return p.toPrecision(5).replace(/0+$/, "").replace(/\.$/, "");
}

export default function Markets({ instruments, prices, onTrade }) {
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [flash, setFlash] = useState({});
  const prev = useRef({});

  useEffect(() => {
    const f = {};
    for (const [sym, p] of Object.entries(prices)) {
      const before = prev.current[sym];
      if (before != null && before !== p.price) f[sym] = p.price > before ? "up" : "down";
      prev.current[sym] = p.price;
    }
    if (Object.keys(f).length) {
      setFlash(f);
      const t = setTimeout(() => setFlash({}), 420);
      return () => clearTimeout(t);
    }
  }, [prices]);

  const list = useMemo(() => {
    let arr = instruments;
    if (cat !== "All") arr = arr.filter((i) => i.type === cat.toLowerCase());
    if (q.trim()) {
      const s = q.toLowerCase();
      arr = arr.filter((i) => i.symbol.toLowerCase().includes(s) || i.name.toLowerCase().includes(s));
    }
    return arr.slice(0, 120);
  }, [instruments, cat, q]);

  return (
    <div>
      <div style={{ position: "relative", marginBottom: 10 }}>
        <IconSearch style={{ width: 17, height: 17, position: "absolute", left: 13, top: 13, color: "var(--text-faint)" }} />
        <input className="search" placeholder="Search instruments…" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 38 }} />
      </div>

      <div className="chips">
        {CATS.map((c) => (
          <button key={c} className={"chip" + (cat === c ? " on" : "")} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>

      {list.map((i) => {
        const p = prices[i.symbol];
        const chg = p?.changePercent ?? i.changePercent ?? 0;
        const up = (chg ?? 0) >= 0;
        const initial = i.type === "crypto" ? "₿" : i.symbol[0] ?? "?";
        return (
          <div key={i.symbol} className={"mkt-row " + (flash[i.symbol] ?? "")}>
            <div
              className="symicon"
              onClick={() => onTrade(i)}
              role="button"
            >{initial}</div>
            <div style={{ textAlign: "left", minWidth: 0, cursor: "pointer" }} onClick={() => onTrade(i)}>
              <div className="mkt-name">{i.symbol}</div>
              <div className="mkt-sub" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.name}</div>
            </div>
            <div className="mkt-price num">
              {p ? fmtPrice(p.price) : "—"}
              <div className={"mkt-chg num " + (up ? "up" : "down")} style={{ fontWeight: 600 }}>
                {p ? `${up ? "▲" : "▼"} ${Math.abs(chg).toFixed(2)}%` : ""}
              </div>
            </div>
            <button
              className="tradebtn"
              style={{ background: up ? "rgba(14,203,129,.16)" : "rgba(246,70,93,.16)", color: up ? "var(--up)" : "var(--down)" }}
              onClick={() => onTrade(i)}
            >
              Trade
            </button>
          </div>
        );
      })}
      {list.length === 0 && <div className="empty">No instruments match.</div>}
    </div>
  );
}
