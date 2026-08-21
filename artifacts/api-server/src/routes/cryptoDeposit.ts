import { Router, type IRouter, type Request } from "express";
import { eq, desc } from "drizzle-orm";
import { createPublicClient, http, parseAbiItem, decodeEventLog, type Hash, recoverMessageAddress } from "viem";
import { bsc, polygon } from "viem/chains";
import { db, accountsTable, cryptoDepositsTable, walletAddressesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { depositRateLimit } from "../middlewares/rateLimit";
import { getOrCreateAccount } from "./account";
import { randomBytes } from "crypto";

const router: IRouter = Router();

const PLATFORM_ADDRESS = (process.env.PLATFORM_USDT_DEPOSIT_ADDRESS ?? "").toLowerCase();

const USDT_CONTRACTS: Record<number, `0x${string}`> = {
  56:  "0x55d398326f99059fF775485246999027B3197955",
  137: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
};

const USDT_DECIMALS: Record<number, number> = {
  56: 18,
  137: 6,
};

const RPC_URLS: Record<number, string> = {
  56:  "https://bsc-dataseed.binance.org",
  137: "https://polygon-rpc.com",
};

const CHAIN_OBJECTS: Record<number, typeof bsc | typeof polygon> = {
  56: bsc,
  137: polygon,
};

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

// keccak256("Transfer(address,address,uint256)") — used to filter topic0
const TRANSFER_TOPIC0 = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function getClient(chainId: number) {
  const chain = CHAIN_OBJECTS[chainId];
  const rpcUrl = RPC_URLS[chainId];
  if (!chain || !rpcUrl) return null;
  return createPublicClient({ chain, transport: http(rpcUrl) });
}

// In-memory nonce store: userId → { nonce, expiresAt }
// Nonces are single-use and expire after 10 minutes.
interface NonceEntry {
  nonce: string;
  expiresAt: number;
}
const nonceStore = new Map<string, NonceEntry>();
const NONCE_TTL_MS = 10 * 60 * 1000;

function pruneExpiredNonces() {
  const now = Date.now();
  for (const [key, entry] of nonceStore) {
    if (entry.expiresAt < now) nonceStore.delete(key);
  }
}

const CHAIN_NAMES: Record<number, string> = {
  56: "BSC",
  137: "Polygon",
};

const EXPLORER_BASE_URLS: Record<number, string> = {
  56: "https://bscscan.com/tx/",
  137: "https://polygonscan.com/tx/",
};

// GET /api/deposit/crypto-history
router.get("/deposit/crypto-history", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;

  try {
    const rows = await db
      .select()
      .from(cryptoDepositsTable)
      .where(eq(cryptoDepositsTable.clerkUserId, userId))
      .orderBy(desc(cryptoDepositsTable.creditedAt));

    const items = rows.map((row) => ({
      id: row.id,
      txHash: row.txHash,
      fromWallet: row.fromWallet,
      chainId: row.chainId,
      network: CHAIN_NAMES[row.chainId] ?? `Chain ${row.chainId}`,
      amountUsdt: parseFloat(row.amountUsdt),
      creditedAt: row.creditedAt.toISOString(),
      explorerUrl: `${EXPLORER_BASE_URLS[row.chainId] ?? ""}${row.txHash}`,
    }));

    res.json(items);
  } catch (err) {
    req.log.error({ err }, "failed to fetch crypto deposit history");
    res.status(500).json({ error: "Failed to fetch crypto deposit history." });
  }
});

// GET /api/deposit/crypto-nonce
// Returns a short-lived nonce the frontend must sign to prove wallet ownership.
router.get("/deposit/crypto-nonce", requireAuth, (req, res): void => {
  const userId = (req as Request & { userId: string }).userId;
  pruneExpiredNonces();
  const nonce = randomBytes(16).toString("hex");
  nonceStore.set(userId, { nonce, expiresAt: Date.now() + NONCE_TTL_MS });
  res.json({ nonce });
});

