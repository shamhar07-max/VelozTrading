import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { useListInstruments, useGetWatchlist, useAddToWatchlist, useRemoveFromWatchlist, getGetWatchlistQueryKey } from "@workspace/api-client-react";
import { useWebSocket } from "@/hooks/use-websocket";
import { toKey, formatPrice } from "@/lib/symbol";
import { Search, Star, TrendingUp, TrendingDown, LogIn, Bell } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { SetAlertDialog } from "@/components/set-alert-dialog";
import { InstrumentIcon } from "@/components/instrument-icon";

const CATEGORIES = ["All", "Forex", "Crypto", "Stocks", "Commodities", "Indices"] as const;
type Category = typeof CATEGORIES[number];

export function Markets() {
  useEffect(() => { document.title = "Markets | VelozTrade"; }, []);

  const { isSignedIn } = useAuth();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [alertSymbol, setAlertSymbol] = useState<string | null>(null);
  const { data: instrumentsRaw, isLoading } = useListInstruments();
  const instruments = Array.isArray(instrumentsRaw) ? instrumentsRaw : [];
  const { data: watchlistRaw } = useGetWatchlist({ query: { enabled: !!isSignedIn, queryKey: getGetWatchlistQueryKey() } });
  const watchlist = Array.isArray(watchlistRaw) ? watchlistRaw : [];
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();
  const { prices } = useWebSocket();
  const queryClient = useQueryClient();

  const watchlistSymbols = new Set(watchlist.map(w => w.symbol));

  const filtered = instruments.filter(i => {
    const matchSearch = !search || i.symbol.toLowerCase().includes(search.toLowerCase()) || i.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === "All" || i.type.toLowerCase() === activeCategory.toLowerCase();
    return matchSearch && matchCat;
  });

  const toggleWatchlist = (symbol: string, isWatched: boolean) => {
    if (!isSignedIn) return;
    if (isWatched) {
      removeFromWatchlist.mutate({ symbol }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetWatchlistQueryKey() }) });
    } else {
      addToWatchlist.mutate({ data: { symbol } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetWatchlistQueryKey() }) });
    }
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col h-[calc(100dvh-8.25rem)] md:h-[calc(100dvh-5rem)]">
      {alertSymbol && (
        <SetAlertDialog symbol={alertSymbol} onClose={() => setAlertSymbol(null)}/>
      )}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Markets</h1>
          {!isSignedIn && (
            <p className="text-sm text-muted-foreground mt-1">
              Browse live prices ·{" "}
              <Link href="/sign-in" className="text-primary font-semibold hover:underline">Sign in</Link>
              {" "}to trade & save watchlist
            </p>
          )}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/>
          <Input
            placeholder="Search markets…"
            className="pl-9 bg-card"
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="input-search-markets"
          />
        </div>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all shrink-0 ${
              activeCategory === cat
                ? "bg-primary/15 text-primary border border-primary/30"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground border border-transparent"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="flex-1 glass-card rounded-2xl overflow-hidden flex flex-col min-h-0">
        {/* Desktop header — hidden on mobile */}
        <div className="hidden sm:grid grid-cols-12 px-5 py-3 border-b border-border/50 bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
          <div className="col-span-4">Instrument</div>
          <div className="col-span-2 text-right">Price</div>
          <div className="col-span-2 text-right">24h Change</div>
          <div className="col-span-1 text-right">Spread</div>
          <div className="col-span-1 text-right">Type</div>
          <div className="col-span-1 text-right">{isSignedIn ? "Alert" : ""}</div>
          <div className="col-span-1 text-right">{isSignedIn ? "Watch" : "Trade"}</div>
        </div>
        <div className="flex-1 overflow-auto divide-y divide-border/30">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading markets…</div>
          ) : filtered?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No markets found</div>
          ) : (
            filtered?.map(inst => {
              const q = prices[toKey(inst.symbol)];
              const price = q?.price ?? inst.currentPrice;
              const change = q?.changePercent ?? inst.changePercent ?? 0;
              const up = change > 0;
              const down = change < 0;
              const isWatched = watchlistSymbols.has(inst.symbol);

              const watchButton = isSignedIn ? (
                <button
                  onClick={() => toggleWatchlist(inst.symbol, isWatched)}
                  disabled={addToWatchlist.isPending || removeFromWatchlist.isPending}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors inline-flex"
                  data-testid={`button-watchlist-toggle-${inst.symbol}`}
                >
                  <Star className={`w-4 h-4 ${isWatched ? "fill-primary text-primary" : "text-muted-foreground"}`}/>
                </button>
              ) : (
                <Link
                  href="/sign-in"
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors inline-flex text-muted-foreground hover:text-primary"
                  title="Sign in to trade"
                >
                  <LogIn className="w-4 h-4"/>
                </Link>
              );

              return (
                <div key={inst.symbol} data-testid={`row-market-${inst.symbol}`}>
                  {/* Mobile row */}
                  <div className="sm:hidden flex items-center px-4 py-3 hover:bg-muted/10 transition-colors gap-3">
                    <InstrumentIcon symbol={inst.symbol} size={28}/>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm">{inst.symbol}</div>
                      <div className="text-xs text-muted-foreground truncate">{inst.name}</div>
                    </div>
                    <div className="text-right min-w-0">
                      <div className="font-mono font-semibold text-sm">
                        {price != null ? formatPrice(price, inst.symbol) : <span className="text-muted-foreground">—</span>}
                      </div>
                      <div className={`font-mono text-xs font-semibold flex items-center justify-end gap-0.5 ${up ? "text-success" : down ? "text-destructive" : "text-muted-foreground"}`}>
                        {up ? <TrendingUp className="w-3 h-3"/> : down ? <TrendingDown className="w-3 h-3"/> : null}
                        {change > 0 ? "+" : ""}{change.toFixed(2)}%
                      </div>
                    </div>
                    <div className="shrink-0">{watchButton}</div>
                  </div>
                  {/* Desktop row */}
                  <div className="hidden sm:grid grid-cols-12 px-5 py-3.5 items-center hover:bg-muted/10 transition-colors group">
                    <div className="col-span-4 flex items-center gap-3">
                      <InstrumentIcon symbol={inst.symbol} size={32}/>
                      <div>
                        <div className="font-bold text-sm group-hover:text-primary transition-colors">{inst.symbol}</div>
                        <div className="text-xs text-muted-foreground">{inst.name}</div>
                      </div>
                    </div>
                    <div className="col-span-2 text-right font-mono font-semibold text-sm">
                      {price != null ? formatPrice(price, inst.symbol) : <span className="text-muted-foreground">—</span>}
                    </div>
                    <div className={`col-span-2 text-right font-mono text-sm font-semibold flex items-center justify-end gap-1 ${up ? "text-success" : down ? "text-destructive" : "text-muted-foreground"}`}>
                      {up ? <TrendingUp className="w-3 h-3"/> : down ? <TrendingDown className="w-3 h-3"/> : null}
                      {change > 0 ? "+" : ""}{change.toFixed(2)}%
                    </div>
                    <div className="col-span-1 text-right font-mono text-xs text-muted-foreground">
                      {inst.spread?.toFixed(inst.pip < 0.001 ? 5 : 2)}
                    </div>
                    <div className="col-span-1 text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        inst.type === "crypto" ? "bg-orange-500/10 text-orange-400" :
                        inst.type === "forex" ? "bg-blue-500/10 text-blue-400" :
                        inst.type === "stocks" ? "bg-violet-500/10 text-violet-400" :
                        inst.type === "commodities" ? "bg-yellow-500/10 text-yellow-400" :
                        "bg-primary/10 text-primary"
                      }`}>{inst.type.slice(0,3).toUpperCase()}</span>
                    </div>
                    <div className="col-span-1 text-right">
                      {isSignedIn ? (
                        <button
                          onClick={() => setAlertSymbol(inst.symbol)}
                          className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors inline-flex text-muted-foreground hover:text-primary"
                          title="Set price alert"
                          data-testid={`button-alert-market-${inst.symbol}`}
                        >
                          <Bell className="w-4 h-4"/>
                        </button>
                      ) : null}
                    </div>
                    <div className="col-span-1 text-right">{watchButton}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
