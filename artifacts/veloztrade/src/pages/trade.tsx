import { useEffect, useRef, useState } from "react";
import type { ISeriesApi } from "lightweight-charts";
import { useAuth } from "@clerk/react";
import {
  useListInstruments, useListPositions, useOpenPosition,
  useClosePosition, useUpdatePosition, useGetCandles,
  useGetWatchlist, useAddToWatchlist, useRemoveFromWatchlist,
  getListPositionsQueryKey, getGetWatchlistQueryKey,
  useListPendingOrders, useCreatePendingOrder, useCancelPendingOrder,
  getListPendingOrdersQueryKey,
  useGetAccount, getGetAccountQueryKey,
} from "@workspace/api-client-react";
import { GetCandlesInterval } from "@workspace/api-client-react";
import { useWebSocket } from "@/hooks/use-websocket";
import { toKey, formatPrice, formatPriceDecimals } from "@/lib/symbol";
import { createChart, ColorType, IChartApi, CandlestickSeries, HistogramSeries, LineSeries } from "lightweight-charts";
import type { MouseEventParams } from "lightweight-charts";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import {
  Settings, X, RefreshCw, AlertTriangle, Bell, Minus,
  TrendingUp as TrendLine, Trash2, Search, Star, TrendingUp,
  TrendingDown, LogIn, ChevronDown, ChevronUp, Maximize2, BarChart2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SetAlertDialog } from "@/components/set-alert-dialog";
import { AlertsPanel } from "@/components/alerts-panel";
import { InstrumentIcon } from "@/components/instrument-icon";
import { Link } from "wouter";

// ── Leverage per instrument type (fixed, as shown on home page) ───────────────
const LEVERAGE_BY_TYPE: Record<string, number> = {
  forex:       1000,
  crypto:      5,
  stocks:      10,
  commodities: 100,
  indices:     10,
};

function getLeverageForSymbol(
  symbol: string,
  instruments: Array<{ symbol: string; type: string }> | undefined
): number {
  const inst = instruments?.find(i => i.symbol === symbol);
  const type = inst?.type ?? "forex";
  return LEVERAGE_BY_TYPE[type] ?? 100;
}

const INTERVALS: { value: GetCandlesInterval; label: string }[] = [
  { value: "1min", label: "1m" },
  { value: "5min", label: "5m" },
  { value: "15min", label: "15m" },
  { value: "30min", label: "30m" },
  { value: "1h", label: "1h" },
  { value: "4h", label: "4h" },
  { value: "1day", label: "1D" },
  { value: "1week", label: "1W" },
];

const CATEGORIES = ["All", "Forex", "Crypto", "Stocks", "Commodities", "Indices"] as const;
type Category = typeof CATEGORIES[number];

const TYPE_COLORS: Record<string, string> = {
  crypto:      "bg-orange-500/10 text-orange-400",
  forex:       "bg-blue-500/10 text-blue-400",
  stocks:      "bg-violet-500/10 text-violet-400",
  commodities: "bg-yellow-500/10 text-yellow-400",
  indices:     "bg-emerald-500/10 text-emerald-400",
};

function computePnl(
  openPrice: number, currentPrice: number,
  volume: number, direction: "buy" | "sell",
  lotSize: number = 1
): number {
  return direction === "buy"
    ? (currentPrice - openPrice) * volume * lotSize
    : (openPrice - currentPrice) * volume * lotSize;
}

interface ModifyModalProps {
  positionId: number;
  direction: "buy" | "sell";
  currentPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  onClose: () => void;
  onSave: (sl: number | null, tp: number | null) => void;
  loading: boolean;
}

function ModifyModal({ positionId, direction, currentPrice, stopLoss, takeProfit, onClose, onSave, loading }: ModifyModalProps) {
  const [sl, setSl] = useState(stopLoss != null ? String(stopLoss) : "");
  const [tp, setTp] = useState(takeProfit != null ? String(takeProfit) : "");

  const slNum = sl ? parseFloat(sl) : null;
  const tpNum = tp ? parseFloat(tp) : null;
  const slError = slNum != null
    ? direction === "buy" && slNum >= currentPrice ? "SL must be below current price"
    : direction === "sell" && slNum <= currentPrice ? "SL must be above current price"
    : null : null;
  const tpError = tpNum != null
    ? direction === "buy" && tpNum <= currentPrice ? "TP must be above current price"
    : direction === "sell" && tpNum >= currentPrice ? "TP must be below current price"
    : null : null;
  const hasError = !!(slError || tpError);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="glass-card rounded-2xl p-6 w-[calc(100vw-2rem)] max-w-xs shadow-2xl">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-bold text-lg">Modify Order #{positionId}</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground"/></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Stop Loss</label>
            <Input type="number" step="0.00001" value={sl} onChange={e => setSl(e.target.value)} placeholder="empty = remove" className={`font-mono ${slError ? "border-destructive" : ""}`}/>
            {slError && <p className="text-xs text-destructive mt-1">{slError}</p>}
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Take Profit</label>
            <Input type="number" step="0.00001" value={tp} onChange={e => setTp(e.target.value)} placeholder="empty = remove" className={`font-mono ${tpError ? "border-destructive" : ""}`}/>
            {tpError && <p className="text-xs text-destructive mt-1">{tpError}</p>}
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted">Cancel</button>
            <button
              onClick={() => { if (!hasError) onSave(slNum, tpNum); }}
              disabled={loading || hasError}
              className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Indicator math helpers ────────────────────────────────────────────────────
function calcRSI(closes: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = [];
  if (closes.length <= period) return closes.map(() => null);
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i]! - closes[i - 1]!;
    if (d > 0) avgGain += d; else avgLoss += -d;
  }
  avgGain /= period; avgLoss /= period;
  for (let i = 0; i < period; i++) result.push(null);
  result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i]! - closes[i - 1]!;
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }
  return result;
}

function calcEMAArr(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [];
  const seed = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = 0; i < period - 1; i++) ema.push(NaN);
  ema.push(seed);
  let prev = seed;
  for (let i = period; i < data.length; i++) {
    prev = data[i]! * k + prev * (1 - k);
    ema.push(prev);
  }
  return ema;
}

function calcMACD(closes: number[], fastP = 12, slowP = 26, signalP = 9) {
  if (closes.length < slowP + signalP) return { macd: [] as number[], signal: [] as number[], histogram: [] as number[] };
  const fast = calcEMAArr(closes, fastP);
  const slow = calcEMAArr(closes, slowP);
  const macd = closes.map((_, i) => (!isNaN(fast[i]!) && !isNaN(slow[i]!)) ? fast[i]! - slow[i]! : NaN);
  const validMacd = macd.filter(v => !isNaN(v));
  const signalEMA = calcEMAArr(validMacd, signalP);
  let vi = 0;
  const signal = macd.map(m => { if (isNaN(m)) return NaN; return signalEMA[vi++] ?? NaN; });
  const histogram = macd.map((m, i) => (!isNaN(m) && !isNaN(signal[i]!)) ? m - signal[i]! : NaN);
  return { macd, signal, histogram };
}

