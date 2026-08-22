import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import { logger } from "../lib/logger";
import { INSTRUMENTS, TIER_CONFIG, isMarketOpen } from "../lib/instruments";
import { getBatchPrices, getBatchQuotes, setPriceCacheRef } from "../lib/twelvedata";
import { getOmniBatchPrices, getOmniBatchQuotes } from "../lib/omniPrice";
import { db, positionsTable, ordersTable, accountsTable, pendingOrdersTable, alertsTable, priceSnapshotsTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import { sendUserNotification, priceAlertHtml } from "../lib/notifications";
import { recordTransaction } from "../lib/ledger";

interface PriceMessage {
  symbol: string;
  bid: number;
  ask: number;
  price: number;
  changePercent: number;
  marketOpen: boolean;
}

const STREAM_SYMBOLS = INSTRUMENTS.map((i) => i.symbol);

export const priceCache = new Map<string, { price: number; prevPrice: number }>();
export const changePercentCache = new Map<string, number>();

const realPriceCache = new Map<string, number>();
const sessionOpenPriceCache = new Map<string, number>();

let wss: WebSocketServer | null = null;
let streamInterval: ReturnType<typeof setInterval> | null = null;
let quoteInterval: ReturnType<typeof setInterval> | null = null;
let simulationInterval: ReturnType<typeof setInterval> | null = null;
let slTpCheckInterval: ReturnType<typeof setInterval> | null = null;
let swapInterval: ReturnType<typeof setInterval> | null = null;

const clientSubscriptions = new Map<WebSocket, Set<string> | null>();

export function getWssClientCount(): number {
  return wss?.clients.size ?? 0;
}

function broadcast(msg: PriceMessage) {
  if (!wss) return;
  const payload = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    const subs = clientSubscriptions.get(client);
    if (subs == null || subs.has(msg.symbol)) {
      client.send(payload);
    }
  }
}

function buildMessage(symbol: string, price: number): PriceMessage {
  const instrument = INSTRUMENTS.find((i) => i.symbol === symbol);
  const spread = instrument ? instrument.pip * 2 : 0.0001;

  const dailyChange = changePercentCache.get(symbol) ?? 0;
  const anchor = realPriceCache.get(symbol) ?? sessionOpenPriceCache.get(symbol);
  const drift = anchor && anchor > 0 ? ((price - anchor) / anchor) * 100 : 0;
  const changePercent = parseFloat((dailyChange + drift).toFixed(4));

  return {
    symbol,
    price,
    bid: parseFloat((price - spread).toFixed(8)),
    ask: parseFloat((price + spread).toFixed(8)),
    changePercent,
    marketOpen: isMarketOpen(symbol),
  };
}

const LEVERAGE_BY_TYPE: Record<string, number> = {
  forex: 1000, crypto: 5, stocks: 10, commodities: 100, indices: 10,
};

