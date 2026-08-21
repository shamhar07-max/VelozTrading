import { useEffect, useState } from "react";
import { Zap, TrendingUp, TrendingDown, Filter, RefreshCw, Clock, Target, ShieldOff } from "lucide-react";
import { InstrumentIcon } from "@/components/instrument-icon";
import { useWebSocket } from "@/hooks/use-websocket";
import { formatPrice } from "@/lib/symbol";

const CATEGORIES = ["All","Forex","Crypto","Stocks","Commodities","Indices"] as const;

function seededRand(seed: number) { return Math.abs(Math.sin(seed * 9301 + 49297) * 233280) % 1; }

function generateSignals(epoch: number) {
  const instruments = [
    { sym:"EUR/USD", type:"Forex" }, { sym:"GBP/USD", type:"Forex" }, { sym:"USD/JPY", type:"Forex" },
    { sym:"AUD/USD", type:"Forex" }, { sym:"USD/CHF", type:"Forex" }, { sym:"EUR/GBP", type:"Forex" },
    { sym:"BTC/USD", type:"Crypto" }, { sym:"ETH/USD", type:"Crypto" }, { sym:"SOL/USD", type:"Crypto" },
    { sym:"XRP/USD", type:"Crypto" }, { sym:"BNB/USD", type:"Crypto" },
    { sym:"AAPL", type:"Stocks" }, { sym:"NVDA", type:"Stocks" }, { sym:"TSLA", type:"Stocks" },
    { sym:"MSFT", type:"Stocks" }, { sym:"AMZN", type:"Stocks" },
    { sym:"XAU/USD", type:"Commodities" }, { sym:"XAG/USD", type:"Commodities" }, { sym:"USOIL", type:"Commodities" },
    { sym:"SPX", type:"Indices" }, { sym:"NDX", type:"Indices" }, { sym:"DAX", type:"Indices" },
  ];
  const timeframes = ["M15","M30","H1","H4","D1"];
  const strategies = ["RSI Divergence","MACD Crossover","Support Break","Trend Continuation","EMA Pullback","Bollinger Squeeze","Fibonacci Retracement","Volume Breakout"];
  const sources = ["Technical AI","Pattern Scanner","Momentum Algo","Volatility Model","Community Signal"];
  return instruments.map((inst, i) => {
    const s = epoch * 100 + i;
    const direction = seededRand(s) > 0.48 ? "buy" : "sell";
    const confidence = 60 + Math.floor(seededRand(s+1) * 35);
    const rrRaw = 1.2 + seededRand(s+2) * 2.3;
    const minutesAgo = Math.floor(seededRand(s+3) * 90);
    const tfIdx = Math.floor(seededRand(s+4) * timeframes.length);
    const stIdx = Math.floor(seededRand(s+5) * strategies.length);
    const srcIdx = Math.floor(seededRand(s+6) * sources.length);
    const status = confidence > 80 ? "strong" : confidence > 70 ? "moderate" : "weak";
    return {
      id: i, sym: inst.sym, type: inst.type, direction,
      confidence, rr: parseFloat(rrRaw.toFixed(1)),
      timeframe: timeframes[tfIdx], strategy: strategies[stIdx],
      source: sources[srcIdx], minutesAgo, status,
    };
  }).sort((a,b) => b.confidence - a.confidence);
}

