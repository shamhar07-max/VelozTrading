import { Router, type IRouter, type Request } from "express";
import { eq, and, ne, isNotNull } from "drizzle-orm";
import { db, depositRequestsTable, withdrawalRequestsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/my-notifications", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;

  const [deposits, withdrawals] = await Promise.all([
    db
      .select()
      .from(depositRequestsTable)
      .where(
        and(
          eq(depositRequestsTable.clerkUserId, userId),
          ne(depositRequestsTable.status, "pending"),
          isNotNull(depositRequestsTable.reviewedAt),
        ),
      ),
    db
      .select()
      .from(withdrawalRequestsTable)
      .where(
        and(
          eq(withdrawalRequestsTable.clerkUserId, userId),
          ne(withdrawalRequestsTable.status, "pending"),
          isNotNull(withdrawalRequestsTable.reviewedAt),
        ),
      ),
  ]);

  const items = [
    ...deposits.map((d) => ({
      id: `dep-${d.id}`,
      type: "deposit" as const,
      amount: parseFloat(String(d.amount)),
      status: d.status,
      method: d.method,
      reviewedAt: d.reviewedAt?.toISOString() ?? null,
    })),
    ...withdrawals.map((w) => ({
      id: `wdl-${w.id}`,
      type: "withdrawal" as const,
      amount: parseFloat(String(w.amount)),
      status: w.status,
      method: w.method,
      reviewedAt: w.reviewedAt?.toISOString() ?? null,
    })),
  ].sort((a, b) =>
    new Date(b.reviewedAt ?? 0).getTime() - new Date(a.reviewedAt ?? 0).getTime()
  );

  res.json(items);
});

export default router;
