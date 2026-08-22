import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrandMark, IconChart, IconSwap, IconUser, IconWallet, IconBell, IconStar, IconSearch } from "./icons";
import { IconChevronR } from "./icons2";
import Markets from "./screens/Markets";
import TradeScreen from "./screens/TradeScreen";
import Portfolio from "./screens/Portfolio";
import Wallet from "./screens/Wallet";
import Home from "./screens/Home";
import Watchlist from "./screens/Watchlist";
import Notifications from "./screens/Notifications";
import Leaderboard from "./screens/Leaderboard";
import CalendarScreen from "./screens/Calendar";
import Signals from "./screens/Signals";
import Profile from "./screens/Profile";
import { useLivePrices } from "./ws";
import "./styles.css";

const CLERK_JS_SOURCES = [
  "https://cdn.jsdelivr.net/npm/@clerk/clerk-js@6/dist/clerk.browser.js",
  "https://unpkg.com/@clerk/clerk-js@6/dist/clerk.browser.js",
];

function loadConfig() {
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "/config.js";
    s.onload = () => resolve(window.__VELOZTRADE_CONFIG__ ?? {});
    s.onerror = () => resolve({});
    document.head.appendChild(s);
  });
}
async function loadClerkJs(key) {
  for (const src of CLERK_JS_SOURCES) {
    try {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src; s.async = true;
        s.setAttribute("data-clerk-publishable-key", key);
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
      if (window.Clerk) return window.Clerk;
    } catch { /* next */ }
  }
  throw new Error("clerk-js unreachable");
}

// ── diagnostics strip ───────────────────────────────────────
const BOOT = { cfg: "…", js: "…", load: "…", ses: "…", err: "" };
const listeners = new Set();
function setBoot(k, v) { BOOT[k] = v; listeners.forEach((fn) => fn()); }
function DebugStrip() {
  const [, force] = useState(0);
  useEffect(() => { const fn = () => force((x) => x + 1); listeners.add(fn); return () => listeners.delete(fn); }, []);
  if (!BOOT.err && BOOT.session !== "…") return null;
  return (
    <div className="num" style={{ position: "fixed", left: 6, bottom: 74, zIndex: 999, fontSize: 9,
      color: "#7dd3fc", background: "rgba(0,0,0,.55)", padding: "3px 6px", borderRadius: 6, pointerEvents: "none" }}>
      cfg:{BOOT.cfg} js:{BOOT.js} load:{BOOT.load} ses:{BOOT.session}{BOOT.err ? ` ERR:${BOOT.err}` : ""}
    </div>
  );
}
window.addEventListener("error", (e) => setBoot("err", (e.message || "").slice(0, 80)));
window.addEventListener("unhandledrejection", (e) => setBoot("err", String(e.reason ?? "").slice(0, 80)));

class RootErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: 24, paddingTop: 60 }}>
          <div className="card"><div className="card-title">App crashed</div>
            <div className="num" style={{ fontSize: 12, color: "var(--down)", wordBreak: "break-word" }}>{String(this.state.err?.message ?? this.state.err)}</div></div>
          <button className="btn primary" onClick={() => window.location.reload()}>Reload</button>
          <DebugStrip />
        </div>
      );
    }
    return this.props.children;
  }
}

function useClerkSession() {
  const [state, setState] = useState({ loading: true, clerk: null, signedIn: false });

  async function boot() {
    const host = window.location.hostname;
    const isCanonical = host === "veloztrade.com" || host.endsWith(".veloztrade.com") || host === "localhost";
    const key0 = window.__VELOZTRADE_CONFIG__?.clerkPublishableKey
      ?? import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
    if (key0?.startsWith("pk_live_") && !isCanonical) {
      window.location.replace("https://veloztrade.com" + window.location.pathname + window.location.search);
      return;
    }

    const cfg = await loadConfig();
    const key = cfg.clerkPublishableKey || key0;
    setBoot("cfg", key ? "ok" : "MISSING");
    if (!key) { setBoot("ses", "-"); setState({ loading: false, clerk: null, signedIn: false }); return; }

    try {
      const Clerk = await loadClerkJs(key);
      setBoot("js", "ok");
      await Clerk.load();
      setBoot("load", "ok");
      const apply = () => {
        setBoot("ses", Clerk.session ? "IN" : "out");
        setState({ loading: false, clerk: Clerk, signedIn: !!Clerk.session });
      };
      apply();
      Clerk.addListener(apply);
    } catch (e) {
      setBoot("err", String(e?.message ?? e).slice(0, 60));
      setState({ loading: false, clerk: null, signedIn: false });
    }
  }
  useEffect(() => { boot(); }, []);
  return state;
}

