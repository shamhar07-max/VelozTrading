import { useEffect, useRef, useState } from "react";
import { wsUrl } from "./api";

// Reconnecting WebSocket that keeps a live map of symbol → price message.
// Mirrors the web app's stream protocol ({type:"subscribe_all"}).
export function useLivePrices() {
  const [prices, setPrices] = useState({});
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const retryRef = useRef(null);

  useEffect(() => {
    let dead = false;

    function connect() {
      if (dead) return;
      try {
        const ws = new WebSocket(wsUrl());
        wsRef.current = ws;
        ws.onopen = () => {
          setConnected(true);
          ws.send(JSON.stringify({ type: "subscribe_all" }));
        };
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.symbol && typeof msg.price === "number") {
              setPrices((p) => ({
                ...p,
                [msg.symbol]: {
                  price: msg.price,
                  bid: msg.bid, ask: msg.ask,
                  changePercent: msg.changePercent ?? 0,
                  marketOpen: msg.marketOpen,
                },
              }));
            }
          } catch { /* ignore */ }
        };
        ws.onclose = () => { setConnected(false); retry(); };
        ws.onerror = () => ws.close();
      } catch { retry(); }
    }
    function retry() {
      clearTimeout(retryRef.current);
      retryRef.current = setTimeout(connect, 2500);
    }

    connect();
    return () => { dead = true; clearTimeout(retryRef.current); wsRef.current?.close(); };
  }, []);

  return { prices, connected };
}
