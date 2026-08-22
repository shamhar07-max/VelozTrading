import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrandMark, IconChart, IconSwap, IconWallet, IconUser } from "./icons";
import Markets from "./screens/Markets";
import TradeSheet from "./screens/TradeSheet";
import Positions from "./screens/Positions";
import Account from "./screens/Account";
import { useLivePrices } from "./ws";
import "./styles.css";

const CLERK_JS_SOURCES = [
  "https://cdn.jsdelivr.net/npm/@clerk/clerk-js@6/dist/clerk.browser.js",
  "https://unpkg.com/@clerk/clerk-js@6/dist/clerk.browser.js",
];

function loadConfig() {
  // /config.js sets window.__VELOZTRADE_CONFIG__ = { clerkPublishableKey }
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "/config.js";
    s.onload = () => resolve(window.__VELOZTRADE_CONFIG__ ?? {});
    s.onerror = () => resolve({});
    document.head.appendChild(s);
  });
}

/**
 * Load clerk-js trying each CDN in order. The publishable key is passed via
 * the data-clerk-publishable-key attribute (the official vanilla-JS pattern),
 * then activated with Clerk.load().
 */
async function loadClerkJs(key) {
  for (const src of CLERK_JS_SOURCES) {
    try {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.setAttribute("data-clerk-publishable-key", key);
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
      if (window.Clerk) return window.Clerk;
    } catch { /* try next source */ }
  }
  throw new Error("all clerk-js sources failed");
}

// ── Clerk session bootstrap ─────────────────────────────────
function useClerkSession() {
  const [state, setState] = useState({ loading: true, clerk: null, signedIn: false });

  async function boot() {
    const cfg = await loadConfig();
    const key =
      cfg.clerkPublishableKey ||
      import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
    if (!key) { setState({ loading: false, clerk: null, signedIn: false, noKey: true }); return; }

    try {
      const Clerk = await loadClerkJs(key);
      await Clerk.load();
      const apply = (clerk) =>
        setState({ loading: false, clerk, signedIn: !!clerk.session });

      apply(Clerk);
      Clerk.addListener((ev) => apply(Clerk));
    } catch (e) {
      setState({ loading: false, clerk: null, signedIn: false, error: String(e) });
    }
  }
  useEffect(() => { boot(); }, []);
  return state;
}

function LoginScreen({ clerk }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!clerk || !ref.current) return;
    try {
      clerk.openSignIn?.({ rootId: "clerk-root" }) ||
        clerk.mountSignIn(ref.current, { redirectUrl: "/m/", routing: "hash" });
    } catch {
      ref.current.innerHTML =
        '<div class="empty">Open veloztrade.com once to sign in,<br/>then return to this app.</div>';
    }
  }, [clerk]);
  return (
    <div className="login-wrap">
      <div className="login-logo">
        <BrandMark size={64} />
        <div className="t">Veloz<span style={{ color: "var(--brand2)" }}>Trade</span></div>
        <div className="s">Markets · Margin · Momentum</div>
      </div>
      <div id="clerk-root" ref={ref}>
        <div className="spinner" />
      </div>
    </div>
  );
}

// ── App tabs ────────────────────────────────────────────────
const TABS = [
  { id: "markets",   label: "Markets",   Icon: IconChart },
  { id: "positions", label: "Positions", Icon: IconSwap },
  { id: "account",   label: "Account",   Icon: IconUser },
];

function Shell({ clerk }) {
  const { prices, connected } = useLivePrices();
  const [instruments, setInstruments] = useState([]);
  const [tab, setTab] = useState("markets");
  const [tradeSym, setTradeSym] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    fetch("/api/instruments")
      .then((r) => r.json())
      .then(setInstruments)
      .catch(() => setInstruments([]));
  }, []);

  const tradeInstrument = tradeSym
    ? instruments.find((i) => i.symbol === tradeSym)
    : null;

  return (
    <div className="app">
      <header className="topbar">
        <BrandMark size={30} />
        <div>
          <div className="brandname">Veloz<span>Trade</span></div>
        </div>
        <div className="equity-pill num" title={connected ? "live prices" : "reconnecting…"}>
          <div className="lbl">{connected ? "LIVE" : "SYNC…"}</div>
        </div>
      </header>

      <main className="screen">
        {tab === "markets" && (
          <>
            <HeroEquity prices={prices} instruments={instruments} onTrade={(s) => setTradeSym(s)} />
            <Markets instruments={instruments} prices={prices} onTrade={(i) => setTradeSym(i.symbol)} />
          </>
        )}
        {tab === "positions" && (
          <Positions prices={prices} reloadKey={reload} />
        )}
        {tab === "account" && <Account onLogout={() => clerk.signOut?.(() => window.location.reload())} />}
      </main>

      {tradeInstrument && (
        <TradeSheet
          instrument={tradeInstrument}
          price={prices[tradeInstrument.symbol]}
          onClose={() => setTradeSym(null)}
          onDone={() => { setTab("positions"); setReload((r) => r + 1); }}
        />
      )}

      <nav className="tabbar">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} className={"tab" + (tab === id ? " on" : "")} onClick={() => setTab(id)}>
            <Icon /><span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function HeroEquity({ prices }) {
  const [acc, setAcc] = useState(null);
  useEffect(() => {
    fetch("/api/account", { credentials: "include" }).then(r => r.ok ? r.json() : null).then(setAcc);
  }, []);
  const equity = acc?.balance ?? null;
  return (
    <div className="card hero" style={{ marginBottom: 14 }}>
      <div className="row-split">
        <div>
          <div className="stat k" style={{ marginBottom: 2 }}>EQUITY · REAL ACCOUNT</div>
          <div className="big num">
            {equity == null ? "—" : `$${Number(equity).toLocaleString("en-US",{minimumFractionDigits:2})}`}
          </div>
        </div>
        <span className={`badge ${connected ? "ok" : "warn"}`}>{connected ? "● LIVE FEED" : "○ SYNCING"}</span>
      </div>
    </div>
  );
}

function Root() {
  const { loading, clerk, signedIn } = useClerkSession();

  if (loading) {
    return <div className="login-wrap"><div className="login-logo"><BrandMark size={64}/><div className="t">Veloz<span style={{color:"var(--brand2)"}}>Trade</span></div></div><div className="spinner"/></div>;
  }
  if (!clerk) {
    return (
      <div className="login-wrap">
        <div className="login-logo"><BrandMark size={64}/><div className="t">Veloz<span style={{color:"var(--brand2)"}}>Trade</span></div></div>
        <div className="card"><div className="empty">
          Cannot reach authentication.<br/>Check your connection and reopen the app.
        </div></div>
      </div>
    );
  }
  return signedIn ? <Shell clerk={clerk} /> : <LoginScreen clerk={clerk} />;
}

createRoot(document.getElementById("root")).render(<Root />);
