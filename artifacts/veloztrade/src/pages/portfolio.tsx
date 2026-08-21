import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import {
  useListPositions,
  useUpdatePosition,
  useClosePosition,
  useGetAccount,
  getListPositionsQueryKey,
  getGetAccountQueryKey,
} from "@workspace/api-client-react";
import { useWebSocket } from "@/hooks/use-websocket";
import { useQueryClient } from "@tanstack/react-query";
import { toKey, formatPrice } from "@/lib/symbol";
import { InstrumentIcon } from "@/components/instrument-icon";
import {
  TrendingUp, TrendingDown, Activity, Target, Wallet, X, Edit2, Check,
  Plus, AlertTriangle, ChevronUp, ChevronDown, BarChart2, Layers, Clock,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";

function computePnl(openPrice: number, currentPrice: number, volume: number, direction: "buy" | "sell", lotSize: number = 1) {
  return (direction === "buy" ? (currentPrice - openPrice) * volume : (openPrice - currentPrice) * volume) * lotSize;
}

function InlineEdit({
  value,
  onSave,
  placeholder,
  label,
}: {
  value: number | null;
  onSave: (v: number | null) => void;
  placeholder: string;
  label: string;
}) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(value != null ? String(value) : "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    const parsed = inputVal.trim() === "" ? null : parseFloat(inputVal);
    if (parsed !== null && isNaN(parsed)) { setEditing(false); return; }
    onSave(parsed);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          className="w-24 px-2 py-0.5 text-xs rounded-md border border-primary bg-background font-mono focus:outline-none"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        />
        <button onClick={commit} className="text-success hover:text-success/80"><Check className="w-3.5 h-3.5"/></button>
        <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5"/></button>
      </div>
    );
  }

  return (
    <button
      onClick={() => { setInputVal(value != null ? String(value) : ""); setEditing(true); }}
      className="group flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      <span className={value != null ? "font-mono text-foreground" : "italic opacity-60"}>{value != null ? formatPrice(value, "") : placeholder}</span>
      <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-70 transition-opacity"/>
    </button>
  );
}

