import { Router, type IRouter, type Request } from "express";
import { eq, desc } from "drizzle-orm";
import { db, depositRequestsTable, withdrawalRequestsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/funds-history", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;

  const [deposits, withdrawals] = await Promise.all([
    db
      .select()
      .from(depositRequestsTable)
      .where(eq(depositRequestsTable.clerkUserId, userId))
      .orderBy(desc(depositRequestsTable.createdAt)),
    db
      .select()
      .from(withdrawalRequestsTable)
      .where(eq(withdrawalRequestsTable.clerkUserId, userId))
      .orderBy(desc(withdrawalRequestsTable.createdAt)),
  ]);

  const items = [
    ...deposits.map((d) => ({
      id: d.id,
      type: "deposit" as const,
      method: d.method,
      amount: parseFloat(String(d.amount)),
      status: d.status,
      date: d.createdAt.toISOString(),
      ref: `DEP-${String(d.id).padStart(7, "0")}`,
    })),
    ...withdrawals.map((w) => ({
      id: w.id,
      type: "withdrawal" as const,
      method: w.method,
      amount: parseFloat(String(w.amount)),
      status: w.status,
      date: w.createdAt.toISOString(),
      ref: `WDR-${String(w.id).padStart(7, "0")}`,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  res.json(items);
});

export default router;