// ── T001 + T005: SL/TP auto-execution with correct isDemo balance routing ──────
async function checkSlTpTriggers() {
  if (priceCache.size === 0) return;
  try {
    const openPositions = await db.select().from(positionsTable);
    if (openPositions.length === 0) return;

    for (const pos of openPositions) {
      const cached = priceCache.get(pos.symbol);
      if (!cached) continue;

      const instrument = INSTRUMENTS.find(i => i.symbol === pos.symbol);
      const spread = instrument ? instrument.pip * 2 : 0.0001;
      const bid = cached.price - spread;
      const ask = cached.price + spread;

      const openPrice = parseFloat(String(pos.openPrice));
      const volume = parseFloat(String(pos.volume));
      const direction = pos.direction as "buy" | "sell";

      // Use executable side price: buy closes at bid, sell closes at ask
      const execPrice = direction === "buy" ? bid : ask;

      const sl = pos.stopLoss ? parseFloat(String(pos.stopLoss)) : null;
      const tp = pos.takeProfit ? parseFloat(String(pos.takeProfit)) : null;

      let shouldClose = false;
      let reason = "";

      if (direction === "buy") {
        if (sl !== null && execPrice <= sl) { shouldClose = true; reason = "stop_loss"; }
        if (tp !== null && execPrice >= tp) { shouldClose = true; reason = "take_profit"; }
      } else {
        if (sl !== null && execPrice >= sl) { shouldClose = true; reason = "stop_loss"; }
        if (tp !== null && execPrice <= tp) { shouldClose = true; reason = "take_profit"; }
      }

      if (!shouldClose) continue;

      const lotSize = instrument?.lotSize ?? 1;
      const profit =
        (direction === "buy"
          ? (execPrice - openPrice) * volume
          : (openPrice - execPrice) * volume) * lotSize;

      try {
        await db.transaction(async (tx) => {
          await tx.delete(positionsTable).where(eq(positionsTable.id, pos.id));
          await tx.insert(ordersTable).values({
            accountId: pos.accountId,
            clerkUserId: pos.clerkUserId,
            symbol: pos.symbol,
            symbolName: pos.symbolName,
            direction: pos.direction,
            volume: pos.volume,
            openPrice: pos.openPrice,
            closePrice: String(execPrice),
            stopLoss: pos.stopLoss,
            takeProfit: pos.takeProfit,
            profit: String(profit.toFixed(2)),
            swap: pos.swap,
            commission: pos.commission,
            openTime: pos.openTime,
          });
          // Fix: credit the correct balance based on whether it was a demo or real trade
          if (pos.isDemo) {
            await tx.update(accountsTable)
              .set({ demoBalance: sql`demo_balance + ${profit.toFixed(2)}::numeric` })
              .where(eq(accountsTable.id, pos.accountId));
          } else {
            await tx.update(accountsTable)
              .set({ balance: sql`balance + ${profit.toFixed(2)}::numeric` })
              .where(eq(accountsTable.id, pos.accountId));
          }
          await recordTransaction(tx, {
            clerkUserId: pos.clerkUserId,
            accountId: pos.accountId,
            type: "trade_close",
            amount: profit.toFixed(2),
            isDemo: pos.isDemo,
            refType: "position",
            refId: pos.id,
            description: `${reason} — ${pos.symbol} @ ${execPrice}`,
          });
        });

        logger.info({ positionId: pos.id, symbol: pos.symbol, reason, profit: profit.toFixed(2) },
          "Position auto-closed by SL/TP");
      } catch (err) {
        logger.error({ err, positionId: pos.id }, "Failed to auto-close SL/TP position");
      }
    }
  } catch (err) {
    logger.error({ err }, "SL/TP check error");
  }
}

