import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Clock, CheckCircle, XCircle, Search, Loader2 } from "lucide-react";
import { useListFundsHistory } from "@workspace/api-client-react";

const STATUS_STYLE: Record<string, string> = {
  completed: "bg-success/10 text-success",
  approved:  "bg-success/10 text-success",
  pending:   "bg-amber-400/10 text-amber-400",
  failed:    "bg-destructive/10 text-destructive",
  rejected:  "bg-destructive/10 text-destructive",
  processing:"bg-blue-400/10 text-blue-400",
};
const STATUS_ICON: Record<string, any> = {
  completed: CheckCircle, approved: CheckCircle,
  pending: Clock,
  failed: XCircle, rejected: XCircle,
  processing: Clock,
};

export function FundsHistory() {
  useEffect(() => { document.title = "Funds History | VelozTrade"; }, []);
  const [filter, setFilter] = useState<"all" | "deposit" | "withdrawal">("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const { data: transactionsRaw, isLoading, isError } = useListFundsHistory();
  const transactions = Array.isArray(transactionsRaw) ? transactionsRaw : [];

  const filtered = transactions.filter(t => {
    if (filter !== "all" && t.type !== filter) return false;
    if (status !== "all" && t.status !== status) return false;
    if (search && !t.ref.toLowerCase().includes(search.toLowerCase()) && !t.method.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalIn = transactions.filter(t => (t.type === "deposit") && (t.status === "completed" || t.status === "approved")).reduce((s, t) => s + t.amount, 0);
  const totalOut = transactions.filter(t => (t.type === "withdrawal") && (t.status === "completed" || t.status === "approved")).reduce((s, t) => s + t.amount, 0);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Funds History</h1>
        <p className="text-xs text-muted-foreground mt-0.5">All deposits and withdrawals on your account</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-4">
        <div className="glass-card rounded-xl p-3 md:p-4 border border-border text-center">
          <div className="text-success font-black text-base md:text-xl truncate">${totalIn.toLocaleString()}</div>
          <div className="text-[10px] md:text-xs text-muted-foreground mt-0.5">Total Deposited</div>
        </div>
        <div className="glass-card rounded-xl p-3 md:p-4 border border-border text-center">
          <div className="text-destructive font-black text-base md:text-xl truncate">${totalOut.toLocaleString()}</div>
          <div className="text-[10px] md:text-xs text-muted-foreground mt-0.5">Total Withdrawn</div>
        </div>
        <div className="glass-card rounded-xl p-3 md:p-4 border border-border text-center">
          <div className="text-primary font-black text-base md:text-xl truncate">${(totalIn - totalOut).toLocaleString()}</div>
          <div className="text-[10px] md:text-xs text-muted-foreground mt-0.5">Net Funded</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 p-1 bg-muted rounded-xl">
          {(["all", "deposit", "withdrawal"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] md:text-xs font-semibold capitalize transition-all ${filter === f ? "bg-card text-foreground shadow" : "text-muted-foreground"}`}
            >
              {f === "all" ? "All" : f === "deposit" ? "📥 In" : "📤 Out"}
            </button>
          ))}
        </div>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="bg-muted/40 border border-border rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-primary"
        >
          <option value="all">All Status</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="rejected">Rejected</option>
          <option value="failed">Failed</option>
        </select>
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className="pl-8 pr-3 py-2 w-36 md:w-48 bg-muted/40 border border-border rounded-xl text-xs focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Transactions list */}
      <div className="glass-card rounded-2xl border border-border overflow-hidden">
        {isLoading && (
          <div className="py-12 flex justify-center items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        )}
        {isError && (
          <div className="py-10 text-center text-destructive text-sm">Failed to load. Please try again.</div>
        )}
        {!isLoading && !isError && (
          <>
            {/* Desktop table header */}
            <div className="hidden md:grid grid-cols-12 px-4 py-2.5 border-b border-border bg-muted/20 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              <div className="col-span-1">Type</div>
              <div className="col-span-3">Method</div>
              <div className="col-span-2 text-right">Amount</div>
              <div className="col-span-2 text-center">Status</div>
              <div className="col-span-3">Date</div>
              <div className="col-span-1 text-right">Ref</div>
            </div>
            <div className="divide-y divide-border/30">
              {filtered.map(t => {
                const Icon = STATUS_ICON[t.status] ?? Clock;
                const dateStr = new Date(t.date).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
                const shortDate = new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                return (
                  <div key={`${t.type}-${t.id}`}>
                    {/* Mobile card */}
                    <div className="md:hidden flex items-center gap-3 px-4 py-3.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${t.type === "deposit" ? "bg-success/10" : "bg-destructive/10"}`}>
                        {t.type === "deposit"
                          ? <ArrowDownLeft className="w-4 h-4 text-success" />
                          : <ArrowUpRight className="w-4 h-4 text-destructive" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold capitalize truncate">{t.method}</span>
                          <span className={`font-mono font-bold text-sm shrink-0 ${t.type === "deposit" ? "text-success" : "text-destructive"}`}>
                            {t.type === "deposit" ? "+" : "-"}${t.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <span className="text-[11px] text-muted-foreground">{shortDate} · {t.ref}</span>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[t.status] ?? "bg-muted text-muted-foreground"}`}>
                            <Icon className="w-2.5 h-2.5" /> {t.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Desktop row */}
                    <div className="hidden md:grid grid-cols-12 px-4 py-3.5 items-center hover:bg-muted/10 transition-colors">
                      <div className="col-span-1">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${t.type === "deposit" ? "bg-success/10" : "bg-destructive/10"}`}>
                          {t.type === "deposit" ? <ArrowDownLeft className="w-4 h-4 text-success" /> : <ArrowUpRight className="w-4 h-4 text-destructive" />}
                        </div>
                      </div>
                      <div className="col-span-3 text-sm font-semibold capitalize">{t.method}</div>
                      <div className={`col-span-2 text-right font-mono font-bold text-sm ${t.type === "deposit" ? "text-success" : "text-destructive"}`}>
                        {t.type === "deposit" ? "+" : "-"}${t.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="col-span-2 text-center">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[t.status] ?? "bg-muted text-muted-foreground"}`}>
                          <Icon className="w-2.5 h-2.5" /> {t.status}
                        </span>
                      </div>
                      <div className="col-span-3 text-xs text-muted-foreground">{dateStr}</div>
                      <div className="col-span-1 text-right font-mono text-[10px] text-muted-foreground">{t.ref}</div>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="py-12 text-center">
                  <div className="text-muted-foreground text-sm">No transactions yet.</div>
                  <div className="text-muted-foreground/60 text-xs mt-1">Your deposit and withdrawal history will appear here.</div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
