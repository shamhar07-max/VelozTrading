import { Router, type IRouter, type Request } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, positionsTable, ordersTable, accountsTable } from "@workspace/db";
import {
  ListPositionsResponse,
  GetPositionResponse,
  UpdatePositionResponse,
  ClosePositionResponse,
  OpenPositionBody,
  UpdatePositionBody,
  GetPositionParams,
  UpdatePositionParams,
  ClosePositionParams,
  ClosePositionBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { tradingRateLimit } from "../middlewares/rateLimit";
import { getOrCreateAccount } from "./account";
import { getPrice } from "../lib/twelvedata";
import { INSTRUMENT_MAP, LEVERAGE_BY_TYPE, TIER_CONFIG } from "../lib/instruments";
import { recordTransaction } from "../lib/ledger";
import { accrueForClosedPosition } from "../lib/partnerProgram";

const router: IRouter = Router();

export async function listPositions(clerkUserId: string, isDemo?: boolean) {
  if (isDemo !== undefined) {
    return db
      .select()
      .from(positionsTable)
      .where(and(
        eq(positionsTable.clerkUserId, clerkUserId),
        eq(positionsTable.isDemo, isDemo)
      ));
  }
  return db
    .select()
    .from(positionsTable)
    .where(eq(positionsTable.clerkUserId, clerkUserId));
}

async function buildPositionResponse(pos: typeof positionsTable.$inferSelect) {
  const priceData = await getPrice(pos.symbol);
  const openPrice = parseFloat(String(pos.openPrice));
  const volume = parseFloat(String(pos.volume));

  // Use bid for buys (close = sell at bid), ask for sells (close = buy at ask)
  const currentPrice = priceData
    ? (pos.direction === "buy"
        ? (priceData.bid ?? priceData.price)
        : (priceData.ask ?? priceData.price))
    : openPrice;

  const instrument = INSTRUMENT_MAP.get(pos.symbol);
  const lotSize = instrument?.lotSize ?? 1;

  const profit =
    (pos.direction === "buy"
      ? (currentPrice - openPrice) * volume
      : (openPrice - currentPrice) * volume) * lotSize;

  return {
    id: pos.id,
    symbol: pos.symbol,
    symbolName: pos.symbolName,
    type: "market" as const,
    direction: pos.direction as "buy" | "sell",
    volume,
    lotSize,
    openPrice,
    currentPrice,
    stopLoss: pos.stopLoss ? parseFloat(String(pos.stopLoss)) : null,
    takeProfit: pos.takeProfit ? parseFloat(String(pos.takeProfit)) : null,
    profit: parseFloat(profit.toFixed(2)),
    swap: parseFloat(String(pos.swap)),
    commission: parseFloat(String(pos.commission)),
    openTime: pos.openTime.toISOString(),
  };
}

// GET /positions — only return positions matching the account's current mode
router.get("/positions", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const account = await getOrCreateAccount(userId);
  const positions = await listPositions(userId, account.isDemoMode);
  const results = await Promise.all(positions.map(buildPositionResponse));
  res.json(ListPositionsResponse.parse(results));
});