// POST /api/deposit/crypto-confirm
router.post("/deposit/crypto-confirm", requireAuth, depositRateLimit, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;

  if (!PLATFORM_ADDRESS || PLATFORM_ADDRESS === "0x0000000000000000000000000000000000000000") {
    res.status(503).json({ error: "Crypto deposit verification is not configured on this server." });
    return;
  }

  const { txHash, userWallet, chainId, signature, nonce } = req.body as {
    txHash?: string;
    userWallet?: string;
    chainId?: number;
    signature?: string;
    nonce?: string;
  };

  if (!txHash || typeof txHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    res.status(400).json({ error: "Invalid transaction hash." });
    return;
  }
  if (!userWallet || typeof userWallet !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(userWallet)) {
    res.status(400).json({ error: "Invalid userWallet address." });
    return;
  }
  if (!chainId || ![56, 137].includes(chainId)) {
    res.status(400).json({ error: "chainId must be 56 (BSC) or 137 (Polygon)." });
    return;
  }
  if (!signature || typeof signature !== "string" || !/^0x[0-9a-fA-F]+$/.test(signature)) {
    res.status(400).json({ error: "Wallet ownership signature is required." });
    return;
  }
  if (!nonce || typeof nonce !== "string") {
    res.status(400).json({ error: "Nonce is required." });
    return;
  }

  // Verify the nonce belongs to this user and hasn't expired
  pruneExpiredNonces();
  const storedEntry = nonceStore.get(userId);
  if (!storedEntry || storedEntry.nonce !== nonce || storedEntry.expiresAt < Date.now()) {
    res.status(400).json({ error: "Invalid or expired nonce. Please try again." });
    return;
  }
  // Consume nonce immediately (single-use)
  nonceStore.delete(userId);

  // Recover signer from the signature and verify ownership
  const message = `VelozTrade deposit verification\nNonce: ${nonce}`;
  let recoveredAddress: string;
  try {
    recoveredAddress = (
      await recoverMessageAddress({ message, signature: signature as `0x${string}` })
    ).toLowerCase();
  } catch {
    res.status(400).json({ error: "Could not recover signer from signature." });
    return;
  }

  if (recoveredAddress !== userWallet.toLowerCase()) {
    res.status(403).json({
      error: "Wallet ownership verification failed. The signature does not match the provided wallet address.",
    });
    return;
  }

  const normalizedWallet = userWallet.toLowerCase();
  const normalizedTxHash = txHash.toLowerCase();

  const existingDeposit = await db
    .select()
    .from(cryptoDepositsTable)
    .where(eq(cryptoDepositsTable.txHash, normalizedTxHash));

  if (existingDeposit.length > 0) {
    const existing = existingDeposit[0]!;
    if (existing.clerkUserId === userId) {
      res.status(409).json({ error: "This transaction has already been credited to your account." });
    } else {
      res.status(409).json({ error: "This transaction has already been processed." });
    }
    return;
  }

  const client = getClient(chainId);
  if (!client) {
    res.status(400).json({ error: "Unsupported chain." });
    return;
  }

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash as Hash });
  } catch {
    res.status(400).json({ error: "Transaction not found or not yet confirmed. Please wait for confirmation and try again." });
    return;
  }

  if (receipt.status !== "success") {
    res.status(400).json({ error: "Transaction failed on-chain." });
    return;
  }

  const usdtContract = USDT_CONTRACTS[chainId]!;
  const decimals = USDT_DECIMALS[chainId]!;

  // Only consider logs from the correct USDT contract with the exact Transfer topic0
  const candidateLogs = receipt.logs.filter(
    (log) =>
      log.address.toLowerCase() === usdtContract.toLowerCase() &&
      log.topics[0]?.toLowerCase() === TRANSFER_TOPIC0
  );

  let amountRaw = BigInt(0);
  let matchedLog = false;

  for (const log of candidateLogs) {
    try {
      const decoded = decodeEventLog({
        abi: [TRANSFER_EVENT],
        data: log.data,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      });
      const { from, to, value } = decoded.args as { from: string; to: string; value: bigint };

      if (from.toLowerCase() !== normalizedWallet) continue;
      if (to.toLowerCase() !== PLATFORM_ADDRESS) continue;

      amountRaw += value;
      matchedLog = true;
    } catch {
      continue;
    }
  }

  if (!matchedLog || amountRaw === BigInt(0)) {
    res.status(400).json({
      error: "No USDT transfer from your wallet to the platform deposit address was found in this transaction.",
    });
    return;
  }

  const amountUsdt = Number(amountRaw) / Math.pow(10, decimals);

  if (amountUsdt < 1) {
    res.status(400).json({ error: `Deposit amount is too small (${amountUsdt.toFixed(6)} USDT).` });
    return;
  }

  try {
    await getOrCreateAccount(userId);

    await db.transaction(async (tx) => {
      // Insert as 'pending' — balance will be credited once an admin approves.
      await tx.insert(cryptoDepositsTable).values({
        clerkUserId: userId,
        txHash: normalizedTxHash,
        fromWallet: normalizedWallet,
        chainId,
        amountUsdt: amountUsdt.toFixed(6),
        status: "pending",
      });

      // Register this wallet → user mapping so the background scanner can
      // recognise future direct deposits from the same address.
      await tx
        .insert(walletAddressesTable)
        .values({ clerkUserId: userId, walletAddress: normalizedWallet })
        .onConflictDoUpdate({
          target: walletAddressesTable.walletAddress,
          set: { clerkUserId: userId },
        });
    });

    req.log.info({ userId, txHash: normalizedTxHash, chainId, amountUsdt }, "crypto deposit submitted — pending admin approval");

    res.json({
      ok: true,
      amountUsdt,
      message: `Your deposit of ${amountUsdt.toFixed(2)} USDT has been submitted and is pending admin approval. Funds will appear in your account once reviewed.`,
    });
  } catch (err) {
    req.log.error({ err, txHash: normalizedTxHash }, "crypto deposit db error");
    res.status(500).json({ error: "Failed to submit deposit. Please contact support with your transaction hash." });
  }
});

