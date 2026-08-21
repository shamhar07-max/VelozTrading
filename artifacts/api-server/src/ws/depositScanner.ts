/**
 * Background deposit scanner
 *
 * Every SCAN_INTERVAL_MS this job:
 *  1. Reads the last-scanned block per chain from DB
 *  2. Calls eth_getLogs for USDT Transfer events to PLATFORM_ADDRESS
 *  3. For each transfer not yet in crypto_deposits, looks up the from-wallet
 *     in wallet_addresses; if matched, inserts a 'pending' record for admin review
 *  4. Persists the new last-scanned block
 *
 * Unmatched transfers (wallet not registered) are logged as warnings so an
 * admin can reconcile them manually.
 */

import { createPublicClient, http, parseAbiItem, decodeEventLog } from "viem";
import { bsc, polygon } from "viem/chains";
import { eq } from "drizzle-orm";
import type { Logger } from "pino";
import {
  db,
  cryptoDepositsTable,
  walletAddressesTable,
  depositScanStateTable,
} from "@workspace/db";
import { getOrCreateAccount } from "../routes/account";

// ── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_ADDRESS = (
  process.env.PLATFORM_USDT_DEPOSIT_ADDRESS ?? ""
).toLowerCase();

const USDT_CONTRACTS: Record<number, `0x${string}`> = {
  56: "0x55d398326f99059fF775485246999027B3197955",
  137: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
};

const USDT_DECIMALS: Record<number, number> = {
  56: 18,
  137: 6,
};

const CHAIN_OBJECTS: Record<number, typeof bsc | typeof polygon> = {
  56: bsc,
  137: polygon,
};

// RPC URLs — prefer env-var overrides (BSC_RPC_URL / POLYGON_RPC_URL) so
// operators can supply a private/paid endpoint.
// Defaults use official free public RPCs that don't require API keys:
//   BSC:     bsc-dataseed.binance.org — Binance's own node, no key, recent getLogs OK
//   Polygon: polygon-rpc.com          — official Polygon Foundation endpoint, no key
const RPC_URLS: Record<number, string> = {
  56:  process.env.BSC_RPC_URL     ?? "https://bsc-dataseed.binance.org/",
  137: process.env.POLYGON_RPC_URL ?? "https://polygon-rpc.com/",
};

const CHAIN_IDS = [56, 137] as const;

/** How often to poll for new deposits */
const SCAN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/** Maximum block range per getLogs call — free Ankr nodes handle up to ~1 000 */
const MAX_BLOCKS_PER_SCAN = 100n;

/** On first startup (no stored state), how far back to look.
 *  Kept at 100 so the very first scan stays within the non-archive window
 *  available on free public RPC nodes. */
const STARTUP_LOOKBACK_BLOCKS = 100n;

/** Minimum deposit to auto-credit (mirrors manual-flow minimum) */
const MIN_DEPOSIT_USDT = 1;

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

// ── Helpers ──────────────────────────────────────────────────────────────────

function getClient(chainId: number) {
  const chain = CHAIN_OBJECTS[chainId];
  const rpcUrl = RPC_URLS[chainId];
  if (!chain || !rpcUrl) return null;
  return createPublicClient({ chain, transport: http(rpcUrl) });
}

async function getLastScannedBlock(chainId: number): Promise<bigint | null> {
  const rows = await db
    .select({ lastScannedBlock: depositScanStateTable.lastScannedBlock })
    .from(depositScanStateTable)
    .where(eq(depositScanStateTable.chainId, chainId))
    .limit(1);
  return rows.length > 0 ? BigInt(rows[0]!.lastScannedBlock) : null;
}

async function setLastScannedBlock(
  chainId: number,
  block: bigint
): Promise<void> {
  await db
    .insert(depositScanStateTable)
    .values({ chainId, lastScannedBlock: block.toString() })
    .onConflictDoUpdate({
      target: depositScanStateTable.chainId,
      set: { lastScannedBlock: block.toString() },
    });
}

async function findUserByWallet(
  walletAddress: string
): Promise<string | null> {
  const rows = await db
    .select({ clerkUserId: walletAddressesTable.clerkUserId })
    .from(walletAddressesTable)
    .where(eq(walletAddressesTable.walletAddress, walletAddress.toLowerCase()))
    .limit(1);
  return rows.length > 0 ? rows[0]!.clerkUserId : null;
}

// Records a scanner-discovered deposit as 'pending' without touching the balance.
// An admin must approve the record (via PATCH /api/admin/crypto-deposits/:id)
// before funds are credited to the user's trading account.
async function recordPendingDeposit(
  clerkUserId: string,
  txHash: string,
  fromWallet: string,
  chainId: number,
  amountUsdt: number,
  log: Logger
): Promise<void> {
  await getOrCreateAccount(clerkUserId);

  await db.insert(cryptoDepositsTable).values({
    clerkUserId,
    txHash: txHash.toLowerCase(),
    fromWallet: fromWallet.toLowerCase(),
    chainId,
    amountUsdt: amountUsdt.toFixed(6),
    status: "pending",
  });

  log.info(
    { clerkUserId, txHash, chainId, amountUsdt },
    "deposit-scanner: recorded pending deposit — awaiting admin approval"
  );
}

// ── Per-chain scan ────────────────────────────────────────────────────────────

