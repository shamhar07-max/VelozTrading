import { createContext, useContext, useEffect, useState, useRef, ReactNode, useCallback } from "react";
import { toKey } from "@/lib/symbol";

export type QuoteData = {
  symbol: string;
  bid: number;
  ask: number;
  price: number;
  changePercent: number;
  prevPrice?: number;
  direction?: "up" | "down" | "flat";
  marketOpen?: boolean;
};

type WebSocketContextType = {
  prices: Record<string, QuoteData>;
  isConnected: boolean;
  subscribe: (symbols: string[]) => void;
  subscribeAll: () => void;
};

const WebSocketContext = createContext<WebSocketContextType>({
  prices: {},
  isConnected: false,
  subscribe: () => {},
  subscribeAll: () => {},
});

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [prices, setPrices]         = useState<Record<string, QuoteData>>({});
  const [isConnected, setConnected] = useState(false);
  const prevRef                     = useRef<Record<string, number>>({});
  const wsRef                       = useRef<WebSocket | null>(null);
  const retryRef                    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef                 = useRef(0);
  const pendingSubRef               = useRef<string[] | "all" | null>(null);
  const unmountedRef                = useRef(false);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) return;

    // Split-hosting support: VITE_WS_URL overrides the default same-origin
    // endpoint when the WebSocket server lives on a different origin.
    const wsBase = (import.meta.env.VITE_WS_URL || "").replace(/\/+$/, "");
    const url = wsBase ||
      `${window.location.protocol === "https:" ? "wss://" : "ws://"}${window.location.host}`;
    const ws = new WebSocket(`${url}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) { ws.close(); return; }
      setConnected(true);
      attemptsRef.current = 0;
      // Restore any pending subscription
      const pending = pendingSubRef.current;
      if (pending === "all") {
        ws.send(JSON.stringify({ type: "subscribe_all" }));
      } else if (Array.isArray(pending)) {
        ws.send(JSON.stringify({ type: "subscribe", symbols: pending }));
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      if (unmountedRef.current) return;
      // Exponential backoff: 1 s → 2 s → 4 s … capped at 30 s
      const delay = Math.min(1_000 * Math.pow(2, attemptsRef.current), 30_000);
      attemptsRef.current++;
      retryRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => { ws.close(); };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as {
          type?: string;
          symbol?: string;
          bid?: number;
          ask?: number;
          price?: number;
          changePercent?: number;
          marketOpen?: boolean;
        };
        if (msg.type === "pong" || !msg.symbol) return;

        const key  = toKey(msg.symbol);
        const prev = prevRef.current[key];
        const p    = msg.price!;
        const dir: QuoteData["direction"] =
          prev == null ? "flat" : p > prev ? "up" : p < prev ? "down" : "flat";

        prevRef.current[key] = p;

        setPrices(s => ({
          ...s,
          [key]: {
            symbol:        key,
            bid:           msg.bid!,
            ask:           msg.ask!,
            price:         p,
            changePercent: msg.changePercent!,
            marketOpen:    msg.marketOpen,
            prevPrice:     prev,
            direction:     dir,
          },
        }));
      } catch { /* ignore */ }
    };
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    connect();

    // Heartbeat keeps the connection alive through proxies
    const hb = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 25_000);

    return () => {
      unmountedRef.current = true;
      clearInterval(hb);
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const subscribe = useCallback((symbols: string[]) => {
    pendingSubRef.current = symbols;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "subscribe", symbols }));
    }
  }, []);

  const subscribeAll = useCallback(() => {
    pendingSubRef.current = "all";
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "subscribe_all" }));
    }
  }, []);

  return (
    <WebSocketContext.Provider value={{ prices, isConnected, subscribe, subscribeAll }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  return useContext(WebSocketContext);
}
