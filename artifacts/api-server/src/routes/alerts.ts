import { Router, type IRouter, type Request } from "express";
import { eq, and } from "drizzle-orm";
import { db, alertsTable, accountsTable } from "@workspace/db";
import { ListAlertsResponse, CreateAlertBody, DeleteAlertParams, TriggerAlertParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { accountRateLimit } from "../middlewares/rateLimit";
import { INSTRUMENT_MAP } from "../lib/instruments";
import { sendPushNotification } from "../lib/notifications";

const router: IRouter = Router();

router.get("/alerts", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;

  const items = await db
    .select()
    .from(alertsTable)
    .where(eq(alertsTable.clerkUserId, userId))
    .orderBy(alertsTable.createdAt);

  const result = items.map((a) => ({
    id: a.id,
    symbol: a.symbol,
    targetPrice: parseFloat(a.targetPrice),
    condition: a.condition,
    status: a.status,
    note: a.note ?? null,
    createdAt: a.createdAt.toISOString(),
    triggeredAt: a.triggeredAt ? a.triggeredAt.toISOString() : null,
  }));

  res.json(ListAlertsResponse.parse(result));
});

router.post("/alerts", requireAuth, accountRateLimit, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const parsed = CreateAlertBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { symbol, targetPrice, condition, note } = parsed.data;

  if (!INSTRUMENT_MAP.has(symbol)) {
    res.status(400).json({ error: "Unknown symbol" });
    return;
  }

  const [alert] = await db
    .insert(alertsTable)
    .values({
      clerkUserId: userId,
      symbol,
      targetPrice: String(targetPrice),
      condition,
      note: note ?? null,
    })
    .returning();

  res.status(201).json({
    id: alert.id,
    symbol: alert.symbol,
    targetPrice: parseFloat(alert.targetPrice),
    condition: alert.condition,
    status: alert.status,
    note: alert.note ?? null,
    createdAt: alert.createdAt.toISOString(),
    triggeredAt: null,
  });
});

router.delete("/alerts/:id", requireAuth, accountRateLimit, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteAlertParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(alertsTable)
    .where(and(eq(alertsTable.id, params.data.id), eq(alertsTable.clerkUserId, userId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }

  res.sendStatus(204);
});

router.patch("/alerts/:id/trigger", requireAuth, accountRateLimit, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = TriggerAlertParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [updated] = await db
    .update(alertsTable)
    .set({ status: "triggered", triggeredAt: new Date() })
    .where(and(eq(alertsTable.id, params.data.id), eq(alertsTable.clerkUserId, userId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }

  // Fire-and-forget push notification if user has a device token
  void (async () => {
    try {
      const [account] = await db
        .select({ pushToken: accountsTable.pushToken })
        .from(accountsTable)
        .where(eq(accountsTable.clerkUserId, userId));
      if (account?.pushToken) {
        const price = parseFloat(updated.targetPrice);
        await sendPushNotification(
          account.pushToken,
          `🔔 Price Alert: ${updated.symbol}`,
          `${updated.symbol} has reached $${price.toLocaleString("en-US", { minimumFractionDigits: 2 })}${updated.note ? ` — ${updated.note}` : ""}`
        );
      }
    } catch { /* non-critical */ }
  })();

  res.json({
    id: updated.id,
    symbol: updated.symbol,
    targetPrice: parseFloat(updated.targetPrice),
    condition: updated.condition,
    status: updated.status,
    note: updated.note ?? null,
    createdAt: updated.createdAt.toISOString(),
    triggeredAt: updated.triggeredAt ? updated.triggeredAt.toISOString() : null,
  });
});

export default router;
