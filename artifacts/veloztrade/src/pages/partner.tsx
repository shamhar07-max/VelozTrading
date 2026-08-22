import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect } from "wouter";
import {
  Copy, Check, Users, DollarSign, TrendingUp, Gift, Unlock, Lock,
  ChevronDown, ChevronUp, ExternalLink, Award, Zap, BarChart2,
  ArrowDownToLine, X, AlertCircle, Loader2, CheckCircle, Building2,
  Bitcoin, Smartphone, ArrowRight, Clock, Info, ShieldAlert,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";

interface PartnerMe {
  id: number;
  name: string;
  referralCode: string;
  referralLink: string;
  status: string;
  seededCapital: number;
  cpaRate: number;
  revSharePct: number;
  totalReferrals: number;
  depositingReferrals: number;
  cpaEarned: number;
  revShareEarned: number;
  lotRebateEarned: number;
  parentOverrideEarned: number;
  pendingAmount: number;
  capitalUnlockedPct: number;
  commissionWallet: number;
  withdrawableBalance: number;
  nextMilestoneAt: number | null;
  balance: number;
  createdAt: string;
}

interface Commission {
  id: number;
  sourceType: string;
  amount: number;
  state: "pending" | "approved" | "reversed";
  runMonth: string | null;
  lots: number | null;
  reason: string | null;
  refPositionId: number | null;
  refClerkUserId: string | null;
  createdAt: string;
}

const MILESTONES = [
  { depositors: 10,  pct: 25,  unlockAmount: (capital: number) => capital * 0.25 },
  { depositors: 25,  pct: 50,  unlockAmount: (capital: number) => capital * 0.50 },
  { depositors: 50,  pct: 75,  unlockAmount: (capital: number) => capital * 0.75 },
  { depositors: 100, pct: 100, unlockAmount: (capital: number) => capital },
];

const SOURCE_LABELS: Record<string, string> = {
  cpa:             "CPA Bonus",
  rev_share:       "Revenue Share",
  lot_rebate:      "Lot Rebate",
  parent_override: "Parent Override",
  adjustment:      "Adjustment",
};

const SOURCE_COLORS: Record<string, string> = {
  cpa:             "bg-emerald-400/10 text-emerald-400",
  rev_share:       "bg-primary/10 text-primary",
  lot_rebate:      "bg-sky-400/10 text-sky-400",
  parent_override: "bg-violet-400/10 text-violet-400",
  adjustment:      "bg-amber-400/10 text-amber-400",
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatCard({ label, value, sub, icon: Icon, color = "text-primary", loading }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color?: string; loading?: boolean;
}) {
  return (
    <div className="glass-card rounded-2xl p-5 border border-border">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-xl bg-muted/60 ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      {loading ? <Skeleton className="h-7 w-28 mt-1" /> : (
        <div className={`text-2xl font-black font-mono ${color}`}>{value}</div>
      )}
      {sub && !loading && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 text-primary text-xs font-bold hover:bg-primary/10 transition-all shrink-0"
    >
      {copied ? <><Check className="w-3 h-3"/> Copied!</> : <><Copy className="w-3 h-3"/> {label}</>}
    </button>
  );
}

function MilestoneTracker({ partner }: { partner: PartnerMe }) {
  const { depositingReferrals, seededCapital, capitalUnlockedPct } = partner;
  const lockedPrincipal = seededCapital * (1 - capitalUnlockedPct / 100);

  return (
    <div className="glass-card rounded-2xl border border-border p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Award className="w-5 h-5 text-primary"/> Capital Unlock Milestones
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Seeded capital: <span className="font-semibold text-foreground">${fmt(seededCapital)}</span> · Refer more depositing clients to unlock more
          </p>
        </div>
        <div className={`px-3 py-1.5 rounded-xl text-sm font-bold border ${capitalUnlockedPct === 100 ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" : "border-primary/30 bg-primary/10 text-primary"}`}>
          {capitalUnlockedPct}% Unlocked
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {MILESTONES.map((m) => {
          const unlocked = depositingReferrals >= m.depositors;
          const current = depositingReferrals < m.depositors && (m.depositors === 10 || depositingReferrals >= MILESTONES[MILESTONES.indexOf(m) - 1]!.depositors);
          const amount = m.unlockAmount(seededCapital);
          return (
            <div
              key={m.depositors}
              className={`rounded-xl border p-4 flex flex-col gap-2 transition-all ${
                unlocked
                  ? "border-emerald-400/30 bg-emerald-400/5"
                  : current
                  ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                  : "border-border bg-muted/20 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${unlocked ? "bg-emerald-400/15 text-emerald-400" : current ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {m.depositors} depositors
                </span>
                {unlocked
                  ? <Unlock className="w-4 h-4 text-emerald-400"/>
                  : <Lock className="w-4 h-4 text-muted-foreground"/>
                }
              </div>
              <div className={`text-xl font-black font-mono ${unlocked ? "text-emerald-400" : current ? "text-primary" : "text-muted-foreground"}`}>
                ${fmt(amount)}
              </div>
              <div className="text-xs text-muted-foreground">{m.pct}% of capital</div>
              {current && (
                <div className="text-xs text-primary font-medium">
                  {m.depositors - depositingReferrals} more to unlock →
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-6 p-4 rounded-xl bg-muted/30 border border-border flex-wrap">
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">Withdrawable Now</div>
          <div className="text-xl font-black font-mono text-emerald-400">${fmt(partner.withdrawableBalance)}</div>
        </div>
        <div className="w-px h-8 bg-border hidden sm:block"/>
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">Still Locked</div>
          <div className="text-xl font-black font-mono text-muted-foreground">${fmt(lockedPrincipal)}</div>
        </div>
        <div className="w-px h-8 bg-border hidden sm:block"/>
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">Depositing Referrals</div>
          <div className="text-xl font-black font-mono text-foreground">{depositingReferrals}</div>
        </div>
        {partner.nextMilestoneAt && (
          <>
            <div className="w-px h-8 bg-border hidden sm:block"/>
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">Next Milestone</div>
              <div className="text-sm font-bold text-primary">{partner.nextMilestoneAt} depositors</div>
              <div className="text-xs text-muted-foreground">{partner.nextMilestoneAt - depositingReferrals} to go</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EarningsBreakdown({ partner, commissions }: { partner: PartnerMe; commissions: Commission[] }) {
  const [activeTab, setActiveTab] = useState<"cpa" | "rev_share" | "lot_rebate" | "parent_override">("cpa");

  const streams = [
    {
      id: "cpa" as const,
      label: "CPA Commissions",
      icon: Gift,
      total: partner.cpaEarned,
      color: "text-emerald-400",
      desc: `$${fmt(partner.cpaRate)} flat per qualifying referral who deposits`,
      sourceType: "cpa",
    },
    {
      id: "rev_share" as const,
      label: "Revenue Share",
      icon: Zap,
      total: partner.revShareEarned,
      color: "text-primary",
      desc: `${(partner.revSharePct * 100).toFixed(0)}% of commissions from referred clients' trades`,
      sourceType: "rev_share",
    },
    {
      id: "lot_rebate" as const,
      label: "Lot Rebate",
      icon: TrendingUp,
      total: partner.lotRebateEarned,
      color: "text-sky-400",
      desc: "Fixed USD per standard lot traded by your referred clients, tiered by monthly network volume",
      sourceType: "lot_rebate",
    },
    {
      id: "parent_override" as const,
      label: "Parent Override",
      icon: Award,
      total: partner.parentOverrideEarned,
      color: "text-violet-400",
      desc: "$3.00 per lot on all client volume traded by desks under you (IBs only)",
      sourceType: "parent_override",
    },
  ];

  const activeStream = streams.find(s => s.id === activeTab)!;
  const recentEvents = commissions
    .filter(c => c.sourceType === activeStream.sourceType)
    .slice(0, 5);

  return (
    <div className="glass-card rounded-2xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-primary"/> Earnings Breakdown
        </h2>
      </div>
      <div className="grid grid-cols-3 border-b border-border">
        {streams.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveTab(s.id)}
            className={`p-4 flex flex-col gap-1 text-left border-r last:border-r-0 border-border transition-colors ${activeTab === s.id ? "bg-primary/5" : "hover:bg-muted/20"}`}
          >
            <div className="flex items-center gap-1.5">
              <s.icon className={`w-4 h-4 ${activeTab === s.id ? s.color : "text-muted-foreground"}`}/>
              <span className="text-xs font-medium text-muted-foreground truncate">{s.label}</span>
            </div>
            <div className={`text-lg font-black font-mono ${activeTab === s.id ? s.color : "text-foreground"}`}>
              ${fmt(s.total)}
            </div>
          </button>
        ))}
      </div>
      {streams.map((s) => activeTab === s.id && (
        <div key={s.id} className="px-5 py-4 space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border">
            <s.icon className={`w-5 h-5 ${s.color} mt-0.5 shrink-0`}/>
            <div>
              <div className="font-semibold text-sm text-foreground mb-0.5">{s.label}</div>
              <div className="text-xs text-muted-foreground">{s.desc}</div>
              <div className={`text-2xl font-black font-mono mt-2 ${s.color}`}>${fmt(s.total)}</div>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Recent Events {recentEvents.length > 0 ? `(last ${recentEvents.length})` : ""}
            </div>
            {recentEvents.length === 0 ? (
              <div className="text-xs text-muted-foreground italic py-3 text-center">
                No {s.label.toLowerCase()} events yet
              </div>
            ) : (
              <div className="space-y-1.5">
                {recentEvents.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/20 border border-border/40">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.color.replace("text-", "bg-")}`}/>
                      <span className="text-xs text-muted-foreground">
                        {new Date(c.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {c.refClerkUserId && (
                        <span className="text-xs font-mono text-muted-foreground truncate">
                          · user …{c.refClerkUserId.slice(-6)}
                        </span>
                      )}
                    </div>
                    <span className={`text-sm font-bold font-mono ${s.color} shrink-0`}>
                      +${fmt(c.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const WITHDRAW_METHODS = [
  { id: "bank",      label: "Bank Wire",      icon: Building2,  time: "1–3 business days" },
  { id: "crypto",    label: "Crypto",         icon: Bitcoin,    time: "2–6 hours" },
  { id: "ewallet",   label: "E-Wallet",       icon: Smartphone, time: "1–24 hours" },
  { id: "jazzcash",  label: "JazzCash",       icon: Smartphone, time: "1–6 hours" },
  { id: "easypaisa", label: "Easypaisa",      icon: Smartphone, time: "1–6 hours" },
  { id: "upi",       label: "UPI",            icon: Smartphone, time: "1–6 hours" },
];

interface DestField { id: string; label: string; placeholder: string; required: boolean }

function getDestFields(method: string): DestField[] {
  switch (method) {
    case "bank":
      return [
        { id: "accountHolder", label: "Account Holder Name",      placeholder: "Full name as on bank account",       required: true  },
        { id: "bankName",      label: "Bank Name",                 placeholder: "e.g. HBL, Standard Chartered, HSBC", required: true  },
        { id: "iban",          label: "IBAN / Account Number",     placeholder: "International bank account number",  required: true  },
        { id: "swift",         label: "SWIFT / BIC Code",          placeholder: "8 or 11 character code",             required: false },
        { id: "country",       label: "Bank Country",              placeholder: "e.g. Pakistan, UAE, UK",             required: true  },
      ];
    case "crypto":
      return [
        { id: "wallet",  label: "Wallet Address", placeholder: "Your receiving wallet address",     required: true },
        { id: "network", label: "Network / Chain", placeholder: "e.g. BTC, ERC-20, TRC-20, BEP-20", required: true },
        { id: "coin",    label: "Coin / Token",    placeholder: "e.g. BTC, ETH, USDT, BNB",         required: true },
      ];
    case "ewallet":
      return [
        { id: "walletType",   label: "Wallet Type",               placeholder: "e.g. Skrill, Neteller, PayPal", required: true },
        { id: "accountEmail", label: "Wallet Email / Account ID", placeholder: "Email registered with the wallet", required: true },
        { id: "accountName",  label: "Account Holder Name",       placeholder: "Full name on the wallet account", required: true },
      ];
    case "jazzcash":
    case "easypaisa":
      return [
        { id: "phone",       label: `${method === "jazzcash" ? "JazzCash" : "Easypaisa"} Mobile Number`, placeholder: "03XXXXXXXXX", required: true },
        { id: "accountName", label: "Account Holder Name", placeholder: "Registered name on account", required: true },
      ];
    case "upi":
      return [
        { id: "upiId",       label: "UPI ID",       placeholder: "yourname@upi or phone@upi", required: true },
        { id: "accountName", label: "Account Name", placeholder: "Name on bank account",      required: true },
      ];
    default:
      return [{ id: "details", label: "Payout Details", placeholder: "Provide your payout account details", required: true }];
  }
}

type ModalStep = "method" | "amount" | "details" | "done";

function PartnerWithdrawModal({ partner, onClose, onSuccess }: {
  partner: PartnerMe;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep]         = useState<ModalStep>("method");
  const [method, setMethod]     = useState("bank");
  const [amount, setAmount]     = useState(String(Math.floor(partner.withdrawableBalance * 100) / 100));
  const [dest, setDest]         = useState<Record<string, string>>({});
  const [submitting, setSubmit] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [requestId, setReqId]   = useState<number | null>(null);

  const withdrawable  = partner.withdrawableBalance;
  const parsedAmount  = parseFloat(amount) || 0;
  const insufficient  = parsedAmount > withdrawable;
  const fields        = getDestFields(method);
  const destComplete  = fields.filter(f => f.required).every(f => (dest[f.id] ?? "").trim().length > 0);

  async function handleSubmit() {
    if (!destComplete || parsedAmount < 10 || insufficient) return;
    const bankDetails = fields.map(f => `${f.label}: ${(dest[f.id] ?? "").trim() || "—"}`).join("\n");
    setSubmit(true);
    setError(null);
    try {
      const res = await fetch("/api/account/withdrawal-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsedAmount, method, bankDetails }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setError(body?.error ?? "Request failed. Please try again.");
        return;
      }
      const data = await res.json() as { id?: number };
      setReqId(data.id ?? null);
      setStep("done");
      onSuccess();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmit(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative w-full max-w-lg bg-background border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <ArrowDownToLine className="w-5 h-5 text-primary"/>
            <h2 className="font-bold text-lg">Withdraw Earnings</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4"/>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Done state */}
          {step === "done" && (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 rounded-full bg-warning/15 border border-warning/30 flex items-center justify-center mx-auto">
                <Clock className="w-8 h-8 text-warning"/>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-1">Withdrawal Submitted!</h3>
                <p className="text-sm text-muted-foreground">
                  <span className="font-bold text-foreground">${fmt(parsedAmount)}</span> is pending admin approval.
                </p>
              </div>
              {requestId && (
                <p className="text-xs text-muted-foreground font-mono bg-muted/40 inline-block px-3 py-1.5 rounded-lg">
                  Request #{requestId}
                </p>
              )}
              <div className="bg-muted/30 border border-border rounded-xl p-4 text-left text-xs text-muted-foreground space-y-1">
                <div className="font-semibold text-foreground mb-1.5 flex items-center gap-1.5"><Info className="w-3.5 h-3.5"/> What happens next?</div>
                <p>1. Our team reviews your withdrawal request</p>
                <p>2. We verify the destination account details</p>
                <p>3. Funds are sent via {WITHDRAW_METHODS.find(m => m.id === method)?.label}</p>
                <p>4. Expected processing: {WITHDRAW_METHODS.find(m => m.id === method)?.time}</p>
              </div>
              <button onClick={onClose} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all">
                Close
              </button>
            </div>
          )}

          {step !== "done" && (
            <>
              {/* Balance info + locked-capital explanation */}
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Withdrawable Balance</div>
                    <div className="text-2xl font-black font-mono text-emerald-400">${fmt(withdrawable)}</div>
                  </div>
                  {partner.seededCapital > 0 && (
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground mb-0.5">Capital Unlocked</div>
                      <div className="text-lg font-bold text-foreground">{partner.capitalUnlockedPct}%</div>
                    </div>
                  )}
                </div>
                {partner.seededCapital > 0 && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-400/5 border border-amber-400/20 text-xs text-amber-400">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5"/>
                    <span>
                      Your seeded capital of <strong>${fmt(partner.seededCapital)}</strong> unlocks progressively as you refer more depositing clients.
                      Currently <strong>{partner.capitalUnlockedPct}%</strong> ({partner.depositingReferrals} depositing referrals) is unlocked.
                      Locked capital cannot be withdrawn until the corresponding milestone is reached.
                    </span>
                  </div>
                )}
              </div>

              {/* Step indicator */}
              <div className="flex items-center gap-2 text-xs">
                {(["method", "amount", "details"] as const).map((s, i) => (
                  <div key={s} className="flex items-center gap-2">
                    {i > 0 && <div className={`h-px w-5 ${step === "amount" && i === 2 ? "bg-border" : (step === "details" || (step === "amount" && i === 1)) ? "bg-primary" : step === "method" ? "bg-border" : "bg-primary"}`}/>}
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold transition-all ${
                      (step === "amount" && i === 0) || (step === "details" && i <= 1)
                        ? "bg-emerald-500 text-white"
                        : step === s
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {(step === "amount" && i === 0) || (step === "details" && i <= 1)
                        ? <CheckCircle className="w-3 h-3"/>
                        : i + 1
                      }
                    </div>
                    <span className={step === s ? "text-foreground font-medium" : "text-muted-foreground"}>
                      {s === "method" ? "Method" : s === "amount" ? "Amount" : "Details"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Step 1: Method */}
              {step === "method" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {WITHDRAW_METHODS.map(m => (
                      <button
                        key={m.id}
                        onClick={() => { setMethod(m.id); setDest({}); }}
                        className={`text-left p-3 rounded-xl border transition-all ${method === m.id ? "border-primary/50 bg-primary/8" : "border-border hover:bg-muted/20"}`}
                      >
                        <m.icon className={`w-4 h-4 mb-1.5 ${method === m.id ? "text-primary" : "text-muted-foreground"}`}/>
                        <div className="font-semibold text-sm">{m.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">⏱ {m.time}</div>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setStep("amount")}
                    className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                  >
                    Continue <ArrowRight className="w-4 h-4"/>
                  </button>
                </div>
              )}

              {/* Step 2: Amount */}
              {step === "amount" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">Withdrawal Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                      <Input
                        type="number" min="10" max={withdrawable} step="1" value={amount}
                        onChange={e => setAmount(e.target.value)}
                        className={`pl-7 font-mono text-lg ${insufficient ? "border-destructive focus-visible:ring-destructive" : ""}`}
                        placeholder="0"
                      />
                    </div>
                    {insufficient ? (
                      <p className="text-xs text-destructive mt-2 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3"/> Exceeds withdrawable balance of ${fmt(withdrawable)}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-2">
                        Withdrawable: ${fmt(withdrawable)} · Minimum: $10
                      </p>
                    )}
                    {withdrawable > 0 && (
                      <button
                        onClick={() => setAmount(String(Math.floor(withdrawable * 100) / 100))}
                        className="text-xs text-primary hover:underline mt-1"
                      >
                        Use max (${fmt(withdrawable)})
                      </button>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setStep("method")} className="flex-1 py-3 rounded-xl border border-border text-sm hover:bg-muted transition-all">Back</button>
                    <button
                      onClick={() => setStep("details")}
                      disabled={!amount || parsedAmount < 10 || insufficient}
                      className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      Continue <ArrowRight className="w-4 h-4"/>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Payout details */}
              {step === "details" && (
                <div className="space-y-4">
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-400/5 border border-amber-400/20 text-xs text-amber-400">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5"/>
                    <span>Double-check your payout details. We are not responsible for funds sent to incorrect accounts.</span>
                  </div>
                  <div className="space-y-3">
                    {fields.map(f => (
                      <div key={f.id}>
                        <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                          {f.label}{f.required && <span className="text-destructive ml-0.5">*</span>}
                        </label>
                        <Input
                          value={dest[f.id] ?? ""}
                          onChange={e => setDest(prev => ({ ...prev, [f.id]: e.target.value }))}
                          placeholder={f.placeholder}
                          className="text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  {error && (
                    <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 flex items-start gap-2 text-sm text-destructive">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5"/>
                      {error}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button onClick={() => setStep("amount")} className="flex-1 py-3 rounded-xl border border-border text-sm hover:bg-muted transition-all">Back</button>
                    <button
                      onClick={handleSubmit}
                      disabled={!destComplete || submitting}
                      className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      {submitting
                        ? <><Loader2 className="w-4 h-4 animate-spin"/> Submitting…</>
                        : <>Submit Request <ArrowRight className="w-4 h-4"/></>
                      }
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CommissionHistory({ commissions, loading }: { commissions: Commission[]; loading: boolean }) {
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<"createdAt" | "amount">("createdAt");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const sorted = [...commissions].sort((a, b) => {
    const aV = sortField === "amount" ? a.amount : new Date(a.createdAt).getTime();
    const bV = sortField === "amount" ? b.amount : new Date(b.createdAt).getTime();
    return sortDir === "desc" ? bV - aV : aV - bV;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageItems = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSort(field: "createdAt" | "amount") {
    if (sortField === field) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortField(field); setSortDir("desc"); }
  }

  const running = sorted.reduce<number[]>((acc, c) => {
    const prev = acc.length > 0 ? acc[acc.length - 1]! : 0;
    acc.push(prev + c.amount);
    return acc;
  }, []);
  const runningByPage = running.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function SortIcon({ field }: { field: "createdAt" | "amount" }) {
    if (sortField !== field) return null;
    return sortDir === "desc" ? <ChevronDown className="w-3 h-3"/> : <ChevronUp className="w-3 h-3"/>;
  }

  return (
    <div className="glass-card rounded-2xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary"/> Commission History
        </h2>
        <span className="text-xs text-muted-foreground">{commissions.length} total events</span>
      </div>
      {loading ? (
        <div className="p-5 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full"/>)}</div>
      ) : commissions.length === 0 ? (
        <div className="p-10 text-center text-muted-foreground text-sm">
          <Gift className="w-8 h-8 mx-auto mb-2 opacity-30"/>
          No commission events yet. Start referring clients to earn!
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase">#</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Type</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Referred User</th>
                  <th
                    className="text-right px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase cursor-pointer hover:text-foreground select-none"
                    onClick={() => toggleSort("amount")}
                  >
                    <span className="flex items-center justify-end gap-1">Amount <SortIcon field="amount"/></span>
                  </th>
                  <th className="text-right px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Running Total</th>
                  <th
                    className="text-right px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase cursor-pointer hover:text-foreground select-none"
                    onClick={() => toggleSort("createdAt")}
                  >
                    <span className="flex items-center justify-end gap-1">Date <SortIcon field="createdAt"/></span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((c, i) => {
                  const globalIdx = (page - 1) * PAGE_SIZE + i;
                  return (
                    <tr key={c.id} className="border-b border-border/40 hover:bg-muted/10">
                      <td className="px-5 py-3 text-xs text-muted-foreground">{globalIdx + 1}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${SOURCE_COLORS[c.sourceType] ?? "bg-muted text-muted-foreground"}`}>
                          {SOURCE_LABELS[c.sourceType] ?? c.sourceType}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs font-mono text-muted-foreground">
                        {c.refClerkUserId ? `…${c.refClerkUserId.slice(-8)}` : <span className="opacity-40">—</span>}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-bold text-emerald-400">
                        +${fmt(c.amount)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-xs text-muted-foreground">
                        ${fmt(runningByPage[i] ?? 0)}
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-muted-foreground">
                        {new Date(c.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                >Prev</button>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                >Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function Partner() {
  useEffect(() => { document.title = "Partner Portal | VelozTrade"; }, []);

  const queryClient = useQueryClient();
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  const { data: partner, isLoading, error } = useQuery<PartnerMe>({
    queryKey: ["partner-me"],
    queryFn: async () => {
      const res = await fetch("/api/partner/me");
      if (res.status === 404) throw new Error("NOT_PARTNER");
      if (!res.ok) throw new Error("Failed to load partner data");
      return res.json();
    },
    retry: false,
    staleTime: 30_000,
  });

  const { data: commissionsRaw, isLoading: commissionsLoading } = useQuery<Commission[]>({
    queryKey: ["partner-commissions"],
    queryFn: async () => {
      const res = await fetch("/api/partner/me/commissions");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!partner,
    staleTime: 30_000,
  });
  const commissions = Array.isArray(commissionsRaw) ? commissionsRaw : [];

  if (error && (error as Error).message === "NOT_PARTNER") {
    return <Redirect to="/dashboard" />;
  }

  const qrUrl = partner
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(partner.referralLink)}&bgcolor=ffffff&color=000000&margin=4`
    : null;

  function handleWithdrawSuccess() {
    void queryClient.invalidateQueries({ queryKey: ["partner-me"] });
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {showWithdrawModal && partner && (
        <PartnerWithdrawModal
          partner={partner}
          onClose={() => setShowWithdrawModal(false)}
          onSuccess={handleWithdrawSuccess}
        />
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Partner Portal</h1>
            {partner && (
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${partner.status === "active" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" : "border-border bg-muted text-muted-foreground"}`}>
                {partner.status.toUpperCase()}
              </span>
            )}
          </div>
          {partner && (
            <p className="text-sm text-muted-foreground mt-0.5">Welcome, {partner.name} · Partner since {new Date(partner.createdAt).toLocaleDateString()}</p>
          )}
        </div>
        {partner && (
          <button
            onClick={() => setShowWithdrawModal(true)}
            disabled={partner.withdrawableBalance <= 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            <ArrowDownToLine className="w-4 h-4"/>
            Withdraw Earnings
          </button>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Referrals" value={isLoading ? "…" : String(partner?.totalReferrals ?? 0)} icon={Users} color="text-primary" loading={isLoading}/>
        <StatCard label="Depositing Referrals" value={isLoading ? "…" : String(partner?.depositingReferrals ?? 0)} icon={Gift} color="text-emerald-400" loading={isLoading} sub={`of ${partner?.totalReferrals ?? 0} total`}/>
        <StatCard label="Commission Earned" value={isLoading ? "…" : `$${fmt((partner?.cpaEarned ?? 0) + (partner?.revShareEarned ?? 0))}`} icon={DollarSign} color="text-amber-400" loading={isLoading}/>
        <StatCard label="Withdrawable Balance" value={isLoading ? "…" : `$${fmt(partner?.withdrawableBalance ?? 0)}`} icon={TrendingUp} color="text-emerald-400" loading={isLoading} sub={`${partner?.capitalUnlockedPct ?? 0}% capital unlocked`}/>
      </div>

      {/* Referral Link Widget */}
      <div className="glass-card rounded-2xl border border-primary/20 p-6">
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
          <ExternalLink className="w-5 h-5 text-primary"/> Your Referral Link
        </h2>
        <div className="grid md:grid-cols-[1fr_auto] gap-6 items-start">
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-xl border border-border">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-muted-foreground font-semibold mb-0.5 uppercase tracking-wider">Referral Code</div>
                <div className="font-mono font-black text-2xl text-primary tracking-widest">
                  {isLoading ? <Skeleton className="h-7 w-32"/> : partner?.referralCode}
                </div>
              </div>
              {partner && <CopyButton text={partner.referralCode} label="Copy Code"/>}
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-xl border border-border">
              <div className="flex-1 min-w-0 text-xs font-mono text-muted-foreground truncate">
                {isLoading ? <Skeleton className="h-4 w-full"/> : partner?.referralLink}
              </div>
              {partner && <CopyButton text={partner.referralLink} label="Copy Link"/>}
            </div>
            <div className="flex gap-2 flex-wrap pt-1">
              {partner && [
                { label: "WhatsApp", color: "bg-emerald-600", url: `https://wa.me/?text=${encodeURIComponent(`Join VelozTrade — the world's fastest CFD broker. Use my referral link: ${partner.referralLink}`)}` },
                { label: "Telegram", color: "bg-sky-500",     url: `https://t.me/share/url?url=${encodeURIComponent(partner.referralLink)}&text=${encodeURIComponent("Join VelozTrade using my referral link!")}` },
                { label: "Email",    color: "bg-rose-600",    url: `mailto:?subject=${encodeURIComponent("Join VelozTrade with my referral link")}&body=${encodeURIComponent(`Sign up using my referral link: ${partner.referralLink}`)}` },
              ].map(s => (
                <a key={s.label} href={s.url} target="_blank" rel="noreferrer"
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-white text-xs font-semibold ${s.color} hover:opacity-90 transition-all`}>
                  {s.label}
                </a>
              ))}
            </div>
          </div>
          {qrUrl && (
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-2xl border border-border p-2 bg-white shadow-sm">
                <img src={qrUrl} alt="Referral QR Code" width={160} height={160} className="rounded-xl"/>
              </div>
              <div className="text-xs text-muted-foreground text-center">Scan to sign up</div>
            </div>
          )}
        </div>
      </div>

      {/* Milestone Tracker */}
      {partner && <MilestoneTracker partner={partner}/>}
      {isLoading && <Skeleton className="h-60 w-full rounded-2xl"/>}

      {/* Earnings Breakdown */}
      {partner && <EarningsBreakdown partner={partner} commissions={commissions}/>}
      {isLoading && <Skeleton className="h-48 w-full rounded-2xl"/>}

      {/* Commission History */}
      <CommissionHistory commissions={commissions} loading={isLoading || commissionsLoading}/>
    </div>
  );
}
