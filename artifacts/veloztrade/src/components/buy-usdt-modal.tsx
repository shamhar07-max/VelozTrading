import { useState } from "react";
import { Copy, Check, ExternalLink, ShoppingCart, Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BuyUsdtModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address: string;
}

const UPI_PROVIDERS = [
  {
    id: "onramper_upi" as const,
    label: "Onramper",
    sub: "UPI · ₹ INR · instant",
  },
  {
    id: "trustwallet_upi" as const,
    label: "Trust Wallet",
    sub: "UPI · EasyPaisa · cards",
  },
] as const;

const OTHER_PROVIDERS = [
  {
    id: "binance",
    label: "Binance P2P",
    sub: "INR · PKR",
    autoFill: false,
    tooltip: "Copy the address above first — Binance P2P cannot auto-fill your destination wallet.",
  },
  {
    id: "guardarian",
    label: "Guardarian",
    sub: "Bank transfer",
    autoFill: true,
    tooltip: null,
  },
] as const;

type AllProviderId = "onramper_upi" | "trustwallet_upi" | "binance" | "guardarian";

function getWebUrl(provider: AllProviderId, address: string): string {
  const enc = encodeURIComponent(address);
  switch (provider) {
    case "onramper_upi":
      return (
        `https://buy.onramper.com/?mode=buy` +
        `&defaultCrypto=USDT_ETH` +
        `&wallets=USDT_ETH:${enc}` +
        `&defaultFiat=INR` +
        `&paymentMethods=UPI` +
        `&language=en`
      );
    case "trustwallet_upi":
      return `https://buy.trustwallet.com/?asset=USDT&address=${enc}&fiat=INR`;
    case "binance":
      return `https://p2p.binance.com/en/trade/buy/USDT?fiat=INR`;
    case "guardarian":
      return (
        `https://guardarian.com/buy-crypto` +
        `?crypto_currency=USDT` +
        `&network=ERC20` +
        `&wallet_address=${enc}`
      );
  }
}

function handleRedirect(provider: AllProviderId, address: string, onClose: () => void) {
  const webUrl = getWebUrl(provider, address);

  if (provider === "trustwallet_upi") {
    const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = `trust://buy?asset=USDT&address=${encodeURIComponent(address)}&fiat=INR`;
      setTimeout(() => { window.location.href = webUrl; }, 1500);
      onClose();
      return;
    }
  }

  window.open(webUrl, "_blank", "noopener,noreferrer");
  onClose();
}

export function BuyUsdtModal({ open, onOpenChange, address }: BuyUsdtModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-primary" />
            Buy USDT
          </DialogTitle>
          <DialogDescription>
            Your ERC-20 deposit address is pre-filled automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Address display */}
          <div className="rounded-xl bg-muted/50 border border-border p-3 space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Destination address (USDT ERC-20)
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono text-foreground truncate">{address}</code>
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition-all"
              >
                {copied ? (
                  <><Check className="w-3 h-3" /> Copied</>
                ) : (
                  <><Copy className="w-3 h-3" /> Copy</>
                )}
              </button>
            </div>
          </div>

          {/* ── UPI Featured Section ─────────────────────────────────── */}
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/8 p-3.5 space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="text-base leading-none">🇮🇳</span>
              <div>
                <p className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  Pay with UPI
                </p>
                <p className="text-[11px] text-muted-foreground">Instant ₹ → USDT · lowest fees · no card needed</p>
              </div>
              <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                Recommended
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {UPI_PROVIDERS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleRedirect(p.id, address, () => onOpenChange(false))}
                  className="group flex flex-col items-start gap-1 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-all text-left w-full"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-sm font-semibold text-foreground">{p.label}</span>
                    <ExternalLink className="w-3 h-3 text-emerald-500/60 group-hover:text-emerald-400 transition-colors" />
                  </div>
                  <span className="text-[11px] text-emerald-400/80">{p.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Other Options ────────────────────────────────────────── */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">More options</p>
            <TooltipProvider delayDuration={200}>
              <div className="grid grid-cols-2 gap-2">
                {OTHER_PROVIDERS.map(p => {
                  const btn = (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleRedirect(p.id, address, () => onOpenChange(false))}
                      className="group relative flex flex-col items-start gap-1 p-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all text-left w-full"
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-sm font-semibold text-foreground">{p.label}</span>
                        <ExternalLink className="w-3 h-3 text-muted-foreground/50 group-hover:text-primary/60 transition-colors" />
                      </div>
                      <span className="text-[11px] text-muted-foreground">{p.sub}</span>
                      {!p.autoFill && (
                        <span className="text-[10px] text-amber-500/80 font-medium mt-0.5">
                          Copy address first ↑
                        </span>
                      )}
                    </button>
                  );

                  if (p.tooltip) {
                    return (
                      <Tooltip key={p.id}>
                        <TooltipTrigger asChild>{btn}</TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[220px] text-center">
                          {p.tooltip}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  return btn;
                })}
              </div>
            </TooltipProvider>
          </div>

          <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
            VelozTrade does not process your payment. KYC and payment are handled entirely by the provider you choose.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
