import { useEffect } from "react";
import { Link } from "wouter";
import { useGetDashboardSummary, useGetDashboardActivity, useGetAccount, getGetAccountQueryKey, useListPositions, getListPositionsQueryKey, useClosePosition, useGetEquityHistory } from "@workspace/api-client-react";
import { useWebSocket } from "@/hooks/use-websocket";
import { useQueryClient } from "@tanstack/react-query";
import { toKey, formatPrice, toDisplaySymbol } from "@/lib/symbol";
import { ArrowUpRight, ArrowDownRight, Wallet, Activity, Target, Layers, TrendingUp, TrendingDown, BarChart2, Plus, Zap, Shield, Gauge } from "lucide-react";
import { InstrumentIcon } from "@/components/instrument-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

const MOVERS_SYMS = [
  { key: "EURUSD", label: "EUR/USD" },
  { key: "BTCUSD", label: "BTC/USD" },
  { key: "XAUUSD", label: "XAU/USD" },
  { key: "AAPL", label: "AAPL" },
  { key: "ETHUSD", label: "ETH/USD" },
  { key: "SPX", label: "S&P 500" },
  { key: "NVDA", label: "NVIDIA" },
  { key: "GBPUSD", label: "GBP/USD" },
];

function computePnl(openPrice: number, currentPrice: number, volume: number, direction: "buy" | "sell", lotSize: number = 1): number {
  return direction === "buy"
    ? (currentPrice - openPrice) * volume * lotSize
    : (openPrice - currentPrice) * volume * lotSize;
}

function StatCard({ title, value, delta, icon: Icon, positive }: {
  title: string; value: string | null; delta?: string; icon: any; positive?: boolean;
}) {
  return (
    <div className="glass-card rounded-2xl p-5 relative overflow-hidden group">
      <div className="absolute top-3 right-3 w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity">
        <Icon className="w-5 h-5 text-primary"/>
      </div>
      <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">{title}</div>
      {value === null ? (
        <Skeleton className="h-8 w-28 mt-1"/>
      ) : (
        <div className={`text-2xl font-black font-mono tracking-tight ${positive === true ? "text-success" : positive === false ? "text-destructive" : "text-foreground"}`}>
          {value}
        </div>
      )}
      {delta && <div className={`text-xs mt-1.5 font-medium ${positive ? "text-success" : "text-muted-foreground"}`}>{delta}</div>}
    </div>
  );
}