router.post("/positions", requireAuth, tradingRateLimit, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const parsed = OpenPositionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { symbol, direction, volume, stopLoss, takeProfit } = parsed.data;

  if (volume < 0.01 || volume > 1000) {
    res.status(400).json({ error: "Volume must be between 0.01 and 1000 lots." });
    return;
  }

  const instrument = INSTRUMENT_MAP.get(symbol);
  if (!instrument) {
    res.status(400).json({ error: "Unknown symbol" });
    return;
  }

  const priceData = await getPrice(symbol);
  if (!priceData) {
    res.status(400).json({ error: "Could not fetch current price" });
    return;
  }
  const openPrice = direction === "buy" ? priceData.ask : priceData.bid;
  if (!openPrice) {
    res.status(400).json({ error: "Could not fetch current price" });
    return;
  }
  if (direction === "buy") {
    if (stopLoss != null && stopLoss >= openPrice) {
      res.status(400).json({ error: "Stop Loss must be below the current price for a buy order." });
      return;
    }
    if (takeProfit != null && takeProfit <= openPrice) {
      res.status(400).json({ error: "Take Profit must be above the current price for a buy order." });
      return;
    }
  } else {
    if (stopLoss != null && stopLoss <= openPrice) {
      res.status(400).json({ error: "Stop Loss must be above the current price for a sell order." });
      return;
    }
    if (takeProfit != null && takeProfit >= openPrice) {
      res.status(400).json({ error: "Take Profit must be below the current price for a sell order." });
      return;
    }
  }

  const account = await getOrCreateAccount(userId);
  const isDemo = account.isDemoMode;

  const instrumentLeverage = LEVERAGE_BY_TYPE[instrument.type] ?? 100;
  const lotSize = instrument.lotSize ?? 1;
  const notional = openPrice * volume * lotSize;
  const requiredMargin = notional / instrumentLeverage;

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
      usedMargin += (pData.price * vol * ls) / lev;
    }
  }

  const activeBalance = parseFloat(String(isDemo ? account.demoBalance : account.balance));
  const equity = activeBalance + floatingPnl;
  const freeMargin = equity - usedMargin;

  // Tier-based commission: VIP pays $0/lot, Standard pays $2/lot
  const tierConfig = TIER_CONFIG[account.accountType ?? "real"] ?? TIER_CONFIG["real"]!;
  const commission = volume * tierConfig.commissionPerLot;

  if (requiredMargin > freeMargin) {
    res.status(400).json({
      error: `Insufficient free margin. Required: $${requiredMargin.toFixed(2)}, Free margin: $${freeMargin.toFixed(2)}.`,
    });
    return;
  }

  let pos!: typeof positionsTable.$inferSelect;

  // Atomic: insert position + deduct commission from active balance
  await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(positionsTable)
      .values({
        accountId: account.id,
        clerkUserId: userId,
        symbol,
        symbolName: instrument.name,
        direction,
        volume: String(volume),
        openPrice: String(openPrice),
        stopLoss: stopLoss != null ? String(stopLoss) : null,
        takeProfit: takeProfit != null ? String(takeProfit) : null,
        swap: "0",
        commission: String(commission.toFixed(2)),
        isDemo,
      })
      .returning();
    pos = inserted;

    if (commission > 0) {
      if (isDemo) {
        await tx
          .update(accountsTable)
          .set({ demoBalance: sql`demo_balance - ${commission.toFixed(2)}::numeric` })
          .where(eq(accountsTable.id, account.id));
        await recordTransaction(tx, {
          clerkUserId: userId,
          accountId: account.id,
          type: "trade_commission",
          amount: (-commission).toFixed(2),
          isDemo,
          refType: "position",
          refId: pos.id,
          description: `Open commission — ${symbol} ${direction} ${volume} lots`,
        });
      } else {
        await tx
          .update(accountsTable)
          .set({ balance: sql`balance - ${commission.toFixed(2)}::numeric` })
          .where(eq(accountsTable.id, account.id));
        await recordTransaction(tx, {
          clerkUserId: userId,
          accountId: account.id,
          type: "trade_commission",
          amount: (-commission).toFixed(2),
          isDemo,
          refType: "position",
          refId: pos.id,
          description: `Open commission — ${symbol} ${direction} ${volume} lots`,
        });

        // IB/Sub-IB commissions are NOT credited at trade open. Lot rebates and
        // parent overrides accrue as PENDING lines when a trade CLOSES (spec §4)
        // and reach the partner only via the approved monthly run.
      }
    }
  });

  const result = await buildPositionResponse(pos);
  res.status(201).json(GetPositionResponse.parse(result));
});

router.get("/positions/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const params = GetPositionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [pos] = await db
    .select()
    .from(positionsTable)
    .where(and(eq(positionsTable.id, params.data.id), eq(positionsTable.clerkUserId, userId)));

  if (!pos) {
    res.status(404).json({ error: "Position not found" });
    return;
  }

  res.json(GetPositionResponse.parse(await buildPositionResponse(pos)));
});

router.patch("/positions/:id", requireAuth, tradingRateLimit, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const params = UpdatePositionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdatePositionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(positionsTable)
    .where(and(eq(positionsTable.id, params.data.id), eq(positionsTable.clerkUserId, userId)));
  if (!existing) {
    res.status(404).json({ error: "Position not found" });
    return;
  }
  const currentPriceData = await getPrice(existing.symbol);
  const currentPrice = currentPriceData?.price ?? parseFloat(String(existing.openPrice));
  const { stopLoss, takeProfit } = body.data;
  if (existing.direction === "buy") {
    if (stopLoss != null && stopLoss >= currentPrice) {
      res.status(400).json({ error: "Stop Loss must be below current price for a buy position." });
      return;
    }
    if (takeProfit != null && takeProfit <= currentPrice) {
      res.status(400).json({ error: "Take Profit must be above current price for a buy position." });
      return;
    }
  } else {
    if (stopLoss != null && stopLoss <= currentPrice) {
      res.status(400).json({ error: "Stop Loss must be above current price for a sell position." });
      return;
    }
    if (takeProfit != null && takeProfit >= currentPrice) {
      res.status(400).json({ error: "Take Profit must be below current price for a sell position." });
      return;
    }
  }

  const updates: Partial<typeof positionsTable.$inferInsert> = {};
  if (body.data.stopLoss !== undefined)
    updates.stopLoss = body.data.stopLoss != null ? String(body.data.stopLoss) : null;
  if (body.data.takeProfit !== undefined)
    updates.takeProfit = body.data.takeProfit != null ? String(body.data.takeProfit) : null;

  const [pos] = await db
    .update(positionsTable)
    .set(updates)
    .where(and(eq(positionsTable.id, params.data.id), eq(positionsTable.clerkUserId, userId)))
    .returning();

  if (!pos) {
    res.status(404).json({ error: "Position not found" });
    return;
  }

  res.json(UpdatePositionResponse.parse(await buildPositionResponse(pos)));
});

