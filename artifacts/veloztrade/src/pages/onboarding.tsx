import { useEffect, useState } from "react";
import { useUser } from "@clerk/react";
import { CheckCircle, ArrowRight, Shield, AlertTriangle, X, ChevronDown, Lock } from "lucide-react";
import { useLocation } from "wouter";

const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, "");

const ACCOUNT_TYPES = [
  {
    id: "silver",
    name: "Silver",
    badge2: "🥈",
    minDeposit: "$250",
    spread: "From 0.3 pips",
    commission: "None",
    leverage: "Forex 1:1000 · Stocks 1:10 · Crypto 1:5",
    features: [
      "2,000+ instruments",
      "Demo account ($10,000 virtual)",
      "24/7 customer support",
      "All major asset classes",
      "Standard charting tools",
      "Email & SMS alerts",
    ],
    color: "border-border",
    highlight: "border-slate-400/50",
    btnClass: "bg-slate-600 hover:bg-slate-700 text-white",
    badge: null,
    upgrade: "Upgrade to Gold for ECN pricing",
  },
  {
    id: "gold",
    name: "Gold",
    badge2: "🥇",
    minDeposit: "$2,500",
    spread: "From 0.2 pips",
    commission: "$2.50/lot",
    leverage: "Forex 1:1000 · Stocks 1:10 · Crypto 1:5",
    features: [
      "2,000+ instruments",
      "Raw ECN pricing",
      "Priority 24/7 support",
      "Advanced analytics suite",
      "Commodities 1:100 leverage",
      "Custom price alerts",
    ],
    color: "border-primary/50",
    highlight: "border-primary/70",
    btnClass: "bg-primary hover:bg-primary/90 text-primary-foreground",
    badge: "Most Popular",
    upgrade: "Upgrade to Platinum for dedicated manager",
  },
  {
    id: "platinum",
    name: "Platinum",
    badge2: "💎",
    minDeposit: "$10,000",
    spread: "From 0.1 pips",
    commission: "$1.50/lot",
    leverage: "Forex 1:1000 · Stocks 1:10 · Crypto 1:5",
    features: [
      "2,000+ instruments",
      "Zero-spread on majors",
      "Dedicated account manager",
      "Indices 1:10 leverage",
      "VIP market research",
      "Priority withdrawals",
    ],
    color: "border-amber-400/40",
    highlight: "border-amber-400/70",
    btnClass: "bg-amber-500 hover:bg-amber-600 text-white",
    badge: "Best Value",
    upgrade: "Upgrade to VIP for ultimate access",
  },
  {
    id: "vip",
    name: "VIP",
    badge2: "👑",
    minDeposit: "$50,000",
    spread: "0.0 pips",
    commission: "Volume-based",
    leverage: "Forex 1:1000 · Stocks 1:10 · Crypto 1:5",
    features: [
      "2,000+ instruments",
      "Personal account manager",
      "Custom leverage tiers",
      "Priority withdrawals (4h)",
      "Exclusive market research",
      "API access + co-location",
    ],
    color: "border-violet-500/40",
    highlight: "border-violet-500/70",
    btnClass: "bg-violet-600 hover:bg-violet-700 text-white",
    badge: "Exclusive",
    upgrade: null,
  },
];

