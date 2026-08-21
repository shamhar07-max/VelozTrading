import { Router, type IRouter, type Request } from "express";
import { eq, and } from "drizzle-orm";
import { db, pendingOrdersTable, accountsTable, positionsTable } from "@workspace/db";
import {
  ListPendingOrdersResponse,
  ListPendingOrdersResponseItem,
  CreatePendingOrderBody,
  CancelPendingOrderParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { tradingRateLimit } from "../middlewares/rateLimit";
import { getOrCreateAccount } from "./account";
import { INSTRUMENT_MAP, LEVERAGE_BY_TYPE } from "../lib/instruments";
import { listPositions } from "./positions";
import { getPrice } from "../lib/twelvedata";

const router: IRouter = Router();

const VALID_ORDER_TYPES = [
  "buy_limit", "sell_limit",
  "buy_stop", "sell_stop",
  "buy_stop_limit", "sell_stop_limit",
  "trailing_stop",
] as const;
type OrderType = typeof VALID_ORDER_TYPES[number];

function buildPendingResponse(po: typeof pendingOrdersTable.$inferSelect) {
  return {
    id: po.id,
    symbol: po.symbol,
    symbolName: po.symbolName,
    direction: po.direction as "buy" | "sell",
    orderType: (po.orderType ?? "buy_limit") as OrderType,
    volume: parseFloat(String(po.volume)),
    limitPrice: parseFloat(String(po.limitPrice)),
    stopPrice: po.stopPrice ? parseFloat(String(po.stopPrice)) : null,
    trailingDistance: po.trailingDistance ? parseFloat(String(po.trailingDistance)) : null,
    marginReserved: parseFloat(String(po.marginReserved ?? "0")),
    stopLoss: po.stopLoss ? parseFloat(String(po.stopLoss)) : null,
    takeProfit: po.takeProfit ? parseFloat(String(po.takeProfit)) : null,
    status: po.status as "pending" | "filled" | "cancelled",
    createdAt: po.createdAt.toISOString(),
  };
}

router.get("/pending-orders", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const account = await getOrCreateAccount(userId);
  const rows = await db
    .select()
    .from(pendingOrdersTable)
    .where(and(
      eq(pendingOrdersTable.clerkUserId, userId),
      eq(pendingOrdersTable.status, "pending"),
      eq(pendingOrdersTable.isDemo, account.isDemoMode),
    ));
  res.json(ListPendingOrdersResponse.parse(rows.map(buildPendingResponse)));
});