// ── T003: Pending order activation — all order types ──────────────────────────
async function checkPendingOrders() {
  if (priceCache.size === 0) return;
  try {
    const pending = await db.select().from(pendingOrdersTable).where(eq(pendingOrdersTable.status, "pending"));
    if (pending.length === 0) return;

    for (const po of pending) {
      const cached = priceCache.get(po.symbol);
      if (!cached) continue;

      const instrument = INSTRUMENTS.find(i => i.symbol === po.symbol);
      const spread = instrument ? instrument.pip * 2 : 0.0001;
      const ask = parseFloat((cached.price + spread).toFixed(8));
      const bid = parseFloat((cached.price - spread).toFixed(8));
      const limitPrice = parseFloat(String(po.limitPrice));
      const stopPrice = po.stopPrice ? parseFloat(String(po.stopPrice)) : null;
      const trailingDistance = po.trailingDistance ? parseFloat(String(po.trailingDistance)) : null;
      const direction = po.direction as "buy" | "sell";
      const orderType = (po.orderType ?? (direction === "buy" ? "buy_limit" : "sell_limit")) as string;

      let triggered = false;

      // ── Trailing stop: update peak and effective limit price first ────────
      if (orderType === "trailing_stop" && trailingDistance) {
        const trailingPeak = po.trailingPeak ? parseFloat(String(po.trailingPeak)) : null;
        if (direction === "buy") {
          // Track lowest ask — as price falls, stop level falls with it
          const currentPeak = trailingPeak ?? ask;
          if (ask < currentPeak) {
            const newPeak = ask;
            const newStopLevel = newPeak + trailingDistance;
            try {
              await db.update(pendingOrdersTable)
                .set({ trailingPeak: String(newPeak), limitPrice: String(newStopLevel.toFixed(8)) })
                .where(eq(pendingOrdersTable.id, po.id));
            } catch { /* ignore, will retry */ }
          }
          // Trigger when ask rises back up to the stop level
          const effectiveStop = (trailingPeak ?? ask) + trailingDistance;
          triggered = ask >= effectiveStop;
        } else {
          // Track highest bid — as price rises, stop level rises with it
          const currentPeak = trailingPeak ?? bid;
          if (bid > currentPeak) {
            const newPeak = bid;
            const newStopLevel = newPeak - trailingDistance;
            try {
              await db.update(pendingOrdersTable)
                .set({ trailingPeak: String(newPeak), limitPrice: String(newStopLevel.toFixed(8)) })
                .where(eq(pendingOrdersTable.id, po.id));
            } catch { /* ignore, will retry */ }
          }
          // Trigger when bid falls back down to the stop level
          const effectiveStop = (trailingPeak ?? bid) - trailingDistance;
          triggered = bid <= effectiveStop;
        }
      } else if (orderType === "buy_limit") {
        triggered = ask <= limitPrice;
      } else if (orderType === "sell_limit") {
        triggered = bid >= limitPrice;
      } else if (orderType === "buy_stop") {
        triggered = ask >= limitPrice;
      } else if (orderType === "sell_stop") {
        triggered = bid <= limitPrice;
      } else if (orderType === "buy_stop_limit" && stopPrice !== null) {
        // Phase 1: wait for ask >= stopPrice, then convert to buy_limit at limitPrice
        if (ask >= stopPrice) {
          try {
            await db.update(pendingOrdersTable)
              .set({ orderType: "buy_limit", stopPrice: null })
              .where(eq(pendingOrdersTable.id, po.id));
          } catch { /* ignore */ }
        }
        continue;
      } else if (orderType === "sell_stop_limit" && stopPrice !== null) {
        if (bid <= stopPrice) {
          try {
            await db.update(pendingOrdersTable)
              .set({ orderType: "sell_limit", stopPrice: null })
              .where(eq(pendingOrdersTable.id, po.id));
          } catch { /* ignore */ }
        }
        continue;
      } else {
        // Legacy: infer from direction
        triggered =
          (direction === "buy" && ask <= limitPrice) ||
          (direction === "sell" && bid >= limitPrice);
      }

      if (!triggered) continue;

      try {
        const [account] = await db
          .select()
          .from(accountsTable)
          .where(eq(accountsTable.id, po.accountId));
        if (!account) continue;

        // Fill at current market price (ask for buys, bid for sells)
        const fillPrice = direction === "buy" ? ask : bid;

        // Slippage guard: reject if market has moved more than 0.5% against the limit
        const MAX_SLIPPAGE_PCT = 0.005;
        const slippage =
          direction === "buy"
            ? (fillPrice - limitPrice) / limitPrice
            : (limitPrice - fillPrice) / limitPrice;
        if (slippage > MAX_SLIPPAGE_PCT) {
          logger.info(
            { pendingId: po.id, symbol: po.symbol, limitPrice, fillPrice, slippagePct: (slippage * 100).toFixed(3) },
            "Pending order skipped — slippage exceeds 0.5%"
          );
          continue;
        }

        const volume = parseFloat(String(po.volume));
        const lotSize = instrument?.lotSize ?? 1;
        const leverage = LEVERAGE_BY_TYPE[instrument?.type ?? "forex"] ?? 100;
        const notional = fillPrice * volume * lotSize;
        const requiredMargin = notional / leverage;

        const isDemo = po.isDemo;
        const activeBalance = parseFloat(String(isDemo ? account.demoBalance : account.balance));

        if (requiredMargin > activeBalance) {
          continue;
        }

        // Tier-based commission
        const tierConfig = TIER_CONFIG[account.accountType ?? "real"] ?? TIER_CONFIG["real"]!;
        const commission = volume * tierConfig.commissionPerLot;

        await db.transaction(async (tx) => {
          await tx.update(pendingOrdersTable).set({ status: "filled" }).where(eq(pendingOrdersTable.id, po.id));
          const [filledPos] = await tx.insert(positionsTable).values({
            accountId: po.accountId,
            clerkUserId: po.clerkUserId,
            symbol: po.symbol,
            symbolName: po.symbolName,
            direction: po.direction,
            volume: String(volume),
            openPrice: String(fillPrice),
            stopLoss: po.stopLoss,
            takeProfit: po.takeProfit,
            swap: "0",
            commission: String(commission.toFixed(2)),
            isDemo,
          }).returning({ id: positionsTable.id });
          // Deduct commission from the correct balance
          if (commission > 0) {
            if (isDemo) {
              await tx.update(accountsTable)
                .set({ demoBalance: sql`demo_balance - ${commission.toFixed(2)}::numeric` })
                .where(eq(accountsTable.id, po.accountId));
            } else {
              await tx.update(accountsTable)
                .set({ balance: sql`balance - ${commission.toFixed(2)}::numeric` })
                .where(eq(accountsTable.id, po.accountId));
            }
            await recordTransaction(tx, {
              clerkUserId: po.clerkUserId,
              accountId: po.accountId,
              type: "trade_commission",
              amount: (-commission).toFixed(2),
              isDemo,
              refType: "position",
              refId: filledPos?.id ?? null,
              description: `Open commission — ${po.symbol} ${orderType}`,
            });
          }
        });

        logger.info(
          { pendingId: po.id, symbol: po.symbol, direction, orderType, limitPrice },
          "Pending order activated"
        );
      } catch (err) {
        logger.error({ err, pendingId: po.id }, "Failed to activate pending order");
      }
    }
  } catch (err) {
    logger.error({ err }, "Pending orders check error");
  }
}