function LoginScreen() {
  const go = (path) => { window.location.href = path; };
  return (
    <div className="login-wrap">
      <div className="login-logo">
        <BrandMark size={64} />
        <div className="t">Veloz<span style={{ color: "var(--brand2)" }}>Trade</span></div>
        <div className="s">Markets · Margin · Momentum</div>
      </div>
      <div className="card" style={{ textAlign: "center", padding: "22px 18px" }}>
        <p style={{ margin: "0 0 16px", color: "var(--text-dim)", fontSize: 13.5 }}>
          Sign in once to sync your portfolio,<br />live prices and positions.
        </p>
        <button className="btn primary" onClick={() => go("/sign-in?redirect_url=" + encodeURIComponent("/m/"))}>Sign in</button>
        <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => go("/sign-up?redirect_url=" + encodeURIComponent("/m/"))}>
          Create free account · $10k demo
        </button>
      </div>
      <p className="tiny" style={{ textAlign: "center", marginTop: 14 }}>You'll return here automatically after signing in.</p>
    </div>
  );
}

// ── Tab screens ─────────────────────────────────────────────
const TABS = [
  { id: "home",      label: "Home",   Icon: ({ ...p }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { id: "markets",   label: "Markets", Icon: IconChart },
  { id: "trade",     label: "Trade",   Icon: IconSwap },
  { id: "portfolio", label: "Positions", Icon: IconWallet },
  { id: "profile",   label: "Account", Icon: IconUser },
];

function TabsApp({ clerk, onLogout }) {
  const [tab, setTab] = useState("home");
  const { prices, connected } = useLivePrices();
  const [instruments, setInstruments] = useState([]);
  const [tradeSym, setTradeSym] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    fetch("/api/instruments").then((r) => r.json()).then(setInstruments).catch(() => setInstruments([]));
  }, []);

  const openTrade = (symOrInst) => setTradeSym(typeof symOrInst === "string" ? symOrInst : symOrInst.symbol);

  function openPushed(view) { window.history.pushState({ view }, ""); setPushedView(view); }
  const [pushedView, setPushedView] = useState(null);
  useEffect(() => {
    const onPop = () => setPushedView(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  let content = null;
  if (pushedView === "watchlist") content = <Watchlist prices={prices} instruments={instruments} onTrade={openTrade} />;
  else if (pushedView === "notifications") content = <Notifications />;
  else if (pushedView === "leaderboard") content = <Leaderboard />;
  else if (pushedView === "calendar") content = <CalendarScreen />;
  else if (pushedView === "signals") content = <Signals prices={prices} instruments={instruments} onTrade={openTrade} />;

  if (content) {
    return (
      <div className="app">
        <div className="apphead">
          <button className="iconbtn" onClick={() => window.history.back()} aria-label="Back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <div className="ttl" style={{ textTransform: "capitalize" }}>{pushedView}</div>
        </div>
        <main className="screen">{content}</main>
        <DebugStrip />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <BrandMark size={30} />
        <div className="brandname">Veloz<span style={{ color: "var(--brand2)" }}>Trade</span></div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="iconbtn" onClick={() => openPushed("notifications")} aria-label="Alerts">
            <IconBell />
          </button>
          <button className="iconbtn" onClick={() => openPushed("watchlist")} aria-label="Watchlist">
            <IconStar />
          </button>
        </div>
      </header>

      <main className="screen">
        {tab === "home" && (
          <>
            <HeroEquity connected={connected} />
            <Home prices={prices} instruments={instruments} onTrade={openTrade} navigate={openPushed} notifCount={0} />
          </>
        )}
        {tab === "markets" && <Markets instruments={instruments} prices={prices} onTrade={openTrade} />}
        {tab === "trade" && (
          <TradeScreen instruments={instruments} prices={prices} initialSymbol={tradeSym} onOpened={() => setTab("portfolio")} />
        )}
        {tab === "portfolio" && <Portfolio prices={prices} reloadKey={reloadKey} />}
        {tab === "profile" && (
          <>
            <QuickLinks onOpen={openPushed} />
            <Profile clerk={clerk} onLogout={onLogout} />
          </>
        )}
      </main>

      {tradeSym && (
        <TradeModal symbol={tradeSym} instruments={instruments} prices={prices}
          onClose={() => setTradeSym(null)} onDone={() => { setTab("portfolio"); setReloadKey((r) => r + 1); }} />
      )}

      <nav className="tabbar">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} className={"tab" + (id === "trade" ? " center" : "") + (tab === id ? " on" : "")}
            onClick={() => { if (id === "trade") { setTradeSym(null); } setTab(id); }}>
            <span className={id === "trade" ? "fab" : ""}><Icon /></span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <DebugStrip />
    </div>
  );
}

function TradeModal({ symbol, instruments, prices, onClose, onDone }) {
  const inst = instruments.find((i) => i.symbol === symbol);
  if (!inst) return null;
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="row-split" style={{ marginBottom: 10 }}>
          <div><div style={{ fontWeight: 900, fontSize: 17 }}>{inst.symbol}</div><div className="tiny">{inst.name}</div></div>
          <button className="iconbtn" onClick={onClose} aria-label="Close"><IconXSmall /></button>
        </div>
        <TradeScreenInner inst={inst} p={prices[inst.symbol]} onDone={onDone} />
      </div>
    </>
  );
}
function TradeScreenInner({ inst, p, onDone }) {
  const [side, setSide] = useState("buy");
  const [lots, setLots] = useState("0.01");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const exec = p ? (side === "buy" ? (p.ask ?? p.price) : (p.bid ?? p.price)) : null;
  async function submit() {
    setBusy(true);
    try {
      await fetch("/api/positions", { method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ symbol: inst.symbol, direction: side, volume: parseFloat(lots) }) });
      setMsg("ok");
    } catch { setMsg("fail"); } finally { setBusy(false); }
  }
  return (
    <>
      <div className="seg">
        <button className={side === "buy" ? "on-buy" : ""} onClick={() => setSide("buy")}>BUY / LONG</button>
        <button className={side === "sell" ? "on-sell" : ""} onClick={() => setSide("sell")}>SELL / SHORT</button>
      </div>
      <div className="field"><label>Volume (lots)</label>
        <div className="lot-stepper">
          <button onClick={() => setLots((v) => Math.max(0.01, (parseFloat(v) || 0.01) - 0.01).toString())}>−</button>
          <input type="number" inputMode="decimal" step="0.01" min="0.01" value={lots} onChange={(e) => setLots(e.target.value)} />
          <button onClick={() => setLots((v) => ((parseFloat(v) || 0) + 0.01).toFixed(2))}>+</button>
        </div>
      </div>
      {msg === "ok" ? <div className="badge ok" style={{ display: "block", padding: 12 }}>✓ Order filled — view it under Positions</div> :
       msg === "fail" ? <div className="badge err" style={{ display: "block", padding: 12 }}>Order failed — try again</div> :
       <button className={"btn " + side} disabled={busy || !exec} onClick={submit}>{busy ? "Placing…" : `${side === "buy" ? "Buy" : "Sell"} ${lots} lots`}</button>}
      {msg === "ok" && <button className="btn primary" style={{ marginTop: 8 }} onClick={() => { onDone(); onClose?.(); }}>Go to positions</button>}
    </>
  );
}
function IconXSmall(p) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>; }

