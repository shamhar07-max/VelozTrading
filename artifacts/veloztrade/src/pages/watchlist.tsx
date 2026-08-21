import { useEffect, useState } from "react";
import { useGetWatchlist, useRemoveFromWatchlist, getGetWatchlistQueryKey } from "@workspace/api-client-react";
import { useWebSocket } from "@/hooks/use-websocket";
import { useQueryClient } from "@tanstack/react-query";
import { toKey, formatPrice } from "@/lib/symbol";
import { InstrumentIcon } from "@/components/instrument-icon";
import { X, Star, TrendingUp, TrendingDown, Bell } from "lucide-react";
import { Link } from "wouter";
import { SetAlertDialog } from "@/components/set-alert-dialog";
import { AlertsPanel } from "@/components/alerts-panel";

export function Watchlist() {
  useEffect(() => {
    document.title = "Watchlist | VelozTrade";
  }, []);

  const { data: watchlistRaw, isLoading } = useGetWatchlist();
  const watchlist = Array.isArray(watchlistRaw) ? watchlistRaw : [];
  const removeFromWatchlist = useRemoveFromWatchlist();
  const { prices } = useWebSocket();
  const queryClient = useQueryClient();
  const [alertSymbol, setAlertSymbol] = useState<string | null>(null);

  return (
    <div className="max-w-7xl mx-auto">
      {alertSymbol && (
        <SetAlertDialog symbol={alertSymbol} onClose={() => setAlertSymbol(null)}/>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Watchlist</h1>
        <Link href="/trade" className="flex items-center gap-1.5 text-sm text-primary font-semibold hover:text-primary/80 transition-colors">
          <Star className="w-4 h-4"/> Add symbols
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-6 rounded-xl border border-border bg-card animate-pulse h-32"/>
          ))}
        </div>
      ) : watchlist?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
            <Star className="w-8 h-8 text-muted-foreground"/>
          </div>
          <div>
            <div className="font-semibold text-lg mb-1">Your watchlist is empty</div>
            <p className="text-muted-foreground text-sm mb-4">Add instruments from the Markets page to track them here.</p>
            <Link href="/trade" className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors">
              Browse Markets
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
          {watchlist?.map(item => {
            const liveKey = toKey(item.symbol);
            const quote = prices[liveKey];
            const price = quote?.price ?? item.price ?? null;
            const change = quote?.changePercent ?? item.changePercent ?? 0;
            const isUp = change > 0;
            const isDown = change < 0;

            return (
              <div
                key={item.symbol}
                className="p-5 rounded-xl border border-border bg-card hover:border-primary/40 transition-all group relative cursor-pointer"
                data-testid={`card-watchlist-${item.symbol}`}
              >
                <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      setAlertSymbol(item.symbol);
                    }}
                    className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                    title="Set price alert"
                    data-testid={`button-alert-watchlist-${item.symbol}`}
                  >
                    <Bell className="w-3.5 h-3.5"/>
                  </button>
                  <button
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                    onClick={(e) => {
                      e.preventDefault();
                      removeFromWatchlist.mutate({ symbol: item.symbol }, {
                        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetWatchlistQueryKey() }),
                      });
                    }}
                    disabled={removeFromWatchlist.isPending}
                    data-testid={`button-remove-watchlist-${item.symbol}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-start justify-between mb-3 pr-14">
                  <div className="flex items-center gap-2.5">
                    <InstrumentIcon symbol={item.symbol} size={36} />
                    <div>
                      <div className="font-bold text-base">{item.symbol}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[130px]">{item.name}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize shrink-0 mt-0.5">
                    {item.type}
                  </span>
                </div>

                <div className="flex items-end justify-between">
                  <div className="font-mono font-bold text-xl">
                    {price != null ? formatPrice(price, item.symbol) : <span className="text-muted-foreground text-base">—</span>}
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-semibold ${isUp ? "text-success" : isDown ? "text-destructive" : "text-muted-foreground"}`}>
                    {isUp ? <TrendingUp className="w-3.5 h-3.5"/> : isDown ? <TrendingDown className="w-3.5 h-3.5"/> : null}
                    {change > 0 ? "+" : ""}{change.toFixed(2)}%
                  </div>
                </div>

                <Link
                  href={`/trade?symbol=${encodeURIComponent(item.symbol)}`}
                  className="mt-3 block text-center text-xs font-semibold text-primary hover:text-primary/80 border border-primary/20 hover:border-primary/40 rounded-lg py-1.5 transition-all"
                >
                  Trade
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {(watchlist?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ height: "240px" }}>
          <AlertsPanel/>
        </div>
      )}
    </div>
  );
}