// ── T005: Stop-out loop — close positions until account is solvent ─────────────
async function checkMarginCalls() {
  if (priceCache.size === 0) return;
  try {
    const allPositions = await db.select().from(positionsTable);
    if (allPositions.length === 0) return;

    const byAccount = new Map<number, typeof allPositions>();
    for (const pos of allPositions) {
      if (!byAccount.has(pos.accountId)) byAccount.set(pos.accountId, []);
      byAccount.get(pos.accountId)!.push(pos);
    }

    for (const [accountId, accountPositions] of byAccount) {
      const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, accountId));
      if (!account) continue;

      // Process demo and real positions separately
      for (const isDemo of [false, true]) {
        const modedPositions = accountPositions.filter(p => p.isDemo === isDemo);
        if (modedPositions.length === 0) continue;

        const activeBalance = parseFloat(String(isDemo ? account.demoBalance : account.balance));
        let remaining = [...modedPositions];
        let currentBalance = activeBalance;

        // Loop until margin level is restored or all positions are closed
        while (remaining.length > 0) {
          let floatingPnl = 0;
          let usedMargin = 0;

          for (const pos of remaining) {
            const cached = priceCache.get(pos.symbol);
            if (!cached) continue;
            const instr = INSTRUMENTS.find(i => i.symbol === pos.symbol);
            const posSpread = instr ? instr.pip * 2 : 0.0001;
            const execPrice = pos.direction === "buy" ? cached.price - posSpread : cached.price + posSpread;
            const openPrice = parseFloat(String(pos.openPrice));
            const volume = parseFloat(String(pos.volume));
            const lotSize = instr?.lotSize ?? 1;
            const leverage = LEVERAGE_BY_TYPE[instr?.type ?? "forex"] ?? 100;
            const pnl = (pos.direction === "buy"
              ? (execPrice - openPrice) * volume
              : (openPrice - execPrice) * volume) * lotSize;
            floatingPnl += pnl;
            usedMargin += (execPrice * volume * lotSize) / leverage;
          }

          if (usedMargin <= 0) break;
          const equity = currentBalance + floatingPnl;
          const marginLevel = (equity / usedMargin) * 100;
          if (marginLevel >= 50) break;

          // Find the most losing position
          let worstPos = remaining[0]!;
          let worstPnl = Infinity;
          for (const pos of remaining) {
            const cached = priceCache.get(pos.symbol);
            if (!cached) continue;
            const instr = INSTRUMENTS.find(i => i.symbol === pos.symbol);
            const posSpread = instr ? instr.pip * 2 : 0.0001;
            const execPrice = pos.direction === "buy" ? cached.price - posSpread : cached.price + posSpread;
            const openPrice = parseFloat(String(pos.openPrice));
            const volume = parseFloat(String(pos.volume));
            const lotSize = instr?.lotSize ?? 1;
            const pnl = (pos.direction === "buy"
              ? (execPrice - openPrice) * volume
              : (openPrice - execPrice) * volume) * lotSize;
            if (pnl < worstPnl) { worstPnl = pnl; worstPos = pos; }
          }

          const cached = priceCache.get(worstPos.symbol);
          if (!cached) break;
          const worstInstr = INSTRUMENTS.find(i => i.symbol === worstPos.symbol);
          const worstSpread = worstInstr ? worstInstr.pip * 2 : 0.0001;
          const closePrice = worstPos.direction === "buy" ? cached.price - worstSpread : cached.price + worstSpread;
          const openPrice = parseFloat(String(worstPos.openPrice));
          const volume = parseFloat(String(worstPos.volume));
          const instr = INSTRUMENTS.find(i => i.symbol === worstPos.symbol);
          const lotSize = instr?.lotSize ?? 1;
          const profit = (worstPos.direction === "buy"
            ? (closePrice - openPrice) * volume
            : (openPrice - closePrice) * volume) * lotSize;

          try {
            await db.transaction(async (tx) => {
              await tx.delete(positionsTable).where(eq(positionsTable.id, worstPos.id));
              await tx.insert(ordersTable).values({
                accountId: worstPos.accountId,
                clerkUserId: worstPos.clerkUserId,
                symbol: worstPos.symbol,
                symbolName: worstPos.symbolName,
                direction: worstPos.direction,
                volume: worstPos.volume,
                openPrice: worstPos.openPrice,
                closePrice: String(closePrice),
                stopLoss: worstPos.stopLoss,
                takeProfit: worstPos.takeProfit,
                profit: String(profit.toFixed(2)),
                swap: worstPos.swap,
                commission: worstPos.commission,
                openTime: worstPos.openTime,
              });
              if (isDemo) {
                await tx.update(accountsTable)
                  .set({ demoBalance: sql`demo_balance + ${profit.toFixed(2)}::numeric` })
                  .where(eq(accountsTable.id, worstPos.accountId));
              } else {
                await tx.update(accountsTable)
                  .set({ balance: sql`balance + ${profit.toFixed(2)}::numeric` })
                  .where(eq(accountsTable.id, worstPos.accountId));
              }
              await recordTransaction(tx, {
                clerkUserId: worstPos.clerkUserId,
                accountId: worstPos.accountId,
                type: "stop_out",
                amount: profit.toFixed(2),
                isDemo,
                refType: "position",
                refId: worstPos.id,
                description: `Stop-out — ${worstPos.symbol} @ ${closePrice} (margin level ${marginLevel.toFixed(1)}%)`,
              });
            });

            currentBalance += profit;
            remaining = remaining.filter(p => p.id !== worstPos.id);
            logger.info(
              { positionId: worstPos.id, symbol: worstPos.symbol, marginLevel: marginLevel.toFixed(1), profit: profit.toFixed(2), isDemo },
              "Stop-out: closed position"
            );
          } catch (err) {
            logger.error({ err, positionId: worstPos.id }, "Failed to close stop-out position");
            break;
          }
        }
      }
    }
  } catch (err) {
    logger.error({ err }, "Margin call check error");
  }
}

