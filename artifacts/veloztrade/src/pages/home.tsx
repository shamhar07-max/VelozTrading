import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowRight, Zap, Shield, BarChart3, BarChart2, Globe, Clock, Smartphone,
  CheckCircle, TrendingUp, Lock, Award, ChevronRight, MessageCircle,
  X, ChevronDown, Star, Users, Activity, DollarSign, Building2,
  FileText, HelpCircle, Twitter, Linkedin, Send, Mail,
} from "lucide-react";
import { useWebSocket } from "@/hooks/use-websocket";
import { InstrumentIcon } from "@/components/instrument-icon";
import { toKey, formatPrice, toDisplaySymbol } from "@/lib/symbol";

const TICKER_SYMS = ["EURUSD","BTCUSD","XAUUSD","SPX","AAPL","ETHUSD","GBPUSD","USDJPY","NVDA","SOLUSD","NDX","USOIL"];

function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lm-bg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#040C1A"/>
          <stop offset="100%" stopColor="#061828"/>
        </linearGradient>
        <linearGradient id="lm-mark" x1="16" y1="76" x2="84" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00C6FF"/>
          <stop offset="55%" stopColor="#0072FF"/>
          <stop offset="100%" stopColor="#7C3AED"/>
        </linearGradient>
        <filter id="lm-glow">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect width="100" height="100" rx="20" fill="url(#lm-bg)"/>
      <line x1="16" y1="24" x2="50" y2="76" stroke="url(#lm-mark)" strokeWidth="8.5" strokeLinecap="round" filter="url(#lm-glow)"/>
      <polyline points="50,76 62,49 71,61 84,20" stroke="url(#lm-mark)" strokeWidth="8.5" strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#lm-glow)"/>
      <circle cx="84" cy="20" r="6.5" fill="#00C6FF" filter="url(#lm-glow)"/>
      <circle cx="84" cy="20" r="3" fill="white"/>
    </svg>
  );
}