function calcBB(closes: number[], period = 20, mult = 2) {
  const upper: (number | null)[] = [], mid: (number | null)[] = [], lower: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { upper.push(null); mid.push(null); lower.push(null); continue; }
    const sl = closes.slice(i - period + 1, i + 1);
    const mean = sl.reduce((a, b) => a + b) / period;
    const std = Math.sqrt(sl.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
    upper.push(mean + mult * std); mid.push(mean); lower.push(mean - mult * std);
  }
  return { upper, mid, lower };
}

export function Trade() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [symbol, setSymbol] = useState("BTC/USD");
  const [volume, setVolume] = useState("0.1");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [direction, setDirection] = useState<"buy" | "sell">("buy");
  const [interval, setInterval] = useState<GetCandlesInterval>("5min");
  const [modifyPos, setModifyPos] = useState<number | null>(null);
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [limitPrice, setLimitPrice] = useState("");
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [bottomTab, setBottomTab] = useState<"positions" | "pending" | "alerts">("positions");
  const [activeIndicators, setActiveIndicators] = useState<Set<"rsi" | "macd" | "bb">>(new Set());
  const [pendingOrderType, setPendingOrderType] = useState<"buy_limit" | "sell_limit" | "buy_stop" | "sell_stop" | "buy_stop_limit" | "sell_stop_limit" | "trailing_stop">("buy_limit");
  const [stopPriceInput, setStopPriceInput] = useState("");
  const [trailingDistInput, setTrailingDistInput] = useState("");

  // Markets panel state
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [alertSymbol, setAlertSymbol] = useState<string | null>(null);

  useEffect(() => {
    document.title = `Trade ${symbol.replace("/", "")} | VelozTrade`;
  }, [symbol]);

  const { isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  // ── Chart refs ─────────────────────────────────────────────────────────────
  const chartPanelRef      = useRef<HTMLDivElement>(null);
  const chartContainerRef  = useRef<HTMLDivElement>(null);
  const chartRef           = useRef<IChartApi | null>(null);
  const candleSeriesRef    = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volSeriesRef       = useRef<ISeriesApi<"Histogram"> | null>(null);
  const currentBarRef      = useRef<{ time: number; open: number; high: number; low: number; close: number } | null>(null);
  const drawingModeRef     = useRef<null | "hline" | "trend">(null);
  const trendStartRef      = useRef<{ time: number; price: number } | null>(null);
  const drawnPriceLinesRef = useRef<ReturnType<NonNullable<typeof candleSeriesRef.current>["createPriceLine"]>[]>([]);
  const drawnLineSeriesRef = useRef<ISeriesApi<"Line">[]>([]);
  const livePriceLineRef   = useRef<ReturnType<NonNullable<typeof candleSeriesRef.current>["createPriceLine"]> | null>(null);
  const [drawingMode, setDrawingMode] = useState<null | "hline" | "trend">(null);
  const [hoveredOHLC, setHoveredOHLC] = useState<{ o: number; h: number; l: number; c: number } | null>(null);

  // ── Indicator series refs ───────────────────────────────────────────────────
  const bbUpperRef   = useRef<ISeriesApi<"Line"> | null>(null);
  const bbMidRef     = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerRef   = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiRef       = useRef<ISeriesApi<"Line"> | null>(null);
  const macdLineRef  = useRef<ISeriesApi<"Line"> | null>(null);
  const macdSigRef   = useRef<ISeriesApi<"Line"> | null>(null);
  const macdHistRef  = useRef<ISeriesApi<"Histogram"> | null>(null);

  // ── Data hooks ─────────────────────────────────────────────────────────────
  const { data: instrumentsRaw } = useListInstruments();
  const instruments = Array.isArray(instrumentsRaw) ? instrumentsRaw : [];
  const { data: candles, isLoading: candlesLoading, isError: candlesError, refetch: refetchCandles } = useGetCandles({ symbol, interval });
  const { data: positionsRaw } = useListPositions({ query: { refetchInterval: 5000, queryKey: getListPositionsQueryKey() } });
  const positions = Array.isArray(positionsRaw) ? positionsRaw : [];
  const { data: watchlistRaw } = useGetWatchlist({ query: { enabled: !!isSignedIn, queryKey: getGetWatchlistQueryKey() } });
  const watchlist = Array.isArray(watchlistRaw) ? watchlistRaw : [];
  const openPosition   = useOpenPosition();
  const closePosition  = useClosePosition();
  const updatePosition = useUpdatePosition();
  const addToWatchlist    = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();
  const { prices } = useWebSocket();
  const { data: pendingOrdersRaw } = useListPendingOrders({ query: { enabled: !!isSignedIn, refetchInterval: 5000, queryKey: getListPendingOrdersQueryKey() } });
  const pendingOrders = Array.isArray(pendingOrdersRaw) ? pendingOrdersRaw : [];
  const createPendingOrder = useCreatePendingOrder();
  const cancelPendingOrder = useCancelPendingOrder();
  const { data: account } = useGetAccount({ query: { enabled: !!isSignedIn, queryKey: getGetAccountQueryKey() } });

  const TIER_COMMISSION_PER_LOT: Record<string, number> = { real: 2.00, silver: 1.50, gold: 1.00, platinum: 0.50, vip: 0.00 };
  const tierCommissionPerLot = TIER_COMMISSION_PER_LOT[account?.accountType ?? "real"] ?? 2.00;

  const priceKey = toKey(symbol);
  const quote = prices[priceKey];
  const indicatorKey = [...activeIndicators].sort().join(",");
  const currentInstrument = instruments?.find(i => i.symbol === symbol);
  const watchlistSymbols = new Set(watchlist?.map(w => w.symbol) ?? []);

  // ── Leverage: automatic per instrument type, not a user dropdown ───────────
  const leverage = getLeverageForSymbol(symbol, instruments);

  const INTERVAL_SECONDS: Record<GetCandlesInterval, number> = {
    "1min": 60, "5min": 300, "15min": 900, "30min": 1800,
    "1h": 3600, "4h": 14400, "1day": 86400, "1week": 604800,
  };

  // ── Markets filter ─────────────────────────────────────────────────────────
  const filtered = instruments?.filter(i => {
    const matchSearch = !search || i.symbol.toLowerCase().includes(search.toLowerCase()) || i.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === "All" || i.type.toLowerCase() === activeCategory.toLowerCase();
    return matchSearch && matchCat;
  });

  const toggleWatchlist = (sym: string, isWatched: boolean) => {
    if (!isSignedIn) return;
    if (isWatched) {
      removeFromWatchlist.mutate({ symbol: sym }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetWatchlistQueryKey() }) });
    } else {
      addToWatchlist.mutate({ data: { symbol: sym } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetWatchlistQueryKey() }) });
    }
  };

  // ── Effect 1: Create chart once on mount — never recreated ────────────────
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(148,163,184,0.9)",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: "rgba(148,163,184,0.1)" },
        horzLines: { color: "rgba(148,163,184,0.1)" },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: "rgba(148,163,184,0.4)", labelBackgroundColor: "#1e293b" },
        horzLine: { color: "rgba(148,163,184,0.4)", labelBackgroundColor: "#1e293b" },
      },
      rightPriceScale: {
        borderColor: "rgba(148,163,184,0.3)",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: "rgba(148,163,184,0.3)",
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 8,
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a", downColor: "#ef5350",
      borderUpColor: "#26a69a", borderDownColor: "#ef5350",
      wickUpColor: "#26a69a", wickDownColor: "#ef5350",
      borderVisible: true,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    const volSeries = chart.addSeries(HistogramSeries, {
      color: "rgba(0,212,255,0.25)",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.80, bottom: 0 },
      visible: false,
    });

    candleSeriesRef.current = candleSeries as ISeriesApi<"Candlestick">;
    volSeriesRef.current    = volSeries as ISeriesApi<"Histogram">;
    chartRef.current        = chart;

    const clickHandler = (param: MouseEventParams) => {
      if (!param.point || !candleSeriesRef.current || !chartRef.current) return;
      const price = (candleSeriesRef.current as ISeriesApi<"Candlestick">).coordinateToPrice(param.point.y);
      if (price == null || param.time == null) return;
      const t = param.time as number;

      if (drawingModeRef.current === "hline") {
        const pl = (candleSeriesRef.current as ISeriesApi<"Candlestick">).createPriceLine({
          price, color: "#0ea5e9", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "",
        });
        drawnPriceLinesRef.current.push(pl as any);
        setDrawingMode(null); drawingModeRef.current = null;
      } else if (drawingModeRef.current === "trend") {
        if (!trendStartRef.current) {
          trendStartRef.current = { time: t, price };
        } else {
          const start = trendStartRef.current;
          const ls = chartRef.current.addSeries(LineSeries, {
            color: "#f59e0b", lineWidth: 1, crosshairMarkerVisible: false,
            lastValueVisible: false, priceLineVisible: false,
          });
          ls.setData([
            { time: start.time as any, value: start.price },
            { time: t as any, value: price },
          ]);
          drawnLineSeriesRef.current.push(ls);
          trendStartRef.current = null;
          setDrawingMode(null); drawingModeRef.current = null;
        }
      }
    };
    chart.subscribeClick(clickHandler);

    const crosshairHandler = (param: MouseEventParams) => {
      if (!param.seriesData || !candleSeriesRef.current) { setHoveredOHLC(null); return; }
      const bar = param.seriesData.get(candleSeriesRef.current) as { open?: number; high?: number; low?: number; close?: number } | undefined;
      if (bar && bar.open != null) {
        setHoveredOHLC({ o: bar.open, h: bar.high!, l: bar.low!, c: bar.close! });
      } else {
        setHoveredOHLC(null);
      }
    };
    chart.subscribeCrosshairMove(crosshairHandler);

    // ResizeObserver — reacts to flex container resize, not just window resize
    const ro = new ResizeObserver(() => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    });
    ro.observe(chartContainerRef.current);

    return () => {
      ro.disconnect();
      chart.unsubscribeClick(clickHandler);
      chart.unsubscribeCrosshairMove(crosshairHandler);
      setHoveredOHLC(null);
      candleSeriesRef.current = null;
      volSeriesRef.current    = null;
      chartRef.current        = null;
      drawnPriceLinesRef.current = [];
      drawnLineSeriesRef.current = [];
      bbUpperRef.current = null; bbMidRef.current = null; bbLowerRef.current = null;
      rsiRef.current = null;
      macdLineRef.current = null; macdSigRef.current = null; macdHistRef.current = null;
      chart.remove();
    };
  }, []); // empty deps — chart is created once and lives until unmount

  // ── Effect 2: Clear state when symbol or interval changes ──────────────────
  // MUST run before Effect 3 (candle data load) so that on initial mount or
  // React-Query cache hits — where both effects fire in the same cycle — the
  // clear happens first and the candle-seed that follows is never overwritten.
  useEffect(() => {
    currentBarRef.current = null;
    drawnPriceLinesRef.current = [];
    drawnLineSeriesRef.current = [];
    livePriceLineRef.current = null;
  }, [symbol, interval]);

  // ── Effect 3: Update chart data when candles or symbol/interval change ─────
  useEffect(() => {
    if (!candleSeriesRef.current || !volSeriesRef.current || !chartRef.current) return;

    if (Array.isArray(candles) && candles.length > 0) {
      const sorted = [...candles]
        .filter(c => c.datetime && isFinite(new Date(c.datetime).getTime()))
        .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
      if (sorted.length === 0) { candleSeriesRef.current.setData([]); volSeriesRef.current.setData([]); currentBarRef.current = null; return; }
      candleSeriesRef.current.setData(sorted.map(c => ({
        time: Math.floor(new Date(c.datetime).getTime() / 1000) as unknown as number,
        open: c.open, high: c.high, low: c.low, close: c.close,
      })) as any);
      volSeriesRef.current.setData(sorted.map(c => ({
        time: Math.floor(new Date(c.datetime).getTime() / 1000) as unknown as number,
        value: c.volume,
        color: c.close >= c.open ? "rgba(38,166,154,0.4)" : "rgba(239,83,80,0.4)",
      })) as any);
      chartRef.current.timeScale().fitContent();
      // Seed currentBarRef from last historical candle so live WebSocket ticks
      // update the current bar correctly instead of resetting open to the tick price.
      const last = sorted[sorted.length - 1];
      currentBarRef.current = {
        time: Math.floor(new Date(last.datetime).getTime() / 1000),
        open: last.open, high: last.high, low: last.low, close: last.close,
      };
    } else {
      candleSeriesRef.current.setData([]);
      volSeriesRef.current.setData([]);
      currentBarRef.current = null;
    }
  }, [candles]);

  useEffect(() => { drawingModeRef.current = drawingMode; }, [drawingMode]);

  const clearDrawings = () => {
    if (candleSeriesRef.current) {
      for (const line of drawnPriceLinesRef.current) {
        try { (candleSeriesRef.current as any).removePriceLine(line); } catch { /* ignore */ }
      }
      drawnPriceLinesRef.current = [];
    }
    if (chartRef.current) {
      for (const series of drawnLineSeriesRef.current) {
        try { chartRef.current.removeSeries(series); } catch { /* ignore */ }
      }
      drawnLineSeriesRef.current = [];
    }
    setDrawingMode(null); drawingModeRef.current = null; trendStartRef.current = null;
  };

  useEffect(() => {
    if (!candleSeriesRef.current || !quote?.price) return;
    const price = quote.price;

    if (currentBarRef.current) {
      currentBarRef.current = {
        ...currentBarRef.current,
        high: Math.max(currentBarRef.current.high, price),
        low:  Math.min(currentBarRef.current.low,  price),
        close: price,
      };
      try { candleSeriesRef.current.update(currentBarRef.current as any); } catch { /* ignore */ }
    }

    try {
      if (!livePriceLineRef.current) {
        livePriceLineRef.current = candleSeriesRef.current.createPriceLine({
          price,
          color: "#f59e0b",
          lineWidth: 1 as any,
          lineStyle: 1,
          axisLabelVisible: false,
          title: "",
        });
      } else {
        livePriceLineRef.current.applyOptions({ price });
      }
    } catch { /* ignore */ }
  }, [quote?.price]);

  // ── Effect 4: Indicator series management ────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !candles || candles.length === 0) return;

    const sorted = [...candles].sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
    const closes = sorted.map(c => c.close);
    const times  = sorted.map(c => Math.floor(new Date(c.datetime).getTime() / 1000));

    const hasRsi  = activeIndicators.has("rsi");
    const hasMacd = activeIndicators.has("macd");
    const hasBb   = activeIndicators.has("bb");

    // Adjust main scale bottom margin to make room for sub-panels
    let mainBottom = 0.10;
    if (hasRsi && hasMacd) mainBottom = 0.46;
    else if (hasRsi || hasMacd) mainBottom = 0.28;
    chart.priceScale("right").applyOptions({ scaleMargins: { top: 0.08, bottom: mainBottom } });

    // ── Bollinger Bands (overlay on main chart) ────────────────────────────
    if (hasBb) {
      if (!bbUpperRef.current) {
        bbUpperRef.current = chart.addSeries(LineSeries, { color: "rgba(56,189,248,0.7)",  lineWidth: 1 as any, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
        bbMidRef.current   = chart.addSeries(LineSeries, { color: "rgba(148,163,184,0.4)", lineWidth: 1 as any, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
        bbLowerRef.current = chart.addSeries(LineSeries, { color: "rgba(56,189,248,0.7)",  lineWidth: 1 as any, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      }
      const bb = calcBB(closes, 20, 2);
      const toSeries = (arr: (number | null)[]) =>
        arr.map((v, i) => v != null ? { time: times[i] as any, value: v } : null).filter(Boolean) as { time: any; value: number }[];
      try { bbUpperRef.current.setData(toSeries(bb.upper)); bbMidRef.current?.setData(toSeries(bb.mid)); bbLowerRef.current?.setData(toSeries(bb.lower)); } catch { /* stale */ }
    } else {
      if (bbUpperRef.current) { try { chart.removeSeries(bbUpperRef.current); } catch {} bbUpperRef.current = null; }
      if (bbMidRef.current)   { try { chart.removeSeries(bbMidRef.current);   } catch {} bbMidRef.current   = null; }
      if (bbLowerRef.current) { try { chart.removeSeries(bbLowerRef.current); } catch {} bbLowerRef.current = null; }
    }

    // ── RSI (sub-panel via "rsi" price scale) ─────────────────────────────
    if (hasRsi) {
      if (!rsiRef.current) {
        rsiRef.current = chart.addSeries(LineSeries, { color: "#f59e0b", lineWidth: 1 as any, priceScaleId: "rsi", priceLineVisible: false, lastValueVisible: true });
      }
      chart.priceScale("rsi").applyOptions({ scaleMargins: hasMacd ? { top: 0.57, bottom: 0.22 } : { top: 0.75, bottom: 0.02 }, visible: true });
      const rsiVals = calcRSI(closes, 14);
      const rsiData = rsiVals.map((v, i) => v != null ? { time: times[i] as any, value: v } : null).filter(Boolean) as { time: any; value: number }[];
      try { rsiRef.current.setData(rsiData); } catch { /* stale */ }
    } else {
      if (rsiRef.current) { try { chart.removeSeries(rsiRef.current); } catch {} rsiRef.current = null; }
    }

    // ── MACD (sub-panel via "macd" price scale) ───────────────────────────
    if (hasMacd) {
      if (!macdLineRef.current) {
        macdLineRef.current = chart.addSeries(LineSeries,      { color: "#818cf8", lineWidth: 1 as any, priceScaleId: "macd", priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
        macdSigRef.current  = chart.addSeries(LineSeries,      { color: "#f87171", lineWidth: 1 as any, priceScaleId: "macd", priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
        macdHistRef.current = chart.addSeries(HistogramSeries, { priceScaleId: "macd", priceLineVisible: false, lastValueVisible: false });
        chart.priceScale("macd").applyOptions({ scaleMargins: { top: 0.83, bottom: 0 }, visible: false });
      }
      const { macd, signal, histogram } = calcMACD(closes, 12, 26, 9);
      const toLine  = (arr: number[]) => arr.map((v, i) => !isNaN(v) ? { time: times[i] as any, value: v } : null).filter(Boolean) as { time: any; value: number }[];
      const toHist  = (arr: number[]) => arr.map((v, i) => !isNaN(v) ? { time: times[i] as any, value: v, color: v >= 0 ? "rgba(38,166,154,0.6)" : "rgba(239,83,80,0.6)" } : null).filter(Boolean) as any[];
      try { macdLineRef.current.setData(toLine(macd)); macdSigRef.current?.setData(toLine(signal)); macdHistRef.current?.setData(toHist(histogram)); } catch { /* stale */ }
    } else {
      if (macdLineRef.current) { try { chart.removeSeries(macdLineRef.current); } catch {} macdLineRef.current = null; }
      if (macdSigRef.current)  { try { chart.removeSeries(macdSigRef.current);  } catch {} macdSigRef.current  = null; }
      if (macdHistRef.current) { try { chart.removeSeries(macdHistRef.current); } catch {} macdHistRef.current = null; }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, indicatorKey]);

  const handleExecute = () => setShowConfirm(true);

  const handleConfirm = () => {
    if (orderType === "limit") {
      const isTrailing = pendingOrderType === "trailing_stop";
      const needsStop  = pendingOrderType === "buy_stop_limit" || pendingOrderType === "sell_stop_limit";
      createPendingOrder.mutate(
        {
          data: {
            symbol, direction, volume: parseFloat(volume),
            limitPrice: isTrailing ? (quote?.price ?? 0) : parseFloat(limitPrice),
            stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
            takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
            orderType: pendingOrderType,
            stopPrice: needsStop && stopPriceInput ? parseFloat(stopPriceInput) : undefined,
            trailingDistance: isTrailing && trailingDistInput ? parseFloat(trailingDistInput) : undefined,
          } as any,
        },
        { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListPendingOrdersQueryKey() }); setLimitPrice(""); setStopPriceInput(""); setTrailingDistInput(""); setStopLoss(""); setTakeProfit(""); setShowConfirm(false); setBottomTab("pending"); } }
      );
    } else {
      openPosition.mutate(
        { data: { symbol, direction, volume: parseFloat(volume), stopLoss: stopLoss ? parseFloat(stopLoss) : undefined, takeProfit: takeProfit ? parseFloat(takeProfit) : undefined } },
        { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListPositionsQueryKey() }); setStopLoss(""); setTakeProfit(""); setShowConfirm(false); } }
      );
    }
  };

  const modifyingPos = positions?.find(p => p.id === modifyPos);

  const lotSize = currentInstrument?.lotSize ?? 100000;
  const marginPreview = quote?.price
    ? ((parseFloat(volume) * quote.price * lotSize) / leverage).toFixed(2)
    : "0.00";

  const byType: Record<string, typeof instruments> = {};
  if (instruments) {
    for (const inst of instruments) {
      if (!byType[inst.type]) byType[inst.type] = [];
      byType[inst.type]!.push(inst);
    }
  }

  return (
    <div className="flex flex-col md:flex-row h-[calc(100dvh-5.5rem)] md:h-[calc(100dvh-2.5rem)] gap-0 overflow-y-auto md:overflow-hidden -m-3 md:-m-5">
      {/* ── Dialogs ── */}
      {showAlertDialog && <SetAlertDialog symbol={symbol} onClose={() => setShowAlertDialog(false)}/>}
      {alertSymbol && <SetAlertDialog symbol={alertSymbol} onClose={() => setAlertSymbol(null)}/>}
      {modifyPos != null && modifyingPos && (
        <ModifyModal
          positionId={modifyPos}
          direction={modifyingPos.direction}
          currentPrice={prices[toKey(modifyingPos.symbol)]?.price ?? modifyingPos.currentPrice}
          stopLoss={modifyingPos.stopLoss ?? null}
          takeProfit={modifyingPos.takeProfit ?? null}
          onClose={() => setModifyPos(null)}
          loading={updatePosition.isPending}
          onSave={(sl, tp) => {
            updatePosition.mutate(
              { id: modifyPos, data: { stopLoss: sl, takeProfit: tp } },
              { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListPositionsQueryKey() }); setModifyPos(null); } }
            );
          }}
        />
      )}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="glass-card rounded-2xl p-6 w-[calc(100vw-2rem)] max-w-xs shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg">Confirm Order</h3>
              <button onClick={() => setShowConfirm(false)}><X className="w-4 h-4 text-muted-foreground"/></button>
            </div>
            <div className="rounded-xl bg-muted/30 p-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Symbol</span><span className="font-semibold">{symbol}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Direction</span><span className={`font-bold uppercase ${direction === "buy" ? "text-success" : "text-destructive"}`}>{direction}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Volume</span><span className="font-mono">{volume} lots</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Price</span><span className="font-mono">{quote ? (direction === "buy" ? formatPrice(quote.ask, symbol) : formatPrice(quote.bid, symbol)) : "Market price"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Margin req.</span><span className="font-mono">${marginPreview}</span></div>
              {stopLoss && <div className="flex justify-between"><span className="text-muted-foreground">Stop Loss</span><span className="font-mono text-destructive">{stopLoss}</span></div>}
              {takeProfit && <div className="flex justify-between"><span className="text-muted-foreground">Take Profit</span><span className="font-mono text-success">{takeProfit}</span></div>}
            </div>
            <div className="text-xs text-muted-foreground bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              Trading CFDs carries significant risk. You may lose more than you deposit.
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted">Cancel</button>
              <button
                onClick={handleConfirm}
                disabled={openPosition.isPending}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 ${direction === "buy" ? "bg-success hover:bg-success/90" : "bg-destructive hover:bg-destructive/90"}`}
              >
                {openPosition.isPending ? "Placing…" : `Confirm ${direction.toUpperCase()}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          LEFT PANEL — Markets list
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex flex-col w-64 xl:w-72 shrink-0 border-r border-border bg-card/50 h-full overflow-hidden">
        {/* Search */}
        <div className="p-3 border-b border-border space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground"/>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search markets…"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/40 border border-border rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          {/* Category tabs */}
          <div className="flex gap-1 flex-wrap">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  activeCategory === cat
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Instruments list */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/30">
          {filtered?.map(inst => {
            const q = prices[toKey(inst.symbol)];
            const price = q?.price ?? null;
            const change = q?.changePercent ?? 0;
            const up = change > 0;
            const isWatched = watchlistSymbols.has(inst.symbol);
            const isActive = inst.symbol === symbol;
            const lev = LEVERAGE_BY_TYPE[inst.type] ?? 100;

            return (
              <button
                key={inst.symbol}
                onClick={() => setSymbol(inst.symbol)}
                className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-muted/30 transition-colors ${isActive ? "bg-primary/8 border-l-2 border-primary" : ""}`}
              >
                <InstrumentIcon symbol={inst.symbol} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className={`font-bold text-xs ${isActive ? "text-primary" : ""}`}>{inst.symbol}</span>
                    <span className={`font-mono text-xs font-semibold ${up ? "text-success" : change < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {price != null ? formatPrice(price, inst.symbol) : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <span className="text-[10px] text-muted-foreground truncate">{inst.name}</span>
                    <span className={`text-[10px] font-semibold ${up ? "text-success" : change < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {change > 0 ? "+" : ""}{change.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${TYPE_COLORS[inst.type] ?? "bg-muted text-muted-foreground"}`}>
                      {inst.type.slice(0, 3).toUpperCase()}
                    </span>
                    <span className="text-[9px] text-muted-foreground/60 font-mono">1:{lev}</span>
                  </div>
                </div>
                {isSignedIn && (
                  <button
                    onClick={e => { e.stopPropagation(); toggleWatchlist(inst.symbol, isWatched); }}
                    className="shrink-0 p-0.5 rounded hover:bg-muted transition-colors"
                  >
                    <Star className={`w-3 h-3 ${isWatched ? "fill-primary text-primary" : "text-muted-foreground/40"}`}/>
                  </button>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          CENTRE — Chart + Order panel + Positions
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-0 min-w-0 md:flex-1 md:overflow-hidden">
        {/* Top: chart + order panel */}
        <div className="flex flex-col md:flex-row gap-0 md:flex-1 md:min-h-0">

          {/* Chart — flex-1 on desktop fills all space above the positions panel */}
          <div ref={chartPanelRef} className="h-[42vh] min-h-[280px] md:h-auto md:flex-1 md:min-h-0 rounded-none border-b md:border-b-0 md:border-r border-border bg-card flex flex-col overflow-hidden" data-trade-chart>
            {/* Chart toolbar */}
            <div className="px-3 py-2 border-b border-border flex items-center gap-2 bg-card shrink-0">
              {/* Symbol selector (mobile: dropdown; desktop: clicking left panel) */}
              <div className="flex items-center gap-2">
                <InstrumentIcon symbol={symbol} size={22} />
                <Select value={symbol} onValueChange={setSymbol}>
                  <SelectTrigger className="w-24 sm:w-36 font-bold text-sm border-none shadow-none focus:ring-0 h-8 px-1">
                    <SelectValue/>
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {Object.entries(byType).map(([type, insts]) => (
                      <div key={type}>
                        <div className="px-2 py-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">{type}</div>
                        {insts?.map(i => (
                          <SelectItem key={i.symbol} value={i.symbol} className="text-sm">
                            <span className="flex items-center gap-2">
                              <InstrumentIcon symbol={i.symbol} size={18} />
                              <span className="font-mono">{i.symbol}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Live price */}
              <div className="flex items-center gap-1 sm:gap-2 text-sm flex-1 min-w-0 overflow-hidden">
                {quote && (
                  <>
                    <span className="font-mono font-bold text-xs sm:text-sm truncate shrink min-w-0">{formatPrice(quote.price, symbol)}</span>
                    <span className={`text-xs font-semibold px-1 py-0.5 rounded shrink-0 hidden sm:inline-flex ${quote.changePercent >= 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                      {quote.changePercent >= 0 ? "+" : ""}{quote.changePercent.toFixed(2)}%
                    </span>
                  </>
                )}
                {/* Leverage badge — read-only, per instrument type */}
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-mono shrink-0 hidden sm:inline-flex">
                  1:{leverage}
                </span>
              </div>

              <div className="ml-auto flex items-center gap-1">
                {/* Drawing tools */}
                <div className="flex items-center gap-0.5 border-r border-border/50 pr-2 mr-1">
                  <button
                    onClick={() => setDrawingMode(m => m === "hline" ? null : "hline")}
                    className={`flex items-center gap-1 px-2 py-1 text-xs rounded font-medium transition-colors ${drawingMode === "hline" ? "bg-primary/20 text-primary ring-1 ring-primary/30" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                  >
                    <Minus className="w-3 h-3"/>
                    <span className="hidden sm:inline">H-Line</span>
                  </button>
                  <button
                    onClick={() => setDrawingMode(m => m === "trend" ? null : "trend")}
                    className={`flex items-center gap-1 px-2 py-1 text-xs rounded font-medium transition-colors ${drawingMode === "trend" ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                  >
                    <TrendLine className="w-3 h-3"/>
                    <span className="hidden sm:inline">{drawingMode === "trend" && trendStartRef.current ? "Point 2" : "Trend"}</span>
                  </button>
                  <button onClick={clearDrawings} className="flex items-center gap-1 px-1.5 py-1 text-xs rounded font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 className="w-3 h-3"/>
                  </button>
                </div>
                <button
                  onClick={() => {
                    if (document.fullscreenElement) { document.exitFullscreen(); }
                    else { chartPanelRef.current?.requestFullscreen(); }
                  }}
                  className="flex items-center gap-1 px-1.5 py-1 text-xs rounded font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Fullscreen chart"
                >
                  <Maximize2 className="w-3.5 h-3.5"/>
                </button>
              </div>
            </div>
            {/* Interval row — horizontally scrollable, no wrapping */}
            <div className="px-3 py-1 border-b border-border flex items-center gap-0.5 bg-card/50 shrink-0 overflow-x-auto scrollbar-none">
              {INTERVALS.map(intv => (
                <button
                  key={intv.value}
                  onClick={() => setInterval(intv.value)}
                  className={`shrink-0 px-2.5 py-1 text-xs rounded font-medium transition-colors ${interval === intv.value ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                >
                  {intv.label}
                </button>
              ))}
              <div className="ml-auto shrink-0 pl-2 flex items-center gap-0.5">
                {/* Indicator toggles */}
                <div className="flex items-center gap-0.5 border-r border-border/50 pr-2 mr-1">
                  {(["BB", "RSI", "MACD"] as const).map(ind => {
                    const key = ind.toLowerCase() as "bb" | "rsi" | "macd";
                    return (
                      <button
                        key={ind}
                        onClick={() => setActiveIndicators(prev => {
                          const next = new Set(prev);
                          if (next.has(key)) next.delete(key); else next.add(key);
                          return next;
                        })}
                        title={ind === "BB" ? "Bollinger Bands" : ind === "RSI" ? "Relative Strength Index (14)" : "MACD (12,26,9)"}
                        className={`flex items-center gap-0.5 px-2 py-1 text-xs rounded font-medium transition-colors ${activeIndicators.has(key) ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                      >
                        <BarChart2 className="w-3 h-3 hidden sm:block"/>
                        {ind}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setShowAlertDialog(true)}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                >
                  <Bell className="w-3 h-3"/>
                  <span className="hidden sm:inline">Alert</span>
                </button>
              </div>
            </div>

            {/* OHLC crosshair info bar */}
            {hoveredOHLC && (
              <div className="px-3 py-1 border-b border-border/40 flex items-center gap-3 bg-card/30 text-[10px] font-mono shrink-0">
                <span className="text-muted-foreground">O <span className="text-foreground font-semibold">{formatPrice(hoveredOHLC.o, symbol)}</span></span>
                <span className="text-muted-foreground">H <span className="text-success font-semibold">{formatPrice(hoveredOHLC.h, symbol)}</span></span>
                <span className="text-muted-foreground">L <span className="text-destructive font-semibold">{formatPrice(hoveredOHLC.l, symbol)}</span></span>
                <span className="text-muted-foreground">C <span className={`font-semibold ${hoveredOHLC.c >= hoveredOHLC.o ? "text-success" : "text-destructive"}`}>{formatPrice(hoveredOHLC.c, symbol)}</span></span>
                <span className={`ml-1 font-semibold ${hoveredOHLC.c >= hoveredOHLC.o ? "text-success" : "text-destructive"}`}>
                  {hoveredOHLC.c >= hoveredOHLC.o ? "▲" : "▼"} {Math.abs(((hoveredOHLC.c - hoveredOHLC.o) / hoveredOHLC.o) * 100).toFixed(2)}%
                </span>
              </div>
            )}

            {/* Chart canvas */}
            <div className="flex-1 relative min-h-0">
              <div ref={chartContainerRef} className="absolute inset-0"/>
              {candlesLoading && (
                <div className="absolute inset-0 flex flex-col gap-3 p-4 bg-card z-10">
                  <div className="flex items-end gap-1.5 flex-1">
                    {[55,40,70,45,80,35,60,50,75,42,65,38,72,48,58,44,68,52,78,46].map((h, i) => (
                      <div key={i} className="flex-1 flex flex-col justify-end gap-0.5">
                        <Skeleton className="w-full" style={{ height: `${h}%` }}/>
                      </div>
                    ))}
                  </div>
                  <Skeleton className="h-6 w-full"/>
                </div>
              )}
              {(candlesError || (!candlesLoading && candles && candles.length === 0)) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-card z-10">
                  <div className="flex flex-col items-center gap-3 text-center px-6">
                    <div className="w-12 h-12 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-destructive"/>
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-foreground">Chart data unavailable</p>
                      <p className="text-xs text-muted-foreground mt-1">Market data API is busy — please retry in a moment.</p>
                    </div>
                    <button onClick={() => refetchCandles()} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors">
                      <RefreshCw className="w-3.5 h-3.5"/> Retry
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Order panel ──────────────────────────────────────────────────── */}
          <div className="w-full md:w-64 xl:w-72 shrink-0 bg-card flex flex-col md:overflow-hidden border-t md:border-t-0 md:border-l border-border">
            <div className="px-4 py-3 border-b border-border font-bold text-sm flex items-center gap-2">
              <Settings className="w-4 h-4 text-muted-foreground"/> New Order
            </div>
            <div className="p-4 space-y-3 md:flex-1 md:overflow-auto">
              {/* Buy / Sell */}
              <div className="flex p-1 bg-muted rounded-xl">
                <button
                  className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${direction === "buy" ? "bg-success text-success-foreground shadow-sm glow-success" : "hover:bg-background/50 text-muted-foreground"}`}
                  onClick={() => setDirection("buy")}
                  data-testid="button-direction-buy"
                >Buy</button>
                <button
                  className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${direction === "sell" ? "bg-destructive text-destructive-foreground shadow-sm glow-destructive" : "hover:bg-background/50 text-muted-foreground"}`}
                  onClick={() => setDirection("sell")}
                  data-testid="button-direction-sell"
                >Sell</button>
              </div>

              {/* Market / Limit */}
              <div className="flex p-0.5 bg-muted rounded-lg">
                {(["market", "limit"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setOrderType(t)}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-md capitalize transition-all ${orderType === t ? "bg-card text-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {t === "market" ? "Market" : "Limit / Pending"}
                  </button>
                ))}
              </div>

              {/* Bid / Ask */}
              {quote && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-success/8 border border-success/20 rounded-lg p-2 text-center">
                    <div className="text-xs text-muted-foreground mb-0.5">Ask (Buy)</div>
                    <div className="font-mono font-bold text-success text-xs">{formatPrice(quote.ask, symbol)}</div>
                  </div>
                  <div className="bg-destructive/8 border border-destructive/20 rounded-lg p-2 text-center">
                    <div className="text-xs text-muted-foreground mb-0.5">Bid (Sell)</div>
                    <div className="font-mono font-bold text-destructive text-xs">{formatPrice(quote.bid, symbol)}</div>
                  </div>
                </div>
              )}

              {orderType === "limit" && (
                <div className="space-y-3">
                  {/* Pending order type */}
                  <div>
                    <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Order Type</label>
                    <Select value={pendingOrderType} onValueChange={v => setPendingOrderType(v as typeof pendingOrderType)}>
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue/>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="buy_limit">Buy Limit</SelectItem>
                        <SelectItem value="sell_limit">Sell Limit</SelectItem>
                        <SelectItem value="buy_stop">Buy Stop</SelectItem>
                        <SelectItem value="sell_stop">Sell Stop</SelectItem>
                        <SelectItem value="buy_stop_limit">Buy Stop-Limit</SelectItem>
                        <SelectItem value="sell_stop_limit">Sell Stop-Limit</SelectItem>
                        <SelectItem value="trailing_stop">Trailing Stop</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Stop trigger price (stop-limit only) */}
                  {(pendingOrderType === "buy_stop_limit" || pendingOrderType === "sell_stop_limit") && (
                    <div>
                      <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Stop Trigger Price</label>
                      <Input type="number" step="0.00001" value={stopPriceInput} onChange={e => setStopPriceInput(e.target.value)} className="font-mono" placeholder={quote ? formatPrice(quote.price, symbol) : "0.00000"}/>
                    </div>
                  )}
                  {/* Trailing distance OR limit price */}
                  {pendingOrderType === "trailing_stop" ? (
                    <div>
                      <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Trailing Distance</label>
                      <Input type="number" step="0.00001" value={trailingDistInput} onChange={e => setTrailingDistInput(e.target.value)} className="font-mono" placeholder={currentInstrument ? `e.g. ${(currentInstrument.pip * 50).toFixed(currentInstrument.pip < 0.001 ? 4 : 1)}` : "0.0010"}/>
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Limit Price</label>
                      <Input type="number" step="0.00001" value={limitPrice} onChange={e => setLimitPrice(e.target.value)} className="font-mono" placeholder={quote ? formatPrice(quote.price, symbol) : "0.00000"} data-testid="input-limit-price"/>
                    </div>
                  )}
                </div>
              )}

              {/* Volume */}
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Volume (Lots)</label>
                <Input type="number" step="0.01" min="0.01" value={volume} onChange={e => setVolume(e.target.value)} className="font-mono text-base" data-testid="input-volume"/>
              </div>

              {/* Leverage — display only, fixed per instrument */}
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-muted/30 border border-border/50">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Leverage</div>
                  <div className="text-[10px] text-muted-foreground/60 capitalize">{currentInstrument?.type ?? ""} — fixed by asset class</div>
                </div>
                <div className="font-black font-mono text-primary text-lg">1:{leverage}</div>
              </div>

              {/* SL / TP */}
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Stop Loss <span className="text-muted-foreground/60">(optional)</span></label>
                <Input type="number" step="0.00001" value={stopLoss} onChange={e => setStopLoss(e.target.value)} className="font-mono" placeholder={`e.g. ${quote ? formatPrice(quote.price * 0.99, symbol) : "—"}`} data-testid="input-sl"/>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Take Profit <span className="text-muted-foreground/60">(optional)</span></label>
                <Input type="number" step="0.00001" value={takeProfit} onChange={e => setTakeProfit(e.target.value)} className="font-mono" placeholder={`e.g. ${quote ? formatPrice(quote.price * 1.01, symbol) : "—"}`} data-testid="input-tp"/>
              </div>

              {/* Order summary */}
              <div className="bg-muted/40 border border-border/50 rounded-xl p-3 space-y-1.5 text-xs">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Order Summary</div>
                <div className="flex justify-between"><span className="text-muted-foreground">Spread</span><span className="font-mono">{currentInstrument ? (currentInstrument.pip * 2).toFixed(currentInstrument.pip < 0.001 ? 5 : 2) : "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Required Margin</span><span className="font-mono font-bold text-foreground">${marginPreview}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Leverage</span><span className="font-mono font-bold text-primary">1:{leverage}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Commission</span><span className="font-mono">{tierCommissionPerLot === 0 ? <span className="text-success font-bold">Free</span> : <>${(parseFloat(volume || "0") * tierCommissionPerLot).toFixed(2)} <span className="text-muted-foreground/60 text-[10px]">({account?.accountType ?? "real"} tier)</span></>}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Pip Value</span><span className="font-mono">{currentInstrument ? `$${((parseFloat(volume) * (currentInstrument.lotSize ?? 100000)) * (currentInstrument.pip ?? 0.0001)).toFixed(4)}` : "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Notional</span><span className="font-mono">{quote ? `$${(parseFloat(volume) * quote.price * (currentInstrument?.lotSize ?? 100000)).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}</span></div>
                {stopLoss && quote && (
                  <div className="flex justify-between text-destructive/80"><span>Max Loss (SL)</span><span className="font-mono font-bold">${Math.abs((parseFloat(stopLoss) - quote.price) * parseFloat(volume) * (currentInstrument?.lotSize ?? 100000)).toFixed(2)}</span></div>
                )}
                {takeProfit && quote && (
                  <div className="flex justify-between text-success/80"><span>Target (TP)</span><span className="font-mono font-bold">${Math.abs((parseFloat(takeProfit) - quote.price) * parseFloat(volume) * (currentInstrument?.lotSize ?? 100000)).toFixed(2)}</span></div>
                )}
                {quote && (
                  <div className="flex justify-between pt-1 border-t border-border/50">
                    <span className="text-muted-foreground">Market</span>
                    <span className={`font-semibold ${quote.marketOpen !== false ? "text-success" : "text-muted-foreground"}`}>
                      {quote.marketOpen !== false ? "● Open" : "● Closed"}
                    </span>
                  </div>
                )}
              </div>

              {openPosition.isError && (
                <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                  Failed to execute. {(openPosition.error as any)?.message ?? "Try again."}
                </div>
              )}

              {orderType === "limit" && pendingOrderType !== "trailing_stop" && !limitPrice && (
                <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                  Enter a limit price to place this order.
                </div>
              )}
              {orderType === "limit" && pendingOrderType === "trailing_stop" && !trailingDistInput && (
                <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                  Enter a trailing distance to place this order.
                </div>
              )}
              <button
                onClick={handleExecute}
                disabled={
                  openPosition.isPending ||
                  (orderType === "limit" && pendingOrderType !== "trailing_stop" && !limitPrice) ||
                  (orderType === "limit" && pendingOrderType === "trailing_stop" && !trailingDistInput)
                }
                className={`w-full py-4 rounded-xl font-bold text-base text-white transition-all ${direction === "buy" ? "bg-success hover:bg-success/90 glow-success" : "bg-destructive hover:bg-destructive/90 glow-destructive"} disabled:opacity-40`}
                data-testid="button-execute-order"
              >
                {openPosition.isPending ? "Executing…" : `${direction === "buy" ? "Buy" : "Sell"} ${symbol.replace("/", "")}`}
              </button>
            </div>
          </div>
        </div>

        {/* ── Positions / Alerts bottom panel ─────────────────────────────── */}
        <div className="md:h-52 border-t border-border bg-card flex flex-col shrink-0">
          <div className="flex items-center border-b border-border shrink-0">
            <button
              onClick={() => setBottomTab("positions")}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${bottomTab === "positions" ? "text-foreground border-b-2 border-primary -mb-px" : "text-muted-foreground hover:text-foreground"}`}
            >
              Positions ({positions?.length ?? 0})
            </button>
            <button
              onClick={() => setBottomTab("pending")}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${bottomTab === "pending" ? "text-foreground border-b-2 border-primary -mb-px" : "text-muted-foreground hover:text-foreground"}`}
            >
              Pending ({pendingOrders?.length ?? 0})
            </button>
            <button
              onClick={() => setBottomTab("alerts")}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1 ${bottomTab === "alerts" ? "text-foreground border-b-2 border-primary -mb-px" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Bell className="w-3 h-3"/> Alerts
            </button>
          </div>

          {bottomTab === "positions" ? (
            <div className="flex-1 overflow-auto">
              <table className="w-full min-w-[640px] text-xs text-left">
                <thead className="bg-muted/30 text-muted-foreground sticky top-0 z-10">
                  <tr>
                    {["Symbol","Type","Volume","Open","Current","SL / TP","Live P&L","Actions"].map(h => (
                      <th key={h} className={`px-3 py-2 font-semibold ${["Open","Current","Live P&L","Actions","SL / TP"].includes(h) ? "text-right" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {positions?.map(pos => {
                    const key = toKey(pos.symbol);
                    const currentPrice = prices[key]?.price ?? pos.currentPrice;
                    const pnl = computePnl(pos.openPrice, currentPrice, pos.volume, pos.direction, pos.lotSize);
                    return (
                      <tr key={pos.id} className="hover:bg-muted/20">
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <InstrumentIcon symbol={pos.symbol} size={20}/>
                            <span className="font-bold">{pos.symbol}</span>
                          </div>
                        </td>
                        <td className={`px-3 py-2.5 capitalize font-semibold ${pos.direction === "buy" ? "text-success" : "text-destructive"}`}>{pos.direction}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{pos.volume}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{formatPrice(pos.openPrice, pos.symbol)}</td>
                        <td className={`px-3 py-2.5 text-right font-mono ${prices[key]?.direction === "up" ? "text-success" : prices[key]?.direction === "down" ? "text-destructive" : ""}`}>
                          {formatPrice(currentPrice, pos.symbol)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">
                          {pos.stopLoss ? formatPrice(pos.stopLoss, pos.symbol) : "—"} / {pos.takeProfit ? formatPrice(pos.takeProfit, pos.symbol) : "—"}
                        </td>
                        <td className={`px-3 py-2.5 text-right font-mono font-bold ${(pnl - (pos.commission ?? 0)) >= 0 ? "text-success" : "text-destructive"}`}>
                          <div>{(pnl - (pos.commission ?? 0)) >= 0 ? "+" : ""}${(pnl - (pos.commission ?? 0)).toFixed(2)}</div>
                          {(pos.commission ?? 0) !== 0 && (
                            <div className="text-xs font-normal text-muted-foreground">fee −${(pos.commission ?? 0).toFixed(2)}</div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => setModifyPos(pos.id)} className="text-xs px-2 py-1 border border-border rounded-md hover:bg-muted text-muted-foreground transition-colors">Edit</button>
                            <button
                              onClick={async () => {
                                const posKey = toKey(pos.symbol);
                                const liveQuote = prices[posKey];
                                const execPrice = pos.direction === "buy"
                                  ? (liveQuote?.bid ?? liveQuote?.price)
                                  : (liveQuote?.ask ?? liveQuote?.price);
                                await fetch(`/api/positions/${pos.id}`, {
                                  method: "DELETE",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ closePrice: execPrice }),
                                });
                                await Promise.all([
                                  queryClient.invalidateQueries({ queryKey: getListPositionsQueryKey() }),
                                  queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey() }),
                                ]);
                              }}
                              disabled={closePosition.isPending}
                              className="text-xs px-2 py-1 border border-destructive/30 rounded-md hover:bg-destructive/10 text-destructive transition-colors"
                              data-testid={`button-close-position-${pos.id}`}
                            >Close</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {(!positions || positions.length === 0) && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No open positions</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : bottomTab === "pending" ? (
            <div className="flex-1 overflow-auto">
              <table className="w-full min-w-[640px] text-xs text-left">
                <thead className="bg-muted/30 text-muted-foreground sticky top-0 z-10">
                  <tr>
                    {["Symbol","Dir.","Order Type","Volume","Limit Price","SL / TP","Placed","Cancel"].map(h => (
                      <th key={h} className={`px-3 py-2 font-semibold ${["Limit Price","SL / TP","Placed","Cancel"].includes(h) ? "text-right" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pendingOrders?.map(po => (
                    <tr key={po.id} className="hover:bg-muted/20">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <InstrumentIcon symbol={po.symbol} size={20}/>
                          <span className="font-bold">{po.symbol}</span>
                        </div>
                      </td>
                      <td className={`px-3 py-2.5 capitalize font-semibold ${po.direction === "buy" ? "text-success" : "text-destructive"}`}>{po.direction}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground capitalize">{((po as any).orderType ?? "limit").replace(/_/g, " ")}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{po.volume}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-primary">{formatPrice(po.limitPrice, po.symbol)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">
                        {po.stopLoss ? formatPrice(po.stopLoss, po.symbol) : "—"} / {po.takeProfit ? formatPrice(po.takeProfit, po.symbol) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">
                        {new Date(po.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          onClick={() => cancelPendingOrder.mutate({ id: po.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListPendingOrdersQueryKey() }) })}
                          disabled={cancelPendingOrder.isPending}
                          className="text-xs px-2 py-1 border border-destructive/30 rounded-md hover:bg-destructive/10 text-destructive transition-colors"
                        >Cancel</button>
                      </td>
                    </tr>
                  ))}
                  {(!pendingOrders || pendingOrders.length === 0) && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No pending orders</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <AlertsPanel defaultSymbol={symbol}/>
          )}
        </div>
      </div>
    </div>
  );
}
