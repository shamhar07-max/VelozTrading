import { useEffect, useState } from "react";
import { BadgeCheck, TrendingUp, Users, Copy, Star, Shield, ChevronDown, Search, Filter, X, Zap, AlertCircle, CheckCircle, BarChart2 } from "lucide-react";
import { InstrumentIcon } from "@/components/instrument-icon";
import { motion, AnimatePresence } from "framer-motion";

const TIER_COLORS: Record<string,string> = { VIP:"text-violet-400 bg-violet-500/10 border-violet-500/20", Platinum:"text-amber-400 bg-amber-500/10 border-amber-500/20", Gold:"text-primary bg-primary/10 border-primary/20", Silver:"text-slate-400 bg-slate-500/10 border-slate-500/20" };

const TRADERS = [
  { id:"t1", name:"Marcus Reynolds", handle:"marcusfx", tier:"VIP", flag:"🇬🇧", color:"bg-violet-600", verified:true, followers:12400, copying:834, winRate:87.3, monthReturn:+18.4, totalReturn:+214, avgTrade:"EUR/USD", riskScore:3, minCopy:100, joined:"Jan 2022", trades:1847, description:"Institutional macro trader, 12 years experience. Specialise in G10 FX and gold. Risk-adjusted returns over pure P&L." },
  { id:"t2", name:"Sofia Chen", handle:"sofiacrypto", tier:"Platinum", flag:"🇸🇬", color:"bg-emerald-600", verified:true, followers:9100, copying:601, winRate:82.1, monthReturn:+24.7, totalReturn:+312, avgTrade:"BTC/USD", riskScore:5, minCopy:50, joined:"Mar 2022", trades:2341, description:"Crypto-focused swing trader. On-chain analysis + technical setups. High conviction, medium-frequency." },
  { id:"t3", name:"Ahmed Al-Rashid", handle:"ahmedtrades", tier:"Gold", flag:"🇦🇪", color:"bg-amber-600", verified:false, followers:4800, copying:312, winRate:74.6, monthReturn:+11.2, totalReturn:+128, avgTrade:"XAU/USD", riskScore:2, minCopy:25, joined:"Sep 2022", trades:3102, description:"Conservative commodities and indices trader. Low drawdown strategy. Ideal for capital preservation." },
  { id:"t4", name:"Isabella Müller", handle:"isabellafx", tier:"Platinum", flag:"🇩🇪", color:"bg-blue-600", verified:true, followers:7300, copying:488, winRate:79.4, monthReturn:+15.8, totalReturn:+189, avgTrade:"NVDA", riskScore:4, minCopy:200, joined:"Nov 2021", trades:892, description:"Tech stock CFD specialist. Focus on FAANG and AI stocks. Earnings season specialist." },
  { id:"t5", name:"James Okonkwo", handle:"jamesgold", tier:"VIP", flag:"🇳🇬", color:"bg-rose-600", verified:true, followers:18200, copying:1204, winRate:91.2, monthReturn:+31.5, totalReturn:+487, avgTrade:"SPX", riskScore:4, minCopy:500, joined:"May 2021", trades:2108, description:"Top-ranked trader on VelozTrade. Index momentum + options-equivalent CFD strategies. Multiple contest winner." },
  { id:"t6", name:"Yuki Tanaka", handle:"yukitrader", tier:"Gold", flag:"🇯🇵", color:"bg-cyan-600", verified:false, followers:3200, copying:198, winRate:71.3, monthReturn:+8.9, totalReturn:+94, avgTrade:"USD/JPY", riskScore:2, minCopy:25, joined:"Feb 2023", trades:4210, description:"High-frequency scalper on JPY pairs. Many small wins. Best for traders who prefer active, frequent trades." },
  { id:"t7", name:"Priya Sharma", handle:"priyainvests", tier:"Silver", flag:"🇮🇳", color:"bg-pink-600", verified:false, followers:1600, copying:87, winRate:68.5, monthReturn:+6.4, totalReturn:+71, avgTrade:"AAPL", riskScore:2, minCopy:10, joined:"Jun 2023", trades:634, description:"Fundamental-driven equity trader. Long-term bias on large-cap US stocks. Good for beginners." },
  { id:"t8", name:"Carlos Mendez", handle:"carlosnasdaq", tier:"Gold", flag:"🇧🇷", color:"bg-orange-600", verified:true, followers:5900, copying:374, winRate:77.8, monthReturn:+19.3, totalReturn:+241, avgTrade:"NAS100", riskScore:5, minCopy:100, joined:"Aug 2022", trades:1548, description:"NASDAQ momentum trader. AI/Tech sector bull. High beta plays on growth names." },
];

