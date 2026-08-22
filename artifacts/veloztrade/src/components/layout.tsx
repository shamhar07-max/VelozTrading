import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart2, CalendarDays, Clock, LayoutDashboard, LogOut, Star, Sun, Moon,
  Menu, X, CreditCard, Wallet, User, ShieldCheck, Trophy, Briefcase,
  Users, Copy, Zap, BookOpen, Gift, Medal, Bell, HelpCircle, History, ChevronLeft, ChevronRight,
  Handshake, Building2, Layers,
} from "lucide-react";
import { useWebSocket } from "@/hooks/use-websocket";
import { useNotificationPolling } from "@/hooks/use-notifications";
import { useTheme } from "@/components/theme-provider";
import { toKey, formatPrice } from "@/lib/symbol";

let _logoCounter = 0;
function LogoMark({ size = 30 }: { size?: number }) {
  // Use a stable unique ID per instance so multiple SVGs on the same page
  // don't share gradient/filter IDs (causes mobile logo to render blank).
  const [uid] = useState(() => `vt-logo-${++_logoCounter}`);
  const bgId = `${uid}-bg`;
  const markId = `${uid}-mark`;
  const glowId = `${uid}-glow`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={bgId} x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#040C1A"/><stop offset="100%" stopColor="#061828"/>
        </linearGradient>
        <linearGradient id={markId} x1="16" y1="76" x2="84" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00C6FF"/><stop offset="55%" stopColor="#0072FF"/><stop offset="100%" stopColor="#7C3AED"/>
        </linearGradient>
        <filter id={glowId}><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <rect width="100" height="100" rx="20" fill={`url(#${bgId})`}/>
      <line x1="16" y1="24" x2="50" y2="76" stroke={`url(#${markId})`} strokeWidth="8.5" strokeLinecap="round" filter={`url(#${glowId})`}/>
      <polyline points="50,76 62,49 71,61 84,20" stroke={`url(#${markId})`} strokeWidth="8.5" strokeLinecap="round" strokeLinejoin="round" fill="none" filter={`url(#${glowId})`}/>
      <circle cx="84" cy="20" r="6.5" fill="#00C6FF" filter={`url(#${glowId})`}/>
      <circle cx="84" cy="20" r="3" fill="white"/>
    </svg>
  );
}

const TICKER_SYMS = ["EURUSD","BTCUSD","XAUUSD","SPX","AAPL","ETHUSD","GBPUSD","USDJPY","NVDA","AUDUSD","NDX","USOIL"];

const navItems = [
  { href: "/dashboard",    label: "Dashboard",       icon: LayoutDashboard },
  { href: "/trade",        label: "Trade",           icon: BarChart2 },
  { href: "/portfolio",    label: "Portfolio",       icon: Briefcase },
  { href: "/deposit",      label: "Deposit",         icon: CreditCard },
  { href: "/withdraw",     label: "Withdraw",        icon: Wallet },
  { href: "/funds-history",label: "Funds History",   icon: History },
  { href: "/watchlist",    label: "Watchlist",       icon: Star },
  { href: "/history",      label: "Trade History",   icon: Clock },
  { href: "/social",       label: "Social Feed",     icon: Users },
  { href: "/copy-trading", label: "AutoCopy",        icon: Copy },
  { href: "/signals",      label: "Signals",         icon: Zap },
  { href: "/leaderboard",  label: "Leaderboard",     icon: Trophy },
  { href: "/contests",     label: "Contests",        icon: Medal },
  { href: "/calendar",     label: "Calendar",        icon: CalendarDays },
  { href: "/academy",      label: "Academy",         icon: BookOpen },
];

const moreItems = [
  { href: "/referral",      label: "Refer a Friend",  icon: Gift },
  { href: "/partner",       label: "Partner Portal",  icon: Handshake, partnerOnly: true },
  { href: "/ib",            label: "IB Panel",        icon: Building2 },
  { href: "/sub-ib",        label: "Sub-IB Panel",    icon: Layers },
  { href: "/notifications", label: "Notifications",   icon: Bell },
  { href: "/support",       label: "Support",         icon: HelpCircle },
  { href: "/profile",       label: "Profile",         icon: User },
  { href: "/admin",         label: "Admin",           icon: ShieldCheck, adminOnly: true },
];