const TERMS_TEXT = `
VELOZ TRADE – GLOBAL FEE SCHEDULE, TERMS OF SERVICE & RISK DISCLOSURE
Version 2.0 | Effective: May 31, 2023 | Legal Entity: Veloz Trade LTD

══════════════════════════════════════════════════════════════
PART A — COMPLETE FEE SCHEDULE (GLOBAL)
══════════════════════════════════════════════════════════════

1. ACCOUNT TYPES & SPREAD MODEL

Standard Account (Beginners & Casual Traders)
  EUR/USD Spread: 0.5–0.7 pips average | Commission: $0 (built into spread)
  Min. Deposit: $250 | Max Leverage: 1:1000

Gold Account (Active Day Traders)
  EUR/USD Spread: Raw + 0.0 pips base | Commission: $3.00–$3.50 per lot per side
  Min. Deposit: $2,500 | Max Leverage: 1:1000

Platinum Account (Professional Traders)
  EUR/USD Spread: From 0.1 pips | Commission: $1.50 per lot per side
  Min. Deposit: $10,000 | Max Leverage: 1:1000

VIP Account (Institutional & High-Net-Worth)
  EUR/USD Spread: 0.0 pips | Commission: Volume-based
  Min. Deposit: $50,000 | Max Leverage: 1:1000

Base Currencies: USD, EUR, GBP, JPY, CHF, AUD, CAD, NZD, SGD, HKD

2. LEVERAGE BY ASSET CLASS (FIXED — NOT USER ADJUSTABLE)

  Forex (Currencies): 1:1000
  Commodities (Gold, Silver, Oil): 1:100
  Stocks (CFDs): 1:10
  Indices (S&P 500, DAX, FTSE): 1:10
  Cryptocurrencies (BTC, ETH, etc.): 1:5

Margin Call Level: 100% | Stop Out Level: 50%
Negative Balance Protection: Provided to all retail clients

3. OVERNIGHT (SWAP) FINANCING

  Forex & Commodities: Triple swap on Wednesday
  Indices, Stocks, ETFs, Crypto, Oils: Triple swap on Friday
  Islamic (Swap-Free) Account: Zero swap for first 10 calendar days; standard rates thereafter

4. DEPOSIT & WITHDRAWAL FEES

  Platform Deposit Fee: $0
  Platform Withdrawal Fee: $0
  Minimum Withdrawal: $10 USD
  Processing: 24 hours (e-wallets) | 1–3 business days (bank wire)
  Note: Third-party providers (banks, card issuers, e-wallets) may apply their own fees.
  Veloz Trade has no control over and is not responsible for third-party fees.

5. INACTIVITY (DORMANCY) FEE

  12 consecutive months without login AND no open positions: $10/month
  Fee stops immediately upon trading activity or login.

6. CURRENCY CONVERSION FEE

  0.5% applied when deposit currency differs from account base currency.

7. COPY TRADING PERFORMANCE FEE (IF USED)

  Standard Account: 20.00% of profit on profitable copied trades
  Silver: 15.00% | Gold: 12.50% | Platinum: 10.00% | VIP/Diamond: 7.50%
  Fee charged only on profitable closed copied trades.

══════════════════════════════════════════════════════════════
PART B — TERMS AND CONDITIONS OF SERVICE
══════════════════════════════════════════════════════════════

1. INTRODUCTION AND SCOPE

1.1 These Terms and Conditions ("Terms") govern the contractual relationship between Veloz Trade LTD ("Veloz Trade," "we," "us," or "our") and any natural or legal person ("Client," "you," "your") who opens a trading account, accesses our trading platform (web, mobile, or API), or uses any of our services.

1.2 By registering for an account, you confirm that you have read, understood, and agree to be bound by these Terms, together with our Risk Disclosure Notice, Order Execution Policy, Conflict of Interest Policy, and Privacy Policy.

1.3 HIGH RISK WARNING: CFDs are complex instruments and come with a high risk of losing money rapidly due to leverage. You should consider whether you understand how CFDs work and whether you can afford the high risk of losing your money. A significant percentage of retail investor accounts lose money when trading CFDs. Past performance is not indicative of future results.

2. ELIGIBILITY AND ACCOUNT OPENING

2.1 Minimum Age: You must be at least 18 years old to open an account.

2.2 Prohibited Jurisdictions: You may not open an account if you are a resident of the United States of America, Canada, Belgium, Iran, North Korea, the EU/EEA, Japan, the United Kingdom, or any country sanctioned by the EU. It is your sole responsibility to ensure your use of our services is lawful in your jurisdiction.

2.3 Verification (KYC): You must provide valid government-issued identification, proof of address, and any other documents we reasonably request as part of our AML and KYC obligations.

3. TRADING ON MARGIN AND CFDS

3.1 Leverage: Leverage is fixed by asset class as stated in Part A. Leverage can magnify both profits and losses. A small adverse market movement can result in the loss of all deposited funds.

3.2 Margin Requirements: You must maintain sufficient funds to cover initial and maintenance margin at all times.

3.3 Negative Balance Protection: Retail clients are granted negative balance protection. Your liability is limited to the funds in your trading account.

3.4 Margin Call (100%): When equity falls below 100% of required margin, we issue a notification. You are solely responsible for monitoring your account.

3.5 Stop Out (50%): If equity falls to or below 50% of required margin, we reserve the right to automatically close open positions without further notice.

4. FINANCIAL CHARGES AND FEES

4.1 Spreads: Variable; may widen during volatile market conditions.
4.2 Commissions: As per your account tier (see Part A).
4.3 Overnight Financing (Swap): Positions held after 23:59 GMT server time incur daily swap fees.
4.4 Deposit and Withdrawal: Veloz Trade charges $0. Third-party fees may apply.
4.5 Inactivity Fee: $10/month after 12 consecutive inactive months.
4.6 Currency Conversion: 0.5% when applicable.

5. DEPOSITS, WITHDRAWALS AND CLIENT FUNDS

5.1 Funds must originate from an account in your own name. Third-party payments are strictly prohibited.
5.2 Client funds are held in segregated bank accounts, completely separate from operational funds.
5.3 Minimum withdrawal: $10 USD. Processed within 24 hours (e-wallets) or 1–3 business days (wire).

6. PROHIBITED CONDUCT

You agree not to:
- Use the platform for money laundering, fraud, or any illegal purpose
- Engage in latency arbitrage, price manipulation, or abusive automated trading
- Provide false or misleading information during registration or verification
- Allow any third party to access your trading account
- Exploit platform errors or pricing anomalies

Violation may result in immediate account termination, forfeiture of profits, and reporting to authorities.

7. TERMINATION

7.1 By Client: You may close your account at any time by providing written notice after closing all positions.
7.2 By Veloz Trade: We may suspend or terminate your account immediately for breach of Terms, fraud, or regulatory requirement.
7.3 Upon termination, open positions will be closed at market prices, fees deducted, and remaining balance returned.

8. LIMITATION OF LIABILITY

To the maximum extent permitted by law, Veloz Trade shall not be liable for any indirect, incidental, or consequential losses. Our total aggregate liability shall not exceed the total fees paid by you in the six months preceding any claim.

9. GOVERNING LAW AND DISPUTE RESOLUTION

These Terms are governed by the laws of the jurisdiction of Veloz Trade's registration. Disputes shall first be addressed through good-faith negotiations. If not resolved within 30 days, they shall be submitted to binding arbitration at Veloz Trade's discretion.

10. AMENDMENTS

We may update these Terms with 7 days' notice via email or platform notification. Continued use after the effective date constitutes acceptance.

══════════════════════════════════════════════════════════════
PART C — RISK DISCLOSURE DOCUMENT
══════════════════════════════════════════════════════════════

1. HIGH RISK OF LOSS
Trading CFDs carries a substantial risk of loss. You should not trade with money you cannot afford to lose. You may lose all of your invested capital.

2. LEVERAGE RISK
Leverage allows control of large positions with small deposits. While leverage can magnify profits, it equally magnifies losses. Veloz Trade offers up to 1:1000 on Forex — this significantly increases risk.

3. MARKET VOLATILITY RISK
CFD prices can change rapidly due to economic announcements, political events, or market sentiment. Gapping can cause losses that exceed your stop loss levels.

4. COUNTERPARTY RISK
CFDs are OTC products traded directly with Veloz Trade as counterparty. There is no central exchange. You rely on Veloz Trade's financial stability and execution integrity.

5. LIQUIDITY AND EXECUTION RISK
In fast-moving markets, slippage may occur. Stop loss orders may not execute at your specified price. Veloz Trade does not guarantee fill prices.

6. TECHNICAL RISK
Trading platforms, internet connections, and data feeds may experience failures. Veloz Trade is not liable for losses caused by technical issues beyond our reasonable control.

7. CURRENCY CONVERSION RISK
If your account base currency differs from the traded asset's currency, exchange rate fluctuations and our 0.5% conversion fee will affect final returns.

8. INACTIVITY RISK
Accounts inactive for 12 months incur a $10/month fee. Funds may be depleted over time if you forget your account.

9. COPY TRADING RISK
Past performance of copied traders does not guarantee future results. You may lose money even when copying a profitable trader. Performance fees apply only on profits.

10. NO INVESTMENT ADVICE
Veloz Trade does not provide personal investment advice. Any market commentary is for informational purposes only. You are solely responsible for all trading decisions.

11. YOUR REPRESENTATION
By trading with Veloz Trade, you confirm that you:
- Understand all risks described above
- Have sufficient financial resources to bear these risks
- Are not relying on any profit guarantees from Veloz Trade
- Will not trade with funds required for living expenses

══════════════════════════════════════════════════════════════
CONTACT INFORMATION
══════════════════════════════════════════════════════════════

Legal: legal@veloztrade.com
Support: support@veloztrade.com
Complaints: complaints@veloztrade.com

Registered Address: 17 Midas Avenue, Olympus, Pretoria, Gauteng 0081, South Africa
FSCA License Number: 51748 | Effective: 31/05/2023
Company Registration: 2023/786745/09
`.trim();

