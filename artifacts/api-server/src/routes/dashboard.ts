import { Router, type IRouter, type Request } from "express";
import { eq, desc } from "drizzle-orm";
import { db, ordersTable, positionsTable, accountsTable } from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  GetDashboardActivityResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { getOrCreateAccount } from "./account";
import { getPrice } from "../lib/twelvedata";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;

  const account = await getOrCreateAccount(userId);
  const positions = await db
    .select()
    .from(positionsTable)
    .where(eq(positionsTable.clerkUserId, userId));
  const orders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.clerkUserId, userId));

  // FIX: Fetch all prices in parallel — previously sequential for-await loop
  const priceResults = await Promise.all(
    positions.map((pos) => getPrice(pos.symbol))
  );

  let floatingPnl = 0;
  let usedMargin = 0;
  positions.forEach((pos, i) => {
    const priceData = priceResults[i];
    if (priceData) {
      const curr = priceData.price;
      const open = parseFloat(String(pos.openPrice));
      const vol = parseFloat(String(pos.volume));
      const pnl = pos.direction === "buy" ? (curr - open) * vol : (open - curr) * vol;
      floatingPnl += pnl;
      usedMargin += (open * vol) / parseFloat(String(account.leverage));
    }
  });

  const balance = parseFloat(String(account.balance));
  const equity = balance + floatingPnl;
  const marginLevel = usedMargin > 0 ? (equity / usedMargin) * 100 : 0;

  const totalTrades = orders.length;
  const winners = orders.filter((o) => parseFloat(String(o.profit)) > 0).length;
  const winRate = totalTrades > 0 ? (winners / totalTrades) * 100 : 0;
  const totalProfit = orders.reduce((sum, o) => sum + parseFloat(String(o.profit)), 0);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);

  const todayPnl = orders
    .filter((o) => o.closeTime >= todayStart)
    .reduce((sum, o) => sum + parseFloat(String(o.profit)), 0);

  const weekPnl = orders
    .filter((o) => o.closeTime >= weekStart)
    .reduce((sum, o) => sum + parseFloat(String(o.profit)), 0);

  res.json(
    GetDashboardSummaryResponse.parse({
      balance,
      equity,
      floatingPnl: parseFloat(floatingPnl.toFixed(2)),
      openPositions: positions.length,
      totalTrades,
      winRate: parseFloat(winRate.toFixed(1)),
      totalProfit: parseFloat(totalProfit.toFixed(2)),
      marginLevel: parseFloat(marginLevel.toFixed(2)),
      todayPnl: parseFloat(todayPnl.toFixed(2)),
      weekPnl: parseFloat(weekPnl.toFixed(2)),
    })
  );
});

router.get("/dashboard/activity", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;

  const recentOrders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.clerkUserId, userId))
    .orderBy(desc(ordersTable.closeTime))
    .limit(10);

  const activities = recentOrders.map((o, idx) => ({
    id: o.id * 100 + idx,
    type: "trade_close" as const,
    description: `Closed ${o.direction.toUpperCase()} ${o.symbol} — ${parseFloat(String(o.volume))} lot(s)`,
    symbol: o.symbol,
    amount: parseFloat(String(o.profit)),
    timestamp: o.closeTime.toISOString(),
  }));

  const positions = await db
    .select()
    .from(positionsTable)
    .where(eq(positionsTable.clerkUserId, userId))
    .orderBy(desc(positionsTable.openTime))
    .limit(5);

  const openActivities = positions.map((p, idx) => ({
    id: p.id * 1000 + idx,
    type: "trade_open" as const,
    description: `Opened ${p.direction.toUpperCase()} ${p.symbol} — ${parseFloat(String(p.volume))} lot(s)`,
    symbol: p.symbol,
    amount: null,
    timestamp: p.openTime.toISOString(),
  }));

  const combined = [...openActivities, ...activities]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);

  res.json(GetDashboardActivityResponse.parse(combined));
});

export default router;
