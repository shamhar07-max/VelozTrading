import React, { useEffect, useState, useCallback, useRef } from "react";
import { useUser, useAuth } from "@clerk/react";
import {
  ShieldCheck, ShieldOff, Users, BarChart2, Database, Wifi,
  RefreshCw, TrendingUp, TrendingDown, X, DollarSign,
  ChevronDown, ChevronUp, Activity, AlertTriangle,
  FileText, CheckCircle, Clock, XCircle, Search, Filter,
  Download, Upload, Eye, Settings, Globe, Lock, Unlock,
  Bell, CreditCard, ArrowUpRight, ArrowDownRight, Layers,
  PieChart, Calendar, Hash, UserCheck, UserX, Ban, Loader2,
  Wallet, ExternalLink, AlertCircle, Handshake, Gift, Plus, Copy, Check,
  Edit2, ListOrdered,
} from "lucide-react";
import { formatPrice } from "@/lib/symbol";
import { toKey } from "@/lib/symbol";
import { useWebSocket } from "@/hooks/use-websocket";
import { toast } from "@/hooks/use-toast";

interface AdminStats {
  accounts: number;
  openPositions: number;
  totalOrders: number;
  totalBalance: number;
  wsClients: number;
  symbolsTracked: number;
  prices: { symbol: string; price: number; changePercent: number }[];
}

interface AdminUser {
  clerkUserId: string;
  email: string;
  name: string;
  imageUrl: string | null;
  balance: number;
  equity: number;
  floatingPnl: number;
  usedMargin: number;
  freeMargin: number;
  marginLevel: number;
  openPositions: number;
  leverage: number;
  accountType: string;
  kycStatus: string;
  createdAt: string;
  isAdmin: boolean;
}

interface AdminPosition {
  id: number;
  clerkUserId: string;
  symbol: string;
  symbolName: string;
  direction: string;
  volume: number;
  openPrice: number;
  currentPrice: number;
  pnl: number;
  stopLoss: number | null;
  takeProfit: number | null;
  openTime: string;
}

interface AdminPartner {
  id: number;
  clerkUserId: string;
  name: string;
  referralCode: string;
  seededCapital: number;
  cpaRate: number;
  revSharePct: number;
  capitalUnlockedPct: number;
  commissionWallet: number;
  status: string;
  balance: number;
  tradingProfit: number;
  totalReferrals: number;
  depositingReferrals: number;
  cpaEarned: number;
  revShareEarned: number;
  createdAt: string;
}

interface AdminOrder {
  id: number;
  clerkUserId: string;
  status: "open" | "closed";
  symbol: string;
  symbolName: string;
  direction: string;
  volume: number;
  openPrice: number;
  closePrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  profit: number | null;
  swap: number;
  commission: number;
  openTime: string;
  closeTime: string | null;
  currentPrice?: number;
  pnl?: number;
}

interface DepositRequest {
  id: number;
  clerkUserId: string;
  email: string;
  name: string;
  amount: number;
  method: string;
  status: string;
  notes: string | null;
  paymentProof: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

interface WithdrawalRequest {
  id: number;
  clerkUserId: string;
  email: string;
  name: string;
  amount: number;
  method: string;
  bankDetails: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

interface AdminCryptoDeposit {
  id: number;
  clerkUserId: string;
  email: string;
  name: string;
  txHash: string;
  fromWallet: string;
  chainId: number;
  network: string;
  amountUsdt: number;
  status: string;
  explorerUrl: string;
  createdAt: string;
  reviewedAt: string | null;
}

let _adminGetToken: (() => Promise<string | null>) | null = null;

async function adminFetch(path: string, opts?: RequestInit) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts?.headers as Record<string, string> | undefined),
  };
  if (_adminGetToken) {
    const token = await _adminGetToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`/api${path}`, { ...opts, headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function StatCard({ label, value, sub, icon: Icon, color = "text-primary", trend }: {
  label: string; value: string | number; sub?: string; icon: React.ElementType; color?: string; trend?: "up" | "down";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 hover:border-border/80 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
        <div className={`p-2 rounded-lg bg-muted/60 ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      {trend && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend === "up" ? "text-emerald-400" : "text-destructive"}`}>
          {trend === "up" ? <TrendingUp className="w-3 h-3"/> : <TrendingDown className="w-3 h-3"/>}
          <span>{trend === "up" ? "Trending up" : "Trending down"}</span>
        </div>
      )}
    </div>
  );
}

