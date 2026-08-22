import React, { useEffect, useState } from "react";
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

function IbClientsTable() {
  const [page, setPage] = React.useState(1);
  const { data, isLoading } = useQuery<{ total: number; page: number; limit: number; clients: Array<{ clerkUserId: string; name: string; email: string; balance: number; accountType: string; kycStatus: string; leverage: number; currency: string; referredBy: string; depositStatus: string; createdAt: string }> }>({
    queryKey: ["ib-clients", page],
    queryFn: async () => {
      const res = await fetch(`/api/ib/clients?page=${page}&limit=50`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
  const clients = data?.clients ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 50));
  return (
    <div className="glass-card rounded-2xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h2 className="font-bold flex items-center gap-2"><Users className="w-5 h-5 text-primary"/> Client Details — {total} total</h2>
        <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
      </div>
      {isLoading ? <div className="p-6"><Skeleton className="h-64 w-full"/></div> : clients.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">No clients yet.</div> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead><tr className="border-b border-border bg-muted/20">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">#</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Client</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Email</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Balance</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Tier</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">KYC</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Leverage</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Referred By</th>
              </tr></thead>
              <tbody>
                {clients.map((c, i) => (
                  <tr key={c.clerkUserId} className="border-b border-border/40 hover:bg-muted/10">
                    <td className="px-4 py-3 text-xs text-muted-foreground">{(page-1)*50 + i + 1}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{c.email}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">${fmt(c.balance)}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary uppercase">{c.accountType}</span></td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c.kycStatus==="verified"?"bg-emerald-400/10 text-emerald-400":c.kycStatus==="pending"?"bg-amber-400/10 text-amber-400":"bg-muted text-muted-foreground"}`}>{c.kycStatus}</span></td>
                    <td className="px-4 py-3 text-right font-mono text-xs">1:{c.leverage}</td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{c.referredBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && <div className="px-5 py-3 border-t border-border flex items-center justify-between"><span className="text-xs text-muted-foreground">{total} clients</span><div className="flex gap-2"><button disabled={page===1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted disabled:opacity-40">Prev</button><button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted disabled:opacity-40">Next</button></div></div>}
        </>
      )}
    </div>
  );
}

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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
            <Building2 className="w-7 h-7 text-primary"/> IB Panel
            <span className="text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-400">ACTIVE</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{data.name} · {data.referralCode}{data.legacyId ? ` · ${data.legacyId}` : ""}</p>
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
      </div>

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
        <h2 className="font-bold flex items-center gap-2"><ArrowDownToLine className="w-5 h-5 text-primary"/> Commissions &amp; Payouts</h2>
        <p className="text-sm text-muted-foreground mt-3">
          Lot rebates, parent overrides, CPA bonuses and revenue share accrue as pending lines and are
          settled in the monthly commission run after reconciliation and approval. Approved amounts appear
          in your withdrawable balance; payouts process within 24&ndash;48 hours of request.
        </p>
        {data.status !== "active" && (
          <p className="mt-3 text-sm text-amber-400">Partner status: {data.status} — new accruals are paused while not active.</p>
        )}
      </div>

      <IbClientsTable />
    </div>
  );
}