router.post("/pending-orders", requireAuth, tradingRateLimit, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const parsed = CreatePendingOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { symbol, direction, volume, limitPrice, stopLoss, takeProfit } = parsed.data;
  const orderType = ((parsed.data as any).orderType as OrderType | undefined)
    ?? (direction === "buy" ? "buy_limit" : "sell_limit");
  const stopPrice: number | null = (parsed.data as any).stopPrice ?? null;
  const trailingDistance: number | null = (parsed.data as any).trailingDistance ?? null;

  if (!VALID_ORDER_TYPES.includes(orderType as any)) {
    res.status(400).json({ error: `Invalid orderType. Must be one of: ${VALID_ORDER_TYPES.join(", ")}` });
    return;
  }

  if (volume < 0.01 || volume > 1000) {
    res.status(400).json({ error: "Volume must be between 0.01 and 1000 lots." });
    return;
  }

  if (limitPrice <= 0) {
    res.status(400).json({ error: "Limit price must be positive." });
    return;
  }

  if ((orderType === "buy_stop_limit" || orderType === "sell_stop_limit") && !stopPrice) {
    res.status(400).json({ error: "stopPrice is required for stop-limit orders." });
    return;
  }

  if (orderType === "trailing_stop" && !trailingDistance) {
    res.status(400).json({ error: "trailingDistance is required for trailing stop orders." });
    return;
  }

  const instrument = INSTRUMENT_MAP.get(symbol);
  if (!instrument) {
    res.status(400).json({ error: "Unknown symbol" });
    return;
  }

  // SL/TP validation only applies to limit-type orders (stop orders have different direction semantics)
  if (orderType === "buy_limit" || orderType === "buy_stop") {
    if (stopLoss != null && stopLoss >= limitPrice) {
      res.status(400).json({ error: "Stop Loss must be below the limit price for a buy order." });
      return;
    }
    if (takeProfit != null && takeProfit <= limitPrice) {
      res.status(400).json({ error: "Take Profit must be above the limit price for a buy order." });
      return;
    }
  } else if (orderType === "sell_limit" || orderType === "sell_stop") {
    if (stopLoss != null && stopLoss <= limitPrice) {
      res.status(400).json({ error: "Stop Loss must be above the limit price for a sell order." });
      return;
    }
    if (takeProfit != null && takeProfit >= limitPrice) {
      res.status(400).json({ error: "Take Profit must be below the limit price for a sell order." });
      return;
    }
  }

  const account = await getOrCreateAccount(userId);
  const isDemo = account.isDemoMode;

  // Compute required margin for this pending order
  const instrumentLeverage = LEVERAGE_BY_TYPE[instrument.type] ?? 100;
  const lotSize = instrument.lotSize ?? 1;
  const triggerPrice = stopPrice ?? limitPrice;
  const notional = triggerPrice * volume * lotSize;
  const requiredMargin = notional / instrumentLeverage;

  // Check free margin
  const openPositions = await listPositions(userId, isDemo);
  let usedMargin = 0;
  let floatingPnl = 0;
  for (const pos of openPositions) {
    const pData = await getPrice(pos.symbol);
    if (pData) {
      const inst = INSTRUMENT_MAP.get(pos.symbol);
      const ls = inst?.lotSize ?? 1;
      const lev = LEVERAGE_BY_TYPE[inst?.type ?? "forex"] ?? 100;
      const op = parseFloat(String(pos.openPrice));
      const vol = parseFloat(String(pos.volume));
      const pnl = (pos.direction === "buy" ? (pData.price - op) * vol : (op - pData.price) * vol) * ls;
      floatingPnl += pnl;
      usedMargin += (op * vol * ls) / lev;
    }
  }

  // Also include already-reserved margin from other pending orders
  const existingPending = await db
    .select()
    .from(pendingOrdersTable)
    .where(and(
      eq(pendingOrdersTable.clerkUserId, userId),
      eq(pendingOrdersTable.status, "pending"),
      eq(pendingOrdersTable.isDemo, isDemo),
    ));
  for (const po of existingPending) {
    usedMargin += parseFloat(String(po.marginReserved ?? "0"));
  }

  const activeBalance = parseFloat(String(isDemo ? account.demoBalance : account.balance));
  const equity = activeBalance + floatingPnl;
  const freeMargin = equity - usedMargin;

  if (requiredMargin > freeMargin) {
    res.status(400).json({
      error: `Insufficient free margin. Required: $${requiredMargin.toFixed(2)}, Available: $${freeMargin.toFixed(2)}.`,
    });
    return;
  }

  // For trailing stop, set initial limitPrice based on current price
  let effectiveLimitPrice = limitPrice;
  let effectiveTrailingPeak: string | null = null;
  if (orderType === "trailing_stop" && trailingDistance) {
    const priceData = await getPrice(symbol);
    if (priceData) {
      const currentPrice = direction === "buy" ? priceData.ask : priceData.bid;
      if (direction === "buy") {
        effectiveTrailingPeak = String(currentPrice);
        effectiveLimitPrice = currentPrice + trailingDistance;
      } else {
        effectiveTrailingPeak = String(currentPrice);
        effectiveLimitPrice = currentPrice - trailingDistance;
      }
    }
  }

  const [row] = await db
    .insert(pendingOrdersTable)
    .values({
      accountId: account.id,
      clerkUserId: userId,
      symbol,
      symbolName: instrument.name,
      direction,
      orderType,
      volume: String(volume),
      limitPrice: String(effectiveLimitPrice),
      stopPrice: stopPrice != null ? String(stopPrice) : null,
      trailingDistance: trailingDistance != null ? String(trailingDistance) : null,
      trailingPeak: effectiveTrailingPeak,
      stopLoss: stopLoss != null ? String(stopLoss) : null,
      takeProfit: takeProfit != null ? String(takeProfit) : null,
      marginReserved: String(requiredMargin.toFixed(2)),
      isDemo,
    })
    .returning();

  res.status(201).json(ListPendingOrdersResponseItem.parse(buildPendingResponse(row)));
});

router.delete("/pending-orders/:id", requireAuth, tradingRateLimit, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const params = CancelPendingOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [updated] = await db
    .update(pendingOrdersTable)
    .set({ status: "cancelled" })
    .where(and(
      eq(pendingOrdersTable.id, params.data.id),
      eq(pendingOrdersTable.clerkUserId, userId),
      eq(pendingOrdersTable.status, "pending"),
    ))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Pending order not found or already cancelled" });
    return;
  }

  res.status(204).send();
});

export default router;