function TermsModal({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [checked1, setChecked1] = useState(false);
  const [checked2, setChecked2] = useState(false);
  const [checked3, setChecked3] = useState(false);

  const canAccept = scrolled && checked1 && checked2 && checked3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-destructive"/>
            </div>
            <div>
              <div className="font-bold text-base">Terms & Conditions</div>
              <div className="text-xs text-muted-foreground">You must read and agree to continue</div>
            </div>
          </div>
          <button onClick={onDecline} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
            <X className="w-4 h-4"/>
          </button>
        </div>

        {/* Scrollable T&C */}
        <div
          className="flex-1 overflow-y-auto p-5 text-xs text-muted-foreground leading-relaxed font-mono whitespace-pre-wrap"
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) setScrolled(true);
          }}
        >
          {TERMS_TEXT}
          <div className="h-8"/>
        </div>

        {/* Scroll indicator */}
        {!scrolled && (
          <div className="px-5 py-2 bg-muted/30 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
            <ChevronDown className="w-4 h-4 animate-bounce"/>
            Please scroll to the bottom to read all terms
          </div>
        )}

        {/* Checkboxes */}
        <div className="p-5 border-t border-border space-y-3 shrink-0">
          {[
            { id: "c1", state: checked1, set: setChecked1, label: "I confirm I have read, understood, and agree to all Terms & Conditions above, including the Risk Warning." },
            { id: "c2", state: checked2, set: setChecked2, label: "I acknowledge that trading CFDs and leveraged instruments carries high risk of loss, and I may lose my entire deposit." },
            { id: "c3", state: checked3, set: setChecked3, label: "I confirm I am at least 18 years of age, legally permitted to trade in my jurisdiction, and not a resident of any restricted country." },
          ].map(({ id, state, set, label }) => (
            <label key={id} className="flex items-start gap-3 cursor-pointer group">
              <div
                onClick={() => set(!state)}
                className={`w-5 h-5 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all cursor-pointer ${state ? "bg-primary border-primary" : "border-border group-hover:border-primary/50"}`}
              >
                {state && <CheckCircle className="w-3 h-3 text-white"/>}
              </div>
              <span className="text-xs text-muted-foreground leading-relaxed">{label}</span>
            </label>
          ))}

          <div className="flex gap-3 pt-2">
            <button onClick={onDecline} className="flex-1 py-2.5 rounded-xl border border-border text-sm hover:bg-muted transition-all">
              Decline & Cancel
            </button>
            <button
              onClick={onAccept}
              disabled={!canAccept}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {!canAccept && <Lock className="w-3.5 h-3.5"/>}
              I Agree & Continue
            </button>
          </div>
          {!scrolled && <p className="text-center text-[10px] text-muted-foreground">Scroll through all terms to enable agreement</p>}
        </div>
      </div>
    </div>
  );
}