export function AdminAccessDenied() {
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapDone, setBootstrapDone] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  async function handleBootstrap() {
    setBootstrapping(true);
    setBootstrapError(null);
    try {
      const res = await fetch("/api/admin/bootstrap", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Unknown error" }));
        setBootstrapError(body.error ?? "Failed");
      } else {
        setBootstrapDone(true);
        setTimeout(() => window.location.reload(), 1200);
      }
    } catch (e: any) {
      setBootstrapError(e.message ?? "Network error");
    } finally {
      setBootstrapping(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 px-6 text-center">
      <div className="p-5 rounded-2xl bg-destructive/10 border border-destructive/20">
        <ShieldOff className="w-12 h-12 text-destructive" />
      </div>
      <div className="max-w-md">
        <h1 className="text-2xl font-bold text-foreground">Admin Access Required</h1>
        <p className="text-muted-foreground mt-2">
          Your account doesn't have admin privileges yet.
        </p>

        {/* One-click bootstrap — works only when no admin exists */}
        <div className="mt-6 p-5 rounded-2xl border border-primary/20 bg-primary/5 text-left">
          <div className="flex items-center gap-2 font-semibold text-sm mb-2">
            <ShieldCheck className="w-4 h-4 text-primary"/> First-time setup
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            If no admin exists yet, click below to promote your account. This button only works once — it becomes unavailable once an admin is already set.
          </p>
          {bootstrapDone ? (
            <div className="flex items-center gap-2 text-sm font-semibold text-success">
              <CheckCircle className="w-4 h-4"/> You're now admin — reloading…
            </div>
          ) : (
            <>
              <button
                onClick={handleBootstrap}
                disabled={bootstrapping}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                {bootstrapping ? "Promoting…" : "Make me Admin"}
              </button>
              {bootstrapError && (
                <p className="text-xs text-destructive mt-2">{bootstrapError}</p>
              )}
            </>
          )}
        </div>

        {/* Manual method */}
        <div className="mt-4 p-4 rounded-xl bg-muted/40 border border-border text-left">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Or set manually via Clerk Dashboard:</p>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Go to <strong>clerk.com</strong> → Dashboard → Users</li>
            <li>Select your account → Edit public metadata</li>
            <li>Set the value below and save</li>
          </ol>
          <pre className="mt-3 px-4 py-2 rounded-lg bg-muted border border-border text-xs font-mono">
            {`{ "role": "admin" }`}
          </pre>
          <p className="text-xs text-muted-foreground mt-2">Then sign out and sign back in.</p>
        </div>
      </div>
    </div>
  );
}

function EditBalanceModal({ user, onClose, onSave }: { user: AdminUser; onClose: () => void; onSave: () => void }) {
  const [balance, setBalance] = useState(String(user.balance));
  const [reason, setReason] = useState("Manual adjustment");
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-[440px] mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-lg">Set Balance</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Current Balance</label>
            <div className="px-3 py-2 rounded-lg bg-muted/40 border border-border text-sm font-mono text-muted-foreground">
              ${user.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">New Balance (USD)</label>
            <input
              type="number" min="0" step="100" value={balance}
              onChange={e => setBalance(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Reason / Note</label>
            <input
              value={reason} onChange={e => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm hover:bg-muted">Cancel</button>
          <button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await adminFetch(`/admin/users/${user.clerkUserId}/balance`, {
                  method: "PATCH", body: JSON.stringify({ balance: parseFloat(balance) }),
                });
                onSave();
                onClose();
              } finally { setSaving(false); }
            }}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function KycReviewModal({ user, onClose, onSave }: { user: AdminUser; onClose: () => void; onSave: () => void }) {
  const [status, setStatus] = useState(user.kycStatus);
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-[480px] mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-lg">KYC Review</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { label: "Account Type", value: user.accountType },
            { label: "Current KYC", value: user.kycStatus },
            { label: "Account ID", value: user.clerkUserId.slice(-8) },
            { label: "Joined", value: new Date(user.createdAt).toLocaleDateString() },
          ].map(row => (
            <div key={row.label} className="p-3 rounded-lg bg-muted/30 border border-border">
              <div className="text-xs text-muted-foreground mb-0.5">{row.label}</div>
              <div className="text-sm font-semibold capitalize">{row.value}</div>
            </div>
          ))}
        </div>

        <div className="mb-5">
          <label className="text-xs font-medium text-muted-foreground block mb-2">Update KYC Status</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: "unverified", label: "Unverified", icon: XCircle, color: "border-muted text-muted-foreground" },
              { value: "pending", label: "Pending", icon: Clock, color: "border-warning/50 text-warning" },
              { value: "verified", label: "Verified", icon: CheckCircle, color: "border-success/50 text-success" },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setStatus(opt.value)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                  status === opt.value ? `${opt.color} bg-muted/40` : "border-border text-muted-foreground hover:bg-muted/20"
                }`}
              >
                <opt.icon className="w-4 h-4"/>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm hover:bg-muted">Cancel</button>
          <button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await adminFetch(`/admin/users/${user.clerkUserId}/kyc`, {
                  method: "PATCH", body: JSON.stringify({ kycStatus: status }),
                });
                onSave();
                onClose();
              } finally { setSaving(false); }
            }}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Update KYC Status"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DepositReviewModal({ dep, onClose, onAction }: {
  dep: DepositRequest;
  onClose: () => void;
  onAction: () => void;
}) {
  const [rejectNote, setRejectNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | null>(null);

  const handleAction = async (action: "approve" | "reject") => {
    setSaving(true);
    try {
      await adminFetch(`/admin/deposits/${dep.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action, notes: rejectNote || undefined }),
      });
      onAction();
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="font-bold text-lg">Review Deposit Request</h3>
            <p className="text-xs text-muted-foreground mt-0.5">#{dep.id} · {new Date(dep.createdAt).toLocaleString()}</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground"/></button>
        </div>

        <div className="p-5 space-y-4">
          {/* User + amount */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Client",  value: dep.name !== "—" ? dep.name : dep.email },
              { label: "Email",   value: dep.email },
              { label: "Amount",  value: `$${dep.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}` },
              { label: "Method",  value: dep.method.toUpperCase() },
            ].map(row => (
              <div key={row.label} className="p-3 rounded-xl bg-muted/30 border border-border">
                <div className="text-xs text-muted-foreground mb-0.5">{row.label}</div>
                <div className="text-sm font-semibold text-foreground break-all">{row.value}</div>
              </div>
            ))}
          </div>

          {/* Payment proof */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5"/> Payment Proof Provided by Client
            </div>
            {dep.paymentProof ? (
              <pre className="text-sm text-foreground whitespace-pre-wrap font-mono leading-relaxed">
                {dep.paymentProof}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground italic">No payment proof submitted</p>
            )}
          </div>

          {dep.notes && (
            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Admin Notes</div>
              <p className="text-sm text-foreground">{dep.notes}</p>
            </div>
          )}

          {/* Status badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Status:</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              dep.status === "approved" ? "bg-emerald-400/10 text-emerald-400" :
              dep.status === "rejected" ? "bg-destructive/10 text-destructive" :
              "bg-warning/10 text-warning"
            }`}>{dep.status.toUpperCase()}</span>
          </div>

          {dep.status === "pending" && !confirmAction && (
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmAction("reject")}
                className="flex-1 py-2.5 rounded-xl border border-destructive/30 text-destructive text-sm font-semibold hover:bg-destructive/10 transition-colors"
              >
                Reject
              </button>
              <button
                onClick={() => setConfirmAction("approve")}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors"
              >
                Approve & Credit
              </button>
            </div>
          )}

          {confirmAction === "approve" && (
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-4 space-y-3">
              <p className="text-sm font-semibold text-emerald-400">
                Confirm: Credit <span className="font-mono">${dep.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span> to {dep.email}?
              </p>
              <p className="text-xs text-muted-foreground">This will immediately add the amount to the client's trading balance.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmAction(null)} className="flex-1 py-2 rounded-xl border border-border text-sm hover:bg-muted">Cancel</button>
                <button
                  disabled={saving}
                  onClick={() => handleAction("approve")}
                  className="flex-1 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto"/> : "Yes, Approve"}
                </button>
              </div>
            </div>
          )}

          {confirmAction === "reject" && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
              <p className="text-sm font-semibold text-destructive">Reject this deposit request?</p>
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Reason for rejection (optional)</label>
                <input
                  value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                  placeholder="e.g. Transaction not found, invalid details…"
                  className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-1 focus:ring-destructive"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setConfirmAction(null)} className="flex-1 py-2 rounded-xl border border-border text-sm hover:bg-muted">Cancel</button>
                <button
                  disabled={saving}
                  onClick={() => handleAction("reject")}
                  className="flex-1 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold hover:bg-destructive/90 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto"/> : "Confirm Reject"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DepositReviewTab({ deposits, totalDeposited, pendingDeposits, onAction }: {
  deposits: DepositRequest[];
  totalDeposited: number;
  pendingDeposits: number;
  onAction: () => void;
}) {
  const [reviewing, setReviewing] = useState<DepositRequest | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const filtered = deposits.filter(d => filter === "all" || d.status === filter);

  return (
    <div className="space-y-4">
      {reviewing && (
        <DepositReviewModal dep={reviewing} onClose={() => setReviewing(null)} onAction={() => { onAction(); setReviewing(null); }} />
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {[
          { label: "Total Approved",  value: `$${totalDeposited.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, icon: ArrowUpRight,  color: "text-emerald-400", sub: `${deposits.filter(d => d.status === "approved").length} deposits` },
          { label: "Pending Review",  value: pendingDeposits,  icon: Clock,        color: "text-warning",    sub: "awaiting approval" },
          { label: "Rejected",        value: deposits.filter(d => d.status === "rejected").length, icon: XCircle, color: "text-destructive", sub: "declined requests" },
          { label: "Total Requests",  value: deposits.length,  icon: CreditCard,   color: "text-primary",    sub: "all time" },
        ].map(item => (
          <div key={item.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between mb-1.5">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{item.label}</span>
              <item.icon className={`w-4 h-4 ${item.color}`}/>
            </div>
            <div className={`text-2xl font-bold font-mono ${item.color}`}>{item.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{item.sub}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["all", "pending", "approved", "rejected"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              filter === f ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"
            }`}
          >
            {f}
            {f === "pending" && pendingDeposits > 0 && (
              <span className="ml-1.5 text-xs bg-warning/15 text-warning px-1.5 py-0.5 rounded-full font-bold">{pendingDeposits}</span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard className="w-10 h-10 text-muted-foreground mx-auto mb-3"/>
            <p className="font-semibold text-foreground">No {filter === "all" ? "" : filter} deposit requests</p>
            <p className="text-sm text-muted-foreground mt-1">Requests from users will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Client</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Method</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Payment Proof</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Submitted</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(dep => (
                <tr key={dep.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${dep.status === "pending" ? "bg-warning/[0.02]" : ""}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{dep.name !== "—" ? dep.name : dep.email}</p>
                    <p className="text-xs text-muted-foreground">{dep.email}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                    ${dep.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground capitalize">{dep.method}</span>
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    {dep.paymentProof ? (
                      <p className="text-xs text-foreground truncate font-mono">{dep.paymentProof.split("\n")[0]}</p>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Not provided</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      dep.status === "approved" ? "bg-emerald-400/10 text-emerald-400" :
                      dep.status === "rejected"  ? "bg-destructive/10 text-destructive"  :
                      "bg-warning/10 text-warning"
                    }`}>{dep.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(dep.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setReviewing(dep)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors mx-auto ${
                        dep.status === "pending"
                          ? "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                          : "bg-muted text-muted-foreground hover:bg-muted/80 border border-border"
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5"/>
                      {dep.status === "pending" ? "Review" : "View"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}

function WithdrawalReviewModal({ wd, onClose, onAction }: {
  wd: WithdrawalRequest;
  onClose: () => void;
  onAction: () => void;
}) {
  const [rejectNote, setRejectNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | null>(null);

  const handleAction = async (action: "approve" | "reject") => {
    setSaving(true);
    try {
      await adminFetch(`/admin/withdrawals/${wd.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action, notes: rejectNote || undefined }),
      });
      onAction();
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="font-bold text-lg">Review Withdrawal Request</h3>
            <p className="text-xs text-muted-foreground mt-0.5">#{wd.id} · {new Date(wd.createdAt).toLocaleString()}</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground"/></button>
        </div>

        <div className="p-5 space-y-4">
          {/* User + amount */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Client",  value: wd.name !== "—" ? wd.name : wd.email },
              { label: "Email",   value: wd.email },
              { label: "Amount",  value: `$${wd.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}` },
              { label: "Method",  value: wd.method.toUpperCase() },
            ].map(row => (
              <div key={row.label} className="p-3 rounded-xl bg-muted/30 border border-border">
                <div className="text-xs text-muted-foreground mb-0.5">{row.label}</div>
                <div className="text-sm font-semibold text-foreground break-all">{row.value}</div>
              </div>
            ))}
          </div>

          {/* Payout destination details */}
          <div className="rounded-xl border border-violet-400/20 bg-violet-400/5 p-4">
            <div className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ArrowDownRight className="w-3.5 h-3.5"/> Payout Destination Details
            </div>
            {wd.bankDetails ? (
              <pre className="text-sm text-foreground whitespace-pre-wrap font-mono leading-relaxed">
                {wd.bankDetails}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground italic">No payout details provided</p>
            )}
          </div>

          {wd.notes && (
            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Admin Notes</div>
              <p className="text-sm text-foreground">{wd.notes}</p>
            </div>
          )}

          {/* Status badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Status:</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              wd.status === "approved" ? "bg-emerald-400/10 text-emerald-400" :
              wd.status === "rejected" ? "bg-destructive/10 text-destructive" :
              "bg-warning/10 text-warning"
            }`}>{wd.status.toUpperCase()}</span>
          </div>

          {wd.status === "pending" && !confirmAction && (
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmAction("reject")}
                className="flex-1 py-2.5 rounded-xl border border-destructive/30 text-destructive text-sm font-semibold hover:bg-destructive/10 transition-colors"
              >
                Reject &amp; Refund
              </button>
              <button
                onClick={() => setConfirmAction("approve")}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors"
              >
                Approve Payout
              </button>
            </div>
          )}

          {confirmAction === "approve" && (
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-4 space-y-3">
              <p className="text-sm font-semibold text-emerald-400">
                Confirm payout of <span className="font-mono">${wd.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span> to {wd.email}?
              </p>
              <p className="text-xs text-muted-foreground">
                Funds have already been deducted from the client's balance at submission. Approving confirms the payout was sent to the destination account.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmAction(null)} className="flex-1 py-2 rounded-xl border border-border text-sm hover:bg-muted">Cancel</button>
                <button
                  disabled={saving}
                  onClick={() => handleAction("approve")}
                  className="flex-1 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto"/> : "Yes, Mark as Sent"}
                </button>
              </div>
            </div>
          )}

          {confirmAction === "reject" && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
              <p className="text-sm font-semibold text-destructive">Reject &amp; refund this withdrawal?</p>
              <p className="text-xs text-muted-foreground">The held balance will be returned to the client's trading account.</p>
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Reason for rejection (optional)</label>
                <input
                  value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                  placeholder="e.g. Invalid destination details, compliance hold…"
                  className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm focus:outline-none focus:ring-1 focus:ring-destructive"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setConfirmAction(null)} className="flex-1 py-2 rounded-xl border border-border text-sm hover:bg-muted">Cancel</button>
                <button
                  disabled={saving}
                  onClick={() => handleAction("reject")}
                  className="flex-1 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold hover:bg-destructive/90 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto"/> : "Reject & Refund"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WithdrawalReviewTab({ withdrawals, totalWithdrawn, pendingWithdrawals, onAction }: {
  withdrawals: WithdrawalRequest[];
  totalWithdrawn: number;
  pendingWithdrawals: number;
  onAction: () => void;
}) {
  const [reviewing, setReviewing] = useState<WithdrawalRequest | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const filtered = withdrawals.filter(w => filter === "all" || w.status === filter);

  return (
    <div className="space-y-4">
      {reviewing && (
        <WithdrawalReviewModal wd={reviewing} onClose={() => setReviewing(null)} onAction={() => { onAction(); setReviewing(null); }} />
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {[
          { label: "Total Paid Out",  value: `$${totalWithdrawn.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, icon: ArrowDownRight, color: "text-violet-400", sub: `${withdrawals.filter(w => w.status === "approved").length} withdrawals` },
          { label: "Pending Review",  value: pendingWithdrawals,  icon: Clock,         color: "text-warning",    sub: "awaiting admin action" },
          { label: "Rejected",        value: withdrawals.filter(w => w.status === "rejected").length, icon: XCircle, color: "text-destructive", sub: "refunded to clients" },
          { label: "Total Requests",  value: withdrawals.length,  icon: TrendingDown,  color: "text-primary",    sub: "all time" },
        ].map(item => (
          <div key={item.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between mb-1.5">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{item.label}</span>
              <item.icon className={`w-4 h-4 ${item.color}`}/>
            </div>
            <div className={`text-2xl font-bold font-mono ${item.color}`}>{item.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{item.sub}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["all", "pending", "approved", "rejected"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              filter === f ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"
            }`}
          >
            {f}
            {f === "pending" && pendingWithdrawals > 0 && (
              <span className="ml-1.5 text-xs bg-warning/15 text-warning px-1.5 py-0.5 rounded-full font-bold">{pendingWithdrawals}</span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <TrendingDown className="w-10 h-10 text-muted-foreground mx-auto mb-3"/>
            <p className="font-semibold text-foreground">No {filter === "all" ? "" : filter} withdrawal requests</p>
            <p className="text-sm text-muted-foreground mt-1">Requests submitted by users will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Client</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Method</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Payout Details</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Submitted</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(wd => (
                <tr key={wd.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${wd.status === "pending" ? "bg-warning/[0.02]" : ""}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{wd.name !== "—" ? wd.name : wd.email}</p>
                    <p className="text-xs text-muted-foreground">{wd.email}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-violet-400">
                    ${wd.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground capitalize">{wd.method}</span>
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    {wd.bankDetails ? (
                      <p className="text-xs text-foreground truncate font-mono">{wd.bankDetails.split("\n")[0]}</p>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Not provided</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      wd.status === "approved" ? "bg-emerald-400/10 text-emerald-400" :
                      wd.status === "rejected"  ? "bg-destructive/10 text-destructive"  :
                      "bg-warning/10 text-warning"
                    }`}>{wd.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(wd.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setReviewing(wd)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors mx-auto ${
                        wd.status === "pending"
                          ? "bg-violet-400/10 text-violet-400 hover:bg-violet-400/20 border border-violet-400/20"
                          : "bg-muted text-muted-foreground hover:bg-muted/80 border border-border"
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5"/>
                      {wd.status === "pending" ? "Review" : "View"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}

function CryptoDepositReviewModal({ dep, onClose, onAction }: {
  dep: AdminCryptoDeposit;
  onClose: () => void;
  onAction: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | null>(null);

  const handleAction = async (action: "approve" | "reject") => {
    setSaving(true);
    try {
      await adminFetch(`/admin/crypto-deposits/${dep.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      onAction();
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="font-bold text-lg">Review Crypto Deposit</h3>
            <p className="text-xs text-muted-foreground mt-0.5">#{dep.id} · {new Date(dep.createdAt).toLocaleString()}</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground"/></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Client",  value: dep.name !== "—" ? dep.name : dep.email },
              { label: "Email",   value: dep.email },
              { label: "Amount",  value: `${dep.amountUsdt.toFixed(2)} USDT` },
              { label: "Network", value: dep.network },
            ].map(row => (
              <div key={row.label} className="p-3 rounded-xl bg-muted/30 border border-border">
                <div className="text-xs text-muted-foreground mb-0.5">{row.label}</div>
                <div className="text-sm font-semibold text-foreground break-all">{row.value}</div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-violet-400/20 bg-violet-400/5 p-4 space-y-2">
            <div className="text-xs font-semibold text-violet-400 uppercase tracking-wider flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5"/> On-chain Details
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">From Wallet</div>
              <div className="text-xs font-mono text-foreground break-all">{dep.fromWallet}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">TX Hash</div>
              <a
                href={dep.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-primary hover:underline flex items-center gap-1 break-all"
              >
                {dep.txHash}
                <ExternalLink className="w-3 h-3 shrink-0"/>
              </a>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Status:</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              dep.status === "approved" ? "bg-emerald-400/10 text-emerald-400" :
              dep.status === "rejected" ? "bg-destructive/10 text-destructive" :
              "bg-warning/10 text-warning"
            }`}>{dep.status.toUpperCase()}</span>
          </div>

          {dep.status === "pending" && !confirmAction && (
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmAction("reject")}
                className="flex-1 py-2.5 rounded-xl border border-destructive/30 text-destructive text-sm font-semibold hover:bg-destructive/10 transition-colors"
              >
                Reject
              </button>
              <button
                onClick={() => setConfirmAction("approve")}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors"
              >
                Approve &amp; Credit
              </button>
            </div>
          )}

          {confirmAction === "approve" && (
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-4 space-y-3">
              <p className="text-sm font-semibold text-emerald-400">
                Credit <span className="font-mono">{dep.amountUsdt.toFixed(2)} USDT</span> to {dep.email}?
              </p>
              <p className="text-xs text-muted-foreground">This will immediately add the funds to the client's trading balance.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmAction(null)} className="flex-1 py-2 rounded-xl border border-border text-sm hover:bg-muted">Cancel</button>
                <button
                  disabled={saving}
                  onClick={() => handleAction("approve")}
                  className="flex-1 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto"/> : "Yes, Approve"}
                </button>
              </div>
            </div>
          )}

          {confirmAction === "reject" && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
              <p className="text-sm font-semibold text-destructive">Reject this on-chain deposit?</p>
              <p className="text-xs text-muted-foreground">No funds will be credited. The TX record will be marked as rejected.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmAction(null)} className="flex-1 py-2 rounded-xl border border-border text-sm hover:bg-muted">Cancel</button>
                <button
                  disabled={saving}
                  onClick={() => handleAction("reject")}
                  className="flex-1 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold hover:bg-destructive/90 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto"/> : "Confirm Reject"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CryptoDepositsTab({ deposits, onAction }: {
  deposits: AdminCryptoDeposit[];
  onAction: () => void;
}) {
  const [reviewing, setReviewing] = useState<AdminCryptoDeposit | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const filtered = deposits.filter(d => filter === "all" || d.status === filter);
  const pendingCount  = deposits.filter(d => d.status === "pending").length;
  const approvedCount = deposits.filter(d => d.status === "approved").length;
  const totalUsdt     = deposits.filter(d => d.status === "approved").reduce((s, d) => s + d.amountUsdt, 0);

  return (
    <div className="space-y-4">
      {reviewing && (
        <CryptoDepositReviewModal dep={reviewing} onClose={() => setReviewing(null)} onAction={() => { onAction(); setReviewing(null); }} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {[
          { label: "Pending Review",   value: pendingCount,          icon: Clock,        color: "text-warning",      sub: "awaiting approval" },
          { label: "Approved & Credited", value: approvedCount,      icon: CheckCircle,  color: "text-emerald-400",  sub: "funds credited" },
          { label: "Total USDT Credited", value: `${totalUsdt.toFixed(2)} USDT`, icon: Wallet, color: "text-primary", sub: "approved deposits" },
          { label: "Total Deposits",   value: deposits.length,       icon: Hash,         color: "text-muted-foreground", sub: "all time" },
        ].map(item => (
          <div key={item.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between mb-1.5">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{item.label}</span>
              <item.icon className={`w-4 h-4 ${item.color}`}/>
            </div>
            <div className={`text-2xl font-bold font-mono ${item.color}`}>{item.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{item.sub}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 border-b border-border">
        {(["all", "pending", "approved", "rejected"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              filter === f ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"
            }`}
          >
            {f}
            {f === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 text-xs bg-warning/15 text-warning px-1.5 py-0.5 rounded-full font-bold">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-3"/>
            <p className="font-semibold text-foreground">No {filter === "all" ? "" : filter} crypto deposits</p>
            <p className="text-sm text-muted-foreground mt-1">On-chain deposits detected by the scanner will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Client</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Network</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">TX Hash</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Detected</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(dep => (
                  <tr key={dep.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${dep.status === "pending" ? "bg-warning/[0.02]" : ""}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{dep.name !== "—" ? dep.name : dep.email}</p>
                      <p className="text-xs text-muted-foreground">{dep.email}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                      {dep.amountUsdt.toFixed(2)} USDT
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${dep.network === "BSC" ? "bg-amber-400/10 text-amber-400" : "bg-violet-400/10 text-violet-400"}`}>
                        {dep.network}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <a
                        href={dep.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-primary hover:underline flex items-center gap-1 truncate"
                      >
                        {dep.txHash.slice(0, 10)}…{dep.txHash.slice(-6)}
                        <ExternalLink className="w-3 h-3 shrink-0"/>
                      </a>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        dep.status === "approved" ? "bg-emerald-400/10 text-emerald-400" :
                        dep.status === "rejected" ? "bg-destructive/10 text-destructive"  :
                        "bg-warning/10 text-warning"
                      }`}>{dep.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(dep.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setReviewing(dep)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors mx-auto ${
                          dep.status === "pending"
                            ? "bg-warning/10 text-warning hover:bg-warning/20 border border-warning/20"
                            : "bg-muted text-muted-foreground hover:bg-muted/80 border border-border"
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5"/>
                        {dep.status === "pending" ? "Review" : "View"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function EditPositionModal({ pos, onClose, onSave }: { pos: AdminOrder; onClose: () => void; onSave: () => void }) {
  const [sl, setSl] = useState(pos.stopLoss != null ? String(pos.stopLoss) : "");
  const [tp, setTp] = useState(pos.takeProfit != null ? String(pos.takeProfit) : "");
  const [openPrice, setOpenPrice] = useState(String(pos.openPrice));
  const [volume, setVolume] = useState(String(pos.volume));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      await adminFetch(`/admin/positions/${pos.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          sl: sl !== "" ? parseFloat(sl) : null,
          tp: tp !== "" ? parseFloat(tp) : null,
          openPrice: openPrice !== "" ? parseFloat(openPrice) : undefined,
          volume: volume !== "" ? parseFloat(volume) : undefined,
        }),
      });
      toast({ title: "Position updated", description: `${pos.symbol} #${pos.id} fields saved.` });
      onSave();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save";
      setError(msg);
      toast({ title: "Update failed", description: msg, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="font-bold text-lg">Edit Open Position</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{pos.symbol} · #{pos.id}</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground"/></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Open Price", value: openPrice, set: setOpenPrice },
              { label: "Volume (lots)", value: volume, set: setVolume },
              { label: "Stop Loss", value: sl, set: setSl },
              { label: "Take Profit", value: tp, set: setTp },
            ].map(({ label, value, set }) => (
              <div key={label}>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">{label}</label>
                <input
                  type="number" step="any" value={value} onChange={e => set(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-input border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="—"
                />
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-3 p-5 pt-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-50">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditOrderModal({ order, onClose, onSave }: { order: AdminOrder; onClose: () => void; onSave: () => void }) {
  const [closePrice, setClosePrice] = useState(order.closePrice != null ? String(order.closePrice) : "");
  const [profit, setProfit] = useState(order.profit != null ? String(order.profit) : "");
  const [commission, setCommission] = useState(String(order.commission));
  const [swap, setSwap] = useState(String(order.swap));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      const result = await adminFetch(`/admin/orders/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          closePrice: closePrice !== "" ? parseFloat(closePrice) : undefined,
          profit: profit !== "" ? parseFloat(profit) : undefined,
          commission: commission !== "" ? parseFloat(commission) : undefined,
          swap: swap !== "" ? parseFloat(swap) : undefined,
        }),
      });
      toast({ title: "Order updated", description: `${order.symbol} #${order.id} fields saved.` });
      if (result?.balanceDelta !== undefined && result.balanceDelta !== 0) {
        const sign = result.balanceDelta > 0 ? "+" : "";
        toast({ title: "Balance adjusted", description: `User balance adjusted by ${sign}$${Number(result.balanceDelta).toFixed(2)}` });
      }
      onSave();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save";
      setError(msg);
      toast({ title: "Update failed", description: msg, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="font-bold text-lg">Edit Closed Order</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{order.symbol} · #{order.id} · closed {order.closeTime ? new Date(order.closeTime).toLocaleString() : "—"}</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground"/></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Close Price", value: closePrice, set: setClosePrice },
              { label: "Profit ($)", value: profit, set: setProfit },
              { label: "Commission ($)", value: commission, set: setCommission },
              { label: "Swap ($)", value: swap, set: setSwap },
            ].map(({ label, value, set }) => (
              <div key={label}>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">{label}</label>
                <input
                  type="number" step="any" value={value} onChange={e => set(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-input border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-3 p-5 pt-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-50">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ForceCloseModal({ pos, onClose, onSave }: { pos: AdminOrder; onClose: () => void; onSave: () => void }) {
  const [useCustom, setUseCustom] = useState(false);
  const [customPrice, setCustomPrice] = useState(pos.currentPrice != null ? String(pos.currentPrice) : String(pos.openPrice));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = async () => {
    setSaving(true); setError(null);
    try {
      const result = await adminFetch(`/admin/positions/${pos.id}`, {
        method: "DELETE",
        body: JSON.stringify(useCustom && customPrice !== "" ? { customClosePrice: parseFloat(customPrice) } : {}),
      });
      const pnl = typeof result?.pnl === "number" ? result.pnl : null;
      toast({
        title: "Position force-closed",
        description: `${pos.symbol} #${pos.id} closed${pnl != null ? ` · P&L ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}` : ""}.`,
      });
      onSave();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to close position";
      setError(msg);
      toast({ title: "Close failed", description: msg, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="font-bold text-lg">Force Close Position</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{pos.direction.toUpperCase()} {pos.symbol} · {pos.volume} lots · #{pos.id}</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground"/></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Open price</span><span className="font-mono font-semibold">{formatPrice(pos.openPrice, pos.symbol)}</span></div>
            {pos.currentPrice != null && (
              <div className="flex justify-between"><span className="text-muted-foreground">Current price</span><span className="font-mono font-semibold">{formatPrice(pos.currentPrice, pos.symbol)}</span></div>
            )}
          </div>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={useCustom} onChange={e => setUseCustom(e.target.checked)} className="w-4 h-4 accent-primary"/>
            <span className="text-sm font-medium">Use custom close price</span>
          </label>
          {useCustom && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Custom Close Price</label>
              <input
                type="number" step="any" value={customPrice} onChange={e => setCustomPrice(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-input border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}
          {!useCustom && (
            <p className="text-xs text-muted-foreground">Position will be closed at the current live market price.</p>
          )}
        </div>
        <div className="flex gap-3 p-5 pt-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted">Cancel</button>
          <button onClick={handleClose} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold hover:bg-destructive/90 disabled:opacity-50">
            {saving ? "Closing…" : "Force Close"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Admin() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  useEffect(() => {
    _adminGetToken = () => getTokenRef.current();
    return () => { _adminGetToken = null; };
  }, []);
  const { prices } = useWebSocket();
  const [tab, setTab] = useState<"overview" | "users" | "positions" | "orders" | "prices" | "kyc" | "deposits" | "withdrawals" | "crypto-deposits" | "partners">("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [positions, setPositions] = useState<AdminPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [editBalanceUser, setEditBalanceUser] = useState<AdminUser | null>(null);
  const [kycReviewUser, setKycReviewUser] = useState<AdminUser | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [deposits, setDeposits]             = useState<DepositRequest[]>([]);
  const [withdrawals, setWithdrawals]       = useState<WithdrawalRequest[]>([]);
  const [cryptoDeposits, setCryptoDeposits] = useState<AdminCryptoDeposit[]>([]);
  const [sortPos, setSortPos] = useState<"pnl" | "time">("time");
  const [userSearch, setUserSearch] = useState("");
  const [kycFilter, setKycFilter] = useState<"all" | "pending" | "verified" | "unverified">("all");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [partners, setPartners] = useState<AdminPartner[]>([]);
  const [createPartnerOpen, setCreatePartnerOpen] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersUserFilter, setOrdersUserFilter] = useState<string | null>(null);
  const [ordersStatusFilter, setOrdersStatusFilter] = useState<"all" | "open" | "closed">("all");
  const [ordersDirectionFilter, setOrdersDirectionFilter] = useState<"all" | "buy" | "sell">("all");
  const [ordersFromDate, setOrdersFromDate] = useState("");
  const [ordersToDate, setOrdersToDate] = useState("");
  const [ordersSearch, setOrdersSearch] = useState("");
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [editingPosition, setEditingPosition] = useState<AdminOrder | null>(null);
  const [editingOrder, setEditingOrder] = useState<AdminOrder | null>(null);
  const [forceClosePos, setForceClosePos] = useState<AdminOrder | null>(null);

  const [metaReloaded, setMetaReloaded] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) { setMetaReloaded(true); return; }
    setMetaReloaded(true); // Email-based check — no metadata reload needed
  }, [isLoaded, user?.id]);

  const ADMIN_EMAIL = "shamhar07@gmail.com";
  const userEmail = user?.emailAddresses?.[0]?.emailAddress ?? "";
  const isAdmin = isLoaded && (userEmail === ADMIN_EMAIL || user?.publicMetadata?.role === "admin");

  const fetchOrders = useCallback(async (opts?: { userId?: string; status?: string; symbol?: string; direction?: string; from?: string; to?: string }) => {
    setOrdersLoading(true);
    try {
      const params = new URLSearchParams();
      if (opts?.userId) params.set("userId", opts.userId);
      if (opts?.status && opts.status !== "all") params.set("status", opts.status);
      if (opts?.symbol) params.set("symbol", opts.symbol);
      if (opts?.direction && opts.direction !== "all") params.set("direction", opts.direction);
      if (opts?.from) params.set("from", opts.from);
      if (opts?.to) params.set("to", opts.to);
      const data = await adminFetch(`/admin/orders?${params.toString()}`);
      setOrders(Array.isArray(data.items) ? data.items : []);
      setOrdersTotal(typeof data.total === "number" ? data.total : 0);
    } catch {
      setOrders([]); setOrdersTotal(0);
    } finally { setOrdersLoading(false); }
  }, []);

  const fetchAll = useCallback(async () => {
    if (!isLoaded || !userEmail) return;
    setLoading(true);
    setFetchError(null);
    try {
      const [s, u, p, d, w, cd, pa] = await Promise.all([
        adminFetch("/admin/stats"),
        adminFetch("/admin/users"),
        adminFetch("/admin/positions"),
        adminFetch("/admin/deposits"),
        adminFetch("/admin/withdrawals"),
        adminFetch("/admin/crypto-deposits"),
        adminFetch("/admin/partners"),
      ]);
      setStats(s); setUsers(u); setPositions(p); setDeposits(d); setWithdrawals(w); setCryptoDeposits(cd);
      setPartners(Array.isArray(pa) ? pa : []);
      setLastUpdated(new Date());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setFetchError(`Failed to load admin data: ${msg}`);
    }
    finally { setLoading(false); }
  }, [isAdmin, isLoaded, userEmail]);

  useEffect(() => {
    document.title = "Admin Panel | VelozTrade";
    if (isAdmin) { fetchAll(); }
  }, [isAdmin, fetchAll]);

  useEffect(() => {
    if (tab === "orders" && isAdmin) {
      fetchOrders({
        userId: ordersUserFilter ?? undefined,
        status: ordersStatusFilter,
        symbol: ordersSearch || undefined,
        direction: ordersDirectionFilter,
        from: ordersFromDate || undefined,
        to: ordersToDate || undefined,
      });
    }
  }, [tab, isAdmin, ordersUserFilter, ordersStatusFilter, ordersSearch, ordersDirectionFilter, ordersFromDate, ordersToDate, fetchOrders]);

  if (!isLoaded || !metaReloaded) return <div className="flex items-center justify-center min-h-[70vh]"><RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!isAdmin) return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 text-center">
      <ShieldOff className="w-12 h-12 text-destructive/50" />
      <p className="text-lg font-semibold text-foreground">Access Denied</p>
      <p className="text-sm text-muted-foreground">You don't have permission to view this page.</p>
    </div>
  );

  const sortedPositions = [...positions].sort((a, b) =>
    sortPos === "pnl" ? a.pnl - b.pnl : new Date(b.openTime).getTime() - new Date(a.openTime).getTime()
  );
  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);

  const filteredUsers = users.filter(u => {
    const matchSearch = !userSearch || u.email.toLowerCase().includes(userSearch.toLowerCase()) || u.name.toLowerCase().includes(userSearch.toLowerCase());
    const matchKyc = kycFilter === "all" || u.kycStatus === kycFilter;
    return matchSearch && matchKyc;
  });

  const kycPending = users.filter(u => u.kycStatus === "pending");
  const kycVerified = users.filter(u => u.kycStatus === "verified");
  const pendingDeposits       = deposits.filter(d => d.status === "pending").length;
  const totalDeposited        = deposits.filter(d => d.status === "approved").reduce((s, d) => s + d.amount, 0);
  const pendingWithdrawals    = withdrawals.filter(w => w.status === "pending").length;
  const totalWithdrawn        = withdrawals.filter(w => w.status === "approved").reduce((s, w) => s + w.amount, 0);
  const pendingCryptoDeposits = cryptoDeposits.filter(d => d.status === "pending").length;

  const TABS = [
    { id: "overview",        label: "Overview",                                                                         icon: PieChart    },
    { id: "users",           label: `Users (${stats?.accounts ?? "…"})`,                                               icon: Users       },
    { id: "positions",       label: `Positions (${positions.length})`,                                                  icon: BarChart2   },
    { id: "orders",          label: `Orders (${ordersTotal})`,                                                          icon: ListOrdered },
    { id: "kyc",             label: `KYC Review ${kycPending.length > 0 ? `(${kycPending.length})` : ""}`,             icon: UserCheck   },
    { id: "deposits",        label: `Deposits${pendingDeposits > 0 ? ` (${pendingDeposits})` : ""}`,                   icon: CreditCard  },
    { id: "crypto-deposits", label: `Crypto Deposits${pendingCryptoDeposits > 0 ? ` (${pendingCryptoDeposits})` : ""}`, icon: Wallet     },
    { id: "withdrawals",     label: `Withdrawals${pendingWithdrawals > 0 ? ` (${pendingWithdrawals})` : ""}`,           icon: TrendingDown },
    { id: "prices",          label: "Live Prices",                                                                      icon: Activity    },
    { id: "partners",        label: `Partners (${partners.length})`,                                                     icon: Handshake   },
  ] as const;

  return (
    <div className="p-4 md:p-6 max-w-screen-xl mx-auto space-y-5 pb-20">
      {editBalanceUser && (
        <EditBalanceModal user={editBalanceUser} onClose={() => setEditBalanceUser(null)} onSave={fetchAll} />
      )}
      {kycReviewUser && (
        <KycReviewModal user={kycReviewUser} onClose={() => setKycReviewUser(null)} onSave={fetchAll} />
      )}
      {createPartnerOpen && (
        <CreatePartnerModal onClose={() => setCreatePartnerOpen(false)} onSave={fetchAll} />
      )}
      {selectedPartnerId !== null && (
        <PartnerDetailPanel
          partnerId={selectedPartnerId}
          onClose={() => setSelectedPartnerId(null)}
          onSave={fetchAll}
        />
      )}
      {editingPosition && (
        <EditPositionModal
          pos={editingPosition}
          onClose={() => setEditingPosition(null)}
          onSave={() => { setEditingPosition(null); fetchOrders({ userId: ordersUserFilter ?? undefined, status: ordersStatusFilter, symbol: ordersSearch || undefined }); }}
        />
      )}
      {editingOrder && (
        <EditOrderModal
          order={editingOrder}
          onClose={() => setEditingOrder(null)}
          onSave={() => { setEditingOrder(null); fetchOrders({ userId: ordersUserFilter ?? undefined, status: ordersStatusFilter, symbol: ordersSearch || undefined }); }}
        />
      )}
      {forceClosePos && (
        <ForceCloseModal
          pos={forceClosePos}
          onClose={() => setForceClosePos(null)}
          onSave={() => {
            setForceClosePos(null);
            fetchAll();
            fetchOrders({ userId: ordersUserFilter ?? undefined, status: ordersStatusFilter, symbol: ordersSearch || undefined });
          }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Admin Panel</h1>
            <p className="text-xs text-muted-foreground">
              {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Loading…"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {kycPending.length > 0 && (
            <button
              onClick={() => setTab("kyc")}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/20 text-xs text-warning font-semibold animate-pulse"
            >
              <Bell className="w-3.5 h-3.5"/>
              {kycPending.length} KYC pending
            </button>
          )}
          <button
            onClick={fetchAll} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error banner */}
      {fetchError && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Could not load admin data</p>
            <p className="text-xs mt-0.5 opacity-80">{fetchError}</p>
          </div>
          <button onClick={fetchAll} className="text-xs underline opacity-70 hover:opacity-100 whitespace-nowrap">Try again</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id} onClick={() => setTab(t.id as any)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              tab === t.id ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"
            }`}
          >
            <t.icon className="w-3.5 h-3.5"/>
            {t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {tab === "overview" && (
        <div className="space-y-5">

          {/* ── Row 1: Key metrics ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Total Users"     value={stats?.accounts ?? "—"}   icon={Users}      color="text-primary" />
            <StatCard label="Open Positions"  value={stats?.openPositions ?? "—"} icon={BarChart2}  color="text-emerald-400" />
            <StatCard label="Total Orders"    value={stats?.totalOrders ?? "—"} icon={Activity}   color="text-amber-400" />
            <StatCard
              label="Platform AUM"
              value={stats ? `$${stats.totalBalance.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
              sub="combined balances"
              icon={Database} color="text-primary"
            />
            <StatCard
              label="Open P&L"
              value={`${totalPnl >= 0 ? "+" : ""}$${Math.abs(totalPnl).toFixed(0)}`}
              sub="all open positions"
              icon={totalPnl >= 0 ? TrendingUp : TrendingDown}
              color={totalPnl >= 0 ? "text-emerald-400" : "text-destructive"}
            />
            <StatCard label="Live Connections" value={stats?.wsClients ?? "—"} sub="WebSocket clients" icon={Wifi} color="text-violet-400" />
          </div>

          {/* ── Row 2: Financial summary ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: "Total Deposited",
                value: `$${totalDeposited.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
                sub: `${deposits.filter(d => d.status === "completed" || d.status === "approved").length} transactions`,
                icon: ArrowUpRight, color: "text-emerald-400", border: "border-emerald-400/20 bg-emerald-400/5",
              },
              {
                label: "Total Withdrawn",
                value: `$${totalWithdrawn.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
                sub: `${withdrawals.filter(w => w.status === "approved").length} approved`,
                icon: ArrowDownRight, color: "text-destructive", border: "border-destructive/20 bg-destructive/5",
              },
              {
                label: "Net Inflow",
                value: `${(totalDeposited - totalWithdrawn) >= 0 ? "+" : ""}$${Math.abs(totalDeposited - totalWithdrawn).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
                sub: "deposited minus withdrawn",
                icon: TrendingUp, color: (totalDeposited - totalWithdrawn) >= 0 ? "text-emerald-400" : "text-destructive",
                border: "border-border bg-card",
              },
              {
                label: "Pending Actions",
                value: pendingDeposits + pendingWithdrawals + kycPending.length,
                sub: `${pendingDeposits} dep · ${pendingWithdrawals} wdl · ${kycPending.length} kyc`,
                icon: Clock,
                color: (pendingDeposits + pendingWithdrawals + kycPending.length) > 0 ? "text-warning" : "text-muted-foreground",
                border: (pendingDeposits + pendingWithdrawals + kycPending.length) > 0 ? "border-warning/20 bg-warning/5" : "border-border bg-card",
              },
            ].map(item => (
              <div key={item.label} className={`rounded-xl border ${item.border} p-4`}>
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{item.label}</p>
                  <item.icon className={`w-4 h-4 ${item.color}`}/>
                </div>
                <p className={`text-2xl font-bold tabular-nums ${item.color}`}>{item.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.sub}</p>
              </div>
            ))}
          </div>

          {/* ── Row 3: Quick actions + KYC + Account breakdown ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Quick actions */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary"/> Quick Actions
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => setTab("kyc")}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${kycPending.length > 0 ? "border-warning/30 bg-warning/5 text-warning hover:bg-warning/10" : "border-border text-muted-foreground hover:bg-muted"}`}
                >
                  <span className="flex items-center gap-2"><UserCheck className="w-3.5 h-3.5"/> Review KYC</span>
                  {kycPending.length > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-warning/15">{kycPending.length} pending</span>}
                </button>
                <button
                  onClick={() => setTab("deposits")}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${pendingDeposits > 0 ? "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10" : "border-border text-muted-foreground hover:bg-muted"}`}
                >
                  <span className="flex items-center gap-2"><CreditCard className="w-3.5 h-3.5"/> Deposits</span>
                  {pendingDeposits > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/15">{pendingDeposits} pending</span>}
                </button>
                <button
                  onClick={() => setTab("crypto-deposits")}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${pendingCryptoDeposits > 0 ? "border-violet-400/30 bg-violet-400/5 text-violet-400 hover:bg-violet-400/10" : "border-border text-muted-foreground hover:bg-muted"}`}
                >
                  <span className="flex items-center gap-2"><Wallet className="w-3.5 h-3.5"/> Crypto Deposits</span>
                  {pendingCryptoDeposits > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-400/15">{pendingCryptoDeposits} pending</span>}
                </button>
                <button
                  onClick={() => setTab("withdrawals")}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${pendingWithdrawals > 0 ? "border-amber-400/30 bg-amber-400/5 text-amber-400 hover:bg-amber-400/10" : "border-border text-muted-foreground hover:bg-muted"}`}
                >
                  <span className="flex items-center gap-2"><Upload className="w-3.5 h-3.5"/> Withdrawals</span>
                  {pendingWithdrawals > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-400/15">{pendingWithdrawals} pending</span>}
                </button>
                <button
                  onClick={() => setTab("users")}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium border border-border text-muted-foreground hover:bg-muted transition-all"
                >
                  <span className="flex items-center gap-2"><Users className="w-3.5 h-3.5"/> Manage Users</span>
                  <span className="text-xs text-muted-foreground">{stats?.accounts ?? 0} total</span>
                </button>
                <button
                  onClick={() => setTab("positions")}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium border border-border text-muted-foreground hover:bg-muted transition-all"
                >
                  <span className="flex items-center gap-2"><BarChart2 className="w-3.5 h-3.5"/> Open Positions</span>
                  <span className="text-xs text-muted-foreground">{positions.length} open</span>
                </button>
              </div>
            </div>

            {/* KYC Summary */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-primary"/> KYC Summary
              </h3>
              <div className="space-y-3">
                {[
                  { label: "Verified",       count: kycVerified.length,                                  color: "text-emerald-400 bg-emerald-400/10", icon: CheckCircle },
                  { label: "Pending Review", count: kycPending.length,                                   color: "text-warning bg-warning/10",         icon: Clock       },
                  { label: "Unverified",     count: users.filter(u => u.kycStatus === "unverified").length, color: "text-muted-foreground bg-muted/40",  icon: XCircle     },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <item.icon className={`w-3.5 h-3.5 ${item.color.split(" ")[0]}`}/>
                      <span className="text-muted-foreground">{item.label}</span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.color}`}>{item.count}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border/50 space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Verification rate</span>
                  <span className="font-semibold text-foreground">
                    {users.length > 0 ? Math.round((kycVerified.length / users.length) * 100) : 0}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all"
                    style={{ width: `${users.length > 0 ? (kycVerified.length / users.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
              {kycPending.length > 0 && (
                <button onClick={() => setTab("kyc")} className="mt-3 w-full py-2 rounded-xl bg-warning/10 border border-warning/20 text-warning text-xs font-semibold hover:bg-warning/20 transition-colors">
                  Review {kycPending.length} pending →
                </button>
              )}
            </div>

            {/* Account type breakdown */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-primary"/> Account Breakdown
              </h3>
              <div className="space-y-3">
                {[
                  { label: "Live (Real) Accounts",  count: users.filter(u => u.accountType === "real").length,  color: "text-primary bg-primary/10",       bar: "bg-primary"     },
                  { label: "Demo Accounts",          count: users.filter(u => u.accountType === "demo").length,  color: "text-violet-400 bg-violet-400/10",  bar: "bg-violet-400"  },
                  { label: "Admin Users",            count: users.filter(u => u.isAdmin).length,                 color: "text-amber-400 bg-amber-400/10",    bar: "bg-amber-400"   },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.color}`}>{item.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.bar} transition-all`}
                        style={{ width: `${users.length > 0 ? (item.count / users.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded-xl bg-muted/30 border border-border text-center">
                  <div className="text-lg font-bold font-mono text-foreground">
                    {users.length > 0 ? `$${(users.reduce((s, u) => s + u.balance, 0) / users.length).toFixed(0)}` : "—"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Avg Balance</div>
                </div>
                <div className="p-2.5 rounded-xl bg-muted/30 border border-border text-center">
                  <div className="text-lg font-bold font-mono text-foreground">{stats?.symbolsTracked ?? "—"}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Live Feeds</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Row 4: Recent transactions + P&L leaderboard ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Recent transactions */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary"/> Recent Transactions
              </h3>
              {(() => {
                const recentDeps = deposits.slice(0, 5).map(d => ({ ...d, kind: "deposit" as const }));
                const recentWdl  = withdrawals.slice(0, 5).map(w => ({ ...w, kind: "withdrawal" as const }));
                const combined   = [...recentDeps, ...recentWdl]
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .slice(0, 8);
                if (combined.length === 0) return (
                  <div className="py-8 text-center text-muted-foreground text-sm">No transactions yet</div>
                );
                return (
                  <div className="space-y-2">
                    {combined.map(tx => {
                      const isDeposit = tx.kind === "deposit";
                      return (
                        <div key={`${tx.kind}-${tx.id}`} className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isDeposit ? "bg-emerald-400/10" : "bg-amber-400/10"}`}>
                            {isDeposit
                              ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400"/>
                              : <ArrowDownRight className="w-3.5 h-3.5 text-amber-400"/>
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{tx.name !== "—" ? tx.name : tx.email}</p>
                            <p className="text-xs text-muted-foreground capitalize">{isDeposit ? "Deposit" : "Withdrawal"} · {tx.method}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-bold ${isDeposit ? "text-emerald-400" : "text-amber-400"}`}>
                              {isDeposit ? "+" : "-"}${tx.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </p>
                            <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString()}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                            tx.status === "approved" || tx.status === "completed" ? "bg-emerald-400/10 text-emerald-400" :
                            tx.status === "pending"  ? "bg-warning/10 text-warning" :
                            "bg-destructive/10 text-destructive"
                          }`}>{tx.status}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* P&L leaderboard */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <Hash className="w-4 h-4 text-primary"/> P&L Leaderboard
              </h3>
              <div className="space-y-1 mb-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3 text-emerald-400"/> Top Winners
                </div>
                {positions.filter(p => p.pnl > 0).sort((a, b) => b.pnl - a.pnl).slice(0, 4).map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-muted/20">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                      <span className="text-sm font-mono font-semibold text-foreground">{p.symbol}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${p.direction === "buy" ? "bg-emerald-400/10 text-emerald-400" : "bg-destructive/10 text-destructive"}`}>{p.direction.toUpperCase()}</span>
                    </div>
                    <span className="text-emerald-400 font-bold text-sm">+${p.pnl.toFixed(2)}</span>
                  </div>
                ))}
                {positions.filter(p => p.pnl > 0).length === 0 && <p className="text-muted-foreground text-xs px-3">No profitable positions</p>}
              </div>
              <div className="border-t border-border/50 pt-3 space-y-1">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <TrendingDown className="w-3 h-3 text-destructive"/> Biggest Drawdowns
                </div>
                {positions.filter(p => p.pnl < 0).sort((a, b) => a.pnl - b.pnl).slice(0, 4).map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-muted/20">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                      <span className="text-sm font-mono font-semibold text-foreground">{p.symbol}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${p.direction === "buy" ? "bg-emerald-400/10 text-emerald-400" : "bg-destructive/10 text-destructive"}`}>{p.direction.toUpperCase()}</span>
                    </div>
                    <span className="text-destructive font-bold text-sm">${p.pnl.toFixed(2)}</span>
                  </div>
                ))}
                {positions.filter(p => p.pnl < 0).length === 0 && <p className="text-muted-foreground text-xs px-3">No losing positions</p>}
              </div>
            </div>
          </div>

          {/* ── Row 5: Platform health ── */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary"/> Platform Health
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: "API Status",       value: "Online",                icon: Globe,    color: "text-emerald-400", dot: "bg-emerald-400" },
                { label: "Price Feeds",      value: `${stats?.symbolsTracked ?? 0} active`, icon: Wifi,    color: "text-emerald-400", dot: "bg-emerald-400" },
                { label: "WS Connections",   value: `${stats?.wsClients ?? 0} live`,       icon: Activity, color: "text-primary",     dot: "bg-primary"     },
                { label: "Live Accounts",    value: users.filter(u => u.accountType === "real").length, icon: Lock,     color: "text-primary",     dot: "bg-primary"     },
                { label: "Demo Accounts",    value: users.filter(u => u.accountType === "demo").length, icon: Unlock,   color: "text-violet-400",  dot: "bg-violet-400"  },
                { label: "Total Positions",  value: positions.length,        icon: Layers,   color: "text-amber-400",   dot: "bg-amber-400"   },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-xl bg-muted/30 border border-border flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`}/>
                    <item.icon className={`w-3.5 h-3.5 ${item.color}`}/>
                  </div>
                  <div className={`text-lg font-bold font-mono ${item.color}`}>{item.value}</div>
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* USERS TAB */}
      {tab === "users" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground"/>
              <input
                value={userSearch} onChange={e => setUserSearch(e.target.value)}
                placeholder="Search by email or name…"
                className="w-full pl-9 pr-3 py-2 text-sm bg-input border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex gap-1.5">
              {(["all", "pending", "verified", "unverified"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setKycFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${kycFilter === f ? "bg-primary/15 text-primary border border-primary/30" : "border border-border text-muted-foreground hover:bg-muted"}`}
                >
                  {f}
                </button>
              ))}
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted">
              <Download className="w-3.5 h-3.5"/> Export CSV
            </button>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">User</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Balance</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Leverage</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Account</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">KYC</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Role</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Joined</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <React.Fragment key={u.clerkUserId}>
                  <tr
                    className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => setExpandedUserId(expandedUserId === u.clerkUserId ? null : u.clerkUserId)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {u.imageUrl
                          ? <img src={u.imageUrl} className="w-8 h-8 rounded-full object-cover" />
                          : <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">{u.email[0]?.toUpperCase()}</div>
                        }
                        <div>
                          <p className="font-medium text-foreground">{u.name !== "—" ? u.name : u.email}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                        {expandedUserId === u.clerkUserId
                          ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground ml-1" />
                          : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-1" />
                        }
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                      <div>${u.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                      <div className={`text-xs font-normal ${u.equity > u.balance ? "text-emerald-400" : u.equity < u.balance ? "text-red-400" : "text-muted-foreground"}`}>
                        Eq ${u.equity.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <LeverageEditor user={u} onSave={fetchAll} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.accountType === "real" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      }`}>{u.accountType === "real" ? "Live" : "Demo"}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.kycStatus === "verified" ? "bg-emerald-400/10 text-emerald-400" :
                        u.kycStatus === "pending" ? "bg-warning/10 text-warning" :
                        "bg-muted text-muted-foreground"
                      }`}>{u.kycStatus}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.isAdmin ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      }`}>{u.isAdmin ? "admin" : "user"}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          title="Edit balance"
                          onClick={() => setEditBalanceUser(u)}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title="Review KYC"
                          onClick={() => setKycReviewUser(u)}
                          className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title="Reset to $10,000"
                          onClick={async () => {
                            if (!confirm(`Reset ${u.email}'s balance to $10,000 and close all positions?`)) return;
                            await adminFetch(`/admin/users/${u.clerkUserId}/reset-balance`, { method: "POST" });
                            fetchAll();
                          }}
                          className="p-1.5 rounded-lg hover:bg-amber-400/10 text-muted-foreground hover:text-amber-400 transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title={u.isAdmin ? "Revoke admin" : "Grant admin"}
                          onClick={async () => {
                            const action = u.isAdmin ? "Revoke admin from" : "Grant admin to";
                            if (!confirm(`${action} ${u.email}?`)) return;
                            await adminFetch(`/admin/users/${u.clerkUserId}/set-admin`, {
                              method: "POST", body: JSON.stringify({ isAdmin: !u.isAdmin }),
                            });
                            fetchAll();
                          }}
                          className={`p-1.5 rounded-lg transition-colors ${
                            u.isAdmin
                              ? "hover:bg-destructive/10 text-primary hover:text-destructive"
                              : "hover:bg-primary/10 text-muted-foreground hover:text-primary"
                          }`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title="View orders"
                          onClick={() => {
                            setOrdersUserFilter(u.clerkUserId);
                            setOrdersStatusFilter("all");
                            setOrdersSearch("");
                            setTab("orders");
                          }}
                          className="p-1.5 rounded-lg hover:bg-amber-400/10 text-muted-foreground hover:text-amber-400 transition-colors"
                        >
                          <ListOrdered className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedUserId === u.clerkUserId && (
                    <tr key={`${u.clerkUserId}-detail`} className="bg-muted/10 border-b border-border/50">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                          <div className="rounded-lg bg-card border border-border p-3 text-center">
                            <p className="text-xs text-muted-foreground mb-1">Balance</p>
                            <p className="font-mono font-semibold text-foreground text-sm">
                              ${u.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="rounded-lg bg-card border border-border p-3 text-center">
                            <p className="text-xs text-muted-foreground mb-1">Equity</p>
                            <p className={`font-mono font-semibold text-sm ${u.equity >= u.balance ? "text-emerald-400" : "text-red-400"}`}>
                              ${u.equity.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="rounded-lg bg-card border border-border p-3 text-center">
                            <p className="text-xs text-muted-foreground mb-1">Floating P&L</p>
                            <p className={`font-mono font-semibold text-sm ${u.floatingPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {u.floatingPnl >= 0 ? "+" : ""}${u.floatingPnl.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="rounded-lg bg-card border border-border p-3 text-center">
                            <p className="text-xs text-muted-foreground mb-1">Used Margin</p>
                            <p className="font-mono font-semibold text-foreground text-sm">
                              ${u.usedMargin.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="rounded-lg bg-card border border-border p-3 text-center">
                            <p className="text-xs text-muted-foreground mb-1">Free Margin</p>
                            <p className={`font-mono font-semibold text-sm ${u.freeMargin >= 0 ? "text-foreground" : "text-red-400"}`}>
                              ${u.freeMargin.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="rounded-lg bg-card border border-border p-3 text-center">
                            <p className="text-xs text-muted-foreground mb-1">Margin Level</p>
                            <p className={`font-mono font-semibold text-sm ${
                              u.openPositions === 0 ? "text-muted-foreground"
                              : u.marginLevel >= 200 ? "text-emerald-400"
                              : u.marginLevel >= 100 ? "text-warning"
                              : "text-red-400"
                            }`}>
                              {u.openPositions === 0 ? "—" : `${u.marginLevel.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`}
                            </p>
                            {u.openPositions > 0 && (
                              <p className="text-xs text-muted-foreground mt-0.5">{u.openPositions} position{u.openPositions !== 1 ? "s" : ""}</p>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
                {filteredUsers.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">{loading ? "Loading…" : "No users found"}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground text-right">Showing {filteredUsers.length} of {users.length} users</p>
        </div>
      )}

      {/* POSITIONS TAB */}
      {tab === "positions" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sort by:</span>
              <button
                onClick={() => setSortPos(sortPos === "pnl" ? "time" : "pnl")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-muted transition-colors"
              >
                {sortPos === "pnl" ? "P&L" : "Time"}
                {sortPos === "pnl" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
            <div className={`text-sm font-bold ${totalPnl >= 0 ? "text-emerald-400" : "text-destructive"}`}>
              Platform P&L: {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">User</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Symbol</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Dir</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Volume</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Open</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Current</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">P&L</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Opened</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Close</th>
                </tr>
              </thead>
              <tbody>
                {sortedPositions.map(pos => {
                  const userEmail = users.find(u => u.clerkUserId === pos.clerkUserId)?.email ?? pos.clerkUserId.slice(0, 8) + "…";
                  const wsLive = prices[toKey(pos.symbol)]?.price;
                  const displayPrice = wsLive ?? pos.currentPrice;
                  const livePnl = pos.direction === "buy"
                    ? (displayPrice - pos.openPrice) * pos.volume
                    : (pos.openPrice - displayPrice) * pos.volume;
                  return (
                    <tr key={pos.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[120px] truncate">{userEmail}</td>
                      <td className="px-4 py-2.5 font-mono font-semibold text-foreground">{pos.symbol}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${pos.direction === "buy" ? "bg-emerald-400/10 text-emerald-400" : "bg-destructive/10 text-destructive"}`}>
                          {pos.direction.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-foreground">{pos.volume}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-muted-foreground text-xs">{formatPrice(pos.openPrice, pos.symbol)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-foreground text-xs">{formatPrice(displayPrice, pos.symbol)}</td>
                      <td className={`px-4 py-2.5 text-right font-mono font-bold ${livePnl >= 0 ? "text-emerald-400" : "text-destructive"}`}>
                        {livePnl >= 0 ? "+" : ""}${livePnl.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                        {new Date(pos.openTime).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          onClick={async () => {
                            if (!confirm(`Force-close ${pos.direction.toUpperCase()} ${pos.symbol} for ${userEmail}?`)) return;
                            await adminFetch(`/admin/positions/${pos.id}`, { method: "DELETE" });
                            fetchAll();
                          }}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {positions.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">{loading ? "Loading…" : "No open positions"}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ORDERS TAB */}
      {tab === "orders" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground"/>
              <input
                value={ordersSearch}
                onChange={e => setOrdersSearch(e.target.value)}
                placeholder="Filter by symbol…"
                className="w-full pl-9 pr-3 py-2 text-sm bg-input border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex gap-1 items-center">
              <span className="text-xs text-muted-foreground mr-1">Status:</span>
              {(["all", "open", "closed"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setOrdersStatusFilter(f)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${ordersStatusFilter === f ? "bg-primary/15 text-primary border border-primary/30" : "border border-border text-muted-foreground hover:bg-muted"}`}
                >{f}</button>
              ))}
            </div>
            <div className="flex gap-1 items-center">
              <span className="text-xs text-muted-foreground mr-1">Dir:</span>
              {(["all", "buy", "sell"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setOrdersDirectionFilter(f)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                    ordersDirectionFilter === f
                      ? f === "buy" ? "bg-emerald-400/15 text-emerald-400 border border-emerald-400/30"
                        : f === "sell" ? "bg-destructive/15 text-destructive border border-destructive/30"
                        : "bg-primary/15 text-primary border border-primary/30"
                      : "border border-border text-muted-foreground hover:bg-muted"
                  }`}
                >{f}</button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">From:</span>
              <input type="date" value={ordersFromDate} onChange={e => setOrdersFromDate(e.target.value)}
                className="px-2 py-1.5 text-xs bg-input border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-xs text-muted-foreground">To:</span>
              <input type="date" value={ordersToDate} onChange={e => setOrdersToDate(e.target.value)}
                className="px-2 py-1.5 text-xs bg-input border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {(ordersFromDate || ordersToDate) && (
                <button onClick={() => { setOrdersFromDate(""); setOrdersToDate(""); }} className="text-xs text-muted-foreground hover:text-foreground"><X className="w-3 h-3"/></button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {ordersUserFilter && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-semibold">
                <span>User: {users.find(u => u.clerkUserId === ordersUserFilter)?.email ?? ordersUserFilter.slice(0, 12) + "…"}</span>
                <button onClick={() => setOrdersUserFilter(null)}><X className="w-3 h-3"/></button>
              </div>
            )}
            <button
              onClick={() => fetchOrders({ userId: ordersUserFilter ?? undefined, status: ordersStatusFilter, symbol: ordersSearch || undefined, direction: ordersDirectionFilter, from: ordersFromDate || undefined, to: ordersToDate || undefined })}
              disabled={ordersLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${ordersLoading ? "animate-spin" : ""}`}/> Refresh
            </button>
            <span className="text-xs text-muted-foreground ml-auto">{ordersTotal} total</span>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">User</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Symbol</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Dir</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Vol</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Open Price</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Close / Current</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">P&L</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Opened</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ordersLoading ? (
                    <tr><td colSpan={10} className="px-4 py-10 text-center text-muted-foreground"><RefreshCw className="w-4 h-4 animate-spin inline mr-2"/>Loading…</td></tr>
                  ) : orders.length === 0 ? (
                    <tr><td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">No orders found</td></tr>
                  ) : orders.map(order => {
                    const userInfo = users.find(u => u.clerkUserId === order.clerkUserId);
                    const userLabel = userInfo?.email ?? order.clerkUserId.slice(0, 8) + "…";
                    const pnl = order.status === "open" ? (order.pnl ?? 0) : (order.profit ?? 0);
                    const closeOrCurrent = order.status === "open"
                      ? (order.currentPrice != null ? formatPrice(order.currentPrice, order.symbol) : "—")
                      : (order.closePrice != null ? formatPrice(order.closePrice, order.symbol) : "—");
                    return (
                      <tr key={`${order.status}-${order.id}`} className="border-b border-border/50 hover:bg-muted/20">
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${order.status === "open" ? "bg-emerald-400/10 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[130px] truncate">{userLabel}</td>
                        <td className="px-4 py-2.5 font-mono font-semibold text-foreground">{order.symbol}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${order.direction === "buy" ? "bg-emerald-400/10 text-emerald-400" : "bg-destructive/10 text-destructive"}`}>
                            {order.direction.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-foreground">{order.volume}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-muted-foreground text-xs">{formatPrice(order.openPrice, order.symbol)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-foreground text-xs">{closeOrCurrent}</td>
                        <td className={`px-4 py-2.5 text-right font-mono font-bold ${pnl >= 0 ? "text-emerald-400" : "text-destructive"}`}>
                          {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(order.openTime).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              title="Edit"
                              onClick={() => order.status === "open" ? setEditingPosition(order) : setEditingOrder(order)}
                              className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5"/>
                            </button>
                            {order.status === "open" && (
                              <button
                                title="Force close"
                                onClick={() => setForceClosePos(order)}
                                className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <X className="w-3.5 h-3.5"/>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* KYC REVIEW TAB */}
      {tab === "kyc" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { label: "Awaiting Review", count: kycPending.length, color: "border-warning/30 bg-warning/5", badge: "bg-warning/10 text-warning" },
              { label: "Verified", count: kycVerified.length, color: "border-success/30 bg-success/5", badge: "bg-success/10 text-success" },
              { label: "Total Submitted", count: users.filter(u => u.kycStatus !== "unverified").length, color: "border-border bg-card", badge: "bg-primary/10 text-primary" },
            ].map(card => (
              <div key={card.label} className={`rounded-xl border ${card.color} p-4 flex items-center justify-between`}>
                <span className="text-sm text-muted-foreground font-medium">{card.label}</span>
                <span className={`text-lg font-black px-3 py-1 rounded-xl ${card.badge}`}>{card.count}</span>
              </div>
            ))}
          </div>

          {kycPending.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <CheckCircle className="w-10 h-10 text-success mx-auto mb-3"/>
              <p className="font-semibold text-foreground">No pending KYC applications</p>
              <p className="text-sm text-muted-foreground mt-1">All submitted applications have been reviewed.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Pending Review ({kycPending.length})</h3>
              {kycPending.map(u => (
                <div key={u.clerkUserId} className="rounded-xl border border-warning/20 bg-warning/5 p-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      {u.imageUrl
                        ? <img src={u.imageUrl} className="w-10 h-10 rounded-full object-cover border border-border"/>
                        : <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">{u.email[0]?.toUpperCase()}</div>
                      }
                      <div>
                        <p className="font-semibold text-foreground">{u.name !== "—" ? u.name : u.email}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Applied: {new Date(u.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-warning/10 text-warning font-semibold border border-warning/20">
                        <Clock className="w-3 h-3 inline mr-1"/>Pending
                      </span>
                      <button
                        onClick={() => setKycReviewUser(u)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5"/> Review Application
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-warning/10 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Account:</span> <span className="font-medium capitalize ml-1">{u.accountType}</span></div>
                    <div><span className="text-muted-foreground">Balance:</span> <span className="font-medium ml-1 font-mono">${u.balance.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span></div>
                    <div><span className="text-muted-foreground">Leverage:</span> <span className="font-medium ml-1">{u.leverage}x</span></div>
                    <div><span className="text-muted-foreground">ID:</span> <span className="font-mono ml-1">{u.clerkUserId.slice(-8)}</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {kycVerified.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Recently Verified</h3>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">User</th>
                      <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Account</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Balance</th>
                      <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kycVerified.map(u => (
                      <tr key={u.clerkUserId} className="border-b border-border/40 hover:bg-muted/10">
                        <td className="px-4 py-2.5">
                          <div>
                            <p className="font-medium text-foreground text-sm">{u.name !== "—" ? u.name : u.email}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.accountType === "real" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                            {u.accountType === "real" ? "Live" : "Demo"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-sm">${u.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2.5 text-center">
                          <button onClick={() => setKycReviewUser(u)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                            <Settings className="w-3.5 h-3.5"/>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DEPOSITS TAB */}
      {tab === "deposits" && (
        <DepositReviewTab
          deposits={deposits}
          totalDeposited={totalDeposited}
          pendingDeposits={pendingDeposits}
          onAction={fetchAll}
        />
      )}

      {/* CRYPTO DEPOSITS TAB */}
      {tab === "crypto-deposits" && (
        <CryptoDepositsTab deposits={cryptoDeposits} onAction={fetchAll} />
      )}

      {/* WITHDRAWALS TAB */}
      {tab === "withdrawals" && (
        <WithdrawalReviewTab
          withdrawals={withdrawals}
          totalWithdrawn={totalWithdrawn}
          pendingWithdrawals={pendingWithdrawals}
          onAction={fetchAll}
        />
      )}

      {/* PARTNERS TAB */}
      {tab === "partners" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
              {[
                { label: "Total Partners", count: partners.length,                                                                 color: "border-primary/30 bg-primary/5",       badge: "bg-primary/10 text-primary"       },
                { label: "Active Partners", count: partners.filter(p => p.status === "active").length,                            color: "border-emerald-400/30 bg-emerald-400/5", badge: "bg-emerald-400/10 text-emerald-400" },
                { label: "Total Seeded Capital", count: `$${partners.reduce((s, p) => s + p.seededCapital, 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`, color: "border-amber-400/30 bg-amber-400/5", badge: "bg-amber-400/10 text-amber-400" },
              ].map(c => (
                <div key={c.label} className={`rounded-xl border ${c.color} p-4 flex items-center justify-between`}>
                  <span className="text-sm text-muted-foreground font-medium">{c.label}</span>
                  <span className={`text-lg font-black px-3 py-1 rounded-xl ${c.badge}`}>{c.count}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setCreatePartnerOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors shrink-0"
            >
              <Plus className="w-4 h-4"/> New Partner
            </button>
          </div>

          {partners.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <Handshake className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3"/>
              <p className="font-semibold text-foreground">No partners yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create your first partner account to get started.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Partner</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Seeded Capital</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Balance</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">CPA Earned</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Rev Share</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Referrals</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Unlock %</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partners.map(p => (
                      <tr key={p.id} onClick={() => setSelectedPartnerId(p.id)} className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-semibold text-foreground">{p.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{p.referralCode}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.status === "active" ? "bg-emerald-400/10 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">${p.seededCapital.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3 text-right font-mono">${p.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-400">${p.cpaEarned.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3 text-right font-mono text-primary">${p.revShareEarned.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm font-bold text-foreground">{p.depositingReferrals}</span>
                          <span className="text-xs text-muted-foreground"> / {p.totalReferrals}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-sm font-bold">{p.capitalUnlockedPct}%</span>
                            <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${p.capitalUnlockedPct}%` }}/>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "prices" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-sm">Live Price Feed — All Instruments</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Prices pause automatically when markets are closed</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-muted-foreground">500ms updates</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Symbol</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Price</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">24h Change</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Bid</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Ask</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.prices ?? []).map((row, i) => {
                  const ws = prices[toKey(row.symbol)];
                  const livePrice = ws?.price ?? row.price;
                  const liveChange = ws?.changePercent ?? row.changePercent;
                  const isUp = liveChange >= 0;
                  const isOpen = ws?.marketOpen !== false;
                  return (
                    <tr key={row.symbol} className={`border-b border-border/40 hover:bg-muted/20 ${i % 2 === 0 ? "" : "bg-muted/5"}`}>
                      <td className="px-5 py-2.5 font-mono font-semibold text-foreground">{row.symbol}</td>
                      <td className={`px-5 py-2.5 text-right font-mono font-bold ${ws?.direction === "up" ? "text-emerald-400" : ws?.direction === "down" ? "text-destructive" : "text-foreground"}`}>
                        {formatPrice(livePrice, row.symbol)}
                      </td>
                      <td className={`px-5 py-2.5 text-right font-mono ${isUp ? "text-emerald-400" : "text-destructive"}`}>
                        {isUp ? "+" : ""}{liveChange.toFixed(2)}%
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono text-xs text-muted-foreground">{ws ? formatPrice(ws.bid, row.symbol) : "—"}</td>
                      <td className="px-5 py-2.5 text-right font-mono text-xs text-muted-foreground">{ws ? formatPrice(ws.ask, row.symbol) : "—"}</td>
                      <td className="px-5 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${isOpen ? "bg-emerald-400/10 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                          {isOpen ? "Open" : "Closed"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

interface PartnerDetailCommission {
  id: number;
  sourceType: string;
  amount: number;
  refPositionId: number | null;
  refClerkUserId: string | null;
  createdAt: string;
}

interface PartnerDetailReferral {
  id: number;
  referredClerkUserId: string;
  depositStatus: string;
  cpaPaid: boolean;
  createdAt: string;
}

interface PartnerDetail {
  partner: {
    id: number;
    name: string;
    referralCode: string;
    seededCapital: number;
    cpaRate: number;
    revSharePct: number;
    capitalUnlockedPct: number;
    commissionWallet: number;
    status: string;
    createdAt: string;
  };
  commissions: PartnerDetailCommission[];
  referrals: PartnerDetailReferral[];
}

function PartnerDetailPanel({ partnerId, onClose, onSave }: { partnerId: number; onClose: () => void; onSave: () => void }) {
  const [data, setData] = useState<PartnerDetail | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [detailTab, setDetailTab] = useState<"referrals" | "commissions">("referrals");

  useEffect(() => {
    adminFetch(`/admin/partners/${partnerId}`)
      .then(d => setData(d))
      .catch((e: unknown) => setLoadErr(e instanceof Error ? e.message : "Failed to load"));
  }, [partnerId]);

  async function toggleStatus() {
    if (!data) return;
    const next = data.partner.status === "active" ? "suspended" : "active";
    setSaving(true);
    try {
      await adminFetch(`/admin/partners/${partnerId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      setData(d => d ? { ...d, partner: { ...d.partner, status: next } } : d);
      onSave();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative bg-card border-l border-border h-full w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Handshake className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-base leading-none">
                {data ? data.partner.name : "Loading…"}
              </h2>
              {data && (
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{data.partner.referralCode}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <button
                onClick={toggleStatus}
                disabled={saving}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ${
                  data.partner.status === "active"
                    ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                    : "bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20"
                }`}
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : data.partner.status === "active" ? <Ban className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                {data.partner.status === "active" ? "Suspend" : "Activate"}
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loadErr && (
            <div className="m-6 p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {loadErr}
            </div>
          )}

          {!data && !loadErr && (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {data && (
            <>
              {/* Stats grid */}
              <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: "Status", value: <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${data.partner.status === "active" ? "bg-emerald-400/10 text-emerald-400" : "bg-muted text-muted-foreground"}`}>{data.partner.status}</span> },
                  { label: "Seeded Capital", value: `$${data.partner.seededCapital.toLocaleString("en-US", { minimumFractionDigits: 2 })}` },
                  { label: "Commission Wallet", value: `$${data.partner.commissionWallet.toLocaleString("en-US", { minimumFractionDigits: 2 })}` },
                  { label: "CPA Rate", value: `$${data.partner.cpaRate.toFixed(2)} / referral` },
                  { label: "Rev Share", value: `${(data.partner.revSharePct * 100).toFixed(1)}%` },
                  { label: "Capital Unlocked", value: `${data.partner.capitalUnlockedPct}%` },
                ].map(s => (
                  <div key={s.label} className="rounded-xl border border-border bg-muted/20 p-3">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{s.label}</div>
                    <div className="text-sm font-bold text-foreground font-mono">{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Sub-tabs */}
              <div className="px-6 flex gap-1 border-b border-border">
                {([
                  { id: "referrals", label: `Referrals (${data.referrals.length})` },
                  { id: "commissions", label: `Commission Log (${data.commissions.length})` },
                ] as const).map(t => (
                  <button
                    key={t.id}
                    onClick={() => setDetailTab(t.id)}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      detailTab === t.id ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Referrals tab */}
              {detailTab === "referrals" && (
                <div className="p-6">
                  {data.referrals.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No referrals yet</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/30 border-b border-border">
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">#</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">User ID</th>
                            <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Deposit</th>
                            <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">CPA Paid</th>
                            <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Referred</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.referrals.map((r, i) => (
                            <tr key={r.id} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                              <td className="px-4 py-2.5 text-xs text-muted-foreground">{i + 1}</td>
                              <td className="px-4 py-2.5 font-mono text-xs text-foreground truncate max-w-[160px]">{r.referredClerkUserId}</td>
                              <td className="px-4 py-2.5 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  r.depositStatus === "deposited" ? "bg-emerald-400/10 text-emerald-400" : "bg-muted text-muted-foreground"
                                }`}>
                                  {r.depositStatus}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                {r.cpaPaid ? (
                                  <span className="flex items-center justify-center gap-1 text-emerald-400 text-xs font-semibold">
                                    <CheckCircle className="w-3.5 h-3.5" /> Paid
                                  </span>
                                ) : (
                                  <span className="flex items-center justify-center gap-1 text-muted-foreground text-xs">
                                    <Clock className="w-3.5 h-3.5" /> Pending
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Commissions tab */}
              {detailTab === "commissions" && (
                <div className="p-6">
                  {data.commissions.length === 0 ? (
                    <div className="text-center py-12">
                      <DollarSign className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No commission events yet</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/30 border-b border-border">
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Type</th>
                            <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Amount</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">User</th>
                            <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.commissions.map(c => (
                            <tr key={c.id} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                              <td className="px-4 py-2.5">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  c.sourceType === "cpa" ? "bg-emerald-400/10 text-emerald-400" : "bg-primary/10 text-primary"
                                }`}>
                                  {c.sourceType === "cpa" ? "CPA" : "Rev Share"}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-400">
                                +${c.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground truncate max-w-[160px]">
                                {c.refClerkUserId ?? "—"}
                              </td>
                              <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                                {new Date(c.createdAt).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {data && (
          <div className="px-6 py-3 border-t border-border shrink-0 text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> Partner since {new Date(data.partner.createdAt).toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  );
}

function CreatePartnerModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({ clerkUserId: "", name: "", referralCode: "", seededCapital: "50000", cpaRate: "50", revSharePct: "0.3" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await adminFetch("/admin/partners", {
        method: "POST",
        body: JSON.stringify({
          clerkUserId: form.clerkUserId.trim(),
          name: form.name.trim(),
          referralCode: form.referralCode.trim() || undefined,
          seededCapital: parseFloat(form.seededCapital),
          cpaRate: parseFloat(form.cpaRate),
          revSharePct: parseFloat(form.revSharePct),
        }),
      });
      if (res?.error) { setError(res.error); return; }
      onSave();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create partner");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-bold text-lg flex items-center gap-2"><Handshake className="w-5 h-5 text-primary"/> New Partner Account</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4"/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 shrink-0"/> {error}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Clerk User ID <span className="text-destructive">*</span></label>
            <input
              required value={form.clerkUserId} onChange={e => setForm(f => ({ ...f, clerkUserId: e.target.value }))}
              placeholder="user_2abc123…"
              className="w-full px-3 py-2 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            />
            <p className="text-[11px] text-muted-foreground">Found in Clerk dashboard → Users → user ID</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Partner Name <span className="text-destructive">*</span></label>
            <input
              required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="John Smith"
              className="w-full px-3 py-2 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Referral Code <span className="text-muted-foreground">(optional)</span></label>
            <input
              value={form.referralCode} onChange={e => setForm(f => ({ ...f, referralCode: e.target.value }))}
              placeholder="VT-JOHNSMITH (auto-generated if blank)"
              className="w-full px-3 py-2 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono uppercase"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Seeded Capital ($)</label>
              <input
                type="number" min="0" step="1000" value={form.seededCapital}
                onChange={e => setForm(f => ({ ...f, seededCapital: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CPA Rate ($)</label>
              <input
                type="number" min="0" step="5" value={form.cpaRate}
                onChange={e => setForm(f => ({ ...f, cpaRate: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rev Share (0–1)</label>
              <input
                type="number" min="0" max="1" step="0.05" value={form.revSharePct}
                onChange={e => setForm(f => ({ ...f, revSharePct: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
            </div>
          </div>
          <div className="p-3 rounded-xl bg-muted/30 border border-border text-xs text-muted-foreground space-y-1">
            <p>• Seeded capital is locked until the partner reaches depositing-referral milestones.</p>
            <p>• CPA rate = flat $ per depositing referral. Rev share = % of referral trade commissions.</p>
            <p>• The user's trading account will be immediately credited with the seeded capital.</p>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin inline mr-1.5"/> Creating…</> : "Create Partner"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LeverageEditor({ user, onSave }: { user: AdminUser; onSave: () => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(user.leverage));
  const [saving, setSaving] = useState(false);

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="font-mono hover:text-primary transition-colors text-right w-full">
        {user.leverage}x
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 justify-end">
      <input
        type="number" min="1" max="1000" value={val}
        onChange={e => setVal(e.target.value)}
        className="w-16 px-2 py-1 rounded bg-input border border-border text-xs font-mono text-right"
        autoFocus
      />
      <button
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          try {
            await adminFetch(`/admin/users/${user.clerkUserId}/leverage`, {
              method: "PATCH", body: JSON.stringify({ leverage: parseInt(val) }),
            });
            setEditing(false);
            onSave();
          } finally { setSaving(false); }
        }}
        className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground font-bold disabled:opacity-50"
      >OK</button>
      <button onClick={() => setEditing(false)} className="text-xs px-1.5 py-1 rounded hover:bg-muted text-muted-foreground">✕</button>
    </div>
  );
}