// DELETE /positions/:id — close a position atomically
router.delete("/positions/:id", requireAuth, tradingRateLimit, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const params = ClosePositionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [pos] = await db
    .select()
    .from(positionsTable)
    .where(and(eq(positionsTable.id, params.data.id), eq(positionsTable.clerkUserId, userId)));

  if (!pos) {
    res.status(404).json({ error: "Position not found" });
    return;
  }

  const body = ClosePositionBody.safeParse(req.body);
  const clientClosePrice = body.success ? body.data.closePrice : undefined;

  const priceData = await getPrice(pos.symbol);
  const instrument = INSTRUMENT_MAP.get(pos.symbol);
  const cachedBid = priceData?.bid ?? priceData?.price ?? parseFloat(String(pos.openPrice));
  const cachedAsk = priceData?.ask ?? priceData?.price ?? parseFloat(String(pos.openPrice));
  const cachedExecPrice = pos.direction === "buy" ? cachedBid : cachedAsk;

  // Use the client-submitted price if it's within 5× the instrument pip of the cached price.
  // This ensures the trade closes at the exact price the trader saw, preventing tick slippage.
  const pip = instrument?.pip ?? 0.0001;
  const tolerance = pip * 5;
  const closePrice =
    clientClosePrice !== undefined && Math.abs(clientClosePrice - cachedExecPrice) <= tolerance
      ? clientClosePrice
      : cachedExecPrice;
  const openPrice = parseFloat(String(pos.openPrice));
  const volume = parseFloat(String(pos.volume));

  const lotSize = instrument?.lotSize ?? 1;
  const profit =
    (pos.direction === "buy"
      ? (closePrice - openPrice) * volume
      : (openPrice - closePrice) * volume) * lotSize;

  let order!: typeof ordersTable.$inferSelect;

  await db.transaction(async (tx) => {
    await tx.delete(positionsTable).where(eq(positionsTable.id, pos.id));

    const [inserted] = await tx
      .insert(ordersTable)
      .values({
        accountId: pos.accountId,
        clerkUserId: userId,
        symbol: pos.symbol,
        symbolName: pos.symbolName,
        direction: pos.direction,
        volume: pos.volume,
        openPrice: pos.openPrice,
        closePrice: String(closePrice),
        stopLoss: pos.stopLoss,
        takeProfit: pos.takeProfit,
        profit: String(profit.toFixed(2)),
        swap: pos.swap,
        commission: pos.commission,
        openTime: pos.openTime,
      })
      .returning();

    order = inserted;

    if (pos.isDemo) {
      await tx
        .update(accountsTable)
        .set({ demoBalance: sql`demo_balance + ${profit.toFixed(2)}::numeric` })
        .where(eq(accountsTable.id, pos.accountId));
      await recordTransaction(tx, {
        clerkUserId: userId,
        accountId: pos.accountId,
        type: "trade_close",
        amount: profit.toFixed(2),
        isDemo: true,
        refType: "order",
        refId: order.id,
        description: `Close ${pos.symbol} @ ${closePrice}`,
      });
    } else {
      // Partners trade on identical terms as regular clients — no profit split.
      // (VEL-IB-SPEC-2026-R1 removed the legacy VelozPartner Pro 70/30 model.)
      const creditedProfit = profit;

      await tx
        .update(accountsTable)
        .set({ balance: sql`balance + ${creditedProfit.toFixed(2)}::numeric` })
        .where(eq(accountsTable.id, pos.accountId));

      await recordTransaction(tx, {
        clerkUserId: userId,
        accountId: pos.accountId,
        type: "trade_close",
        amount: creditedProfit.toFixed(2),
        isDemo: false,
        refType: "order",
        refId: order.id,
        description: `Close ${pos.symbol} @ ${closePrice}`,
      });

      // ── IB/Sub-IB commission accrual (real trades only) ──────────────
      // One closed real trade → pending lot_rebate (+ parent_override for sub-IB
      // books). Settlement happens in the admin-approved monthly run.
      if (!pos.isDemo) {
        await accrueForClosedPosition(tx, {
          positionId: pos.id,
          clientId: userId,
          lots: volume,
        });
      }
    }
  });

  res.json(
    ClosePositionResponse.parse({
      id: order.id,
      symbol: order.symbol,
      symbolName: order.symbolName,
      direction: order.direction as "buy" | "sell",
      volume: parseFloat(String(order.volume)),
      openPrice: parseFloat(String(order.openPrice)),
      closePrice: parseFloat(String(order.closePrice)),
      stopLoss: order.stopLoss ? parseFloat(String(order.stopLoss)) : null,
      takeProfit: order.takeProfit ? parseFloat(String(order.takeProfit)) : null,
      profit: parseFloat(String(order.profit)),
      swap: parseFloat(String(order.swap)),
      commission: parseFloat(String(order.commission)),
      openTime: order.openTime.toISOString(),
      closeTime: order.closeTime.toISOString(),
    })
  );
});

export default router;
