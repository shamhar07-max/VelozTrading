import { useEffect, useState } from "react";
import { useListOrders, useUpdateOrderJournal, getListOrdersQueryKey } from "@workspace/api-client-react";
import type { Order } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatPrice } from "@/lib/symbol";
import { InstrumentIcon } from "@/components/instrument-icon";
import {
  TrendingUp, TrendingDown, Clock, Filter, BookOpen, Star,
  Tag, ChevronDown, ChevronUp, Check, X, Edit3, StickyNote,
  BarChart2, Trophy, Zap, Target, AlertCircle, Coffee,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";

const FILTERS = ["All","Buy","Sell","Profit","Loss","Journaled","No Journal"] as const;
type Filter = typeof FILTERS[number];

const STRATEGY_TAGS = [
  { label: "Breakout", icon: Zap, color: "text-blue-400 bg-blue-400/10 border-blue-400/30" },
  { label: "Trend Follow", icon: TrendingUp, color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" },
  { label: "Mean Revert", icon: BarChart2, color: "text-purple-400 bg-purple-400/10 border-purple-400/30" },
  { label: "News Trade", icon: AlertCircle, color: "text-orange-400 bg-orange-400/10 border-orange-400/30" },
  { label: "Scalp", icon: Coffee, color: "text-pink-400 bg-pink-400/10 border-pink-400/30" },
  { label: "Swing", icon: Target, color: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30" },
  { label: "Pattern", icon: Trophy, color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" },
];

function tagMeta(tag: string | null) {
  return STRATEGY_TAGS.find(t => t.label === tag) ?? null;
}

function SentimentStars({ value, onChange, readonly }: { value: number | null; onChange?: (v: number) => void; readonly?: boolean }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          disabled={readonly}
          onClick={() => onChange?.(n)}
          onMouseEnter={() => !readonly && setHovered(n)}
          onMouseLeave={() => !readonly && setHovered(0)}
          className={`transition-all ${readonly ? "cursor-default" : "cursor-pointer hover:scale-110"}`}
        >
          <Star
            className={`w-4 h-4 transition-colors ${
              n <= (hovered || value || 0)
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/40"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function JournalPanel({ order, onClose }: {
  order: {
    id: number;
    symbol: string;
    profit: number;
    journalNote: string | null;
    strategyTag: string | null;
    sentimentRating: number | null;
  };
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const updateJournal = useUpdateOrderJournal();
  const [note, setNote] = useState(order.journalNote ?? "");
  const [tag, setTag] = useState<string | null>(order.strategyTag ?? null);
  const [rating, setRating] = useState<number | null>(order.sentimentRating ?? null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    updateJournal.mutate(
      {
        id: order.id,
        data: {
          journalNote: note.trim() || null,
          strategyTag: tag,
          sentimentRating: rating,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          setSaved(true);
          setTimeout(() => { setSaved(false); onClose(); }, 700);
        },
        onSettled: () => setSaving(false),
      }
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="px-5 py-4 bg-muted/20 border-t border-border/40 space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <BookOpen className="w-3.5 h-3.5"/> Trade Journal — {order.symbol}
        </div>

        {/* Strategy tag */}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5"><Tag className="w-3 h-3"/> Strategy</div>
          <div className="flex flex-wrap gap-2">
            {STRATEGY_TAGS.map(({ label, icon: Icon, color }) => (
              <button
                key={label}
                onClick={() => setTag(tag === label ? null : label)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                  tag === label ? color : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="w-3 h-3"/>{label}
              </button>
            ))}
          </div>
        </div>

        {/* Sentiment rating */}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5"><Star className="w-3 h-3"/> Trade Confidence (1–5)</div>
          <SentimentStars value={rating} onChange={setRating}/>
          {rating && (
            <div className="text-xs text-muted-foreground mt-1">
              {["","Very Low","Low","Neutral","High","Very High"][rating]} confidence
            </div>
          )}
        </div>

        {/* Notes textarea */}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5"><StickyNote className="w-3 h-3"/> Notes</div>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            placeholder="What was your setup? How did the trade go? What would you do differently?"
            className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-border hover:bg-muted transition-colors">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className="px-5 py-2 text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors flex items-center gap-2"
          >
            {saved ? <><Check className="w-3.5 h-3.5"/> Saved</> : saving ? "Saving…" : "Save Journal"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function OrderRow({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(false);
  const meta = tagMeta(order.strategyTag ?? null);
  const hasJournal = !!(order.journalNote || order.strategyTag || order.sentimentRating);

  return (
    <div className="border-b border-border/30 last:border-0">
      <div
        className={`grid grid-cols-9 px-5 py-3.5 text-sm hover:bg-muted/5 transition-colors cursor-pointer ${expanded ? "bg-muted/10" : ""}`}
        onClick={() => setExpanded(v => !v)}
      >
        <div className="col-span-2 flex items-center gap-2.5">
          <InstrumentIcon symbol={order.symbol} size={28} />
          <div>
            <div className="font-bold">{order.symbol}</div>
            <div className="text-xs text-muted-foreground truncate">{order.symbolName}</div>
          </div>
        </div>
        <div>
          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${order.direction === "buy" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
            {order.direction === "buy" ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>}
            {order.direction.toUpperCase()}
          </span>
        </div>
        <div className="text-right font-mono text-muted-foreground">{order.volume}</div>
        <div className="text-right font-mono text-xs text-muted-foreground">{formatPrice(order.openPrice, order.symbol)}</div>
        <div className="text-right font-mono text-xs text-muted-foreground">{formatPrice(order.closePrice, order.symbol)}</div>
        <div className="text-right">
          {(() => {
            const net = order.profit - (order.commission ?? 0) - (order.swap ?? 0);
            const fees = (order.commission ?? 0) + (order.swap ?? 0);
            return (
              <div>
                <span className={`font-mono font-bold ${net >= 0 ? "text-success" : "text-destructive"}`}>
                  {net >= 0 ? "+" : ""}${Math.abs(net).toFixed(2)}
                </span>
                {fees > 0 && (
                  <div className="text-[10px] text-muted-foreground/60 font-mono">
                    fee −${fees.toFixed(2)}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
        <div className="flex items-center justify-center gap-1">
          {meta ? (
            <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg border ${meta.color}`}>
              <meta.icon className="w-3 h-3"/>{meta.label}
            </span>
          ) : order.strategyTag ? (
            <span className="text-xs text-muted-foreground px-2 py-1 rounded-lg bg-muted border border-border">{order.strategyTag}</span>
          ) : (
            <span className="text-xs text-muted-foreground/30 italic">—</span>
          )}
          {order.sentimentRating != null && (
            <div className="flex gap-px ml-1">
              {[1,2,3,4,5].map(n => (
                <Star key={n} className={`w-3 h-3 ${n <= order.sentimentRating! ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/20"}`}/>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{new Date(order.closeTime).toLocaleDateString()}</span>
          <div className="flex items-center gap-1.5 ml-2">
            {hasJournal && <BookOpen className="w-3.5 h-3.5 text-primary opacity-60"/>}
            <button
              onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
              className={`p-1 rounded-lg transition-colors ${expanded ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"}`}
            >
              <Edit3 className="w-3.5 h-3.5"/>
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <JournalPanel
            order={{ ...order, journalNote: order.journalNote ?? null, strategyTag: order.strategyTag ?? null, sentimentRating: order.sentimentRating ?? null }}
            onClose={() => setExpanded(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export function History() {
  useEffect(() => { document.title = "Trade History | VelozTrade"; }, []);

  const { data: ordersRaw, isLoading } = useListOrders();
  const orders = Array.isArray(ordersRaw) ? ordersRaw : [];
  const [filter, setFilter] = useState<Filter>("All");

  const filtered = orders.filter(o => {
    if (filter === "Buy") return o.direction === "buy";
    if (filter === "Sell") return o.direction === "sell";
    if (filter === "Profit") return (o.profit - (o.commission ?? 0) - (o.swap ?? 0)) > 0;
    if (filter === "Loss") return (o.profit - (o.commission ?? 0) - (o.swap ?? 0)) < 0;
    if (filter === "Journaled") return !!(o.journalNote || o.strategyTag || o.sentimentRating);
    if (filter === "No Journal") return !(o.journalNote || o.strategyTag || o.sentimentRating);
    return true;
  });

  const netPnl = (o: Order) => o.profit - (o.commission ?? 0) - (o.swap ?? 0);
  const totalProfit = orders.reduce((s, o) => s + netPnl(o), 0);
  const winners = orders.filter(o => netPnl(o) > 0).length;
  const winRate = orders.length ? (winners / orders.length * 100) : 0;
  const bestTrade = orders.length ? Math.max(...orders.map(netPnl)) : 0;
  const worstTrade = orders.length ? Math.min(...orders.map(netPnl)) : 0;
  const journaledCount = orders.filter(o => !!(o.journalNote || o.strategyTag || o.sentimentRating)).length;

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Trade History</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {orders?.length ?? 0} trades · {journaledCount} journaled
          </p>
        </div>
      </div>

      {orders && orders.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: "Total P&L", value: `${totalProfit >= 0 ? "+" : ""}$${Math.abs(totalProfit).toFixed(2)}`, positive: totalProfit >= 0 },
            { label: "Win Rate", value: `${winRate.toFixed(1)}%`, positive: winRate >= 50 },
            { label: "Best Trade", value: `+$${bestTrade.toFixed(2)}`, positive: true },
            { label: "Worst Trade", value: `-$${Math.abs(worstTrade).toFixed(2)}`, positive: false },
            { label: "Journaled", value: `${journaledCount} / ${orders.length}`, positive: journaledCount > 0 },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <div className="glass-card rounded-xl p-4">
                <div className="text-xs text-muted-foreground mb-1 font-medium">{s.label}</div>
                <div className={`text-xl font-black font-mono ${s.positive ? "text-success" : "text-destructive"}`}>{s.value}</div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 ${
              filter === f ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground hover:text-foreground border border-transparent"
            }`}
          >
            {f === "Journaled" && <BookOpen className="w-3.5 h-3.5"/>}
            {f}
          </button>
        ))}
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <div className="min-w-[760px]">
        {/* Table header */}
        <div className="grid grid-cols-9 px-5 py-2.5 border-b border-border/50 bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <div className="col-span-2">Symbol</div>
          <div>Type</div>
          <div className="text-right">Volume</div>
          <div className="text-right">Open</div>
          <div className="text-right">Close</div>
          <div className="text-right">Net P&amp;L</div>
          <div className="text-center">Strategy / Rating</div>
          <div className="text-right">Date</div>
        </div>

        <div className="divide-y divide-border/20">
          {isLoading ? (
            <div className="p-5 space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 w-full"/>)}</div>
          ) : filtered?.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center gap-3 text-muted-foreground">
              <Clock className="w-12 h-12 opacity-15"/>
              <p className="font-medium">{filter !== "All" ? `No ${filter.toLowerCase()} trades found` : "No trades yet"}</p>
              <p className="text-sm opacity-70">Complete a trade to see it here. Click the pencil icon to add journal notes.</p>
            </div>
          ) : (
            filtered?.map(order => <OrderRow key={order.id} order={order}/>)
          )}
        </div>
        </div>
        </div>
      </div>

      {/* Journal tip */}
      {(orders?.length ?? 0) > 0 && (
        <div className="text-xs text-muted-foreground bg-muted/30 rounded-xl px-4 py-3 flex items-center gap-2">
          <Edit3 className="w-3.5 h-3.5 shrink-0 text-primary"/>
          Click the <strong>pencil icon</strong> on any trade to add a strategy tag, confidence rating, and notes. Use the <strong>Journaled</strong> filter to review your annotated trades.
        </div>
      )}
    </div>
  );
}