// ── T002: Daily swap accrual at 22:00 UTC (triple Wednesdays for forex/commodities) ──
let lastSwapDate: string | null = null;

async function checkSwapAccrual() {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();
  const today = now.toISOString().slice(0, 10);

  // Only run once per day at 22:00 UTC (within 2-minute window for polling jitter)
  if (utcHour !== 22 || utcMin > 2 || lastSwapDate === today) return;
  lastSwapDate = today;

  const isWednesday = now.getUTCDay() === 3;

  try {
    const openPositions = await db.select().from(positionsTable);
    if (openPositions.length === 0) return;

    let swapCount = 0;
    for (const pos of openPositions) {
      const instrument = INSTRUMENTS.find(i => i.symbol === pos.symbol);
      if (!instrument) continue;

      const volume = parseFloat(String(pos.volume));
      const direction = pos.direction as "buy" | "sell";
      const dailySwap = direction === "buy" ? instrument.buySwap : instrument.sellSwap;

      // Wednesday = 3× swap for forex and commodities (standard industry practice)
      const multiplier = isWednesday && (instrument.type === "forex" || instrument.type === "commodities") ? 3 : 1;
      const swapAmount = dailySwap * volume * multiplier;

      const newSwap = parseFloat(String(pos.swap)) + swapAmount;

        try {
          await db.transaction(async (tx) => {
            await tx.update(positionsTable)
              .set({ swap: String(newSwap.toFixed(2)) })
              .where(eq(positionsTable.id, pos.id));
            if (pos.isDemo) {
              await tx.update(accountsTable)
                .set({ demoBalance: sql`demo_balance + ${swapAmount.toFixed(2)}::numeric` })
                .where(eq(accountsTable.id, pos.accountId));
            } else {
              await tx.update(accountsTable)
                .set({ balance: sql`balance + ${swapAmount.toFixed(2)}::numeric` })
                .where(eq(accountsTable.id, pos.accountId));
            }
            await recordTransaction(tx, {
              clerkUserId: pos.clerkUserId,
              accountId: pos.accountId,
              type: "swap_accrual",
              amount: swapAmount.toFixed(2),
              isDemo: pos.isDemo,
              refType: "position",
              refId: pos.id,
              description: `Daily swap — ${instrument.symbol}${multiplier > 1 ? ` (×${multiplier} Wednesday)` : ""}`,
            });
          });
          swapCount++;
      } catch (err) {
        logger.error({ err, positionId: pos.id }, "Swap accrual failed for position");
      }
    }

    logger.info({ date: today, isWednesday, positionsProcessed: swapCount }, "Daily swap accrual completed");
  } catch (err) {
    logger.error({ err }, "Swap accrual error");
  }
}