export function Onboarding() {
  const { user, isLoaded } = useUser();
  const [, setLocation] = useLocation();
  const [selected, setSelected] = useState<string>("silver");
  const [showTerms, setShowTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<"select" | "terms" | "done">("select");

  useEffect(() => {
    document.title = "Account Setup | VelozTrade";
  }, []);

  useEffect(() => {
    if (isLoaded && (user?.publicMetadata as any)?.accountTier) {
      setLocation("/dashboard");
    }
  }, [isLoaded, user, setLocation]);

  const handleSelectAndContinue = () => {
    setShowTerms(true);
  };

  const handleTermsAccept = async () => {
    setShowTerms(false);
    setTermsAccepted(true);
    setSaving(true);
    try {
      const res = await fetch(`${BASE_PATH}/api/account`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accountTier: selected, termsAccepted: true }),
      });
      if (!res.ok) {
        localStorage.setItem("vt_account_tier", selected);
        localStorage.setItem("vt_terms_accepted", "true");
      }
    } catch {
      localStorage.setItem("vt_account_tier", selected);
      localStorage.setItem("vt_terms_accepted", "true");
    } finally {
      setSaving(false);
      // Generate unique trader code based on email + tier + timestamp
      const email = user?.emailAddresses?.[0]?.emailAddress ?? "unknown";
      const code = "VT-" + btoa(email + selected + Date.now()).replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 8);
      localStorage.setItem("vt_trader_code", code);
      setLocation("/dashboard");
    }
  };

  const selectedType = ACCOUNT_TYPES.find(a => a.id === selected);

  return (
    <>
      {showTerms && (
        <TermsModal
          onAccept={handleTermsAccept}
          onDecline={() => setShowTerms(false)}
        />
      )}

      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(0,114,255,0.08)_0%,transparent_60%)]"/>
        <div className="relative z-10 w-full max-w-6xl">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold tracking-wide uppercase mb-4">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"/>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"/>
              </span>
              Step 1 of 2 — Account Setup
            </div>
            <h1 className="text-3xl md:text-4xl font-black mb-3">Choose Your Account Type</h1>
            <p className="text-muted-foreground text-base max-w-xl mx-auto">
              Select the tier that matches your experience and capital. You can upgrade at any time inside your dashboard.
            </p>
          </div>

          {/* Account cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {ACCOUNT_TYPES.map((acct) => (
              <button
                key={acct.id}
                onClick={() => setSelected(acct.id)}
                className={`relative text-left glass-card rounded-2xl p-5 border-2 transition-all ${
                  selected === acct.id
                    ? acct.highlight + " ring-2 ring-primary/40 scale-[1.02] shadow-[0_0_24px_rgba(0,82,255,0.15)]"
                    : acct.color + " hover:scale-[1.01]"
                }`}
              >
                {acct.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full bg-primary text-primary-foreground whitespace-nowrap shadow-md">
                    {acct.badge}
                  </div>
                )}
                {selected === acct.id && (
                  <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow">
                    <CheckCircle className="w-4 h-4 text-white"/>
                  </div>
                )}

                <div className="mb-4 mt-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{acct.badge2}</span>
                    <div className="text-xl font-black">{acct.name}</div>
                  </div>
                  <div className="text-2xl font-black gradient-text">{acct.minDeposit}</div>
                  <div className="text-xs text-muted-foreground">min. deposit</div>
                </div>

                <div className="space-y-1.5 mb-4">
                  {[
                    { label: "Spread", value: acct.spread },
                    { label: "Commission", value: acct.commission },
                    { label: "Leverage", value: "Up to 1:1000" },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between items-center py-0.5 border-b border-border/30 last:border-0">
                      <span className="text-muted-foreground text-xs">{row.label}</span>
                      <span className="font-bold text-xs">{row.value}</span>
                    </div>
                  ))}
                </div>

                <ul className="space-y-1.5 mb-4">
                  {acct.features.map(f => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle className="w-3 h-3 text-success shrink-0 mt-0.5"/>
                      {f}
                    </li>
                  ))}
                </ul>

                {acct.upgrade && (
                  <div className="text-[10px] text-muted-foreground/60 border-t border-border/20 pt-2">
                    ↑ {acct.upgrade}
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Selected summary + CTA */}
          {selectedType && (
            <div className="glass-card rounded-2xl p-5 border border-primary/20 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{selectedType.badge2}</span>
                <div>
                  <div className="font-bold">{selectedType.name} Account Selected</div>
                  <div className="text-sm text-muted-foreground">
                    Min. deposit: {selectedType.minDeposit} · {selectedType.spread} spreads
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield className="w-3.5 h-3.5 text-primary shrink-0"/>
                You can upgrade inside Dashboard → Profile anytime
              </div>
            </div>
          )}

          <div className="text-center">
            <button
              onClick={handleSelectAndContinue}
              disabled={!selected || saving}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-10 py-4 rounded-xl font-bold text-base hover:bg-primary/90 transition-all disabled:opacity-40 animate-glow-pulse shadow-[0_0_32px_rgba(0,212,255,0.2)]"
            >
              {saving ? "Setting up…" : <>Continue to Terms & Conditions <ArrowRight className="w-5 h-5"/></>}
            </button>
            <p className="text-center text-xs text-muted-foreground mt-3">
              Step 2: You will be required to read and accept our full Terms & Conditions
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