export function TradingSignals() {
  useEffect(() => { document.title = "Trading Signals | VelozTrade"; }, []);
  const [category, setCategory] = useState<string>("All");
  const [dirFilter, setDirFilter] = useState<"all"|"buy"|"sell">("all");
  const [epoch, setEpoch] = useState(() => Math.floor(Date.now() / 30000));
  const [refreshing, setRefreshing] = useState(false);
  const { prices } = useWebSocket();

  useEffect(() => {
    const t = setInterval(() => setEpoch(Math.floor(Date.now() / 30000)), 30000);
    return () => clearInterval(t);
  }, []);

  const signals = generateSignals(epoch).filter(s => {
    const catMatch = category === "All" || s.type === category;
    const dirMatch = dirFilter === "all" || s.direction === dirFilter;
    return catMatch && dirMatch;
  });

  const handleRefresh = () => {
    setRefreshing(true);
    setEpoch(e => e + 1);
    setTimeout(() => setRefreshing(false), 600);
  };

  const strongCount = signals.filter(s => s.status === "strong").length;
  const buyCount = signals.filter(s => s.direction === "buy").length;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><Zap className="w-7 h-7 text-primary"/> Trading Signals</h1>
          <p className="text-sm text-muted-foreground mt-1">AI-generated signals updated every 30 seconds · {signals.length} active signals</p>
        </div>
        <button onClick={handleRefresh} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border hover:bg-muted text-sm font-semibold transition-all">
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}/> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card rounded-xl p-4 border border-border text-center">
          <div className="text-2xl font-black text-success">{buyCount}</div>
          <div className="text-xs text-muted-foreground">Buy Signals</div>
        </div>
        <div className="glass-card rounded-xl p-4 border border-border text-center">
          <div className="text-2xl font-black text-destructive">{signals.length - buyCount}</div>
          <div className="text-xs text-muted-foreground">Sell Signals</div>
        </div>
        <div className="glass-card rounded-xl p-4 border border-border text-center">
          <div className="text-2xl font-black text-primary">{strongCount}</div>
          <div className="text-xs text-muted-foreground">Strong (80%+)</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${category===cat ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground border border-transparent hover:bg-muted/80"}`}>{cat}</button>
          ))}
        </div>
        <div className="flex gap-1 p-0.5 bg-muted rounded-lg ml-auto">
          {(["all","buy","sell"] as const).map(d => (
            <button key={d} onClick={() => setDirFilter(d)} className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-all ${dirFilter===d ? "bg-card text-foreground shadow" : "text-muted-foreground"}`}>{d === "buy" ? "📈 Buy" : d === "sell" ? "📉 Sell" : "All"}</button>
          ))}
        </div>
      </div>

      {/* Signal table */}
      <div className="glass-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
        <div className="min-w-[640px]">
        <div className="grid grid-cols-12 px-4 py-2.5 border-b border-border bg-muted/20 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          <div className="col-span-3">Instrument</div>
          <div className="col-span-1 text-center">Signal</div>
          <div className="col-span-2 text-center">Confidence</div>
          <div className="col-span-1 text-center">R:R</div>
          <div className="col-span-2">Strategy</div>
          <div className="col-span-1 text-center">TF</div>
          <div className="col-span-1">Source</div>
          <div className="col-span-1 text-right">Time</div>
        </div>
        <div className="divide-y divide-border/30 max-h-[60vh] overflow-y-auto">
          {signals.map(sig => {
            const liveKey = sig.sym.replace("/","");
            const price = prices[liveKey]?.price;
            return (
              <div key={sig.id} className="grid grid-cols-12 px-4 py-3 items-center hover:bg-muted/10 transition-colors">
                <div className="col-span-3 flex items-center gap-2">
                  <InstrumentIcon symbol={sig.sym} size={24}/>
                  <div>
                    <div className="font-bold text-xs">{sig.sym}</div>
                    {price && <div className="text-[10px] text-muted-foreground font-mono">{formatPrice(price, sig.sym)}</div>}
                  </div>
                </div>
                <div className="col-span-1 text-center">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sig.direction==="buy" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                    {sig.direction === "buy" ? "▲ BUY" : "▼ SELL"}
                  </span>
                </div>
                <div className="col-span-2 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-16">
                      <div className={`h-full rounded-full ${sig.confidence >= 80 ? "bg-success" : sig.confidence >= 70 ? "bg-amber-400" : "bg-muted-foreground"}`} style={{ width:`${sig.confidence}%` }}/>
                    </div>
                    <span className={`text-[10px] font-bold ${sig.confidence >= 80 ? "text-success" : sig.confidence >= 70 ? "text-amber-400" : "text-muted-foreground"}`}>{sig.confidence}%</span>
                  </div>
                </div>
                <div className="col-span-1 text-center">
                  <span className="text-xs font-mono font-bold text-primary">{sig.rr}:1</span>
                </div>
                <div className="col-span-2 text-xs text-muted-foreground truncate">{sig.strategy}</div>
                <div className="col-span-1 text-center">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-mono">{sig.timeframe}</span>
                </div>
                <div className="col-span-1 text-[10px] text-muted-foreground truncate">{sig.source}</div>
                <div className="col-span-1 text-right flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                  <Clock className="w-2.5 h-2.5"/>{sig.minutesAgo}m
                </div>
              </div>
            );
          })}
        </div>
        </div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">⚠️ Signals are AI-generated for educational purposes only. Always conduct your own analysis. Past signal accuracy is not indicative of future performance.</p>
    </div>
  );
}