function CloseConfirmDialog({
  pos,
  currentPrice,
  pnl,
  onConfirm,
  onCancel,
  loading,
}: {
  pos: { id: number; symbol: string; direction: "buy" | "sell"; volume: number };
  currentPrice: number;
  pnl: number;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl mx-4"
      >
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-warning"/>
          <h3 className="font-bold text-lg">Close Position</h3>
        </div>
        <div className="space-y-3 mb-5 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Symbol</span><span className="font-semibold text-foreground">{pos.symbol}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Direction</span>
            <span className={`font-semibold capitalize ${pos.direction === "buy" ? "text-success" : "text-destructive"}`}>{pos.direction}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Volume</span><span className="font-mono font-semibold text-foreground">{pos.volume} lot</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Close Price</span><span className="font-mono font-semibold text-foreground">{formatPrice(currentPrice, pos.symbol)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-3">
            <span className="font-medium">Realized P&L</span>
            <span className={`font-mono font-bold text-base ${pnl >= 0 ? "text-success" : "text-destructive"}`}>
              {pnl >= 0 ? "+" : ""}${Math.abs(pnl).toFixed(2)}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted/40 transition-colors">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 transition-colors disabled:opacity-60"
          >
            {loading ? "Closing…" : "Close Position"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function Portfolio() {
  useEffect(() => { document.title = "Portfolio | VelozTrade"; }, []);

  const queryClient = useQueryClient();
  const { data: positionsRaw, isLoading } = useListPositions();
  const positions = Array.isArray(positionsRaw) ? positionsRaw : [];
  const { data: account } = useGetAccount({ query: { refetchInterval: 5000, queryKey: getGetAccountQueryKey() } });
  const { prices } = useWebSocket();
  const updatePosition = useUpdatePosition();
  const closePosition = useClosePosition();

  const [closingId, setClosingId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const enriched = (positions ?? []).map((pos) => {
    const curr = prices[toKey(pos.symbol)]?.price ?? pos.currentPrice;
    const pnl = computePnl(pos.openPrice, curr, pos.volume, pos.direction, pos.lotSize ?? 1);
    return { ...pos, curr, pnl };
  });

  const totalPnl = enriched.reduce((s, p) => s + p.pnl, 0);
  const totalVolume = enriched.reduce((s, p) => s + p.volume, 0);
  const winners = enriched.filter((p) => p.pnl > 0).length;
  const balance = parseFloat(String(account?.balance ?? 0));

  // Symbol breakdown
  const bySymbol = enriched.reduce<Record<string, { pnl: number; count: number }>>((acc, p) => {
    if (!acc[p.symbol]) acc[p.symbol] = { pnl: 0, count: 0 };
    acc[p.symbol].pnl += p.pnl;
    acc[p.symbol].count++;
    return acc;
  }, {});
  const symbolEntries = Object.entries(bySymbol).sort((a, b) => Math.abs(b[1].pnl) - Math.abs(a[1].pnl));

  const closingPos = enriched.find((p) => p.id === closingId);

  function handleSaveTp(posId: number, tp: number | null) {
    setUpdatingId(posId);
    updatePosition.mutate(
      { id: posId, data: { takeProfit: tp } },
      {
        onSettled: () => {
          setUpdatingId(null);
          queryClient.invalidateQueries({ queryKey: getListPositionsQueryKey() });
        },
      }
    );
  }

  function handleSaveSl(posId: number, sl: number | null) {
    setUpdatingId(posId);
    updatePosition.mutate(
      { id: posId, data: { stopLoss: sl } },
      {
        onSettled: () => {
          setUpdatingId(null);
          queryClient.invalidateQueries({ queryKey: getListPositionsQueryKey() });
        },
      }
    );
  }

  function handleClose() {
    if (closingId == null || !closingPos) return;
    closePosition.mutate(
      { id: closingId },
      {
        onSuccess: () => {
          setClosingId(null);
          queryClient.invalidateQueries({ queryKey: getListPositionsQueryKey() });
        },
      }
    );
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <AnimatePresence>
        {closingId != null && closingPos && (
          <CloseConfirmDialog
            pos={closingPos}
            currentPrice={closingPos.curr}
            pnl={closingPos.pnl}
            onConfirm={handleClose}
            onCancel={() => setClosingId(null)}
            loading={closePosition.isPending}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Portfolio</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Live open positions with real-time P&amp;L</p>
        </div>
        <Link
          href="/trade"
          className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4"/> New Trade
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Live P&L",
            value: `${totalPnl >= 0 ? "+" : ""}$${Math.abs(totalPnl).toFixed(2)}`,
            icon: Activity,
            positive: totalPnl >= 0 ? true : false,
          },
          {
            label: "Open Positions",
            value: String(enriched.length),
            icon: Layers,
          },
          {
            label: "Total Volume",
            value: `${totalVolume.toFixed(2)} lot`,
            icon: BarChart2,
          },
          {
            label: "Winning",
            value: enriched.length > 0 ? `${winners} / ${enriched.length}` : "—",
            icon: Target,
            positive: winners > 0 ? true : undefined,
          },
        ].map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <div className="glass-card rounded-2xl p-5 relative overflow-hidden group">
              <div className="absolute top-3 right-3 w-9 h-9 rounded-xl bg-primary/5 flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity">
                <card.icon className="w-4 h-4 text-primary"/>
              </div>
              <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">{card.label}</div>
              {isLoading ? (
                <Skeleton className="h-8 w-24"/>
              ) : (
                <div className={`text-2xl font-black font-mono ${card.positive === true ? "text-success" : card.positive === false ? "text-destructive" : "text-foreground"}`}>
                  {card.value}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Main positions table */}
        <div className="xl:col-span-3 glass-card rounded-2xl flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
            <div className="font-bold flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary"/> Open Positions
            </div>
            <span className="text-xs text-muted-foreground">{enriched.length} active</span>
          </div>

          {isLoading ? (
            <div className="p-5 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full"/>)}</div>
          ) : enriched.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
              <Activity className="w-12 h-12 opacity-15"/>
              <p className="font-medium">No open positions</p>
              <p className="text-sm opacity-70">Open a trade to start managing your portfolio</p>
              <Link href="/trade" className="text-xs text-primary hover:underline mt-1">Open a trade →</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/20">
                    <th className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Symbol</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Direction</th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Volume</th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Open</th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Current</th>
                    <th className="px-3 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Stop Loss</th>
                    <th className="px-3 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Take Profit</th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">P&L</th>
                    <th className="px-3 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Time</th>
                    <th className="px-3 py-2.5"/>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {enriched.map((pos) => (
                    <tr key={pos.id} className={`hover:bg-muted/10 transition-colors ${updatingId === pos.id ? "opacity-60" : ""}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <InstrumentIcon symbol={pos.symbol} size={28} />
                          <div>
                            <div className="font-bold">{pos.symbol}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[100px]">{pos.symbolName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${pos.direction === "buy" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                          {pos.direction === "buy" ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>}
                          {pos.direction.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-right font-mono text-sm">{pos.volume}</td>
                      <td className="px-3 py-3.5 text-right font-mono text-sm text-muted-foreground">{formatPrice(pos.openPrice, pos.symbol)}</td>
                      <td className="px-3 py-3.5 text-right font-mono text-sm font-semibold">{formatPrice(pos.curr, pos.symbol)}</td>
                      <td className="px-3 py-3.5 text-center">
                        <InlineEdit
                          value={pos.stopLoss ?? null}
                          onSave={(v) => handleSaveSl(pos.id, v)}
                          placeholder="Set SL"
                          label="Stop Loss"
                        />
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <InlineEdit
                          value={pos.takeProfit ?? null}
                          onSave={(v) => handleSaveTp(pos.id, v)}
                          placeholder="Set TP"
                          label="Take Profit"
                        />
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <div className={`font-mono font-bold ${pos.pnl >= 0 ? "text-success" : "text-destructive"}`}>
                          {pos.pnl >= 0 ? "+" : ""}${Math.abs(pos.pnl).toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {pos.pnl >= 0 ? "+" : ""}{((pos.pnl / balance) * 100).toFixed(2)}%
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                          <Clock className="w-3 h-3"/>
                          {new Date(pos.openTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <button
                          onClick={() => setClosingId(pos.id)}
                          className="text-xs px-3 py-1.5 border border-destructive/40 rounded-lg hover:bg-destructive/10 text-destructive font-medium transition-colors whitespace-nowrap"
                        >
                          Close
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Symbol P&L breakdown */}
        <div className="xl:col-span-1 glass-card rounded-2xl flex flex-col">
          <div className="px-5 py-4 border-b border-border/50 font-bold flex items-center gap-2 text-sm">
            <BarChart2 className="w-4 h-4 text-primary"/> P&L by Symbol
          </div>
          {symbolEntries.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-6 text-center">
              No positions open
            </div>
          ) : (
            <div className="flex-1 p-4 space-y-3 overflow-auto">
              {symbolEntries.map(([sym, { pnl, count }]) => {
                const maxAbs = Math.max(...symbolEntries.map(([, { pnl }]) => Math.abs(pnl)), 1);
                const pct = Math.abs(pnl) / maxAbs;
                return (
                  <div key={sym}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1.5">
                        <InstrumentIcon symbol={sym} size={18} />
                        <span className="text-sm font-semibold">{sym}</span>
                      </span>
                      <span className={`text-xs font-mono font-bold ${pnl >= 0 ? "text-success" : "text-destructive"}`}>
                        {pnl >= 0 ? "+" : ""}${Math.abs(pnl).toFixed(2)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pnl >= 0 ? "bg-success" : "bg-destructive"}`}
                        style={{ width: `${pct * 100}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{count} position{count > 1 ? "s" : ""}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Account margin info */}
          {account && (
            <div className="border-t border-border/50 p-4 space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Balance</span>
                <span className="font-mono font-semibold text-foreground">${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span>Equity</span>
                <span className={`font-mono font-semibold ${(balance + totalPnl) >= balance ? "text-success" : "text-destructive"}`}>
                  ${(balance + totalPnl).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Leverage</span>
                <span className="font-mono font-semibold text-foreground">1:{account.leverage}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Help tip */}
      <div className="text-xs text-muted-foreground bg-muted/30 rounded-xl px-4 py-3 flex items-center gap-2">
        <Edit2 className="w-3.5 h-3.5 shrink-0"/>
        Click any <strong>Stop Loss</strong> or <strong>Take Profit</strong> value to edit it inline. Press Enter to save or Escape to cancel.
      </div>
    </div>
  );
}
