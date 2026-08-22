import { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";

const INTERVALS = [
  { id: "5min", label: "5m" },
  { id: "15min", label: "15m" },
  { id: "1h", label: "1H" },
  { id: "4h", label: "4H" },
  { id: "1day", label: "1D" },
];

const UP = "#0ecb81";
const DOWN = "#f6465d";

/**
 * TradingView-grade candlestick chart, dark themed to VelozTrade.
 * Data: GET /api/candles (TwelveData → Yahoo → synthetic fallback server-side).
 */
export default function CandleChart({ symbol }) {
  const [intervalId, setIntervalId] = useState("1h");
  const [status, setStatus] = useState("loading"); // loading | ok | empty | error
  const boxRef = useRef(null);
  const chartRef = useRef(null);
  const candleRef = useRef(null);
  const volRef = useRef(null);

  // ── fetch candles ──
  useEffect(() => {
    let dead = false;
    setStatus("loading");
    fetch(
      `/api/candles?symbol=${encodeURIComponent(symbol)}&interval=${intervalId}&outputsize=150`,
      { credentials: "include" }
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((rows) => {
        if (!Array.isArray(rows) || rows.length === 0) throw new Error("empty");
        const mapped = rows
          .map((c) => ({
            time: Math.floor(new Date(c.datetime).getTime() / 1000),
            open: +c.open,
            high: +c.high,
            low: +c.low,
            close: +c.close,
            volume: Number(c.volume) || 0,
          }))
          .filter((d) => Number.isFinite(d.time) && d.close > 0)
          .sort((a, b) => a.time - b.time);
        // dedupe identical timestamps
        const dedup = mapped.filter((d, i) => i === 0 || d.time !== mapped[i - 1].time);
        if (dead) return;
        if (dedup.length === 0) setStatus("empty");
        else {
          setData(dedup);
          setStatus("ok");
        }
      })
      .catch(() => { if (!dead) setStatus("error"); });
    return () => { dead = true; };
  }, [symbol, intervalId]);

  // ── create chart once per mount ──
  useEffect(() => {
    if (!boxRef.current || chartRef.current) return;
    const chart = createChart(boxRef.current, {
      width: boxRef.current.clientWidth,
      height: 260,
      layout: {
        background: { type: "solid", color: "#12161c" },
        textColor: "#848e9c",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#1c2128" },
        horzLines: { color: "#1c2128" },
      },
      rightPriceScale: { borderColor: "#23282f" },
      timeScale: { borderColor: "#23282f", timeVisible: true, secondsVisible: false },
      crosshair: {
        vertLine: { color: "#5e6673", labelBackgroundColor: "#0072ff" },
        horzLine: { color: "#5e6673", labelBackgroundColor: "#0072ff" },
      },
    });
    candleRef.current = chart.addCandlestickSeries({
      upColor: UP,
      downColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
      borderVisible: false,
    });
    volRef.current = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });
    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      if (boxRef.current) chart.applyOptions({ width: boxRef.current.clientWidth });
    });
    ro.observe(boxRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volRef.current = null;
    };
  }, []);

  // ── push data into series ──
  useEffect(() => {
    if (!data || !candleRef.current || !volRef.current) return;
    candleRef.current.setData(data.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
    volRef.current.setData(
      data.map((d) => ({
        time: d.time,
        value: d.volume,
        color: d.close >= d.open ? "rgba(14,203,129,.35)" : "rgba(246,70,93,.35)",
      }))
    );
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return (
    <div style={{ marginBottom: 14 }}>
      {/* interval chips */}
      <div className="chips" style={{ paddingBottom: 8 }}>
        {INTERVALS.map((it) => (
          <button
            key={it.id}
            className={"chip" + (intervalId === it.id ? " on" : "")}
            onClick={() => setIntervalId(it.id)}
          >
            {it.label}
          </button>
        ))}
      </div>

      <div
        ref={boxRef}
        style={{
          position: "relative",
          height: 260,
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        {(status === "loading" || status === "empty" || status === "error") && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 2,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "#12161c", flexDirection: "column", gap: 8,
          }}>
            {status === "loading" && <div className="spinner" style={{ margin: 0 }} />}
            {status === "error" && <span className="tiny">Chart feed unavailable — retry shortly</span>}
            {status === "empty" && <span className="tiny">No candles for this interval</span>}
          </div>
        )}
      </div>
    </div>
  );
}
