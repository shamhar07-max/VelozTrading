import { useState, useEffect, useRef } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSignMessage,
} from "wagmi";
import { parseUnits, formatUnits, type Address } from "viem";
import { bsc, polygon } from "wagmi/chains";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Wallet, ExternalLink, Loader2, AlertCircle, CheckCircle2, ShoppingCart } from "lucide-react";

const _rawDepositAddress = import.meta.env.VITE_PLATFORM_USDT_DEPOSIT_ADDRESS ?? "";
const PLATFORM_USDT_ADDRESS: Address | null =
  _rawDepositAddress &&
  /^0x[0-9a-fA-F]{40}$/.test(_rawDepositAddress) &&
  _rawDepositAddress.toLowerCase() !== "0x0000000000000000000000000000000000000000"
    ? (_rawDepositAddress as Address)
    : null;

const USDT_CONTRACTS: Record<number, Address> = {
  56:  "0x55d398326f99059fF775485246999027B3197955",
  137: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
};

const USDT_DECIMALS: Record<number, number> = {
  56: 18,
  137: 6,
};

const CHAIN_NAMES: Record<number, string> = {
  56:  "BSC (BEP-20)",
  137: "Polygon",
};

const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

function BuyRedirectPrompt({ chainId }: { chainId: number }) {
  const isBSC = chainId === bsc.id;

  const links = isBSC
    ? [
        { label: "Binance P2P (USDT)", url: "https://p2p.binance.com/en/trade/sell/USDT" },
        { label: "Trust Wallet Buy", url: "trust://buy" },
      ]
    : [
        { label: "Buy USDT on Polygon", url: "https://app.uniswap.org/#/swap?outputCurrency=0xc2132D05D31c914a87C6611C10748AEb04B58e8F" },
        { label: "Trust Wallet Buy", url: "trust://buy" },
      ];

  return (
    <div className="rounded-xl border border-warning/30 bg-warning/8 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-warning">Your wallet has no USDT</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            You need USDT on {CHAIN_NAMES[chainId] ?? "this network"} to deposit.
            Buy USDT from any exchange, then come back to deposit.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition-all"
          >
            <ShoppingCart className="w-3 h-3" />
            {link.label}
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
        ))}
      </div>
    </div>
  );
}

