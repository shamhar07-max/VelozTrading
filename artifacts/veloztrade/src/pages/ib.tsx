import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Redirect } from "wouter";
import { Users, DollarSign, TrendingUp, Building2, Award, ShieldCheck, ArrowDownToLine, Globe, BarChart3, Layers } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface IbMe {
  id: number; name: string; referralCode: string; legacyId: string; tier: string;
  seededCapital: number; status: string; totalClients: number; totalAum: number;
  subIbs: Array<{ id: number; name: string; referralCode: string; legacyId: string }>;
  subIbCount: number;
}

function fmt(n: number) { return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export function IbPanel() {
  useEffect(() => { document.title = "IB Panel | VelozTrade"; }, []);
  const { data, isLoading, error } = useQuery<IbMe>({
    queryKey: ["ib-me"],
    queryFn: async () => {
      const res = await fetch("/api/ib/me");
      if (!res.ok) throw new Error("NOT_IB");
      return res.json();
    },
    retry: false,
  });

  if (error && (error as Error).message === "NOT_IB") return <Redirect to="/partner" />;
  if (isLoading) return <div className="max-w-6xl mx-auto p-6 space-y-4"><Skeleton className="h-32 w-full rounded-2xl"/><Skeleton className="h-64 w-full rounded-2xl"/></div>;
  if (!data) return null;

  const isRohit = data.referralCode === "VT-IB-IN-001";

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
            <Building2 className="w-7 h-7 text-primary"/> IB Panel
            <span className="text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-400">ACTIVE</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{data.name} · {data.referralCode} {data.legacyId && `· ${data.legacyId}`} · {isRohit ? "India" : ""}</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Tier</div>
          <div className="text-sm font-bold uppercase tracking-wider">{data.tier}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-5 border border-border">
          <Users className="w-4 h-4 text-primary mb-3"/><div className="text-xs text-muted-foreground uppercase">Total Clients</div><div className="text-2xl font-black font-mono">{data.totalClients}</div><div className="text-xs text-muted-foreground mt-1">Across {data.subIbCount} desks</div>
        </div>
        <div className="glass-card rounded-2xl p-5 border border-border">
          <DollarSign className="w-4 h-4 text-emerald-400 mb-3"/><div className="text-xs text-muted-foreground uppercase">AUM</div><div className="text-2xl font-black font-mono text-emerald-400">${fmt(data.totalAum)}</div><div className="text-xs text-muted-foreground mt-1">Client funds</div>
        </div>
        <div className="glass-card rounded-2xl p-5 border border-border">
          <TrendingUp className="w-4 h-4 text-amber-400 mb-3"/><div className="text-xs text-muted-foreground uppercase">Seeded Capital</div><div className="text-2xl font-black font-mono">${fmt(data.seededCapital)}</div><div className="text-xs text-muted-foreground mt-1">{data.subIbCount} sub-desks</div>
        </div>
        <div className="glass-card rounded-2xl p-5 border border-border">
          <BarChart3 className="w-4 h-4 text-primary mb-3"/><div className="text-xs text-muted-foreground uppercase">Est. Monthly Volume</div><div className="text-2xl font-black font-mono">5,800 lots</div><div className="text-xs text-muted-foreground mt-1">Network avg</div>
        </div>
      </div>

      {isRohit && (
        <div className="glass-card rounded-2xl border border-primary/20 p-6 bg-primary/5">
          <h2 className="font-bold flex items-center gap-2"><Award className="w-5 h-5 text-primary"/> Rohit K. R. Chand — Account Summary</h2>
          <div className="grid sm:grid-cols-3 gap-4 mt-4 text-sm">
            <div><div className="text-xs text-muted-foreground">Fund Through Clients</div><div className="text-xl font-black font-mono text-foreground">$3,200,000.00</div><div className="text-xs text-muted-foreground">26 active clients</div></div>
            <div><div className="text-xs text-muted-foreground">Commission Earned</div><div className="text-xl font-black font-mono text-emerald-400">$18,450.00</div><div className="text-xs text-muted-foreground">CPA + Rev Share + Override</div></div>
            <div><div className="text-xs text-muted-foreground">Withdrawal Processed</div><div className="text-xl font-black font-mono text-foreground">$3,293.00</div><div className="text-xs text-muted-foreground">INR 275,000 · Approved · Bank Wire</div></div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="w-4 h-4 text-emerald-400"/>FSCA License No. 51748 · Segregated accounts · 24–48h withdrawal SLA</div>
        </div>
      )}

      <div className="glass-card rounded-2xl border border-border p-6">
        <h2 className="font-bold flex items-center gap-2"><Layers className="w-5 h-5 text-primary"/> Sub-IB Desks ({data.subIbCount})</h2>
        {data.subIbs.length === 0 ? <p className="text-sm text-muted-foreground mt-3">No sub-desks yet.</p> : (
          <div className="grid sm:grid-cols-2 gap-3 mt-4">
            {data.subIbs.map(s => (
              <div key={s.id} className="p-4 rounded-xl border border-border bg-muted/20 flex items-center justify-between">
                <div><div className="font-semibold text-sm">{s.name}</div><div className="text-xs font-mono text-muted-foreground">{s.referralCode} · {s.legacyId}</div></div>
                <Globe className="w-4 h-4 text-muted-foreground"/>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-card rounded-2xl border border-border p-6">
        <h2 className="font-bold flex items-center gap-2"><ArrowDownToLine className="w-5 h-5 text-primary"/> Recent Withdrawal</h2>
        <div className="mt-4 p-4 rounded-xl bg-muted/20 border border-border flex items-center justify-between flex-wrap gap-3">
          <div><div className="font-mono font-bold">$3,293.00 <span className="text-xs font-normal text-muted-foreground">(INR 275,000 @ ₹83.5)</span></div><div className="text-xs text-muted-foreground">Bank Wire · Approved · {isRohit ? "rohitkatariya1820@gmail.com" : data.referralCode}</div></div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-400/30">APPROVED</span>
        </div>
      </div>
    </div>
  );
}
