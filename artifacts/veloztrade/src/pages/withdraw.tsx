import { useEffect, useState } from "react";
import { useGetAccount } from "@workspace/api-client-react";
import {
  Building2, Bitcoin, Smartphone, CheckCircle, ArrowRight,
  Loader2, AlertCircle, ShieldAlert, ShieldCheck, Clock, Info,
} from "lucide-react";
import { Input } from "@/components/ui/input";

const METHODS = [
  { id: "bank",      label: "Bank Wire Transfer",     icon: Building2,  desc: "Local & international",    time: "1–3 business days", fee: "0%", badge: null   },
  { id: "crypto",    label: "Cryptocurrency",         icon: Bitcoin,    desc: "BTC, ETH, USDT and more",  time: "2–6 hours",         fee: "0%", badge: "Fast" },
  { id: "ewallet",   label: "E-Wallet",               icon: Smartphone, desc: "Skrill, Neteller, PayPal", time: "1–24 hours",        fee: "0%", badge: null   },
  { id: "jazzcash",  label: "JazzCash",               icon: Smartphone, desc: "Pakistan mobile wallet",   time: "1–6 hours",         fee: "0%", badge: "🇵🇰"   },
  { id: "easypaisa", label: "Easypaisa",              icon: Smartphone, desc: "Pakistan mobile payment",  time: "1–6 hours",         fee: "0%", badge: "🇵🇰"   },
  { id: "upi",       label: "UPI",                    icon: Smartphone, desc: "India Unified Payments",   time: "1–6 hours",         fee: "0%", badge: "🇮🇳"   },
];

const AMOUNTS = [500, 1000, 5000, 10000];

interface DestField { id: string; label: string; placeholder: string; required: boolean }

function getDestFields(method: string): DestField[] {
  switch (method) {
    case "bank":
      return [
        { id: "accountHolder", label: "Account Holder Name",        placeholder: "Full name as on bank account",          required: true  },
        { id: "bankName",      label: "Bank Name",                   placeholder: "e.g. HBL, Standard Chartered, HSBC",    required: true  },
        { id: "iban",          label: "IBAN / Account Number",       placeholder: "International bank account number",     required: true  },
        { id: "swift",         label: "SWIFT / BIC Code",            placeholder: "8 or 11 character code",                required: false },
        { id: "branch",        label: "Branch / Routing Number",     placeholder: "Branch or ABA/routing (if applicable)", required: false },
        { id: "country",       label: "Bank Country",                placeholder: "e.g. Pakistan, UAE, UK",                required: true  },
      ];
    case "crypto":
      return [
        { id: "wallet",        label: "Wallet Address",              placeholder: "Your receiving wallet address",         required: true  },
        { id: "network",       label: "Network / Chain",             placeholder: "e.g. BTC, ERC-20, TRC-20, BEP-20",     required: true  },
        { id: "coin",          label: "Coin / Token",                placeholder: "e.g. BTC, ETH, USDT, BNB",             required: true  },
      ];
    case "ewallet":
      return [
        { id: "walletType",    label: "Wallet Type",                 placeholder: "e.g. Skrill, Neteller, PayPal",         required: true  },
        { id: "accountEmail",  label: "Wallet Email / Account ID",   placeholder: "Email registered with the wallet",      required: true  },
        { id: "accountName",   label: "Account Holder Name",         placeholder: "Full name on the wallet account",       required: true  },
      ];
    case "jazzcash":
      return [
        { id: "phone",         label: "JazzCash Mobile Number",      placeholder: "03XXXXXXXXX",                           required: true  },
        { id: "accountName",   label: "Account Holder Name",         placeholder: "Registered name on JazzCash",           required: true  },
        { id: "cnic",          label: "CNIC (last 4 digits)",        placeholder: "For verification purposes",             required: false },
      ];
    case "easypaisa":
      return [
        { id: "phone",         label: "Easypaisa Mobile Number",     placeholder: "03XXXXXXXXX",                           required: true  },
        { id: "accountName",   label: "Account Holder Name",         placeholder: "Registered name on Easypaisa",          required: true  },
        { id: "cnic",          label: "CNIC (last 4 digits)",        placeholder: "For verification purposes",             required: false },
      ];
    case "upi":
      return [
        { id: "upiId",         label: "UPI ID",                      placeholder: "yourname@upi or phone@upi",             required: true  },
        { id: "accountName",   label: "Account Holder Name",         placeholder: "Name on bank account",                  required: true  },
        { id: "bankName",      label: "Bank Name",                   placeholder: "e.g. SBI, HDFC, ICICI",                 required: false },
      ];
    default:
      return [
        { id: "details",       label: "Payout Details",              placeholder: "Provide your payout account details",   required: true  },
      ];
  }
}

