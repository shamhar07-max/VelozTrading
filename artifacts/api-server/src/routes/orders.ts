import { Router, type IRouter, type Request } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, ordersTable } from "@workspace/db";
import { ListOrdersResponse, ListOrdersQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { tradingRateLimit } from "../middlewares/rateLimit";

const router: IRouter = Router();

function mapOrder(o: typeof ordersTable.$inferSelect) {
  return {
    id: o.id,
    symbol: o.symbol,
    symbolName: o.symbolName,
    direction: o.direction as "buy" | "sell",
    volume: parseFloat(String(o.volume)),
    openPrice: parseFloat(String(o.openPrice)),
    closePrice: parseFloat(String(o.closePrice)),
    stopLoss: o.stopLoss ? parseFloat(String(o.stopLoss)) : null,
    takeProfit: o.takeProfit ? parseFloat(String(o.takeProfit)) : null,
    profit: parseFloat(String(o.profit)),
    swap: parseFloat(String(o.swap)),
    commission: parseFloat(String(o.commission)),
    openTime: o.openTime.toISOString(),
    closeTime: o.closeTime.toISOString(),
    journalNote: o.journalNote ?? null,
    strategyTag: o.strategyTag ?? null,
    sentimentRating: o.sentimentRating ?? null,
  };
}

router.get("/orders", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const queryParsed = ListOrdersQueryParams.safeParse(req.query);
  const limit = queryParsed.success ? (queryParsed.data.limit ?? 50) : 50;
  const symbol = queryParsed.success ? queryParsed.data.symbol : undefined;

  let query = db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.clerkUserId, userId))
    .orderBy(desc(ordersTable.closeTime))
    .limit(limit);

  if (symbol) {
    query = db
      .select()
      .from(ordersTable)
      .where(and(eq(ordersTable.clerkUserId, userId), eq(ordersTable.symbol, symbol)))
      .orderBy(desc(ordersTable.closeTime))
      .limit(limit);
  }

  const orders = await query;
  res.json(ListOrdersResponse.parse(orders.map(mapOrder)));
});

router.patch("/orders/:id/journal", requireAuth, tradingRateLimit, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { journalNote, strategyTag, sentimentRating } = req.body as {
    journalNote?: string | null;
    strategyTag?: string | null;
    sentimentRating?: number | null;
  };

  if (sentimentRating !== undefined && sentimentRating !== null) {
    if (!Number.isInteger(sentimentRating) || sentimentRating < 1 || sentimentRating > 5) {
      res.status(400).json({ error: "sentimentRating must be 1–5" });
      return;
    }
  }

  const [existing] = await db
    .select()
    .from(ordersTable)
    .where(and(eq(ordersTable.id, id), eq(ordersTable.clerkUserId, userId)));

  if (!existing) { res.status(404).json({ error: "Order not found" }); return; }

  const [updated] = await db
    .update(ordersTable)
    .set({
      ...(journalNote !== undefined ? { journalNote } : {}),
      ...(strategyTag !== undefined ? { strategyTag } : {}),
      ...(sentimentRating !== undefined ? { sentimentRating } : {}),
    })
    .where(and(eq(ordersTable.id, id), eq(ordersTable.clerkUserId, userId)))
    .returning();

  res.json(mapOrder(updated!));
});

export default router;