function PublicTicker() {
  const { prices } = useWebSocket();
  const items = [...TICKER_SYMS, ...TICKER_SYMS];
  return (
    <div className="h-9 bg-card/60 border-b border-border/50 overflow-hidden flex items-center select-none">
      <div className="flex animate-marquee gap-10 whitespace-nowrap">
        {items.map((sym, i) => {
          const q = prices[sym];
          const price = q?.price;
          const chg = q?.changePercent ?? 0;
          const up = chg >= 0;
          return (
            <div key={`${sym}-${i}`} className="flex items-center gap-1.5 text-xs font-mono">
              <span className="text-muted-foreground font-medium">{sym}</span>
              <span className="text-foreground font-bold">{price ? formatPrice(price, sym) : "—"}</span>
              <span className={up ? "text-success" : "text-destructive"}>
                {up ? "▲" : "▼"} {Math.abs(chg).toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HeroTerminal() {
  const { prices } = useWebSocket();
  const btc = prices["BTCUSD"];
  const btcPrice = btc?.price ?? 0;
  const sparkData = [40,55,45,65,72,58,80,75,88,82,95,90,100];

  return (
    <motion.div
      className="relative w-full max-w-[560px] mx-auto"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div
        className="glass-card rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(0,114,255,0.12)]"
        style={{ transform: "perspective(1000px) rotateX(3deg) rotateY(-6deg)" }}
      >
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 bg-muted/20">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-destructive/80"/>
            <div className="w-3 h-3 rounded-full bg-warning/80"/>
            <div className="w-3 h-3 rounded-full bg-success/80"/>
          </div>
          <div className="flex gap-0 ml-3">
            {["Chart","Depth","Orders"].map((t, i) => (
              <div key={t} className={`px-4 py-1 text-xs font-medium rounded-sm ${i === 0 ? "bg-primary/15 text-primary border-b border-primary" : "text-muted-foreground"}`}>{t}</div>
            ))}
          </div>
        </div>

        <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse"/>
            <span className="font-bold text-sm">BTC / USD</span>
            <span className="text-xs text-muted-foreground">Crypto</span>
          </div>
          <div className="text-right">
            <div className="font-mono font-bold text-lg">
              {btcPrice > 0 ? btcPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
            </div>
            <div className={`text-xs font-medium ${(btc?.changePercent ?? 0) >= 0 ? "text-success" : "text-destructive"}`}>
              {(btc?.changePercent ?? 0) >= 0 ? "+" : ""}{(btc?.changePercent ?? 0).toFixed(2)}%
            </div>
          </div>
        </div>

        <div className="h-40 px-4 py-3 relative bg-gradient-to-b from-transparent to-primary/[0.02]">
          <svg viewBox="0 0 300 120" className="w-full h-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00C6FF" stopOpacity="0.25"/>
                <stop offset="100%" stopColor="#00C6FF" stopOpacity="0"/>
              </linearGradient>
            </defs>
            <path
              d={`M0,${120-sparkData[0]*1.1} ${sparkData.map((h,i) => `L${i*(300/(sparkData.length-1))},${120-h*1.1}`).join(" ")} V120 H0 Z`}
              fill="url(#chartGrad)"
            />
            <polyline
              points={sparkData.map((h,i) => `${i*(300/(sparkData.length-1))},${120-h*1.1}`).join(" ")}
              fill="none" stroke="#00C6FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            />
            <circle cx={300} cy={120-sparkData[sparkData.length-1]*1.1} r="4" fill="#00C6FF"/>
          </svg>
          <div className="absolute top-2 left-4 flex gap-2">
            {["1m","5m","15m","1h","4h","1D"].map(t => (
              <button key={t} className={`text-xs px-2 py-0.5 rounded ${t === "4h" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>
            ))}
          </div>
        </div>

        <div className="px-4 py-3 flex gap-3 border-t border-border/30">
          <div className="flex-1 text-center bg-success/10 border border-success/30 rounded-lg py-2">
            <div className="text-xs text-muted-foreground mb-0.5">BUY</div>
            <div className="font-mono font-bold text-success text-sm">{btcPrice > 0 ? (btcPrice + 50).toLocaleString("en-US", {maximumFractionDigits: 2}) : "—"}</div>
          </div>
          <div className="flex-1 text-center bg-destructive/10 border border-destructive/30 rounded-lg py-2">
            <div className="text-xs text-muted-foreground mb-0.5">SELL</div>
            <div className="font-mono font-bold text-destructive text-sm">{btcPrice > 0 ? (btcPrice - 50).toLocaleString("en-US", {maximumFractionDigits: 2}) : "—"}</div>
          </div>
        </div>
      </div>

      <motion.div
        className="absolute -top-4 -right-6 glass rounded-xl p-3 shadow-xl"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse"/>
          <span className="text-xs font-bold text-success">Order Executed</span>
        </div>
        <div className="text-xs text-muted-foreground">BUY AAPL 10 lots</div>
        <div className="text-xs font-mono text-success font-bold">+$843.00</div>
      </motion.div>

      <motion.div
        className="absolute bottom-12 left-1 sm:-bottom-4 sm:-left-6 glass rounded-xl p-3 shadow-xl"
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      >
        <div className="text-xs text-muted-foreground mb-1">Portfolio P&L</div>
        <div className="text-xl font-bold font-mono gradient-text-green">+$12,450</div>
        <div className="text-xs text-success">↑ 24.9% this month</div>
      </motion.div>
    </motion.div>
  );
}

const ACCOUNT_TYPES = [
  {
    name: "Silver",
    badge: null,
    minDeposit: "$250",
    spread: "From 0.3 pips",
    commission: "None",
    leverage: "Stocks 1:10 · Forex 1:1000 · Crypto 1:5",
    execution: "Market · 5ms",
    features: ["2000+ instruments", "Demo account available", "24/7 support", "All asset classes"],
    color: "border-border",
    btnClass: "bg-muted hover:bg-muted/80 text-foreground",
    badge2: "🥈",
  },
  {
    name: "Gold",
    badge: "Most Popular",
    minDeposit: "$2,500",
    spread: "From 0.2 pips",
    commission: "$2.50/lot",
    leverage: "Stocks 1:10 · Forex 1:1000 · Crypto 1:5",
    execution: "ECN · 5ms",
    features: ["2000+ instruments", "Raw ECN pricing", "Priority support", "Advanced analytics", "Commodities 1:100"],
    color: "border-primary/50",
    btnClass: "bg-primary hover:bg-primary/90 text-primary-foreground",
    badge2: "🥇",
  },
  {
    name: "Platinum",
    badge: "Best Value",
    minDeposit: "$10,000",
    spread: "From 0.1 pips",
    commission: "$1.50/lot",
    leverage: "Stocks 1:10 · Forex 1:1000 · Crypto 1:5",
    execution: "Prime ECN · 5ms",
    features: ["2000+ instruments", "Zero-spread majors", "Dedicated manager", "Indices 1:10", "VIP events"],
    color: "border-amber-400/40",
    btnClass: "bg-amber-500 hover:bg-amber-600 text-white",
    badge2: "💎",
  },
  {
    name: "VIP",
    badge: "Exclusive",
    minDeposit: "$50,000",
    spread: "0.0 pips",
    commission: "Volume-based",
    leverage: "Stocks 1:10 · Forex 1:1000 · Crypto 1:5",
    execution: "Prime · 5ms · API",
    features: ["2000+ instruments", "Personal account manager", "Custom leverage tiers", "Priority withdrawals", "Exclusive research"],
    color: "border-violet-500/40",
    btnClass: "bg-violet-600 hover:bg-violet-700 text-white",
    badge2: "👑",
  },
];

const LEVERAGE_TABLE = [
  { asset: "Stocks", leverage: "1:10", icon: "📈" },
  { asset: "Commodities", leverage: "1:100", icon: "🛢️" },
  { asset: "Currencies (Forex)", leverage: "1:1000", icon: "💱" },
  { asset: "Indices", leverage: "1:10", icon: "📊" },
  { asset: "Crypto", leverage: "1:5", icon: "₿" },
];

const FEATURES = [
  { icon: BarChart3, title: "Advanced Charting", desc: "TradingView-powered candlestick charts with 8 timeframes, 100+ technical indicators, and professional drawing tools." },
  { icon: Zap, title: "5ms Execution", desc: "Ultra-fast 5ms order execution with direct market access routing and smart order technology — genuinely institutional speed." },
  { icon: Globe, title: "2000+ Instruments", desc: "Stocks, Forex, Crypto, Indices and Commodities — 2000+ instruments all in a single unified account." },
  { icon: Smartphone, title: "Mobile-First Design", desc: "Fully responsive platform with full chart visibility and one-click trading optimized for any screen size." },
  { icon: Clock, title: "24/7 Crypto Markets", desc: "Bitcoin and altcoins never sleep. Trade crypto markets anytime, day or night with up to 1:5 leverage." },
  { icon: Shield, title: "Bank-Grade Security", desc: "Segregated client funds, 256-bit SSL encryption, and 2FA on all accounts. Your money, protected." },
];

function useLiveTraderCount() {
  const BASE = 312_847;
  const [count, setCount] = useState(BASE + Math.floor(Math.random() * 200));
  useEffect(() => {
    const t = setInterval(() => setCount(c => c + Math.floor(Math.random() * 3)), 3200);
    return () => clearInterval(t);
  }, []);
  return count;
}

const STATS_BASE = [
  { value: "$50B+", label: "Monthly Volume" },
  { value: null, label: "Live Traders", live: true },
  { value: "5ms", label: "Execution Speed" },
  { value: "2000+", label: "Instruments" },
];

const TESTIMONIALS = [
  {
    name: "James Whitfield",
    role: "Professional FX Trader · London",
    avatar: "JW",
    rating: 5,
    text: "VelozTrade's execution speed is genuinely institutional-grade. I moved my entire FX book here from a major broker and haven't looked back. The spread on EUR/USD is consistently sub-pip during London session.",
  },
  {
    name: "Sarah Chen",
    role: "Crypto Portfolio Manager · Singapore",
    avatar: "SC",
    rating: 5,
    text: "The real-time WebSocket feed updates every 500ms — you can see the market breathe. For algorithmic and semi-systematic trading, the data latency is far better than anything else I've tested at this price point.",
  },
  {
    name: "Marcus Okafor",
    role: "Equity Trader · New York",
    avatar: "MO",
    rating: 5,
    text: "Switching from a desktop terminal to VelozTrade was seamless. Having stocks, indices, and commodities all in one account with proper candlestick charts and live P&L is exactly what I needed on the go.",
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Create Your Account",
    desc: "Sign up in 2 minutes. No credit card, no KYC required for your free $10,000 demo account. Start practising immediately.",
    icon: Users,
  },
  {
    step: "02",
    title: "Fund & Configure",
    desc: "Upgrade to a live account via our streamlined KYC process. Set your leverage, preferred pairs, and risk parameters.",
    icon: DollarSign,
  },
  {
    step: "03",
    title: "Trade the World",
    desc: "Access 2000+ instruments with professional charting tools, real-time alerts, and one-click execution from any device.",
    icon: Activity,
  },
];

const FAQS = [
  {
    q: "Is VelozTrade regulated?",
    a: "VelozTrade operates under strict financial compliance standards. All client funds are held in segregated accounts with tier-1 banking partners, completely separate from company funds.",
  },
  {
    q: "How much does it cost to open an account?",
    a: "Opening a demo account is completely free — no credit card required. Live Standard accounts require no minimum deposit. Pro accounts start from $500.",
  },
  {
    q: "What instruments can I trade?",
    a: "VelozTrade offers 2000+ instruments including Forex majors, crosses and exotics, top Cryptocurrencies, US and European Stocks, major Indices (S&P 500, NASDAQ, DAX, FTSE 100), and Commodities (Gold, Silver, Oil).",
  },
  {
    q: "How fast is trade execution?",
    a: "Our infrastructure delivers 5ms execution speeds with direct market access. Orders are routed through our prime broker network with smart order technology to minimise slippage.",
  },
  {
    q: "Can I trade on mobile?",
    a: "Yes. VelozTrade has a dedicated iOS and Android app with the same full feature set as the web platform — live charts, real-time prices, one-click trading, and full position management.",
  },
  {
    q: "What leverage is available?",
    a: "Leverage is fixed by asset class: Stocks 1:10, Commodities 1:100, Currencies (Forex) 1:1000, Indices 1:10, and Crypto 1:5 — consistent across all account types for transparent risk management.",
  },
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section id="faq" className="py-24 bg-background">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="text-center mb-14">
          <div className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">FAQ</div>
          <h2 className="text-3xl md:text-4xl font-bold">Frequently Asked Questions</h2>
          <p className="text-muted-foreground mt-3">Everything you need to know before you start trading.</p>
        </div>
        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <div key={i} className="glass-card rounded-xl border border-border overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-6 py-4 text-left"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span className="font-semibold text-sm pr-4">{faq.q}</span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${open === i ? "rotate-180" : ""}`}/>
              </button>
              {open === i && (
                <div className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed border-t border-border/40 pt-4">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="bg-card/80 border-t border-border" itemScope itemType="https://schema.org/Organization">
      {/* Trust bar */}
      <div className="border-b border-border/50 bg-muted/20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
            {[
              { label: "300,000+ Traders", icon: Users },
              { label: "50+ Instruments", icon: BarChart2 },
              { label: "99.9% Uptime", icon: Activity },
              { label: "24/7 Support", icon: MessageCircle },
              { label: "256-bit Encryption", icon: Lock },
              { label: "Regulated & Compliant", icon: Shield },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <item.icon className="w-3.5 h-3.5 text-primary"/>
                <span className="font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-10 mb-12">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <LogoMark size={36}/>
              <div>
                <span className="font-bold text-xl"><span className="text-foreground">Veloz</span><span className="text-primary">Trade</span></span>
                <div className="text-[10px] text-muted-foreground font-medium tracking-widest uppercase">Professional Trading</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5 max-w-xs" itemProp="description">
              Professional online trading platform for Forex, Crypto, Stocks, Commodities and Indices. Institutional-grade execution for every trader worldwide.
            </p>
            {/* Regulatory badges */}
            <div className="flex flex-wrap gap-2 mb-5">
              {["ISO 27001", "AML/KYC", "SSL TLS 1.3"].map(badge => (
                <span key={badge} className="text-[10px] font-bold px-2 py-1 rounded border border-primary/20 bg-primary/5 text-primary">
                  {badge}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3">
              {[
                { icon: Twitter, label: "Twitter", href: "https://twitter.com/veloztrade" },
                { icon: Linkedin, label: "LinkedIn", href: "https://linkedin.com/company/veloztrade" },
                { icon: Send, label: "Telegram", href: "https://t.me/veloztrade" },
                { icon: Mail, label: "Email", href: "mailto:support@veloztrade.com" },
              ].map(s => (
                <a key={s.label} href={s.href} aria-label={s.label} rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors">
                  <s.icon className="w-4 h-4"/>
                </a>
              ))}
            </div>
          </div>

          {/* Platform links */}
          <div>
            <h4 className="font-bold text-sm mb-4 uppercase tracking-widest text-muted-foreground">Platform</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              {[
                { label: "Dashboard", href: "/dashboard" },
                { label: "Markets & Trade", href: "/trade" },
                { label: "Social Feed", href: "/social" },
                { label: "AutoCopy Trading", href: "/copy-trading" },
                { label: "Trading Signals", href: "/signals" },
                { label: "Contests", href: "/contests" },
                { label: "Academy", href: "/academy" },
              ].map(l => (
                <li key={l.label}><Link href={l.href} className="hover:text-foreground hover:pl-1 transition-all">{l.label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Trading */}
          <div>
            <h4 className="font-bold text-sm mb-4 uppercase tracking-widest text-muted-foreground">Trading</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              {[
                { label: "Forex Trading", href: "/trade" },
                { label: "Crypto Trading", href: "/trade" },
                { label: "Stock CFDs", href: "/trade" },
                { label: "Commodities", href: "/trade" },
                { label: "Indices", href: "/trade" },
                { label: "Account Types", href: "/#accounts" },
                { label: "Open Demo Account", href: "/sign-up" },
              ].map(l => (
                <li key={l.label}><Link href={l.href} className="hover:text-foreground hover:pl-1 transition-all">{l.label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-bold text-sm mb-4 uppercase tracking-widest text-muted-foreground">Company</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              {[
                { label: "About VelozTrade", href: "/about" },
                { label: "Why Choose Us", href: "/#platform" },
                { label: "Security", href: "/#security" },
                { label: "Careers", href: "/careers" },
                { label: "Blog & Insights", href: "/blog" },
                { label: "Press Room", href: "/press" },
                { label: "Partnerships", href: "/partnerships" },
              ].map(l => (
                <li key={l.label}><a href={l.href} className="hover:text-foreground hover:pl-1 transition-all">{l.label}</a></li>
              ))}
            </ul>
          </div>

          {/* Support & Legal */}
          <div>
            <h4 className="font-bold text-sm mb-4 uppercase tracking-widest text-muted-foreground">Support & Legal</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              {[
                { label: "Help Center", href: "/support" },
                { label: "Contact Support", href: "mailto:support@veloztrade.com" },
                { label: "FAQ", href: "/#faq" },
                { label: "Terms of Service", href: "/terms" },
                { label: "Privacy Policy", href: "/privacy" },
                { label: "Cookie Policy", href: "/cookie-policy" },
                { label: "Risk Disclosure", href: "/risk-disclosure" },
              ].map(l => (
                <li key={l.label}><a href={l.href} className="hover:text-foreground hover:pl-1 transition-all">{l.label}</a></li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border pt-8 space-y-4">
          <div className="flex flex-wrap justify-center gap-3 text-[10px] font-semibold text-muted-foreground">
            {["FSCA Licensed", "AML/KYC Compliant", "Segregated Funds", "SSL TLS 1.3", "ISO 27001", "GDPR Compliant"].map(badge => (
              <span key={badge} className="px-2 py-1 rounded bg-muted/50 border border-border">{badge}</span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed text-center max-w-3xl mx-auto">
            <strong className="text-foreground">Risk Warning:</strong> CFDs are leveraged products and may not be suitable for everyone. Trading CFDs involves risk. Please ensure you understand the risks involved. Sanus Financial Services Limited utilizing the domain with registration number 2023/786745/09 is authorised and regulated by the Financial Sector Conduct Authority (FSCA) with License number 51748 dated 31/05/2023. WGM Services Ltd., is part of the group with Sanus Financial Services, a company incorporated in the Republic of Cyprus with Company registration number HT32455 and license number 205/12 and is registered at Themistokli Dervi 48, apt.: 104, Nicosia, Cyprus. Sanus Financial Services Limited does not issue advice, recommendations or opinions in relation to acquiring, holding or disposing of any financial product. Sanus Financial Services Limited is not a financial advisor. <strong className="text-foreground">Restricted Jurisdictions:</strong> Sanus Financial Services Limited does not offer and does not provide services to residents and citizens of certain jurisdictions, including Australia, Canada, the EU and EEA, Japan, the United Kingdom, the United States of America, and countries sanctioned by the EU.
          </p>
          <p className="text-xs text-muted-foreground text-center">© {new Date().getFullYear()} VelozTrade. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export function Home() {
  useEffect(() => {
    document.title = "VelozTrade — Professional Trading Platform | Forex, Crypto, Stocks";
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", "Institutional-grade online trading platform for Forex, Crypto, Stocks, Commodities and Indices. Real-time prices, sub-10ms execution, free $10,000 demo account.");
  }, []);

  const { prices } = useWebSocket();
  const heroSyms = ["EURUSD","XAUUSD","BTCUSD","SPX"];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <PublicTicker />

      {/* Sticky Header */}
      <header className="sticky top-0 w-full border-b border-border/50 bg-background/85 backdrop-blur-xl z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <LogoMark size={28} />
            <span className="font-bold text-base sm:text-xl tracking-tight whitespace-nowrap">
              <span className="text-foreground">Veloz</span><span className="text-primary">Trade</span>
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#markets" className="hover:text-foreground transition-colors">Markets</a>
            <a href="#accounts" className="hover:text-foreground transition-colors">Accounts</a>
            <a href="#platform" className="hover:text-foreground transition-colors">Platform</a>
            <a href="#security" className="hover:text-foreground transition-colors">Security</a>
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/sign-in" className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 whitespace-nowrap hidden xs:block sm:block">
              Sign In
            </Link>
            <Link href="/sign-up" className="text-xs sm:text-sm font-semibold bg-primary text-primary-foreground px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg hover:bg-primary/90 transition-colors shadow-[0_0_16px_rgba(0,212,255,0.3)] whitespace-nowrap">
              <span className="sm:hidden">Trade</span><span className="hidden sm:inline">Start Trading</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative min-h-[calc(100vh-106px)] flex items-center overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-60"/>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_40%,rgba(0,114,255,0.08)_0%,transparent_65%)]"/>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_80%,rgba(124,58,237,0.06)_0%,transparent_50%)]"/>
        <div className="container mx-auto px-4 py-16 lg:py-0 flex flex-col lg:flex-row items-center gap-12 lg:gap-16 relative z-10">
          <motion.div
            className="flex-1 space-y-7 text-center lg:text-left max-w-xl"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold tracking-wide uppercase">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"/>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"/>
              </span>
              Live Markets · Institutional Grade
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05]">
              Trade Global<br />
              <span className="gradient-text">Markets With</span><br />
              Confidence
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-lg mx-auto lg:mx-0">
              Access 2000+ instruments across Forex, Crypto, Stocks, Commodities and Indices. Institutional-grade execution, real-time prices, demo account included.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              <Link href="/sign-up" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-xl font-bold text-base hover:bg-primary/90 transition-all animate-glow-pulse">
                Start Trading Free <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/sign-in" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-border px-8 py-4 rounded-xl font-bold text-base hover:bg-muted transition-colors">
                Sign In
              </Link>
            </div>
            <div className="flex items-center justify-center lg:justify-start gap-6 text-xs text-muted-foreground pt-1">
              {["No credit card required", "$10,000 demo balance", "2-minute setup"].map((t) => (
                <div key={t} className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-success shrink-0"/>
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </motion.div>
          <div className="flex-1 flex justify-center lg:justify-end w-full">
            <HeroTerminal />
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="py-8 border-b border-border bg-card/80">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-10">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest shrink-0">Trusted & Secure</div>
            <div className="h-px sm:h-5 w-full sm:w-px bg-border/60 shrink-0"/>
            {[
              { name: "SSL Secured", detail: "256-bit TLS encryption", icon: Lock },
              { name: "Segregated Funds", detail: "Held in tier-1 banks", icon: Shield },
              { name: "Real-Time Prices", detail: "Sub-500ms live feed", icon: Zap },
              { name: "Demo Protected", detail: "$10K risk-free balance", icon: Award },
            ].map(item => (
              <div key={item.name} className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <item.icon className="w-4 h-4 text-primary"/>
                </div>
                <div>
                  <div className="text-sm font-bold leading-tight">{item.name}</div>
                  <div className="text-xs text-muted-foreground">{item.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-14 border-b border-border bg-card/50">
        <div className="container mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6 divide-x divide-border/50">
          {(() => {
            const liveCount = useLiveTraderCount();
            return STATS_BASE.map((s) => (
              <motion.div
                key={s.label}
                className="text-center px-4"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <div className="text-4xl font-black gradient-text mb-1 flex items-center justify-center gap-1">
                  {(s as any).live ? (
                    <>{liveCount.toLocaleString()}+</>
                  ) : s.value}
                  {(s as any).live && <span className="w-2 h-2 rounded-full bg-success animate-pulse ml-1 mt-1"/>}
                </div>
                <div className="text-muted-foreground text-sm font-medium">{s.label}</div>
              </motion.div>
            ));
          })()}
        </div>
      </section>

      {/* Live Markets */}
      <section id="markets" className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
            <div>
              <div className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Live Prices</div>
              <h2 className="text-3xl md:text-4xl font-bold">Trade the World's Top Assets</h2>
              <p className="text-muted-foreground mt-2 text-lg">Prices stream in real-time via our 500ms live feed.</p>
            </div>
            <Link href="/trade" className="flex items-center gap-2 text-primary font-semibold hover:gap-3 transition-all">
              View All Markets <ChevronRight className="w-5 h-5"/>
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {heroSyms.map((sym, idx) => {
              const q = prices[sym];
              const price = q?.price ?? 0;
              const chg = q?.changePercent ?? 0;
              const up = chg >= 0;
              const names: Record<string,string> = { EURUSD:"Euro / US Dollar", XAUUSD:"Gold / US Dollar", BTCUSD:"Bitcoin / US Dollar", SPX:"S&P 500 Index" };
              return (
                <motion.div
                  key={sym}
                  className="glass-card rounded-2xl p-5 card-hover-3d cursor-pointer"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2.5">
                      <InstrumentIcon symbol={toDisplaySymbol(sym)} size={32} />
                      <div>
                        <div className="font-bold text-base">{sym}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{names[sym] ?? sym}</div>
                      </div>
                    </div>
                    <div className={`text-xs px-2 py-0.5 rounded-full font-semibold ${up ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                      {up ? "▲" : "▼"} {Math.abs(chg).toFixed(2)}%
                    </div>
                  </div>
                  <div className="text-2xl font-mono font-bold mb-3">
                    {price > 0 ? formatPrice(price, sym) : <span className="text-muted-foreground">Loading…</span>}
                  </div>
                  <Link href="/sign-up" className="w-full text-center text-xs font-semibold text-primary hover:text-primary/80 flex items-center justify-center gap-1">
                    Trade Now <ArrowRight className="w-3 h-3"/>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-card/30 border-y border-border">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Get Started</div>
            <h2 className="text-3xl md:text-4xl font-bold">Live in 3 Simple Steps</h2>
            <p className="text-muted-foreground mt-3 text-lg">From signup to your first trade in under 5 minutes.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto relative">
            <div className="hidden md:block absolute top-12 left-[calc(16.666%+2rem)] right-[calc(16.666%+2rem)] h-px bg-gradient-to-r from-primary/40 via-primary/20 to-primary/40"/>
            {HOW_IT_WORKS.map((step, i) => (
              <motion.div
                key={step.step}
                className="flex flex-col items-center text-center gap-5"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
              >
                <div className="relative">
                  <div className="w-24 h-24 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <step.icon className="w-10 h-10 text-primary"/>
                  </div>
                  <div className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-black flex items-center justify-center">
                    {step.step.replace("0","")}
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-2">{step.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="flex justify-center mt-12">
            <Link href="/sign-up" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-xl font-bold text-base hover:bg-primary/90 transition-all">
              Open Free Account <ArrowRight className="w-5 h-5"/>
            </Link>
          </div>
        </div>
      </section>

      {/* Account Types */}
      <section id="accounts" className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">VIP User Levels</div>
            <h2 className="text-3xl md:text-4xl font-bold">Choose Your Trading Level</h2>
            <p className="text-muted-foreground mt-3 text-lg max-w-2xl mx-auto">From Silver to VIP — unlock more features and better conditions as you grow.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
            {ACCOUNT_TYPES.map((acct, i) => (
              <motion.div
                key={acct.name}
                className={`relative glass-card rounded-2xl p-6 border-2 ${acct.color} card-hover-3d ${i === 1 ? "shadow-[0_0_30px_rgba(0,82,255,0.10)]" : ""}`}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
              >
                {acct.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full bg-primary text-primary-foreground whitespace-nowrap">
                    {acct.badge}
                  </div>
                )}
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{acct.badge2}</span>
                    <div className="text-xl font-black">{acct.name}</div>
                  </div>
                  <div className="text-2xl font-black gradient-text">{acct.minDeposit}</div>
                  <div className="text-xs text-muted-foreground">min. deposit</div>
                </div>
                <div className="space-y-2 mb-5 text-sm">
                  {[
                    { label: "Spread", value: acct.spread },
                    { label: "Commission", value: acct.commission },
                    { label: "Execution", value: acct.execution },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between items-center py-1 border-b border-border/40 last:border-0">
                      <span className="text-muted-foreground text-xs">{row.label}</span>
                      <span className="font-bold text-xs">{row.value}</span>
                    </div>
                  ))}
                </div>
                <ul className="space-y-1.5 mb-5">
                  {acct.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle className="w-3 h-3 text-success shrink-0 mt-0.5"/>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={`/sign-up?tier=${acct.name.toLowerCase()}`} className={`block text-center py-2.5 rounded-xl font-bold text-sm ${acct.btnClass} transition-all`}>
                  Open {acct.name} Account
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Features */}
      <section id="platform" className="py-24 bg-card/30 border-y border-border">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Platform</div>
            <h2 className="text-3xl md:text-4xl font-bold">Built for Serious Traders</h2>
            <p className="text-muted-foreground mt-3 text-lg max-w-2xl mx-auto">Every tool a professional needs, distilled into a clean, fast, and reliable platform.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                className="glass-card rounded-2xl p-6 card-hover-3d"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                  <f.icon className="w-6 h-6 text-primary"/>
                </div>
                <h3 className="font-bold text-base mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Testimonials</div>
            <h2 className="text-3xl md:text-4xl font-bold">Trusted by Traders Worldwide</h2>
            <p className="text-muted-foreground mt-3 text-lg">What professional traders say about VelozTrade.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={t.name}
                className="glass-card rounded-2xl p-6 border border-border flex flex-col gap-4"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="flex gap-0.5">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-warning text-warning"/>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">"{t.text}"</p>
                <div className="flex items-center gap-3 pt-2 border-t border-border/40">
                  <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                    {t.avatar}
                  </div>
                  <div>
                    <div className="font-bold text-sm">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="py-24 bg-card/30 border-y border-border">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">Security</div>
              <h2 className="text-3xl md:text-4xl font-bold mb-5">Your Funds Are Protected</h2>
              <p className="text-muted-foreground leading-relaxed mb-8">
                VelozTrade operates under strict financial compliance standards with multiple layers of security protecting every account and transaction.
              </p>
              <div className="space-y-4">
                {[
                  { icon: Lock, title: "256-bit SSL/TLS Encryption", desc: "All data in transit is encrypted using industry-standard TLS 1.3." },
                  { icon: Building2, title: "Segregated Client Funds", desc: "Your funds are held in separate accounts with tier-1 banking partners, fully ring-fenced from company funds." },
                  { icon: Shield, title: "Two-Factor Authentication", desc: "Optional 2FA via authenticator app or SMS adds an extra layer to your account login." },
                  { icon: FileText, title: "Regulatory Compliance", desc: "We maintain rigorous AML/KYC procedures and full audit trails for all client transactions." },
                ].map(item => (
                  <div key={item.title} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <item.icon className="w-5 h-5 text-primary"/>
                    </div>
                    <div>
                      <div className="font-bold text-sm mb-0.5">{item.title}</div>
                      <div className="text-xs text-muted-foreground leading-relaxed">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="glass-card rounded-2xl p-8 border border-border"
            >
              <h3 className="font-bold text-xl mb-6">Start Risk-Free Today</h3>
              <div className="space-y-4 mb-8">
                {[
                  "$10,000 virtual demo balance",
                  "All 2000+ instruments unlocked",
                  "Full platform access",
                  "No time limit on demo",
                  "Switch to live anytime",
                ].map(f => (
                  <div key={f} className="flex items-center gap-3 text-sm">
                    <CheckCircle className="w-4 h-4 text-success shrink-0"/>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <Link href="/sign-up" className="block text-center py-4 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all text-base mb-3">
                Open Free Demo Account
              </Link>
              <p className="text-center text-xs text-muted-foreground">No credit card · No commitment · 2 minutes</p>
            </motion.div>
          </div>
        </div>
      </section>

      <FAQ />

      {/* Final CTA */}
      <section className="py-24 bg-background relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(0,114,255,0.07)_0%,transparent_70%)]"/>
        <div className="container mx-auto px-4 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="text-xs font-semibold text-primary uppercase tracking-widest mb-4">Join 300,000+ Traders</div>
            <h2 className="text-4xl md:text-5xl font-black mb-5 leading-tight">
              Ready to Trade Like a<br /><span className="gradient-text">Professional?</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
              Start with a free demo account. No risk, no commitment. Upgrade to live trading when you're ready.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/sign-up" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-10 py-5 rounded-xl font-bold text-lg hover:bg-primary/90 transition-all animate-glow-pulse shadow-[0_0_32px_rgba(0,212,255,0.3)]">
                Start Trading Free <ArrowRight className="w-5 h-5"/>
              </Link>
              <Link href="/trade" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-border px-10 py-5 rounded-xl font-bold text-lg hover:bg-muted transition-colors">
                View Markets
              </Link>
            </div>
            <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground mt-6">
              {["No credit card", "Instant access", "Free forever"].map(t => (
                <div key={t} className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-success"/>
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
