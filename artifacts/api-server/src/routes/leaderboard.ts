import { Router, type IRouter, type Request } from "express";
import { db, ordersTable, positionsTable, accountsTable } from "@workspace/db";
import { clerkClient } from "@clerk/express";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { getPrice } from "../lib/twelvedata";

const router: IRouter = Router();

router.get("/leaderboard", requireAuth, async (req: Request & { log: any }, res): Promise<void> => {
  try {
    const accounts = await db.select().from(accountsTable);

    const realizedRows = await db
      .select({
        clerkUserId: ordersTable.clerkUserId,
        totalPnl: sql<number>`COALESCE(SUM(CAST(${ordersTable.profit} AS numeric)), 0)`,
        totalTrades: sql<number>`COUNT(*)`,
        winTrades: sql<number>`SUM(CASE WHEN CAST(${ordersTable.profit} AS numeric) > 0 THEN 1 ELSE 0 END)`,
      })
      .from(ordersTable)
      .groupBy(ordersTable.clerkUserId);

    const realizedMap = new Map(realizedRows.map((r) => [r.clerkUserId, r]));

    const openPositions = await db.select().from(positionsTable);
    const positionsByUser = new Map<string, typeof openPositions>();
    for (const pos of openPositions) {
      if (!positionsByUser.has(pos.clerkUserId)) positionsByUser.set(pos.clerkUserId, []);
      positionsByUser.get(pos.clerkUserId)!.push(pos);
    }

    const uniqueSymbols = [...new Set(openPositions.map((p) => p.symbol))];
    const priceResults = await Promise.all(
      uniqueSymbols.map(async (sym) => {
        const p = await getPrice(sym);
        return [sym, p?.price ?? null] as [string, number | null];
      })
    );
    const priceMap = new Map(priceResults);

    const entries = await Promise.all(
      accounts.map(async (account) => {
        const realized = realizedMap.get(account.clerkUserId);
        const totalPnl = Number(realized?.totalPnl ?? 0);
        const totalTrades = Number(realized?.totalTrades ?? 0);
        const winTrades = Number(realized?.winTrades ?? 0);

        const positions = positionsByUser.get(account.clerkUserId) ?? [];
        let floatingPnl = 0;
        for (const pos of positions) {
          const currentPrice = priceMap.get(pos.symbol) ?? parseFloat(String(pos.openPrice));
          const openPrice = parseFloat(String(pos.openPrice));
          const volume = parseFloat(String(pos.volume));
          floatingPnl +=
            pos.direction === "buy"
              ? (currentPrice - openPrice) * volume
              : (openPrice - currentPrice) * volume;
        }

        const combinedPnl = totalPnl + floatingPnl;
        const startBalance = parseFloat(String(account.balance)) - combinedPnl;
        const effectiveStart = startBalance > 0 ? startBalance : 10000;
        const pnlPercent = (combinedPnl / effectiveStart) * 100;
        const winRate = totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0;

        let displayName = "Anonymous Trader";
        let avatarUrl: string | null = null;
        try {
          const user = await clerkClient.users.getUser(account.clerkUserId);
          const first = user.firstName ?? "";
          const lastInitial = user.lastName ? ` ${user.lastName[0]}.` : "";
          displayName =
            first
              ? `${first}${lastInitial}`
              : user.username ?? user.emailAddresses[0]?.emailAddress?.split("@")[0] ?? "Anonymous Trader";
          avatarUrl = user.imageUrl ?? null;
        } catch {
          // user deleted or unavailable
        }

        return {
          userId: account.clerkUserId,
          displayName,
          avatarUrl,
          totalPnl: parseFloat(combinedPnl.toFixed(2)),
          pnlPercent: parseFloat(pnlPercent.toFixed(2)),
          totalTrades,
          winRate: parseFloat(winRate.toFixed(1)),
          startBalance: parseFloat(effectiveStart.toFixed(2)),
          openPositions: positions.length,
        };
      })
    );

    const ranked = entries
      .sort((a, b) => b.pnlPercent - a.pnlPercent)
      .map((entry, i) => ({ rank: i + 1, ...entry }));

    res.json(ranked);
  } catch (err) {
    req.log.error({ err }, "Leaderboard error");
    res.status(500).json({ error: "Failed to compute leaderboard" });
  }
});

export default router;
