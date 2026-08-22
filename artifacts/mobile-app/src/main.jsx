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
    // Live Clerk keys are domain-locked to veloztrade.com. If someone opens
    // the app UI from another host (railway.app preview, IP, etc.), bounce
    // to the canonical domain instead of failing with an auth error.
    const host = window.location.hostname;
    const isCanonical =
      host === "veloztrade.com" || host.endsWith(".veloztrade.com");
    const key0 = window.__VELOZTRADE_CONFIG__?.clerkPublishableKey;
    if (key0?.startsWith("pk_live_") && !isCanonical && host !== "localhost") {
      setBoot("host", "bounce");
      window.location.replace(
        "https://veloztrade.com" + window.location.pathname + window.location.search
      );
      return;
    }

    const cfg = await loadConfig();
    const key =
      cfg.clerkPublishableKey ||
      import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
    setBoot("cfg", key ? "ok" : "MISSING");
    if (!key) { setBoot("session", "-"); setState({ loading: false, clerk: null, signedIn: false, noKey: true }); return; }

    try {
      const Clerk = await loadClerkJs(key);
      setBoot("js", "ok");
      await Clerk.load();
      setBoot("load", "ok");
      const apply = (clerk) => {
        setBoot("session", clerk.session ? "IN" : "out");
        setState({ loading: false, clerk, signedIn: !!clerk.session });
      };

      apply(Clerk);
      Clerk.addListener((ev) => apply(Clerk));
    } catch (e) {
      setBoot("err", String(e?.message ?? e).slice(0, 60));
      setState({ loading: false, clerk: null, signedIn: false, error: String(e) });
    }
  }
  useEffect(() => { boot(); }, []);
  return state;
}

function LoginScreen({ clerk }) {
  const [redirecting, setRedirecting] = useState(false);
  const go = (path) => { setRedirecting(true); window.location.href = path; };

  // Redirect-based sign-in: reuses the platform's proven login page on the
  // same origin. Session cookie is set there, then Clerk sends us back to
  // /m/ already authenticated — no embedded-component fragility.
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
        <button
          className="btn primary"
          disabled={redirecting}
          onClick={() => go("/sign-in?redirect_url=" + encodeURIComponent("/m/"))}
        >
          {redirecting ? "Opening…" : "Sign in"}
        </button>
        <button
          className="btn ghost"
          style={{ marginTop: 10 }}
          disabled={redirecting}
          onClick={() => go("/sign-up?redirect_url=" + encodeURIComponent("/m/"))}
        >
          Create free account · $10k demo
        </button>
      </div>

      <p className="tiny" style={{ textAlign: "center", marginTop: 14 }}>
        You'll return here automatically after signing in.
      </p>
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

// ── Boot diagnostics ─────────────────────────────────────────────────────────
// Temporary visibility layer: renders a fixed strip showing every boot stage
// and any captured error, so field issues can be diagnosed from a screenshot.
const BOOT = { cfg: "…", js: "…", load: "…", session: "…", err: "" };
const listeners = new Set();
function setBoot(k, v) { BOOT[k] = v; listeners.forEach((fn) => fn()); }
function DebugStrip() {
  const [, force] = useState(0);
  useEffect(() => { const fn = () => force((x) => x + 1); listeners.add(fn); return () => listeners.delete(fn); }, []);
  return (
    <div className="num" style={{ position: "fixed", left: 6, bottom: 70, zIndex: 999, fontSize: 9,
      color: "#7dd3fc", background: "rgba(0,0,0,.55)", padding: "3px 6px", borderRadius: 6, pointerEvents: "none" }}>
      cfg:{BOOT.cfg} js:{BOOT.js} load:{BOOT.load} ses:{BOOT.session}{BOOT.err ? ` ERR:${BOOT.err}` : ""}
    </div>
  );
}
window.addEventListener("error", (e) => setBoot("err", (e.message || "error").slice(0, 80)));
window.addEventListener("unhandledrejection", (e) => setBoot("err", String(e.reason ?? "rejection").slice(0, 80)));

class RootErrorBoundary extends React.Component {
  constructor(p){ super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) { setBoot("err", String(err?.message ?? err).slice(0, 80)); }
  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: 24, paddingTop: 60 }}>
          <div className="card"><div className="card-title">App crashed</div>
          <div className="num" style={{ fontSize: 12, color: "var(--down)", wordBreak: "break-word" }}>{String(this.state.err?.message ?? this.state.err)}</div></div>
          <button className="btn primary" onClick={() => window.location.reload()}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
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
          {state.noKey
            ? "Configuration required — deploy with CLERK_PUBLISHABLE_KEY set."
            : "Could not initialize authentication on this domain."}
        </div></div>
        <button
          className="btn primary"
          onClick={() => window.location.replace("https://veloztrade.com" + window.location.pathname)}
        >
          Continue on veloztrade.com
        </button>
      </div>
    );
  }
  return signedIn ? <Shell clerk={clerk} /> : <LoginScreen clerk={clerk} />;
}

function AppRoot() {
  return (
    <RootErrorBoundary>
      <Root />
      <DebugStrip />
    </RootErrorBoundary>
  );
}


createRoot(document.getElementById("root")).render(<Root />);