function HeroEquity({ connected }) {
  const [acc, setAcc] = useState(null);
  useEffect(() => {
    fetch("/api/account", { credentials: "include" }).then((r) => r.ok ? r.json() : null).then(setAcc);
  }, []);
  return (
    <div className="card hero" style={{ marginBottom: 14 }}>
      <div className="row-split">
        <div>
          <div className="stat k">EQUITY · {(acc?.isDemoMode ?? false) ? "DEMO" : "REAL"}</div>
          <div className="big num">${Number(acc?.balance ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
        </div>
        <span className={`badge ${connected ? "ok" : "warn"}`}>{connected ? "● LIVE FEED" : "○ SYNCING"}</span>
      </div>
    </div>
  );
}

function QuickLinks({ onOpen }) {
  const links = [
    { id: "signals", label: "Signals" },
    { id: "leaderboard", label: "Leaderboard" },
    { id: "calendar", label: "Calendar" },
    { id: "watchlist", label: "Watchlist" },
  ];
  return (
    <div className="moregrid" style={{ marginBottom: 14 }}>
      {links.map((l) => (
        <button key={l.id} className="tile" onClick={() => onOpen(l.id)}>{l.label}</button>
      ))}
    </div>
  );
}

function AppRoot() {
  const { loading, clerk, signedIn } = useClerkSession();

  if (loading) {
    return (
      <div className="login-wrap">
        <div className="login-logo"><BrandMark size={64}/><div className="t">Veloz<span style={{color:"var(--brand2)"}}>Trade</span></div></div>
        <div className="spinner"/>
        <DebugStrip />
      </div>
    );
  }
  if (!clerk) {
    return (
      <div className="login-wrap">
        <div className="login-logo"><BrandMark size={64}/><div className="t">Veloz<span style={{color:"var(--brand2)"}}>Trade</span></div></div>
        <div className="card"><div className="empty">Could not initialize authentication.</div></div>
        <button className="btn primary" onClick={() => window.location.replace("https://veloztrade.com" + window.location.pathname)}>Continue on veloztrade.com</button>
        <DebugStrip />
      </div>
    );
  }
  return (
    <>
      {signedIn
        ? <TabsApp clerk={clerk} onLogout={() => clerk.signOut?.(() => window.location.reload())} />
        : <LoginScreen />}
      {!signedIn && <DebugStrip />}
    </>
  );
}

createRoot(document.getElementById("root")).render(<RootErrorBoundary><AppRoot /></RootErrorBoundary>);