async function scanChain(
  chainId: (typeof CHAIN_IDS)[number],
  log: Logger
): Promise<void> {
  const client = getClient(chainId);
  if (!client) return;

  const usdtContract = USDT_CONTRACTS[chainId]!;
  const decimals = USDT_DECIMALS[chainId]!;

  const currentBlock = await client.getBlockNumber();
  const storedBlock = await getLastScannedBlock(chainId);

  // On first run start from STARTUP_LOOKBACK_BLOCKS behind current tip
  const fromBlock =
    storedBlock !== null
      ? storedBlock + 1n
      : currentBlock > STARTUP_LOOKBACK_BLOCKS
        ? currentBlock - STARTUP_LOOKBACK_BLOCKS
        : 0n;

  if (fromBlock > currentBlock) {
    // Nothing new
    return;
  }

  log.info(
    { chainId, fromBlock: fromBlock.toString(), toBlock: currentBlock.toString() },
    "deposit-scanner: scanning blocks"
  );

  // Process in MAX_BLOCKS_PER_SCAN chunks to stay within public RPC limits.
  // lowestFailedBlock tracks the earliest block where a credit attempt failed.
  // The cursor is only advanced up to (lowestFailedBlock - 1) so the transfer
  // is retried on the next scan run instead of being permanently skipped.
  let scanFrom = fromBlock;
  let lowestFailedBlock: bigint | null = null;

  while (scanFrom <= currentBlock) {
    const scanTo =
      scanFrom + MAX_BLOCKS_PER_SCAN - 1n < currentBlock
        ? scanFrom + MAX_BLOCKS_PER_SCAN - 1n
        : currentBlock;

    const logs = await client.getLogs({
      address: usdtContract,
      event: TRANSFER_EVENT,
      args: { to: PLATFORM_ADDRESS as `0x${string}` },
      fromBlock: scanFrom,
      toBlock: scanTo,
    });

    for (const rawLog of logs) {
      const txHash = rawLog.transactionHash;
      if (!txHash) continue;

      // Already credited? Skip.
      const existing = await db
        .select({ id: cryptoDepositsTable.id })
        .from(cryptoDepositsTable)
        .where(eq(cryptoDepositsTable.txHash, txHash.toLowerCase()))
        .limit(1);
      if (existing.length > 0) continue;

      // Decode the Transfer event
      let from: string;
      let value: bigint;
      try {
        const decoded = decodeEventLog({
          abi: [TRANSFER_EVENT],
          data: rawLog.data,
          topics: rawLog.topics as [`0x${string}`, ...`0x${string}`[]],
        });
        const args = decoded.args as {
          from: string;
          to: string;
          value: bigint;
        };
        from = args.from.toLowerCase();
        value = args.value;
      } catch {
        continue;
      }

      const amountUsdt = Number(value) / Math.pow(10, decimals);
      if (amountUsdt < MIN_DEPOSIT_USDT) continue;

      // Match the sending wallet to a registered user
      const clerkUserId = await findUserByWallet(from);
      if (!clerkUserId) {
        log.warn(
          { txHash, from, chainId, amountUsdt },
          "deposit-scanner: unmatched deposit — wallet not registered to any user"
        );
        continue;
      }

      try {
        await recordPendingDeposit(clerkUserId, txHash, from, chainId, amountUsdt, log);
      } catch (err) {
        log.error(
          { err, txHash, clerkUserId, chainId, blockNumber: rawLog.blockNumber?.toString() },
          "deposit-scanner: failed to record pending deposit — will retry next scan"
        );
        // Record the lowest block of any failure so we can hold the cursor back
        const failedBlock = rawLog.blockNumber;
        if (
          failedBlock !== null &&
          failedBlock !== undefined &&
          (lowestFailedBlock === null || failedBlock < lowestFailedBlock)
        ) {
          lowestFailedBlock = failedBlock;
        }
      }
    }

    scanFrom = scanTo + 1n;
  }

  // Advance cursor to currentBlock, but stop just before the first block that
  // had a failed credit, so that transfer is retried on the next scan run.
  const cursorTarget =
    lowestFailedBlock !== null
      ? lowestFailedBlock > 0n
        ? lowestFailedBlock - 1n
        : 0n
      : currentBlock;

  if (lowestFailedBlock !== null) {
    log.warn(
      {
        chainId,
        cursorTarget: cursorTarget.toString(),
        currentBlock: currentBlock.toString(),
        lowestFailedBlock: lowestFailedBlock.toString(),
      },
      "deposit-scanner: cursor held back due to credit failure — will retry next scan"
    );
  }

  await setLastScannedBlock(chainId, cursorTarget);
}

// ── Public API ────────────────────────────────────────────────────────────────

let scannerInterval: ReturnType<typeof setInterval> | null = null;

export function setupDepositScanner(log: Logger): void {
  if (
    !PLATFORM_ADDRESS ||
    PLATFORM_ADDRESS === "0x0000000000000000000000000000000000000000"
  ) {
    log.warn(
      "PLATFORM_USDT_DEPOSIT_ADDRESS not configured — deposit scanner disabled"
    );
    return;
  }

  log.info({ chains: CHAIN_IDS }, "deposit-scanner: started");

  async function runScan() {
    for (const chainId of CHAIN_IDS) {
      try {
        await scanChain(chainId, log);
      } catch (err) {
        log.error({ err, chainId }, "deposit-scanner: chain scan failed");
      }
    }
  }

  // Run immediately on startup, then on interval
  void runScan();
  scannerInterval = setInterval(() => void runScan(), SCAN_INTERVAL_MS);
}

export function teardownDepositScanner(): void {
  if (scannerInterval !== null) {
    clearInterval(scannerInterval);
    scannerInterval = null;
  }
}