// POST /api/deposit/register-wallet
// Pre-registers a wallet address → user mapping so the background deposit
// scanner can auto-credit direct deposits before the user uses the in-app flow.
// Requires the same nonce-based ownership proof as /deposit/crypto-confirm.
router.post("/deposit/register-wallet", requireAuth, depositRateLimit, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;

  const { walletAddress, signature, nonce } = req.body as {
    walletAddress?: string;
    signature?: string;
    nonce?: string;
  };

  if (!walletAddress || typeof walletAddress !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
    res.status(400).json({ error: "Invalid wallet address." });
    return;
  }
  if (!signature || typeof signature !== "string" || !/^0x[0-9a-fA-F]+$/.test(signature)) {
    res.status(400).json({ error: "Wallet ownership signature is required." });
    return;
  }
  if (!nonce || typeof nonce !== "string") {
    res.status(400).json({ error: "Nonce is required." });
    return;
  }

  pruneExpiredNonces();
  const storedEntry = nonceStore.get(userId);
  if (!storedEntry || storedEntry.nonce !== nonce || storedEntry.expiresAt < Date.now()) {
    res.status(400).json({ error: "Invalid or expired nonce. Please try again." });
    return;
  }
  nonceStore.delete(userId);

  const message = `VelozTrade wallet registration\nNonce: ${nonce}`;
  let recoveredAddress: string;
  try {
    recoveredAddress = (
      await recoverMessageAddress({ message, signature: signature as `0x${string}` })
    ).toLowerCase();
  } catch {
    res.status(400).json({ error: "Could not recover signer from signature." });
    return;
  }

  if (recoveredAddress !== walletAddress.toLowerCase()) {
    res.status(403).json({
      error: "Wallet ownership verification failed. The signature does not match the provided wallet address.",
    });
    return;
  }

  await db
    .insert(walletAddressesTable)
    .values({ clerkUserId: userId, walletAddress: walletAddress.toLowerCase() })
    .onConflictDoUpdate({
      target: walletAddressesTable.walletAddress,
      set: { clerkUserId: userId },
    });

  req.log.info({ userId, walletAddress: walletAddress.toLowerCase() }, "wallet address registered");

  res.json({ ok: true });
});

export default router;
