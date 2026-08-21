import { useEffect, useState } from "react";
import { useGetAccount, useListCryptoDepositHistory } from "@workspace/api-client-react";
import {
  CreditCard, Building2, Bitcoin, Smartphone, CheckCircle,
  ArrowRight, Loader2, ShieldCheck, AlertCircle, Clock, Info, Lock, Copy, Check,
  Wallet, ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { CryptoWalletDeposit } from "@/components/crypto-wallet-deposit";
import { BuyUsdtModal } from "@/components/buy-usdt-modal";

const EASYPAISA_QR = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAcIAAAHCAQAAAABUY/ToAAADtklEQVR4nO2cUY6kOAyGf28i9SNIfYA6SrjBHmk1R5obkKPUAVYijyUF/fsQG8KoZx5mGlXRaz/QouETRLLs33YoIX7P8l+/CQJOOumkk0466aSTr0eKWgTyuIpMJQJoBxEAq8hU7K7pyW/r5EuSiSS5AAAC+e32aJ6DfKtQl0IgSfJIPuNtnXwpMurfMgLpu/03LaAAgKRlBTAQQAEECPWPn+nklydXaRkskdSEhtUy2EnPdPIrken+RpkQLGUNFZxPfqaTlyYtl+3ZangIUVYBsEZmCUT++18QBegbktdap5PnkehlMgKRlp8e7K5EkvO11unkeWSLQ3t8Yb49hMBDkMcA5jHAbjmORa61TifPJmXCKsgSIVOJkKm8US8MFWhV/rjKZz7Tya9Gloimn8kK85dV9p6R+lWJkOnpb+vkK5GWywog6S4gWkm2RgJrBMp7tVveIQAsGF1rnU6eR6qmTksgMFj/EAM7Ec0ZgcBAkqyNcE3t5GbcbHekbuoxD33V1k69LnPyAzKLCOcWhwJFxkCkZZUmlHSaZg3sp7+tky9FNj0kaXmvAmj9bgdCEldhFp2SCYbFBNG11unkeaSpmz1RLYAe7EITSmmTQq6HnDyY+UQFuQRyBmCy5+A57cJGuA85aaYeMVArr9nGrc2v5qFCxTZCk9OuqZ08WpfLuGgJj7SEbkualvUWpdyHnDzaXtZb4NG81bWLWqdosHTnuczJn5IlAukeoYHnbvOPbzcS6R4h01Ah02c+08nLk9usYxVgqBF50kE98tQqeu0x5jFU5H3seq11OnkeaXXZAuwqqCkjnXXsRf9e5Xsuc3I36zHONdrWoVAlzQ8hCoA0A2jTV6xCYLW4dK11Onke2c9c07J3gCoOOluHID4vc/IDs/5QxV7WmzeFrULbyn96LnPyR7M4ZCoI0GCk3kQNQf3N7kNO9rYPMnS4sVg7GuiDUec+3h9y8mDNNzCwTTP2WUe7OsPk0W4eh5w8GI+mWc3mH+2eZCpIJZP7kJOdaW2vZ6ESJVRJs+4V4rafuu2sTt+3JuO11unkeaR+59raQOV9+851bG0gPUWgdLut//CZTn5NsujvCjV1nW8k8rhKG5pliW27rOmmZ7+tk69Exh/OBXijAGJxCKFqVtNmdfQ+tZO/JDkPDyFJyj/3N/3MYy4RbZ8+AMj0yc908trkoe+zhG6rWd/ABrq6zPtDTh5N+0PNbMsrts7iDEB3ow30ub2TH5j4b5w76aSTTjrppJP/c/I/u+8Dk/qJJfQAAAAASUVORK5CYII=";
const BTC_ADDRESS = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";
const ETH_ADDRESS    = "0x9d79b3f48c670b4d34af3Cd80059FFA3caF9E894";
const USDT_ETH_ADDRESS = "0xe284557913137BFe780276469C9319D653361bbd";
const USDT_SOL_ADDRESS = "FGS1Cu3i1GXJriXsi9XaXxgXgLLK3CXbL5nhcp1bDBsJ";

const METHODS = [
  { id: "card",      label: "Credit / Debit Card",   icon: CreditCard, desc: "Visa, Mastercard, Amex",    time: "1-24 hrs",  fee: "0%", badge: "Popular", locked: true },
  { id: "bank",      label: "Bank Wire Transfer",     icon: Building2,  desc: "Local & international",     time: "1-3 days",  fee: "0%", badge: null,      locked: true },
  { id: "crypto",    label: "Cryptocurrency",         icon: Bitcoin,    desc: "BTC, ETH, USDT (ERC-20/Solana)", time: "1-6 hrs", fee: "0%", badge: "Fast", locked: false },
  { id: "ewallet",   label: "E-Wallet",               icon: Smartphone, desc: "Skrill, Neteller, PayPal",  time: "1-24 hrs",  fee: "0%", badge: null,      locked: true },
  { id: "jazzcash",  label: "JazzCash",               icon: Smartphone, desc: "Pakistan mobile wallet",    time: "1-6 hrs",   fee: "0%", badge: "🇵🇰 PK", locked: true },
  { id: "easypaisa", label: "Easypaisa",              icon: Smartphone, desc: "Pakistan mobile wallet",    time: "1-6 hrs",   fee: "0%", badge: "🇵🇰 PK", locked: false },
  { id: "upi",       label: "UPI",                    icon: Smartphone, desc: "India Unified Payments",    time: "1-6 hrs",   fee: "0%", badge: "🇮🇳 IN", locked: false },
];

const AMOUNTS = [250, 500, 1000, 5000, 10000];

interface ProofField { id: string; label: string; placeholder: string; required: boolean }

function getProofFields(method: string): ProofField[] {
  switch (method) {
    case "card":
      return [
        { id: "cardHolder",  label: "Cardholder Name",          placeholder: "Name as on card",              required: true  },
        { id: "cardLast4",   label: "Card Last 4 Digits",        placeholder: "e.g. 4242",                    required: true  },
        { id: "bankName",    label: "Issuing Bank",              placeholder: "e.g. HBL, Meezan, Citibank",  required: false },
        { id: "txnId",       label: "Transaction / Auth ID",     placeholder: "Reference number (if any)",    required: false },
      ];
    case "bank":
      return [
        { id: "txnId",       label: "Transaction / Reference No.", placeholder: "Wire reference or TRN",      required: true  },
        { id: "bankName",    label: "Sending Bank",              placeholder: "e.g. Standard Chartered",      required: true  },
        { id: "senderName",  label: "Account Holder Name",       placeholder: "Name on bank account",         required: true  },
        { id: "iban",        label: "IBAN / Account No. (last 4)", placeholder: "e.g. ****1234",             required: false },
      ];
    case "crypto":
      return [
        { id: "txnId",       label: "Transaction Hash / TXID",   placeholder: "Blockchain transaction hash / TXID",   required: true  },
        { id: "fromWallet",  label: "Sending Wallet Address",    placeholder: "Address you sent from",                required: true  },
        { id: "coin",        label: "Coin & Network Used",       placeholder: "e.g. BTC, ETH, USDT ERC-20, USDT Solana", required: true },
      ];
    case "ewallet":
      return [
        { id: "txnId",       label: "Transaction ID",            placeholder: "Transaction reference",         required: true  },
        { id: "email",       label: "Wallet Email / Account",    placeholder: "Email used to send",            required: true  },
        { id: "walletType",  label: "Wallet Type",               placeholder: "e.g. Skrill, Neteller, PayPal", required: true  },
      ];
    case "jazzcash":
      return [
        { id: "txnId",       label: "JazzCash Transaction ID",   placeholder: "Transaction reference",         required: true  },
        { id: "phone",       label: "Mobile Number Used",        placeholder: "03XXXXXXXXX",                   required: true  },
        { id: "senderName",  label: "Account Holder Name",       placeholder: "Registered name on JazzCash",   required: true  },
      ];
    case "easypaisa":
      return [
        { id: "txnId",       label: "Easypaisa Transaction ID",  placeholder: "Transaction reference",         required: true  },
        { id: "phone",       label: "Mobile Number Used",        placeholder: "03XXXXXXXXX",                   required: true  },
        { id: "senderName",  label: "Account Holder Name",       placeholder: "Registered name on Easypaisa",  required: true  },
      ];
    case "upi":
      return [
        { id: "txnId",       label: "UTR / UPI Reference No.",   placeholder: "12-digit UTR number",           required: true  },
        { id: "upiId",       label: "UPI ID Used",               placeholder: "yourname@upi",                  required: true  },
        { id: "senderName",  label: "Account Holder Name",       placeholder: "Name on bank account",          required: false },
      ];
    default:
      return [
        { id: "txnId",       label: "Transaction Reference",     placeholder: "Any reference / ID",            required: true  },
      ];
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-xs px-3 py-1.5 rounded-lg bg-primary/20 text-primary font-semibold hover:bg-primary/30 transition-all shrink-0 flex items-center gap-1"
    >
      {copied ? <><Check className="w-3 h-3"/> Copied!</> : <><Copy className="w-3 h-3"/> Copy</>}
    </button>
  );
}

export function Deposit() {
  useEffect(() => { document.title = "Deposit | VelozTrade"; }, []);

  const { data: account } = useGetAccount();
  const [step, setStep]           = useState<1 | 2 | 3>(1);
  const [method, setMethod]       = useState("upi");
  const [cryptoNetwork, setCryptoNetwork] = useState<"btc" | "eth" | "usdt_eth" | "usdt_sol">("usdt_eth");
  const [amount, setAmount]       = useState("500");
  const [proof, setProof]         = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [requestId, setRequestId] = useState<number | null>(null);
  const [tcChecked, setTcChecked] = useState(false);
  const [cryptoWalletMode, setCryptoWalletMode] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);

  // ── Currency Converter ─────────────────────────────────────────────
  const [localCurrency, setLocalCurrency] = useState("INR");
  const [localAmount, setLocalAmount] = useState("");
  const [fxRates, setFxRates] = useState<Record<string, number>>({});
  const [fxLoading, setFxLoading] = useState(false);
  const [fxError, setFxError] = useState(false);

  // Fetch live FX rates from exchangerate.host (free, no key)
  const fetchFxRates = () => {
    setFxLoading(true);
    setFxError(false);
    fetch("https://api.exchangerate-api.com/v4/latest/USD")
      .then(r => r.json())
      .then(d => { setFxRates(d.rates ?? {}); setFxLoading(false); })
      .catch(() => {
        setFxRates({
          USD:1,EUR:0.92,GBP:0.79,JPY:149.5,CHF:0.89,AUD:1.53,CAD:1.36,NZD:1.63,
          SGD:1.34,HKD:7.82,PKR:279,INR:83.5,AED:3.67,SAR:3.75,QAR:3.64,KWD:0.308,
          BHD:0.377,OMR:0.385,TRY:32.1,ZAR:18.6,EGP:30.9,NGN:1550,GHS:12.5,
          KES:129,TZS:2520,UGX:3780,BRL:4.97,MXN:17.2,CLP:950,COP:3920,ARS:875,
          PEN:3.73,MYR:4.72,THB:35.2,IDR:15780,PHP:56.8,VND:24500,BDT:110,LKR:320,
          TWD:31.5,KRW:1330,CNY:7.24,RUB:89,UAH:38,PLN:4.01,CZK:23.1,HUF:353,
          RON:4.65,SEK:10.5,NOK:10.7,DKK:6.88,MAD:10.1,DZD:134,TND:3.11,
        });
        setFxLoading(false);
        setFxError(true);
      });
  };
  useEffect(() => {
    fetchFxRates();
    const timer = setInterval(fetchFxRates, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // Currencies with metadata
  const CURRENCIES: Array<{ code: string; name: string; flag: string; fee: string }> = [
    { code:"USD", name:"US Dollar",        flag:"🇺🇸", fee:"0%" },
    { code:"EUR", name:"Euro",             flag:"🇪🇺", fee:"0.5%" },
    { code:"GBP", name:"British Pound",    flag:"🇬🇧", fee:"0.5%" },
    { code:"PKR", name:"Pakistani Rupee",  flag:"🇵🇰", fee:"1%" },
    { code:"INR", name:"Indian Rupee",     flag:"🇮🇳", fee:"0.5%" },
    { code:"AED", name:"UAE Dirham",       flag:"🇦🇪", fee:"0%" },
    { code:"SAR", name:"Saudi Riyal",      flag:"🇸🇦", fee:"0%" },
    { code:"QAR", name:"Qatari Riyal",     flag:"🇶🇦", fee:"0%" },
    { code:"KWD", name:"Kuwaiti Dinar",    flag:"🇰🇼", fee:"0%" },
    { code:"BHD", name:"Bahraini Dinar",   flag:"🇧🇭", fee:"0%" },
    { code:"OMR", name:"Omani Rial",       flag:"🇴🇲", fee:"0%" },
    { code:"JPY", name:"Japanese Yen",     flag:"🇯🇵", fee:"0.5%" },
    { code:"CHF", name:"Swiss Franc",      flag:"🇨🇭", fee:"0.5%" },
    { code:"AUD", name:"Australian Dollar",flag:"🇦🇺", fee:"0.5%" },
    { code:"CAD", name:"Canadian Dollar",  flag:"🇨🇦", fee:"0.5%" },
    { code:"SGD", name:"Singapore Dollar", flag:"🇸🇬", fee:"0.5%" },
    { code:"HKD", name:"HK Dollar",        flag:"🇭🇰", fee:"0.5%" },
    { code:"NZD", name:"NZ Dollar",        flag:"🇳🇿", fee:"0.5%" },
    { code:"TRY", name:"Turkish Lira",     flag:"🇹🇷", fee:"1%" },
    { code:"ZAR", name:"South African Rand",flag:"🇿🇦",fee:"1%" },
    { code:"NGN", name:"Nigerian Naira",   flag:"🇳🇬", fee:"1.5%" },
    { code:"KES", name:"Kenyan Shilling",  flag:"🇰🇪", fee:"1.5%" },
    { code:"GHS", name:"Ghanaian Cedi",    flag:"🇬🇭", fee:"1.5%" },
    { code:"EGP", name:"Egyptian Pound",   flag:"🇪🇬", fee:"1.5%" },
    { code:"BRL", name:"Brazilian Real",   flag:"🇧🇷", fee:"1%" },
    { code:"MXN", name:"Mexican Peso",     flag:"🇲🇽", fee:"1%" },
    { code:"MYR", name:"Malaysian Ringgit",flag:"🇲🇾", fee:"0.5%" },
    { code:"THB", name:"Thai Baht",        flag:"🇹🇭", fee:"0.5%" },
    { code:"IDR", name:"Indonesian Rupiah",flag:"🇮🇩", fee:"1%" },
    { code:"PHP", name:"Philippine Peso",  flag:"🇵🇭", fee:"0.5%" },
    { code:"BDT", name:"Bangladeshi Taka", flag:"🇧🇩", fee:"1%" },
    { code:"CNY", name:"Chinese Yuan",     flag:"🇨🇳", fee:"0.5%" },
    { code:"KRW", name:"Korean Won",       flag:"🇰🇷", fee:"0.5%" },
    { code:"SEK", name:"Swedish Krona",    flag:"🇸🇪", fee:"0.5%" },
    { code:"NOK", name:"Norwegian Krone",  flag:"🇳🇴", fee:"0.5%" },
    { code:"PLN", name:"Polish Zloty",     flag:"🇵🇱", fee:"0.5%" },
    { code:"MAD", name:"Moroccan Dirham",  flag:"🇲🇦", fee:"1%" },
  ];

  const selectedCurrencyMeta = CURRENCIES.find(c => c.code === localCurrency) ?? CURRENCIES[0];
  const rate = fxRates[localCurrency] ?? 1;
  const feeRate = parseFloat(selectedCurrencyMeta.fee) / 100;

  // Compute USD from local amount
  const localNum = parseFloat(localAmount) || 0;
  const usdBeforeFee = localNum / rate;
  const feeAmount = usdBeforeFee * feeRate;
  const usdReceived = usdBeforeFee - feeAmount;

  // When user types in local converter, update main USD amount
  const handleLocalAmountChange = (val: string) => {
    setLocalAmount(val);
    const n = parseFloat(val);
    if (!isNaN(n) && n > 0) {
      const usd = (n / rate) * (1 - feeRate);
      setAmount(usd.toFixed(2));
    }
  };

  const { data: cryptoHistoryRaw, isLoading: cryptoHistoryLoading } = useListCryptoDepositHistory();
  const cryptoHistory = Array.isArray(cryptoHistoryRaw) ? cryptoHistoryRaw : [];

  const isReal = !account?.accountType || account.accountType === "real";
  const fields = getProofFields(method);

  const proofComplete = fields
    .filter(f => f.required)
    .every(f => (proof[f.id] ?? "").trim().length > 0);

  const handleMethodChange = (m: string) => {
    const methodData = METHODS.find(x => x.id === m);
    if (methodData?.locked) return;
    setMethod(m); setProof({});
  };

  const handleSubmit = async () => {
    if (!proofComplete) return;
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount < 10) return;

    const proofText = fields
      .map(f => `${f.label}: ${(proof[f.id] ?? "").trim() || "—"}`)
      .join("\n");

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/account/deposit-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsedAmount, method, paymentProof: proofText }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setError(body?.error ?? "Submission failed. Please try again.");
        return;
      }

      const data = await res.json() as { id?: number };
      setRequestId(data.id ?? null);
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
          <h2 className="text-2xl font-bold mb-2">Request Submitted!</h2>
          <p className="text-muted-foreground mb-1">
            Your deposit of{" "}
            <span className="font-bold text-foreground text-lg">
              ${parseFloat(amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>{" "}
            is under review.
          </p>
          <p className="text-sm text-muted-foreground mb-2">
            Our team will verify your payment details and credit your account — usually within 24 hours.
          </p>
          {requestId && (
            <p className="text-xs text-muted-foreground mb-6 font-mono bg-muted/40 inline-block px-3 py-1.5 rounded-lg">
              Request #{requestId}
            </p>
          )}
          <div className="bg-muted/30 border border-border rounded-xl p-4 text-left text-xs text-muted-foreground mb-6 space-y-1">
            <div className="font-semibold text-foreground mb-1.5 flex items-center gap-1.5"><Info className="w-3.5 h-3.5"/> What happens next?</div>
            <p>1. Our team reviews your payment proof</p>
            <p>2. We verify the transaction details you provided</p>
            <p>3. Your balance is credited upon confirmation</p>
            <p>4. You'll be able to start trading immediately after approval</p>
          </div>
          <button
            onClick={() => { setSubmitted(false); setStep(1); setProof({}); setAmount("500"); setError(null); }}
            className="text-sm text-primary hover:underline"
          >
            Submit another deposit
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-1">Deposit Funds</h1>
        <p className="text-muted-foreground">
          {isReal
            ? "Add funds to your real trading account. Deposits are credited after payment verification."
            : "Add funds to your demo trading account."}
        </p>
      </div>

      {/* Account banner */}
      <div className={`glass-card rounded-2xl p-4 flex items-start gap-3 border ${isReal ? "border-success/30 bg-success/5" : "border-primary/20"}`}>
        <ShieldCheck className={`w-5 h-5 shrink-0 mt-0.5 ${isReal ? "text-success" : "text-primary"}`}/>
        <div>
          <div className="font-semibold text-sm mb-0.5">{isReal ? "Real Money Account" : "Demo Account"}</div>
          <p className="text-xs text-muted-foreground">
            {isReal
              ? <>
                  Current balance:{" "}
                  <span className="font-bold text-foreground">
                    ${account?.balance ? parseFloat(String(account.balance)).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "0.00"}
                  </span>.
                  {" "}Submit payment details below — funds are credited after admin verification.
                </>
              : <>
                  Demo balance: <span className="font-bold text-foreground">${account?.balance ? parseFloat(String(account.balance)).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "0.00"}</span>.
                  Switch to a Real account in your profile to trade with real funds.
                </>
            }
          </p>
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {[
          { n: 1, label: "Payment Method" },
          { n: 2, label: "Amount" },
          { n: 3, label: "Payment Proof" },
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

      <div className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 space-y-4">

          {/* Step 1: Method */}
          {step === 1 && (
            <div className="glass-card rounded-2xl p-5">
              <h2 className="font-bold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Choose Payment Method</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {METHODS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => handleMethodChange(m.id)}
                    disabled={m.locked}
                    className={`relative text-left p-4 rounded-xl border transition-all ${
                      m.locked
                        ? "border-border/40 opacity-60 cursor-not-allowed bg-muted/20"
                        : method === m.id
                          ? "border-primary/50 bg-primary/8"
                          : "border-border hover:border-border/80 hover:bg-muted/30"
                    }`}
                  >
                    {m.locked ? (
                      <span className="absolute top-3 right-3"><Lock className="w-3.5 h-3.5 text-muted-foreground"/></span>
                    ) : m.badge ? (
                      <span className="absolute top-3 right-3 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">{m.badge}</span>
                    ) : null}
                    <m.icon className={`w-5 h-5 mb-2 ${m.locked ? "text-muted-foreground/50" : method === m.id ? "text-primary" : "text-muted-foreground"}`}/>
                    <div className="font-semibold text-sm mb-0.5">{m.label}</div>
                    <div className="text-xs text-muted-foreground">{m.locked ? "Coming soon" : m.desc}</div>
                    {!m.locked && (
                      <div className="flex gap-3 mt-2 text-xs">
                        <span className="text-muted-foreground">⏱ {m.time}</span>
                        <span className="text-success">Fee: {m.fee}</span>
                      </div>
                    )}
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
            <div className="glass-card rounded-2xl p-5 space-y-5">
              <h2 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Enter Deposit Amount</h2>

              {/* Currency Converter */}
              <div className="p-4 rounded-xl bg-card border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    💱 Currency Converter
                  </span>
                  {fxLoading && <span className="text-[10px] text-muted-foreground animate-pulse">Loading rates…</span>}
                  {fxError && !fxLoading && <span className="text-[10px] text-amber-400">⚠ Using fallback rates</span>}
                  {!fxLoading && !fxError && <span className="text-[10px] text-success">● Live rates</span>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-muted-foreground font-medium mb-1 block">Your Currency</label>
                    <select
                      value={localCurrency}
                      onChange={e => { setLocalCurrency(e.target.value); setLocalAmount(""); }}
                      className="w-full bg-muted/40 border border-border rounded-lg px-2 py-2 text-xs text-foreground focus:outline-none focus:border-primary font-medium"
                    >
                      {CURRENCIES.map(c => (
                        <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-muted-foreground font-medium mb-1 block">Amount in {localCurrency}</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-bold">{selectedCurrencyMeta.flag}</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={localAmount}
                        onChange={e => handleLocalAmountChange(e.target.value)}
                        placeholder="e.g. 50000"
                        className="w-full pl-7 pr-2 py-2 bg-muted/40 border border-border rounded-lg text-xs font-mono focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-1 pb-0.5">
                    <div className="text-[9px] text-muted-foreground mb-1">≈ USD</div>
                    <div className="font-mono font-black text-primary text-sm">
                      ${localNum > 0 ? usdReceived.toFixed(2) : "0.00"}
                    </div>
                  </div>
                </div>
                {localNum > 0 && (
                  <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                    <div>
                      <div className="font-semibold text-foreground">Rate</div>
                      <div className="font-mono">1 USD = {rate.toFixed(localCurrency === "JPY" || localCurrency === "KRW" || localCurrency === "IDR" || localCurrency === "VND" ? 0 : 4)} {localCurrency}</div>
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">Conversion Fee ({selectedCurrencyMeta.fee})</div>
                      <div className="font-mono text-amber-400">-${feeAmount.toFixed(2)} USD</div>
                    </div>
                    <div>
                      <div className="font-semibold text-success">You Receive</div>
                      <div className="font-mono font-bold text-success">${usdReceived.toFixed(2)} USD</div>
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">
                  {selectedCurrencyMeta.fee === "0%" ? "✅ No conversion fee for " + localCurrency : `⚡ ${selectedCurrencyMeta.fee} conversion fee applies`} · Rates update in real-time
                </p>
              </div>

              <div className="flex gap-2 flex-wrap">
                {AMOUNTS.map(a => (
                  <button
                    key={a}
                    onClick={() => setAmount(String(a))}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${amount === String(a) ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-border/80"}`}
                  >
                    ${a.toLocaleString()}
                  </button>
                ))}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                <Input
                  type="number" min="10" step="10" value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="pl-7 font-mono text-lg"
                  placeholder="500"
                />
              </div>
              <p className="text-xs text-muted-foreground">Minimum deposit: $10 · Maximum: $1,000,000</p>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl border border-border text-sm hover:bg-muted transition-all">Back</button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!amount || parseFloat(amount) < 10}
                  className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  Continue <ArrowRight className="w-4 h-4"/>
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Payment Proof */}
          {step === 3 && (
            <div className="glass-card rounded-2xl p-5 space-y-4">
              <div>
                <h2 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-1">Payment Details & Proof</h2>
                <p className="text-xs text-muted-foreground">
                  Scan the QR code or copy the address to send your payment, then fill in your transaction details below.
                </p>
              </div>

              {/* Crypto mode toggle: Manual TXID vs Connect Wallet */}
              {method === "crypto" && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Submission Method</p>
                  <div className="flex gap-1.5 p-1 bg-muted/40 rounded-xl border border-border">
                    <button
                      onClick={() => setCryptoWalletMode(false)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${!cryptoWalletMode ? "bg-background border border-border/60 shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Manual (TXID)
                    </button>
                    <button
                      onClick={() => setCryptoWalletMode(true)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${cryptoWalletMode ? "bg-primary text-primary-foreground shadow-sm" : "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"}`}
                    >
                      <Wallet className="w-3.5 h-3.5"/> Connect Wallet
                    </button>
                  </div>
                  {!cryptoWalletMode && (
                    <p className="text-xs text-primary/80 flex items-center gap-1.5">
                      <Wallet className="w-3 h-3 shrink-0"/>
                      Use MetaMask or WalletConnect to send directly and auto-verify — tap <strong>Connect Wallet</strong> above.
                    </p>
                  )}
                </div>
              )}

              {/* Wallet mode: show CryptoWalletDeposit component */}
              {method === "crypto" && cryptoWalletMode && (
                <CryptoWalletDeposit />
              )}

              {/* Easypaisa QR */}
              {method === "easypaisa" && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                  <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5"/> Easypaisa — Scan to Pay
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="bg-white p-2 rounded-xl border border-emerald-500/20">
                      <img src={EASYPAISA_QR} alt="Easypaisa QR Code" className="w-28 h-28" />
                    </div>
                    <div className="text-xs text-muted-foreground leading-relaxed">
                      <p className="font-semibold text-foreground mb-1">How to pay:</p>
                      <p>1. Open Easypaisa app</p>
                      <p>2. Tap "Send Money" or "Scan QR"</p>
                      <p>3. Scan this QR code</p>
                      <p>4. Enter the amount: <span className="font-bold text-foreground">${parseFloat(amount || "0").toLocaleString()}</span></p>
                      <p>5. Complete the payment</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">After sending, fill in your transaction details below to confirm your deposit.</p>
                </div>
              )}

              {/* Crypto QR */}
              {method === "crypto" && !cryptoWalletMode && (() => {
                const CRYPTO_OPTIONS = [
                  { id: "btc"       as const, label: "Bitcoin",       ticker: "BTC",  network: "Bitcoin",     address: BTC_ADDRESS,       warn: "Send BTC only on the Bitcoin network.",              locked: true  },
                  { id: "eth"       as const, label: "Ethereum",      ticker: "ETH",  network: "Ethereum",    address: ETH_ADDRESS,       warn: "Send ETH only on the Ethereum network.",             locked: true  },
                  { id: "usdt_eth"  as const, label: "USDT (ERC-20)", ticker: "USDT", network: "ERC-20",      address: USDT_ETH_ADDRESS,  warn: "Send USDT only on the Ethereum (ERC-20) network.",   locked: false },
                  { id: "usdt_sol"  as const, label: "USDT (Solana)", ticker: "USDT", network: "Solana",      address: USDT_SOL_ADDRESS,  warn: "Send USDT only on the Solana network.",              locked: false },
                ];
                const selected = CRYPTO_OPTIONS.find(o => o.id === cryptoNetwork && !o.locked) ?? CRYPTO_OPTIONS[2];
                return (
                  <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Bitcoin className="w-3.5 h-3.5"/> Crypto Deposit — Select Coin
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowBuyModal(true)}
                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all shrink-0"
                      >
                        🇮🇳 Buy USDT via UPI ↗
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      {CRYPTO_OPTIONS.map(opt => (
                        <button
                          key={opt.id}
                          disabled={opt.locked}
                          onClick={() => { if (opt.locked) return; setCryptoNetwork(opt.id); setProof(prev => ({ ...prev, coin: `${opt.ticker} (${opt.network})` })); }}
                          className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 relative
                            ${opt.locked
                              ? "opacity-40 cursor-not-allowed border-border text-muted-foreground bg-muted/10"
                              : cryptoNetwork === opt.id
                                ? "bg-primary/20 border-primary/50 text-primary"
                                : "border-border text-muted-foreground hover:bg-muted/30"}`}
                        >
                          <span className="text-base">{opt.ticker === "BTC" ? "₿" : opt.ticker === "ETH" ? "Ξ" : "₮"}</span>
                          {opt.label}
                          {opt.locked && <span className="ml-auto text-[10px]">🔒</span>}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="bg-white p-2 rounded-xl border border-blue-500/20 shrink-0">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(selected.address)}&margin=4`}
                          alt={`${selected.label} QR Code`}
                          className="w-28 h-28"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground mb-1">{selected.label} Address ({selected.network})</p>
                        <div className="flex items-center gap-2 mb-2">
                          <code className="text-xs font-mono text-foreground bg-muted/40 px-2 py-1 rounded truncate flex-1 block">
                            {selected.address}
                          </code>
                          <CopyButton text={selected.address} />
                        </div>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <p>⚠️ {selected.warn}</p>
                          <p>Amount to send: <strong className="text-foreground">${parseFloat(amount || "0").toLocaleString()} USD worth of {selected.ticker}</strong></p>
                          <p className="text-destructive/80 font-medium">Wrong network = permanent loss of funds.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Manual proof form — hidden in wallet mode */}
              {!(method === "crypto" && cryptoWalletMode) && (
                <>
                  <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-start gap-2 text-xs text-primary">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5"/>
                    <span>
                      Make sure you have already sent the payment via{" "}
                      <span className="font-semibold">{METHODS.find(m => m.id === method)?.label}</span>{" "}
                      before submitting this form.
                    </span>
                  </div>

                  <div className="space-y-3">
                    {fields.map(f => (
                      <div key={f.id}>
                        <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                          {f.label}{f.required && <span className="text-destructive ml-0.5">*</span>}
                        </label>
                        <Input
                          value={proof[f.id] ?? ""}
                          onChange={e => setProof(prev => ({ ...prev, [f.id]: e.target.value }))}
                          placeholder={f.placeholder}
                          className="text-sm"
                        />
                      </div>
                    ))}
                  </div>

                  <label className="flex items-start gap-3 cursor-pointer group p-3 rounded-xl border border-border hover:bg-muted/20 transition-all">
                    <div
                      onClick={() => setTcChecked(!tcChecked)}
                      className={`w-5 h-5 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all cursor-pointer ${tcChecked ? "bg-primary border-primary" : "border-border group-hover:border-primary/50"}`}
                    >
                      {tcChecked && <CheckCircle className="w-3 h-3 text-white"/>}
                    </div>
                    <span className="text-xs text-muted-foreground leading-relaxed">
                      I confirm I have read the <a href="/terms" target="_blank" className="text-primary hover:underline font-semibold">Terms of Service</a> and <a href="/risk-disclosure" target="_blank" className="text-primary hover:underline font-semibold">Risk Disclosure</a>. I understand deposits are subject to verification and trading CFDs carries risk of loss.
                    </span>
                  </label>

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
                      disabled={!proofComplete || submitting || !tcChecked}
                      className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-40 flex items-center justify-center gap-2 glow-cyan"
                    >
                      {submitting
                        ? <><Loader2 className="w-5 h-5 animate-spin"/> Submitting…</>
                        : <>Submit Deposit Request <ArrowRight className="w-5 h-5"/></>
                      }
                    </button>
                  </div>
                </>
              )}

              {/* Back button always visible in wallet mode */}
              {method === "crypto" && cryptoWalletMode && (
                <button onClick={() => setStep(2)} className="w-full py-3 rounded-xl border border-border text-sm hover:bg-muted transition-all">Back</button>
              )}
            </div>
          )}
        </div>

        {/* Order summary sidebar */}
        <div className="lg:col-span-2">
          <div className="glass-card rounded-2xl p-5 sticky top-4 space-y-3">
            <h2 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Summary</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account</span>
                <span className={`font-semibold capitalize ${isReal ? "text-success" : "text-primary"}`}>{isReal ? "Real" : "Demo"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Method</span>
                <span className="font-semibold">{METHODS.find(m => m.id === method)?.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount (USD)</span>
                <span className="font-mono font-bold">${parseFloat(amount || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
              {localCurrency !== "USD" && localNum > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{selectedCurrencyMeta.flag} {localCurrency} Amount</span>
                  <span className="font-mono">{localNum.toLocaleString()} {localCurrency}</span>
                </div>
              )}
              {localCurrency !== "USD" && localNum > 0 && feeRate > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Conversion Fee ({selectedCurrencyMeta.fee})</span>
                  <span className="font-mono text-amber-400">-${feeAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Processing Fee</span>
                <span className="text-success font-semibold">Free</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Processing Time</span>
                <span>{METHODS.find(m => m.id === method)?.time}</span>
              </div>
              <div className="border-t border-border/50 pt-3 flex justify-between font-bold">
                <span>You receive</span>
                <span className="font-mono text-primary text-base">${parseFloat(amount || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
              {localCurrency !== "USD" && localNum > 0 && (
                <div className="text-[10px] text-muted-foreground text-right">
                  Rate: 1 USD = {rate.toFixed(2)} {localCurrency} · Fee: {selectedCurrencyMeta.fee}
                </div>
              )}
            </div>

            <div className="pt-2 rounded-xl bg-muted/30 border border-border p-3 text-xs text-muted-foreground space-y-1.5">
              <div className="font-semibold text-foreground flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-warning"/> How it works</div>
              <p>1. Choose method and amount</p>
              <p>2. Scan QR / send payment</p>
              <p>3. Submit transaction details here</p>
              <p>4. Admin verifies and credits your balance</p>
            </div>

            <p className="text-xs text-center text-muted-foreground">🔒 Secured by 256-bit SSL encryption</p>
          </div>
        </div>
      </div>

      {/* Crypto Deposit History */}
      {(cryptoHistoryLoading || cryptoHistory.length > 0) && (
        <div className="mt-8">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Bitcoin className="w-5 h-5 text-primary"/>
            Crypto Deposit History
          </h2>
          {cryptoHistoryLoading ? (
            <div className="glass-card rounded-2xl p-6 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin"/> Loading history…
            </div>
          ) : (
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/20">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Network</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">TX Hash</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {cryptoHistory.map((row) => (
                      <tr key={row.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {new Date(row.creditedAt).toLocaleDateString("en-US", {
                            year: "numeric", month: "short", day: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold text-success whitespace-nowrap">
                          +${row.amountUsdt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                            row.network === "BSC"
                              ? "bg-yellow-500/15 text-yellow-400"
                              : "bg-purple-500/15 text-purple-400"
                          }`}>
                            {row.network === "BSC" ? "🟡" : "🟣"} {row.network}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-success/15 text-success">
                            <CheckCircle className="w-3 h-3"/> Credited
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <a
                            href={row.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 font-mono text-xs text-primary hover:text-primary/80 hover:underline transition-colors"
                          >
                            {row.txHash.slice(0, 10)}…{row.txHash.slice(-8)}
                            <ExternalLink className="w-3 h-3 shrink-0"/>
                          </a>
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
    </div>

    <BuyUsdtModal
      open={showBuyModal}
      onOpenChange={setShowBuyModal}
      address={USDT_ETH_ADDRESS}
    />
    </>
  );
}
