import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Redirect } from "wouter";
import { Users, DollarSign, Building2, Layers, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface SubIbMe {
  id: number; name: string; referralCode: string; legacyId: string;
  parent: { id: number; name: string; referralCode: string } | null;
  totalClients: number; totalAum: number; seededCapital: number; status: string;
}
function fmt(n: number) { return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export function SubIbPanel() {
  useEffect(() => { document.title = "Sub-IB Panel | VelozTrade"; }, []);
  const { data, isLoading, error } = useQuery<SubIbMe>({
    queryKey: ["sub-ib-me"],
    queryFn: async () => {
      const res = await fetch("/api/sub-ib/me");
      if (!res.ok) throw new Error("NOT_SUBIB");
      return res.json();
    },
    retry: false,
  });

  if (error && (error as Error).message === "NOT_SUBIB") return <Redirect to="/ib" />;
  if (isLoading) return <div className="max-w-6xl mx-auto p-6"><Skeleton className="h-32 w-full rounded-2xl"/></div>;
  if (!data) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3"><Layers className="w-7 h-7 text-primary"/> Sub-IB Panel</h1>
        <p className="text-sm text-muted-foreground mt-1">{data.name} · {data.referralCode} {data.legacyId && `· ${data.legacyId}`}</p>
        {data.parent && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Building2 className="w-3 h-3"/> Parent IB: <span className="font-semibold text-foreground">{data.parent.name}</span> ({data.parent.referralCode}) <ArrowRight className="w-3 h-3"/> $3.00/lot override to parent</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-5 border border-border"><Users className="w-4 h-4 text-primary mb-3"/><div className="text-xs text-muted-foreground uppercase">Clients</div><div className="text-2xl font-black font-mono">{data.totalClients}</div></div>
        <div className="glass-card rounded-2xl p-5 border border-border"><DollarSign className="w-4 h-4 text-emerald-400 mb-3"/><div className="text-xs text-muted-foreground uppercase">AUM</div><div className="text-2xl font-black font-mono text-emerald-400">${fmt(data.totalAum)}</div></div>
        <div className="glass-card rounded-2xl p-5 border border-border"><Building2 className="w-4 h-4 text-amber-400 mb-3"/><div className="text-xs text-muted-foreground uppercase">Seeded Capital</div><div className="text-2xl font-black font-mono">${fmt(data.seededCapital)}</div></div>
      </div>

      <div className="glass-card rounded-2xl border border-border p-6">
        <h2 className="font-bold">Commission Model</h2>
        <p className="text-sm text-muted-foreground mt-2">You earn <strong className="text-foreground">$5.00–$8.00/lot</strong> on your own client volume (tiered). Your parent IB automatically receives <strong className="text-foreground">$3.00/lot</strong> override. Volume rebate $0.10/lot on first 1,000 lots.</p>
        <div className="grid sm:grid-cols-3 gap-3 mt-4 text-sm">
          <div className="p-3 rounded-xl bg-muted/20 border border-border"><div className="text-xs text-muted-foreground">Tier 1 (0–500 lots)</div><div className="font-bold">$5.00 / lot</div></div>
          <div className="p-3 rounded-xl bg-muted/20 border border-border"><div className="text-xs text-muted-foreground">Tier 2 (501–1,500)</div><div className="font-bold">$6.50 / lot</div></div>
          <div className="p-3 rounded-xl bg-muted/20 border border-border"><div className="text-xs text-muted-foreground">Tier 3 (1,501+)</div><div className="font-bold">$8.00 / lot</div></div>
        </div>
      </div>
    </div>
  );
}