function WalletDepositForm({
  address,
  chainId,
}: {
  address: Address;
  chainId: number;
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Nonce fetched from server for ownership proof
  const [nonce, setNonce] = useState<string | null>(null);
  const nonceRef = useRef<string | null>(null);

  const usdtContract = USDT_CONTRACTS[chainId];
  const decimals = USDT_DECIMALS[chainId] ?? 18;

  const { data: balanceRaw, isLoading: balanceLoading } = useReadContract(
    usdtContract
      ? {
          address: usdtContract,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [address],
        }
      : undefined as never
  );

  const balanceUsdt =
    balanceRaw !== undefined
      ? parseFloat(formatUnits(balanceRaw as bigint, decimals))
      : null;

  const { writeContract, data: txHash, isPending: isSending, error: writeError } = useWriteContract();

  const { isLoading: isWaiting, isSuccess: txSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  const { signMessageAsync } = useSignMessage();

  // Fetch a fresh nonce when the component mounts (or wallet changes)
  useEffect(() => {
    let cancelled = false;
    async function fetchNonce() {
      try {
        const res = await fetch("/api/deposit/crypto-nonce");
        if (!cancelled && res.ok) {
          const data = await res.json() as { nonce: string };
          setNonce(data.nonce);
          nonceRef.current = data.nonce;
        }
      } catch {
        // nonce fetch failure is non-critical; will retry on submit
      }
    }
    void fetchNonce();
    return () => { cancelled = true; };
  }, [address, chainId]);

  // After on-chain success → sign nonce → call backend confirm
  const handleConfirm = async (hash: string) => {
    if (confirming || confirmed) return;
    setConfirming(true);
    try {
      // Ensure we have a valid nonce — refresh if missing
      let currentNonce = nonceRef.current;
      if (!currentNonce) {
        const nonceRes = await fetch("/api/deposit/crypto-nonce");
        if (!nonceRes.ok) throw new Error("Could not obtain deposit nonce.");
        const nonceData = await nonceRes.json() as { nonce: string };
        currentNonce = nonceData.nonce;
        nonceRef.current = currentNonce;
        setNonce(currentNonce);
      }

      // Sign the nonce to prove wallet ownership
      const message = `VelozTrade deposit verification\nNonce: ${currentNonce}`;
      let signature: string;
      try {
        signature = await signMessageAsync({ message });
      } catch {
        toast.error("Signature cancelled. Please sign the ownership proof in your wallet to complete the deposit.");
        setConfirming(false);
        return;
      }

      const res = await fetch("/api/deposit/crypto-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txHash: hash,
          userWallet: address,
          chainId,
          signature,
          nonce: currentNonce,
        }),
      });
      const data = await res.json() as { ok?: boolean; message?: string; error?: string; amountUsdt?: number };

      // Nonce consumed — clear it so a fresh one is fetched next time
      nonceRef.current = null;
      setNonce(null);

      if (res.ok && data.ok) {
        setConfirmed(true);
        toast.success(data.message ?? "Deposit submitted — pending admin review.");
      } else {
        toast.error(data.error ?? "Could not submit deposit. Please contact support.");
      }
    } catch {
      toast.error("Network error. Please contact support with your transaction hash.");
    } finally {
      setConfirming(false);
    }
  };

  if (txSuccess && txHash && !confirmed && !confirming) {
    void handleConfirm(txHash);
  }

  const parsedAmount = parseFloat(amount) || 0;
  const isValid = parsedAmount >= 1 && balanceUsdt !== null && parsedAmount <= balanceUsdt;

  const handleDeposit = () => {
    if (!isValid || !usdtContract || !PLATFORM_USDT_ADDRESS) return;
    const amountWei = parseUnits(parsedAmount.toFixed(decimals), decimals);
    writeContract({
      address: usdtContract,
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [PLATFORM_USDT_ADDRESS, amountWei],
    });
  };

  const setMax = () => {
    if (balanceUsdt !== null) setAmount(balanceUsdt.toFixed(2));
  };

  if (!usdtContract) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/8 p-4 text-sm text-destructive">
        Switch your wallet to BSC or Polygon network to deposit USDT.
      </div>
    );
  }

  if (balanceLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Checking USDT balance…
      </div>
    );
  }

  if (balanceUsdt !== null && balanceUsdt < 1) {
    return <BuyRedirectPrompt chainId={chainId} />;
  }

  if (confirmed) {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/8 p-5 text-center space-y-2">
        <CheckCircle2 className="w-8 h-8 text-primary mx-auto" />
        <p className="font-semibold text-foreground">Deposit Submitted — Pending Review</p>
        <p className="text-xs text-muted-foreground">Your on-chain transaction has been verified and your deposit request is now under admin review. Funds will be credited to your account once approved, typically within 24 hours.</p>
        <button
          onClick={() => { setConfirmed(false); setAmount(""); }}
          className="text-xs text-primary hover:underline"
        >
          Make another deposit
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Available USDT</span>
        <span className="font-semibold">
          {balanceUsdt !== null ? balanceUsdt.toFixed(2) : "—"} USDT
          <span className="text-xs text-muted-foreground ml-1">({CHAIN_NAMES[chainId] ?? "Unknown"})</span>
        </span>
      </div>

      <div className="relative">
        <input
          type="number"
          min="1"
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter USDT amount"
          className="w-full px-4 py-3 pr-16 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="button"
          onClick={setMax}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-primary hover:text-primary/80"
        >
          MAX
        </button>
      </div>

      {parsedAmount > 0 && balanceUsdt !== null && parsedAmount > balanceUsdt && (
        <p className="text-xs text-destructive">Amount exceeds your wallet balance.</p>
      )}

      {!PLATFORM_USDT_ADDRESS && (
        <p className="text-xs text-warning">Wallet deposits are not configured yet. Please contact support.</p>
      )}

      {writeError && (
        <p className="text-xs text-destructive">{writeError.message}</p>
      )}

      {(isWaiting || confirming) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          {isWaiting
            ? "Waiting for on-chain confirmation…"
            : "Sign the ownership proof in your wallet…"}
        </div>
      )}

      {txHash && !isWaiting && !confirming && !confirmed && (
        <div className="text-xs text-muted-foreground break-all">
          Tx:{" "}
          <a
            href={chainId === 56 ? `https://bscscan.com/tx/${txHash}` : `https://polygonscan.com/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            {txHash.slice(0, 20)}…
          </a>
        </div>
      )}

      <button
        onClick={handleDeposit}
        disabled={!isValid || isSending || isWaiting || confirming || !PLATFORM_USDT_ADDRESS}
        className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSending ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Confirm in Wallet…</>
        ) : (
          <><Wallet className="w-4 h-4" /> Deposit {parsedAmount > 0 ? `${parsedAmount.toFixed(2)} USDT` : "USDT"}</>
        )}
      </button>

      <p className="text-xs text-muted-foreground text-center">
        Transfers are on-chain. You'll approve the transaction in your wallet, then sign a quick ownership proof. Funds are credited after admin review, typically within 24 hours.
      </p>
    </div>
  );
}

/**
 * Silently registers the connected wallet address with the backend.
 * This enables the background deposit scanner to auto-credit future
 * direct (off-app) transfers from this wallet.
 * Errors are intentionally swallowed — registration is best-effort.
 */
function useWalletRegistration(address: Address | undefined) {
  const { signMessageAsync } = useSignMessage();

  useEffect(() => {
    if (!address) return;

    let cancelled = false;

    async function register() {
      try {
        const nonceRes = await fetch("/api/deposit/crypto-nonce");
        if (!nonceRes.ok || cancelled) return;
        const { nonce } = await nonceRes.json() as { nonce: string };

        const message = `VelozTrade wallet registration\nNonce: ${nonce}`;
        const signature = await signMessageAsync({ message });
        if (cancelled) return;

        await fetch("/api/deposit/register-wallet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: address, signature, nonce }),
        });
      } catch {
        // Silent — registration is best-effort
      }
    }

    void register();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);
}

export function CryptoWalletDeposit() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  // Silently register wallet → user mapping for the background deposit scanner
  useWalletRegistration(address);

  const isConfigured = !!PLATFORM_USDT_ADDRESS;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Connect Wallet</p>
          <p className="text-xs text-muted-foreground">
            Send USDT directly from MetaMask, Trust Wallet, or any WalletConnect wallet
          </p>
        </div>
      </div>

      <div className="flex justify-start">
        <ConnectButton
          accountStatus="address"
          chainStatus="icon"
          showBalance={false}
        />
      </div>

      {!isConfigured && (
        <div className="rounded-xl border border-warning/30 bg-warning/8 p-3 text-xs text-warning">
          Wallet deposit is being set up. Please use Manual TXID for now.
        </div>
      )}

      {isConnected && address && isConfigured && (
        <WalletDepositForm address={address} chainId={chainId} />
      )}
    </div>
  );
}