// ── T006: Price alert email trigger ────────────────────────────────────────────
async function checkAlerts() {
  if (priceCache.size === 0) return;
  try {
    const active = await db
      .select()
      .from(alertsTable)
      .where(eq(alertsTable.status, "active"));
    if (active.length === 0) return;

    for (const alert of active) {
      const cached = priceCache.get(alert.symbol);
      if (!cached) continue;

      const currentPrice = cached.price;
      const targetPrice = parseFloat(String(alert.targetPrice));
      const triggered =
        (alert.condition === "above" && currentPrice >= targetPrice) ||
        (alert.condition === "below" && currentPrice <= targetPrice);

      if (!triggered) continue;

      try {
        // Atomic conditional update: only succeeds if status is still 'active'.
        // If two concurrent check runs both reach this point for the same alert,
        // exactly one will update (and send the email); the other gets 0 rows back.
        const updated = await db
          .update(alertsTable)
          .set({ status: "triggered", triggeredAt: new Date() })
          .where(and(eq(alertsTable.id, alert.id), eq(alertsTable.status, "active")))
          .returning({ id: alertsTable.id });
        if (updated.length === 0) continue; // already triggered by a concurrent check

        const clerkUser = await clerkClient.users.getUser(alert.clerkUserId);
        const email = clerkUser.emailAddresses[0]?.emailAddress;
        const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || "Trader";
        if (email) {
          void sendUserNotification(
            email,
            `🔔 Price Alert: ${alert.symbol} ${alert.condition === "above" ? "above" : "below"} ${targetPrice} — VelozTrade`,
            priceAlertHtml(name, alert.symbol, alert.condition, targetPrice, currentPrice)
          );
        }

        logger.info(
          { alertId: alert.id, symbol: alert.symbol, condition: alert.condition, targetPrice, currentPrice },
          "Price alert triggered — email sent"
        );
      } catch (err) {
        logger.error({ err, alertId: alert.id }, "Failed to process price alert");
      }
    }
  } catch (err) {
    logger.error({ err }, "Alert check error");
  }
}

// Per-instrument-type noise multipliers — keeps relative volatility realistic:
// crypto moves more than forex; indices/commodities sit between the two.
const NOISE_MULTIPLIER: Record<string, number> = {
  forex:       1,
  stocks:      1.5,
  commodities: 2,
  indices:     2,
  crypto:      4,
};

function simulatePriceTick() {
  if (priceCache.size === 0) return;
  for (const [symbol, cached] of priceCache.entries()) {
    if (!isMarketOpen(symbol)) {
      broadcast(buildMessage(symbol, cached.price));
      continue;
    }

    const realPrice = realPriceCache.get(symbol) ?? cached.price;
    const instrumentType = INSTRUMENTS.find(i => i.symbol === symbol)?.type ?? "forex";
    const noiseMult = NOISE_MULTIPLIER[instrumentType] ?? 1;

    // Base coefficient 0.00008 ≈ 0.4–1 pip per tick for major forex at 1s intervals.
    // Mean reversion 0.04 gives a natural drift back to the real price without snapping.
    const meanReversion = (realPrice - cached.price) * 0.04;
    const noise = (Math.random() - 0.5) * 0.00008 * realPrice * noiseMult;
    const newPrice = Math.max(cached.price + meanReversion + noise, 0.00001);
    const rounded = parseFloat(newPrice.toFixed(8));

    priceCache.set(symbol, { price: rounded, prevPrice: cached.price });
    broadcast(buildMessage(symbol, rounded));
  }
}