export function Withdraw() {
  useEffect(() => { document.title = "Withdraw | VelozTrade"; }, []);

  const { data: account, refetch } = useGetAccount();
  const [step, setStep]           = useState<1 | 2 | 3>(1);
  const [method, setMethod]       = useState("bank");
  const [amount, setAmount]       = useState("500");
  const [dest, setDest]           = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [requestId, setRequestId] = useState<number | null>(null);

  const balance      = account?.balance ? parseFloat(String(account.balance)) : 0;
  const parsedAmount = parseFloat(amount) || 0;
  const insufficient = parsedAmount > balance;
  const kycStatus    = account?.kycStatus ?? "unverified";
  const kycVerified  = kycStatus === "verified";
  const kycPending   = kycStatus === "pending";

  const fields = getDestFields(method);
  const destComplete = fields
    .filter(f => f.required)
    .every(f => (dest[f.id] ?? "").trim().length > 0);

  const handleMethodChange = (m: string) => { setMethod(m); setDest({}); };

  const handleSubmit = async () => {
    if (!destComplete || !kycVerified || parsedAmount < 10 || insufficient) return;

    const bankDetails = fields
      .map(f => `${f.label}: ${(dest[f.id] ?? "").trim() || "—"}`)
      .join("\n");

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/account/withdrawal-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsedAmount, method, bankDetails }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string; kycRequired?: boolean };
        setError(body?.error ?? "Request failed. Please try again.");
        return;
      }
      const data = await res.json() as { id?: number };
      setRequestId(data.id ?? null);
      await refetch();
      setSubmitted(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="glass-card rounded-2xl p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-warning/15 border border-warning/30 flex items-center justify-center mx-auto mb-5">
            <Clock className="w-8 h-8 text-warning"/>
          </div>
          <h2 className="text-2xl font-bold mb-2">Withdrawal Submitted!</h2>
          <p className="text-muted-foreground mb-1">
            <span className="font-bold text-foreground text-lg">
              ${parsedAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>{" "}
            has been reserved and is pending admin approval.
          </p>
          <p className="text-sm text-muted-foreground mb-2">
            Our team will process your withdrawal and send the funds to your specified account.
          </p>
          {requestId && (
            <p className="text-xs text-muted-foreground mb-6 font-mono bg-muted/40 inline-block px-3 py-1.5 rounded-lg">
              Request #{requestId}
            </p>
          )}
          <div className="bg-muted/30 border border-border rounded-xl p-4 text-left text-xs text-muted-foreground mb-6 space-y-1">
            <div className="font-semibold text-foreground mb-1.5 flex items-center gap-1.5"><Info className="w-3.5 h-3.5"/> What happens next?</div>
            <p>1. Our team reviews your withdrawal request</p>
            <p>2. We verify the destination account details</p>
            <p>3. Funds are sent to your {METHODS.find(m => m.id === method)?.label}</p>
            <p>4. Expected processing: {METHODS.find(m => m.id === method)?.time}</p>
          </div>
          <button
            onClick={() => { setSubmitted(false); setStep(1); setDest({}); setAmount("500"); setError(null); }}
            className="text-sm text-primary hover:underline"
          >
            Submit another request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-1">Withdraw Funds</h1>
        <p className="text-muted-foreground">Request a withdrawal from your trading account. Funds are sent after verification.</p>
      </div>

      {/* KYC banner */}
      {!kycVerified && (
        <div className={`glass-card rounded-2xl p-4 flex items-start gap-3 border ${kycPending ? "border-warning/40 bg-warning/5" : "border-destructive/30 bg-destructive/5"}`}>
          {kycPending
            ? <Loader2 className="w-5 h-5 text-warning shrink-0 mt-0.5 animate-spin"/>
            : <ShieldAlert className="w-5 h-5 text-destructive shrink-0 mt-0.5"/>
          }
          <div>
            <div className="font-semibold text-sm mb-0.5">
              {kycPending ? "KYC Verification In Progress" : "KYC Verification Required"}
            </div>
            <p className="text-xs text-muted-foreground">
              {kycPending
                ? "Your identity verification is under review. Withdrawals will be enabled once approved — typically within 24 hours."
                : "You must complete KYC identity verification before withdrawing funds. Go to your Profile to submit your documents."
              }
            </p>
            {!kycPending && (
              <a href="/profile" className="inline-flex items-center gap-1 text-xs font-semibold text-primary mt-2 hover:underline">
                Complete KYC in Profile <ArrowRight className="w-3 h-3"/>
              </a>
            )}
          </div>
        </div>
      )}

      {kycVerified && (
        <div className="glass-card rounded-2xl p-4 flex items-start gap-3 border border-success/30 bg-success/5">
          <ShieldCheck className="w-5 h-5 text-success shrink-0 mt-0.5"/>
          <div>
            <div className="font-semibold text-sm mb-0.5">Identity Verified</div>
            <p className="text-xs text-muted-foreground">
              Your KYC is verified. Available balance:{" "}
              <span className="font-bold text-foreground">
                ${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {[
          { n: 1, label: "Method" },
          { n: 2, label: "Amount" },
          { n: 3, label: "Payout Details" },
        ].map(({ n, label }) => (
          <div key={n} className="flex items-center gap-2">
            {n > 1 && <div className={`h-px w-6 ${step >= n ? "bg-primary" : "bg-border"}`}/>}
            <div className="flex items-center gap-1.5">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step > n ? "bg-success text-white" :
                step === n ? "bg-primary text-primary-foreground" :
                "bg-muted text-muted-foreground"
              }`}>
                {step > n ? <CheckCircle className="w-3.5 h-3.5"/> : n}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${step === n ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className={`grid lg:grid-cols-5 gap-5 ${!kycVerified ? "opacity-50 pointer-events-none select-none" : ""}`}>
        <div className="lg:col-span-3 space-y-4">

          {/* Step 1: Method */}
          {step === 1 && (
            <div className="glass-card rounded-2xl p-5">
              <h2 className="font-bold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Choose Withdrawal Method</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {METHODS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => handleMethodChange(m.id)}
                    className={`relative text-left p-4 rounded-xl border transition-all ${method === m.id ? "border-primary/50 bg-primary/8" : "border-border hover:border-border/80 hover:bg-muted/30"}`}
                  >
                    {m.badge && (
                      <span className="absolute top-3 right-3 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">{m.badge}</span>
                    )}
                    <m.icon className={`w-5 h-5 mb-2 ${method === m.id ? "text-primary" : "text-muted-foreground"}`}/>
                    <div className="font-semibold text-sm mb-0.5">{m.label}</div>
                    <div className="text-xs text-muted-foreground">{m.desc}</div>
                    <div className="flex gap-3 mt-2 text-xs">
                      <span className="text-muted-foreground">⏱ {m.time}</span>
                      <span className="text-success">Fee: {m.fee}</span>
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep(2)}
                className="mt-5 w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
              >
                Continue <ArrowRight className="w-4 h-4"/>
              </button>
            </div>
          )}

          {/* Step 2: Amount */}
          {step === 2 && (
            <div className="glass-card rounded-2xl p-5 space-y-4">
              <h2 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Enter Withdrawal Amount</h2>
              <div className="flex gap-2 flex-wrap">
                {AMOUNTS.map(a => (
                  <button
                    key={a}
                    onClick={() => setAmount(String(a))}
                    disabled={a > balance}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all disabled:opacity-30 disabled:cursor-not-allowed ${amount === String(a) ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-border/80"}`}
                  >
                    ${a.toLocaleString()}
                  </button>
                ))}
              </div>
              <div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                  <Input
                    type="number" min="10" max={balance} step="10" value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className={`pl-7 font-mono text-lg ${insufficient ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    placeholder="500"
                  />
                </div>
                {insufficient ? (
                  <p className="text-xs text-destructive mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3"/> Exceeds available balance of ${balance.toFixed(2)}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-2">
                    Available: ${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })} · Minimum: $10
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl border border-border text-sm hover:bg-muted transition-all">Back</button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!amount || parsedAmount < 10 || insufficient}
                  className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  Continue <ArrowRight className="w-4 h-4"/>
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Payout destination details */}
          {step === 3 && (
            <div className="glass-card rounded-2xl p-5 space-y-4">
              <div>
                <h2 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-1">Payout Destination Details</h2>
                <p className="text-xs text-muted-foreground">
                  Provide the account details where you want your funds sent via{" "}
                  <span className="font-semibold text-foreground">{METHODS.find(m => m.id === method)?.label}</span>.
                  Double-check all details — we are not responsible for funds sent to incorrect accounts.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-amber-400/5 border border-amber-400/20 flex items-start gap-2 text-xs text-amber-400">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5"/>
                <span>Ensure your payout details are accurate. Incorrect details may result in failed or lost transfers.</span>
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

              <div className="flex gap-3 pt-1">
                <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-xl border border-border text-sm hover:bg-muted transition-all">Back</button>
                <button
                  onClick={handleSubmit}
                  disabled={!destComplete || submitting}
                  className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {submitting
                    ? <><Loader2 className="w-5 h-5 animate-spin"/> Submitting…</>
                    : <>Submit Withdrawal Request <ArrowRight className="w-5 h-5"/></>
                  }
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Summary sidebar */}
        <div className="lg:col-span-2">
          <div className="glass-card rounded-2xl p-5 sticky top-4 space-y-3">
            <h2 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Summary</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Available Balance</span>
                <span className="font-mono font-bold text-foreground">${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Method</span>
                <span className="font-semibold">{METHODS.find(m => m.id === method)?.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className={`font-mono font-bold ${insufficient ? "text-destructive" : "text-foreground"}`}>
                  ${parsedAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fee</span>
                <span className="text-success font-semibold">Free</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Processing</span>
                <span>{METHODS.find(m => m.id === method)?.time}</span>
              </div>
              <div className="border-t border-border/50 pt-3 flex justify-between font-bold">
                <span>You receive</span>
                <span className={`font-mono text-base ${insufficient ? "text-destructive" : "text-primary"}`}>
                  ${parsedAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
              {!insufficient && parsedAmount > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground pt-1">
                  <span>Balance after withdrawal</span>
                  <span className="font-mono">${(balance - parsedAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>

            <div className="pt-2 rounded-xl bg-muted/30 border border-border p-3 text-xs text-muted-foreground space-y-1.5">
              <div className="font-semibold text-foreground flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-warning"/> How it works</div>
              <p>1. Choose method and amount</p>
              <p>2. Enter your payout account details</p>
              <p>3. Funds are held pending review</p>
              <p>4. Admin verifies and sends to your account</p>
            </div>

            <p className="text-xs text-center text-muted-foreground">🔒 Secured by 256-bit SSL encryption</p>
          </div>
        </div>
      </div>
    </div>
  );
}