export function Dashboard() {
  useEffect(() => { document.title = "Dashboard | VelozTrade"; }, []);

  const queryClient = useQueryClient();
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: activity, isLoading: loadingActivity } = useGetDashboardActivity();
  const { data: account } = useGetAccount({ query: { refetchInterval: 5000, queryKey: getGetAccountQueryKey() } });
  const { data: positionsRaw, isLoading: loadingPositions } = useListPositions();
  const positions = Array.isArray(positionsRaw) ? positionsRaw : [];
  const closePosition = useClosePosition();
  const { prices, isConnected } = useWebSocket();

  const isDemo = account?.isDemoMode ?? false;

  const TIER_BADGES: Record<string, string> = {
    real: "⬜ Real",
    silver: "🥈 Silver",
    gold: "🥇 Gold",
    platinum: "💎 Platinum",
    vip: "👑 VIP",
  };
  const tierLabel = TIER_BADGES[account?.accountType ?? "real"] ?? "Real";

  const totalLivePnl = positions.reduce((sum, pos) => {
    const curr = prices[toKey(pos.symbol)]?.price ?? pos.currentPrice ?? pos.openPrice ?? 0;
    const pnl = computePnl(pos.openPrice ?? 0, curr, pos.volume ?? 0, pos.direction, pos.lotSize ?? 1);
    return sum + (isFinite(pnl) ? pnl : 0);
  }, 0);

  const balance = account?.balance != null ? account.balance : (summary?.balance ?? null);
  const equity = balance !== null ? balance + totalLivePnl : null;

  const { data: equityHistory, isLoading: loadingEquity } = useGetEquityHistory();

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Overview</h1>
          {isDemo && (
            <Link
              href="/profile"
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 transition-colors"
            >
              🟡 Demo · ${(account?.demoBalance ?? 10000).toLocaleString("en-US", { minimumFractionDigits: 2 })} Virtual · Go Live →
            </Link>
          )}
          {!isDemo && account && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full border border-primary/30 bg-primary/8 text-primary">
              {tierLabel}
            </span>
          )}
        </div>
        <Link href="/trade" className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4"/> New Trade
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <StatCard title="Balance" value={balance !== null ? `$${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null} icon={Wallet}/>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <StatCard title="Equity" value={equity !== null ? `$${equity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null} icon={Layers}/>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.10 }}>
          <StatCard
            title="Free Margin"
            value={account?.freeMargin != null ? `$${account.freeMargin.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null}
            icon={Shield}
            positive={account?.freeMargin != null ? (account.freeMargin >= 0 ? undefined : false) : undefined}
          />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
          <StatCard
            title="Margin Level"
            value={account?.marginLevel != null
              ? (account.marginLevel === 0 ? "—" : `${account.marginLevel.toFixed(1)}%`)
              : null}
            delta={account?.marginLevel != null && account.marginLevel > 0 && account.marginLevel < 150
              ? "⚠ Approaching margin call"
              : undefined}
            icon={Gauge}
            positive={account?.marginLevel != null && account.marginLevel > 0
              ? (account.marginLevel >= 100 ? undefined : false)
              : undefined}
          />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.17 }}>
          <StatCard
            title="Live P&L"
            value={`${totalLivePnl >= 0 ? "+" : ""}$${Math.abs(totalLivePnl).toFixed(2)}`}
            icon={Activity}
            positive={totalLivePnl >= 0 ? true : false}
          />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.20 }}>
          <StatCard
            title="Win Rate"
            value={loadingSummary ? null : `${summary?.winRate?.toFixed(1) ?? "0.0"}%`}
            delta={loadingSummary ? undefined : `${summary?.totalTrades ?? 0} total trades`}
            icon={Target}
            positive={summary && summary.winRate >= 50 ? true : undefined}
          />
        </motion.div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Performance Analytics Panel */}
        <div className="xl:col-span-2 glass-card rounded-2xl p-5 flex flex-col gap-4">
          <div className="font-bold flex items-center gap-2 border-b border-border/50 pb-3">
            <BarChart2 className="w-4 h-4 text-primary"/> Performance
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Win Rate", value: `${summary?.winRate?.toFixed(1) ?? 0}%`, color: "text-success" },
              { label: "Total Trades", value: summary?.totalTrades ?? 0, color: "text-foreground" },
              { label: "Profit Factor", value: (summary as any)?.profitFactor ? ((summary as any).profitFactor as number).toFixed(2) : "—", color: "text-primary" },
              { label: "Avg. Trade", value: (summary as any)?.avgTrade ? `$${((summary as any).avgTrade as number).toFixed(2)}` : "—", color: "text-foreground" },
            ].map(stat => (
              <div key={stat.label} className="bg-muted/30 rounded-xl p-3">
                <div className="text-xs text-muted-foreground mb-1">{stat.label}</div>
                <div className={`text-xl font-black font-mono ${stat.color}`}>{loadingSummary ? "—" : stat.value}</div>
              </div>
            ))}
          </div>
          {/* Real equity sparkline */}
          <div className="mt-1">
            <div className="text-xs text-muted-foreground mb-2">Account Equity Curve</div>
            {loadingEquity ? (
              <div className="h-14 flex items-center justify-center"><div className="w-full h-2 bg-muted rounded animate-pulse"/></div>
            ) : !Array.isArray(equityHistory) || equityHistory.length < 2 ? (
              <div className="h-14 flex items-center justify-center text-[11px] text-muted-foreground italic">No closed trades yet</div>
            ) : (() => {
              const pts = equityHistory.map(p => ({ ...p, eq: p.equity }));
              const minEq = Math.min(...pts.map(p => p.eq));
              const maxEq = Math.max(...pts.map(p => p.eq));
              const isUp = pts[pts.length - 1]!.eq >= pts[0]!.eq;
              return (
                <ResponsiveContainer width="100%" height={72}>
                  <LineChart data={pts} margin={{ top: 4, right: 4, left: 4, bottom: 16 }}>
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v: string) => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis domain={[minEq * 0.999, maxEq * 1.001]} hide />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null;
                        const d = payload[0].payload as { date: string; eq: number };
                        return (
                          <div className="bg-card border border-border rounded-lg px-2 py-1 text-[10px] shadow">
                            <div className="font-mono font-bold">${d.eq.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                            <div className="text-muted-foreground">{new Date(d.date).toLocaleDateString()}</div>
                          </div>
                        );
                      }}
                    />
                    <Line type="monotone" dataKey="eq" dot={false} strokeWidth={2} stroke={isUp ? "hsl(var(--success))" : "hsl(var(--destructive))"} />
                  </LineChart>
                </ResponsiveContainer>
              );
            })()}
          </div>
          {/* Account stats */}
          <div className="text-xs text-muted-foreground space-y-1.5 border-t border-border/50 pt-3">
            <div className="flex justify-between">
              <span>Account Type</span>
              <span className="font-semibold text-foreground">{account ? tierLabel : "—"}</span>
            </div>
            {isDemo && (
              <div className="flex justify-between">
                <span>Demo Balance</span>
                <span className="font-mono font-semibold text-amber-400">${(account?.demoBalance ?? 10000).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Execution Speed</span>
              <span className="font-semibold text-success">5ms</span>
            </div>
            <div className="flex justify-between">
              <span>Free Margin</span>
              <span className="font-mono font-semibold text-foreground">{account?.freeMargin != null ? `$${account.freeMargin.toFixed(2)}` : "—"}</span>
            </div>
          </div>
        </div>
        <div className="xl:col-span-3 glass-card rounded-2xl flex flex-col">
          <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
            <div className="font-bold flex items-center gap-2"><BarChart2 className="w-4 h-4 text-primary"/> Open Positions</div>
            <span className="text-xs text-muted-foreground">{positions.length} active</span>
          </div>
          <div className="flex-1 overflow-auto divide-y divide-border/50">
            {loadingPositions ? (
              <div className="p-5 space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-12 w-full"/>)}</div>
            ) : positions.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-3">
                <Activity className="w-10 h-10 opacity-20"/>
                <p className="text-sm">No open positions</p>
                <Link href="/trade" className="text-xs text-primary hover:underline">Open your first trade →</Link>
              </div>
            ) : (
              positions.map(pos => {
                const curr = prices[toKey(pos.symbol)]?.price ?? pos.currentPrice ?? pos.openPrice ?? 0;
                const pnlRaw = computePnl(pos.openPrice ?? 0, curr, pos.volume ?? 0, pos.direction, pos.lotSize ?? 1);
                const pnl = isFinite(pnlRaw) ? pnlRaw : 0;
                return (
                  <div key={pos.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-muted/10">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${pos.direction === "buy" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                        {pos.direction === "buy" ? "B" : "S"}
                      </div>
                      <div>
                        <div className="font-bold text-sm">{pos.symbol}</div>
                        <div className="text-xs text-muted-foreground">{pos.volume} lot · {formatPrice(pos.openPrice, pos.symbol)}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-mono font-bold text-sm ${pnl >= 0 ? "text-success" : "text-destructive"}`}>
                        {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">{formatPrice(curr, pos.symbol)}</div>
                    </div>
                    <button
                      onClick={() => closePosition.mutate({ id: pos.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListPositionsQueryKey() }) })}
                      className="ml-4 text-xs px-3 py-1.5 border border-destructive/30 rounded-lg hover:bg-destructive/10 text-destructive"
                    >Close</button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="xl:col-span-2 glass-card rounded-2xl flex flex-col">
          <div className="px-5 py-4 border-b border-border/50 font-bold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary"/> Live Movers
          </div>
          <div className="flex-1 overflow-auto divide-y divide-border/50">
            {!isConnected || MOVERS_SYMS.every(({ key }) => !prices[key]) ? (
              MOVERS_SYMS.map(({ key }) => (
                <div key={key} className="px-5 py-3 flex items-center justify-between">
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-16"/>
                    <Skeleton className="h-3 w-20"/>
                  </div>
                  <Skeleton className="h-4 w-14"/>
                </div>
              ))
            ) : (
              MOVERS_SYMS.map(({ key, label }) => {
                const q = prices[key];
                if (!q) {
                  return (
                    <div key={key} className="px-5 py-3 flex items-center justify-between">
                      <div className="space-y-1.5">
                        <Skeleton className="h-3.5 w-16"/>
                        <Skeleton className="h-3 w-20"/>
                      </div>
                      <Skeleton className="h-4 w-14"/>
                    </div>
                  );
                }
                const up = q.changePercent >= 0;
                return (
                  <Link key={key} href="/trade" className="px-5 py-3 flex items-center justify-between hover:bg-muted/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <InstrumentIcon symbol={toDisplaySymbol(label)} size={28} />
                      <div>
                        <div className="font-semibold text-sm">{label}</div>
                        <div className="text-xs text-muted-foreground font-mono">{formatPrice(q.price, key)}</div>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1 text-sm font-bold ${up ? "text-success" : "text-destructive"}`}>
                      {up ? <ArrowUpRight className="w-4 h-4"/> : <ArrowDownRight className="w-4 h-4"/>}
                      {Math.abs(q.changePercent).toFixed(2)}%
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="glass-card rounded-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-border/50 font-bold flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary"/> Recent Activity
        </div>
        <div className="divide-y divide-border/50">
          {loadingActivity ? (
            <div className="p-5 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full"/>)}</div>
          ) : !Array.isArray(activity) || activity.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No recent activity</div>
          ) : (
            (Array.isArray(activity) ? activity : []).map(item => {
              const isOpen = item.type === "trade_open";
              return (
                <div key={item.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-muted/10">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isOpen ? "bg-primary/15" : "bg-muted"}`}>
                      {isOpen ? <TrendingUp className="w-4 h-4 text-primary"/> : <TrendingDown className="w-4 h-4 text-muted-foreground"/>}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{item.description}</div>
                      <div className="text-xs text-muted-foreground">{new Date(item.timestamp).toLocaleString()}</div>
                    </div>
                  </div>
                  {item.amount != null && (
                    <div className={`font-mono font-bold text-sm ${item.amount > 0 ? "text-success" : item.amount < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {item.amount > 0 ? "+" : ""}${Math.abs(item.amount).toFixed(2)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