const RISK_COLORS = ["","text-success","text-success","text-amber-400","text-amber-400","text-destructive"];
const RISK_LABELS = ["","Very Low","Low","Medium","High","Very High"];

function RiskBar({ score }: { score: number }) {
  return (
    <div className="flex gap-0.5 items-center">
      {[1,2,3,4,5].map(i => (
        <div key={i} className={`h-1.5 w-4 rounded-full ${i <= score ? (score <= 2 ? "bg-success" : score <= 4 ? "bg-amber-400" : "bg-destructive") : "bg-muted"}`}/>
      ))}
      <span className={`text-[10px] ml-1 font-semibold ${RISK_COLORS[score]}`}>{RISK_LABELS[score]}</span>
    </div>
  );
}

function CopyModal({ trader, onClose }: { trader: typeof TRADERS[0]; onClose: () => void }) {
  const [amount, setAmount] = useState(String(trader.minCopy));
  const [maxLoss, setMaxLoss] = useState("20");
  const [done, setDone] = useState(false);
  const num = parseFloat(amount) || 0;
  const lossVal = (num * parseFloat(maxLoss) / 100).toFixed(2);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div initial={{ scale:0.9, opacity:0 }} animate={{ scale:1, opacity:1 }} className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        {!done ? (
          <>
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`${trader.color} w-10 h-10 rounded-full flex items-center justify-center text-white font-black`}>{trader.name.split(" ").map(n=>n[0]).join("")}</div>
                <div>
                  <div className="font-bold flex items-center gap-1">{trader.name} {trader.verified && <BadgeCheck className="w-3.5 h-3.5 text-primary"/>}</div>
                  <div className="text-xs text-muted-foreground">{trader.winRate}% win rate · 1:{trader.monthReturn > 0 ? "+" : ""}{trader.monthReturn}% this month</div>
                </div>
              </div>
              <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground"/></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Copy Amount (USD) <span className="text-muted-foreground/60">Min: ${trader.minCopy}</span></label>
                <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} min={trader.minCopy} className="w-full pl-7 pr-3 py-2.5 bg-muted/40 border border-border rounded-xl text-sm font-mono focus:outline-none focus:border-primary"/></div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Stop Copy if loss exceeds (%)</label>
                <div className="flex gap-2">
                  {["10","20","30","50"].map(v => (
                    <button key={v} onClick={()=>setMaxLoss(v)} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${maxLoss===v ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>{v}%</button>
                  ))}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-muted/30 border border-border text-xs space-y-1.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Copying amount</span><span className="font-mono font-bold">${num.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Max loss before stop</span><span className="font-mono text-destructive">-${lossVal}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Performance fee</span><span className="font-mono">20% of profits</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Risk score</span><RiskBar score={trader.riskScore}/></div>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-400 flex gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5"/>
                Past performance does not guarantee future results. You may lose money.
              </div>
              <button
                onClick={() => { if(num >= trader.minCopy) setDone(true); }}
                disabled={num < trader.minCopy}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-40"
              >Start Copying {trader.name}</button>
            </div>
          </>
        ) : (
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-success/15 border border-success/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-success"/>
            </div>
            <h3 className="text-xl font-bold mb-2">AutoCopy Activated!</h3>
            <p className="text-sm text-muted-foreground mb-6">You are now copying <span className="font-bold text-foreground">{trader.name}</span>. Their trades will appear in your positions automatically.</p>
            <button onClick={onClose} className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90">Done</button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export function CopyTrading() {
  useEffect(() => { document.title = "AutoCopy | VelozTrade"; }, []);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all"|"vip"|"top">("all");
  const [sort, setSort] = useState<"return"|"winrate"|"copying">("return");
  const [copyTrader, setCopyTrader] = useState<typeof TRADERS[0] | null>(null);
  const [expanded, setExpanded] = useState<string|null>(null);

  const filtered = TRADERS
    .filter(t => {
      if (filter === "vip") return t.tier === "VIP" || t.tier === "Platinum";
      if (filter === "top") return t.winRate >= 80;
      return true;
    })
    .filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.handle.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => sort === "return" ? b.monthReturn - a.monthReturn : sort === "winrate" ? b.winRate - a.winRate : b.copying - a.copying);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {copyTrader && <CopyModal trader={copyTrader} onClose={() => setCopyTrader(null)}/>}

      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><Copy className="w-7 h-7 text-primary"/> AutoCopy Trading</h1>
        <p className="text-muted-foreground mt-1 text-sm">Follow top traders and automatically copy their positions in real-time.</p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:"Top Trader Win Rate", value:"91.2%", icon:TrendingUp, color:"text-success" },
          { label:"Total Traders Available", value:`${TRADERS.length}`, icon:Users, color:"text-primary" },
          { label:"Performance Fee", value:"20% of profits", icon:Zap, color:"text-amber-400" },
          { label:"Min. Copy Amount", value:"$10", icon:Shield, color:"text-violet-400" },
        ].map(s => (
          <div key={s.label} className="glass-card rounded-xl p-4 border border-border">
            <s.icon className={`w-5 h-5 ${s.color} mb-2`}/>
            <div className={`font-black text-lg ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48 max-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search traders…" className="w-full pl-9 pr-3 py-2 bg-muted/40 border border-border rounded-xl text-xs focus:outline-none focus:border-primary"/>
        </div>
        <div className="flex gap-1 p-1 bg-muted rounded-xl">
          {(["all","vip","top"] as const).map(f => (
            <button key={f} onClick={()=>setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${filter===f ? "bg-card text-foreground shadow" : "text-muted-foreground"}`}>
              {f === "all" ? "All" : f === "vip" ? "⭐ VIP/Platinum" : "🏆 80%+ Win Rate"}
            </button>
          ))}
        </div>
        <select value={sort} onChange={e=>setSort(e.target.value as any)} className="bg-muted/40 border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary ml-auto">
          <option value="return">Sort: Best Return</option>
          <option value="winrate">Sort: Win Rate</option>
          <option value="copying">Sort: Most Copied</option>
        </select>
      </div>

      {/* Trader cards */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(t => (
          <div key={t.id} className="glass-card rounded-2xl border border-border overflow-hidden hover:border-primary/30 transition-all">
            <div className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className={`${t.color} w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-sm shrink-0`}>{t.name.split(" ").map(n=>n[0]).join("")}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-sm">{t.name}</span>
                    {t.verified && <BadgeCheck className="w-3.5 h-3.5 text-primary"/>}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${TIER_COLORS[t.tier].replace("bg-","")}`}>{t.tier}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{t.flag} @{t.handle} · {t.joined}</div>
                </div>
                <span className={`text-lg font-black ${t.monthReturn >= 0 ? "text-success" : "text-destructive"}`}>
                  {t.monthReturn >= 0 ? "+" : ""}{t.monthReturn}%
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { label:"Win Rate", value:`${t.winRate}%`, color:"text-success" },
                  { label:"Copying", value:t.copying.toLocaleString(), color:"text-primary" },
                  { label:"Total Return", value:`+${t.totalReturn}%`, color:"text-amber-400" },
                ].map(s => (
                  <div key={s.label} className="text-center py-2 rounded-xl bg-muted/30">
                    <div className={`font-bold text-sm ${s.color}`}>{s.value}</div>
                    <div className="text-[9px] text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] text-muted-foreground">Risk:</span>
                <RiskBar score={t.riskScore}/>
                <span className="ml-auto text-[10px] text-muted-foreground">{t.trades.toLocaleString()} trades</span>
              </div>

              {expanded === t.id && (
                <p className="text-xs text-muted-foreground mb-3 leading-relaxed border-t border-border pt-3">{t.description}</p>
              )}

              <div className="flex gap-2">
                <button onClick={() => setExpanded(expanded === t.id ? null : t.id)} className="flex-1 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-all">
                  {expanded === t.id ? "Hide" : "View Profile"}
                </button>
                <button onClick={() => setCopyTrader(t)} className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5">
                  <Copy className="w-3.5 h-3.5"/> AutoCopy
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