// Bottom nav shows first 5 most important items for mobile
const BOTTOM_NAV = [
  { href: "/dashboard",    label: "Home",     icon: LayoutDashboard },
  { href: "/trade",        label: "Trade",    icon: BarChart2 },
  { href: "/social",       label: "Social",   icon: Users },
  { href: "/copy-trading", label: "Copy",     icon: Copy },
  { href: "/profile",      label: "Profile",  icon: User },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { prices } = useWebSocket();
  const { theme, setTheme } = useTheme();
  useNotificationPolling();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const tickerItems = [...TICKER_SYMS, ...TICKER_SYMS];
  const ADMIN_EMAIL = "shamhar07@gmail.com";
  const userEmail = user?.emailAddresses?.[0]?.emailAddress ?? "";
  const isAdmin = userEmail === ADMIN_EMAIL;

  const { data: partnerData } = useQuery<{ id: number } | null>({
    queryKey: ["partner-me-nav"],
    queryFn: async () => {
      const res = await fetch("/api/partner/me");
      if (res.status === 404) return null;
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user,
    retry: false,
    staleTime: 5 * 60_000,
  });
  const isPartner = !!partnerData;

  const visibleMoreItems = moreItems.filter(i => {
    if ("adminOnly" in i && i.adminOnly) return isAdmin;
    if ("partnerOnly" in i && (i as { partnerOnly?: boolean }).partnerOnly) return isPartner;
    return true;
  });
  const allNavItems = [...navItems, ...visibleMoreItems];

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden">
      {/* ── Desktop Sidebar ──────────────────────────────────────────── */}
      <aside className={`${sidebarCollapsed ? "w-14" : "w-60"} border-r border-border bg-card flex-col hidden md:flex shrink-0 transition-all duration-200`}>
        {/* Logo */}
        <div className="border-b border-border flex items-center h-12 px-3 gap-2 shrink-0">
          <div className="shrink-0 rounded-lg overflow-hidden ring-1 ring-primary/30 shadow-[0_0_8px_rgba(0,114,255,0.2)]">
            <LogoMark size={26} />
          </div>
          {!sidebarCollapsed && (
            <span className="font-bold text-sm tracking-tight truncate">
              <span className="text-foreground">Veloz</span><span className="text-primary">Trade</span>
            </span>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="ml-auto p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5"/> : <ChevronLeft className="w-3.5 h-3.5"/>}
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto scrollbar-thin">
          {navItems.map((item) => {
            const isActive = location === item.href || location.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={sidebarCollapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-2.5 py-2 rounded-lg transition-all text-sm font-medium ${
                  isActive
                    ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgba(0,212,255,0.15)]"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                } ${sidebarCollapsed ? "justify-center" : ""}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                {!sidebarCollapsed && isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shrink-0"/>}
              </Link>
            );
          })}

          <div className={`pt-2 border-t border-border/50 mt-2 space-y-0.5 ${sidebarCollapsed ? "" : ""}`}>
            {visibleMoreItems.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`flex items-center gap-3 px-2.5 py-2 rounded-lg transition-all text-sm font-medium ${
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  } ${sidebarCollapsed ? "justify-center" : ""}`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  {"adminOnly" in item && item.adminOnly && !sidebarCollapsed && (
                    <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-destructive/15 text-destructive shrink-0">ADMIN</span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="p-2 border-t border-border space-y-0.5 shrink-0">
          <button
            className={`flex items-center gap-3 px-2.5 py-2 w-full rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all text-sm font-medium ${sidebarCollapsed ? "justify-center" : ""}`}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? <Sun className="w-4 h-4 shrink-0"/> : <Moon className="w-4 h-4 shrink-0"/>}
            {!sidebarCollapsed && <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
          </button>
          <button
            className={`flex items-center gap-3 px-2.5 py-2 w-full rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all text-sm font-medium ${sidebarCollapsed ? "justify-center" : ""}`}
            onClick={() => signOut({ redirectUrl: "/" })}
            title="Sign out"
          >
            <LogOut className="w-4 h-4 shrink-0"/>
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ── Main content area ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header className="h-10 border-b border-border bg-card/70 flex items-center overflow-hidden shrink-0">
          {/* Mobile logo */}
          <div className="md:hidden flex items-center gap-2 px-3 shrink-0 border-r border-border h-full">
            <div className="shrink-0 rounded-md overflow-hidden ring-1 ring-primary/30 shadow-[0_0_6px_rgba(0,114,255,0.2)]">
              <LogoMark size={24} />
            </div>
            <span className="font-bold text-sm whitespace-nowrap"><span>Veloz</span><span className="text-primary">Trade</span></span>
          </div>
          {/* Ticker */}
          <div className="flex-1 overflow-hidden h-full flex items-center min-w-0">
            <div className="flex animate-marquee gap-6 whitespace-nowrap items-center" style={{ willChange: "transform" }}>
              {tickerItems.map((sym, i) => {
                const q = prices[sym];
                const price = q?.price;
                const chg = q?.changePercent ?? 0;
                const up = chg >= 0;
                return (
                  <div key={`${sym}-${i}`} className="flex items-center gap-1 text-[11px] font-mono">
                    <span className="font-bold text-foreground/80">{sym}</span>
                    <span className="text-foreground">{price ? formatPrice(price, sym) : "—"}</span>
                    <span className={up ? "text-success" : "text-destructive"}>{up ? "▲" : "▼"}{Math.abs(chg).toFixed(2)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Mobile menu button */}
          <button
            className="md:hidden px-3 h-full border-l border-border text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="w-5 h-5"/>
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto relative bg-background">
          {/* Mobile: add bottom padding for nav bar. Trade page uses -m-3 md:-m-5 to escape this. */}
          <div className="p-3 md:p-5 pb-20 md:pb-5 min-h-full h-full">
            {children}
          </div>
        </main>

        {/* ── Mobile bottom nav ────────────────────────────────────────── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 safe-area-pb">
          <div className="flex items-center justify-around px-1 py-1" style={{ paddingBottom: "env(safe-area-inset-bottom, 4px)" }}>
            {BOTTOM_NAV.map((item) => {
              const isActive = location === item.href || location.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl min-w-[52px] transition-all ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : ""}`}/>
                  <span className="text-[9px] font-semibold leading-tight">{item.label}</span>
                </Link>
              );
            })}
            {/* More button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl min-w-[52px] text-muted-foreground"
            >
              <Menu className="w-5 h-5"/>
              <span className="text-[9px] font-semibold">More</span>
            </button>
          </div>
        </nav>
      </div>

      {/* ── Mobile slide-over drawer ─────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}/>
          <div className="absolute right-0 top-0 bottom-0 w-72 bg-card border-l border-border flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <LogoMark size={24}/>
                <span className="font-bold text-sm"><span>Veloz</span><span className="text-primary">Trade</span></span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded-lg hover:bg-muted">
                <X className="w-5 h-5 text-muted-foreground"/>
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
              {allNavItems.map(item => {
                const isActive = location === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
                      isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0"/>
                    <span>{item.label}</span>
                    {"adminOnly" in item && !!item.adminOnly && (
                      <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">ADMIN</span>
                    )}
                  </Link>
                );
              })}
            </nav>
            <div className="p-3 border-t border-border space-y-0.5 shrink-0">
              <button
                className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-muted-foreground hover:bg-muted text-sm font-medium"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </button>
              <button
                className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-muted-foreground hover:bg-muted text-sm font-medium"
                onClick={() => signOut({ redirectUrl: "/" })}
              >
                <LogOut className="w-4 h-4"/>Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