async function loadPersistedPrices(): Promise<void> {
  try {
    const rows = await db.select().from(priceSnapshotsTable);
    let loaded = 0;
    for (const row of rows) {
      if (!priceCache.has(row.symbol)) {
        const price = parseFloat(row.price);
        priceCache.set(row.symbol, { price, prevPrice: price });
        realPriceCache.set(row.symbol, price);
        sessionOpenPriceCache.set(row.symbol, price);
        loaded++;
      }
    }
    logger.info({ loaded, total: rows.length }, "Loaded persisted prices from DB");
  } catch (err) {
    logger.error({ err }, "Failed to load persisted prices from DB — will use hardcoded fallbacks");
  }
}

async function persistRealPrices(): Promise<void> {
  if (realPriceCache.size === 0) return;
  try {
    const values = Array.from(realPriceCache.entries()).map(([symbol, price]) => ({
      symbol,
      price: String(price),
      updatedAt: new Date(),
    }));
    await db
      .insert(priceSnapshotsTable)
      .values(values)
      .onConflictDoUpdate({
        target: priceSnapshotsTable.symbol,
        set: {
          price: sql`excluded.price`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
    logger.info({ count: values.length }, "Persisted real prices to DB");
  } catch (err) {
    logger.error({ err }, "Failed to persist real prices to DB");
  }
}

async function fetchAndBroadcastPrices() {
  try {
    const prices = await getOmniBatchPrices(STREAM_SYMBOLS);
    for (const [symbol, price] of prices.entries()) {
      realPriceCache.set(symbol, price);
      if (!priceCache.has(symbol)) {
        priceCache.set(symbol, { price, prevPrice: price });
        sessionOpenPriceCache.set(symbol, price);
      }
    }
    logger.info({ count: prices.size }, "Refreshed real prices (omni)");
    void persistRealPrices();
  } catch (err) {
    logger.error({ err }, "WebSocket price fetch error");
  }
}

// Last-resort fallback prices for symbols not available on the TwelveData free plan
// (indices with :INDX/:NSE/:CBOE routing, some commodity contracts).
// These are only used on first-ever startup when no persisted values exist in the
// price_snapshots DB table. On every subsequent startup, loadPersistedPrices() seeds
// the priceCache from the DB before TwelveData calls run, so these hardcoded values
// are never used once the server has run at least once.
const FALLBACK_SEED_PRICES: Record<string, number> = {
  "CAC40":    7800,
  "IBEX35":   11200,
  "NI225":    38500,
  "HSI":      22800,
  "NIFTY50":  23500,
  "SENSEX":   77000,
  "RUT":      2120,
  "VIX":      14.5,
  "WHEAT":    530,
  "CORN":     435,
  "NATGAS":   2.55,
  "USOIL":    78.5,
  "UKOIL":    82.0,
  "XPT/USD":  950,
  "MATIC/USD": 0.25,
  "DJI":      43000,
};

async function fillMissingPrices() {
  const missing = STREAM_SYMBOLS.filter((s) => !priceCache.has(s));
  if (missing.length === 0) {
    logger.info("fillMissingPrices: all symbols already seeded");
    return;
  }
  logger.info({ count: missing.length, symbols: missing }, "fillMissingPrices: retrying missing symbols via quotes");
  try {
    const quotes = await getOmniBatchQuotes(missing);
    let filled = 0;
    const stillMissing: string[] = [];
    for (const symbol of missing) {
      const data = quotes.get(symbol);
      if (data) {
        changePercentCache.set(symbol, data.changePercent);
        if (!priceCache.has(symbol)) {
          const jitter = 1 + (Math.random() - 0.5) * 0.0024;
          const startPrice = isMarketOpen(symbol)
            ? parseFloat((data.price * jitter).toFixed(8))
            : data.price;
          priceCache.set(symbol, { price: startPrice, prevPrice: data.price });
          realPriceCache.set(symbol, data.price);
          sessionOpenPriceCache.set(symbol, data.price);
          filled++;
        }
      } else {
        stillMissing.push(symbol);
      }
    }

    // Seed any remaining symbols with fallback prices so users never see "—"
    let fallbackFilled = 0;
    for (const symbol of stillMissing) {
      if (!priceCache.has(symbol) && FALLBACK_SEED_PRICES[symbol] != null) {
        const basePrice = FALLBACK_SEED_PRICES[symbol]!;
        const jitter = 1 + (Math.random() - 0.5) * 0.002;
        const startPrice = parseFloat((basePrice * jitter).toFixed(8));
        priceCache.set(symbol, { price: startPrice, prevPrice: basePrice });
        realPriceCache.set(symbol, basePrice);
        sessionOpenPriceCache.set(symbol, basePrice);
        fallbackFilled++;
      }
    }

    const truelyMissing = stillMissing.filter(
      (s) => !priceCache.has(s) && FALLBACK_SEED_PRICES[s] == null
    );
    logger.info(
      { filled, fallbackFilled, stillMissing: truelyMissing },
      "fillMissingPrices: complete"
    );
  } catch (err) {
    logger.error({ err }, "fillMissingPrices: error");
  }
}

async function refreshChangePercents() {
  try {
    const quotes = await getOmniBatchQuotes(STREAM_SYMBOLS);
    for (const [symbol, data] of quotes.entries()) {
      changePercentCache.set(symbol, data.changePercent);
      if (!priceCache.has(symbol)) {
        const jitter = 1 + (Math.random() - 0.5) * 0.0024;
        const startPrice = isMarketOpen(symbol)
          ? parseFloat((data.price * jitter).toFixed(8))
          : data.price;
        priceCache.set(symbol, { price: startPrice, prevPrice: data.price });
        realPriceCache.set(symbol, data.price);
        sessionOpenPriceCache.set(symbol, data.price);
      }
    }
    logger.info({ count: quotes.size }, "Refreshed change percents (omni)");
  } catch (err) {
    logger.error({ err }, "Quote refresh error");
  }
}

export function setupWebSocket(server: Server) {
  setPriceCacheRef(priceCache);

  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    logger.info({ ip: req.socket.remoteAddress }, "WebSocket client connected");
    clientSubscriptions.set(ws, null);

    for (const [symbol, cached] of priceCache.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(buildMessage(symbol, cached.price)));
      }
    }

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString()) as { type: string; symbols?: string[] };
        if (msg.type === "subscribe" && Array.isArray(msg.symbols) && msg.symbols.length > 0) {
          clientSubscriptions.set(ws, new Set(msg.symbols));
        } else if (msg.type === "subscribe_all" || msg.type === "subscribe") {
          clientSubscriptions.set(ws, null);
        } else if (msg.type === "ping") {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch { /* ignore malformed */ }
    });

    ws.on("error", (err) => logger.error({ err }, "WebSocket client error"));
    ws.on("close", () => {
      clientSubscriptions.delete(ws);
      logger.info("WebSocket client disconnected");
    });
  });

  loadPersistedPrices()
    .then(() => refreshChangePercents())
    .then(() => fetchAndBroadcastPrices())
    .then(() => {
      // After the initial burst, schedule two fill-missing passes for symbols
      // that were rate-limited (429) and came back null during startup.
      setTimeout(() => void fillMissingPrices(), 15_000);
      setTimeout(() => void fillMissingPrices(), 30_000);
    })
    .catch((err) => logger.error({ err }, "Initial fetch failed"));

  // Free-tier throttling: 800 TwelveData credits/day = ~33/hour.
  // Polling every 5m (prices) + 10m (quotes) stays well under the limit;
  // 1s simulation ticks keep the UI feeling live between real fetches.
  streamInterval = setInterval(fetchAndBroadcastPrices, 5 * 60_000);
  setTimeout(() => {
    quoteInterval = setInterval(refreshChangePercents, 10 * 60_000);
  }, 60_000);

  simulationInterval = setInterval(simulatePriceTick, 1000);
  slTpCheckInterval = setInterval(checkSlTpTriggers, 5_000);
  setInterval(checkPendingOrders, 5_000);
  setInterval(checkMarginCalls, 10_000);
  // Swap check runs every 60 s; actual accrual only fires at 22:00 UTC once per day
  swapInterval = setInterval(checkSwapAccrual, 60_000);
  // Price alert emails — check every 30 s; atomic DB update prevents duplicate sends
  setInterval(() => void checkAlerts(), 30_000);

  logger.info({ symbols: STREAM_SYMBOLS.length }, "WebSocket price streamer started");
  return wss;
}

export function stopWebSocket() {
  if (streamInterval) { clearInterval(streamInterval); streamInterval = null; }
  if (quoteInterval) { clearInterval(quoteInterval); quoteInterval = null; }
  if (simulationInterval) { clearInterval(simulationInterval); simulationInterval = null; }
  if (slTpCheckInterval) { clearInterval(slTpCheckInterval); slTpCheckInterval = null; }
  if (swapInterval) { clearInterval(swapInterval); swapInterval = null; }
  if (wss) { wss.close(); wss = null; }
}
