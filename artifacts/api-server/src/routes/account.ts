import { Router, type IRouter, type Request } from "express";
import { eq, and, sql, asc, desc } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import { db, accountsTable, depositRequestsTable, withdrawalRequestsTable, pendingOrdersTable, ordersTable, partnersTable, transactionsTable } from "@workspace/db";
import { GetAccountResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { accountRateLimit, depositRateLimit } from "../middlewares/rateLimit";
import { recordTransaction } from "../lib/ledger";
import { canWithdraw } from "../lib/partnerProgramMath";
import { listPositions as fetchPositions } from "./positions";
import { getPrice } from "../lib/twelvedata";
import { INSTRUMENT_MAP, LEVERAGE_BY_TYPE } from "../lib/instruments";
import {
  sendAdminNotification,
  sendUserNotification,
  kycSubmittedHtml,
  depositRequestedHtml,
  withdrawalRequestedHtml,
  welcomeHtml,
  sendPushNotification,
} from "../lib/notifications";

const router: IRouter = Router();

export async function getOrCreateAccount(clerkUserId: string) {
  const [existing] = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.clerkUserId, clerkUserId));

  if (existing) return existing;

  const [created] = await db
    .insert(accountsTable)
    .values({
      clerkUserId,
      balance: "0.00",        // real account starts at $0 — funded via deposits
      demoBalance: "10000.00",  // demo always starts at $10,000 virtual
      isDemoMode: false,        // default to real mode
      currency: "USD",
      leverage: 100,
      accountType: "real",      // tier starts at "real"; upgrades based on deposits
      kycStatus: "unverified",
    })
    .returning();

  // Send welcome email (non-critical — don't block account creation)
  try {
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || "Trader";
    if (email) {
      void sendUserNotification(email, "Welcome to VelozTrade — Your Account Is Ready", welcomeHtml(name));
    }
  } catch { /* non-critical */ }

  return created;
}

async function computeAccountMetrics(
  account: typeof accountsTable.$inferSelect,
  clerkUserId: string
) {
  const isDemo = account.isDemoMode;
  const allPositions = await fetchPositions(clerkUserId);
  // Only compute metrics for positions that match the current mode
  const positions = allPositions.filter((p) => p.isDemo === isDemo);

  const priceResults = await Promise.all(
    positions.map((pos) => getPrice(pos.symbol))
  );

  let floatingPnl = 0;
  let usedMargin = 0;

  positions.forEach((pos, i) => {
    const priceData = priceResults[i];
    if (priceData) {
      const currentPrice = priceData.price;
      const openPrice = parseFloat(String(pos.openPrice));
      const volume = parseFloat(String(pos.volume));
      const instrument = INSTRUMENT_MAP.get(pos.symbol);
      const lotSize = instrument?.lotSize ?? 1;
      const instrumentLeverage = LEVERAGE_BY_TYPE[instrument?.type ?? "forex"] ?? 100;

      const pnl =
        (pos.direction === "buy"
          ? (currentPrice - openPrice) * volume
          : (openPrice - currentPrice) * volume) * lotSize;
      floatingPnl += pnl;
      usedMargin += (currentPrice * volume * lotSize) / instrumentLeverage;
    }
  });

  // T004: include reserved margin from pending orders in the same mode
  const pendingOrders = await db
    .select()
    .from(pendingOrdersTable)
    .where(and(
      eq(pendingOrdersTable.clerkUserId, clerkUserId),
      eq(pendingOrdersTable.status, "pending"),
      eq(pendingOrdersTable.isDemo, isDemo),
    ));
  for (const po of pendingOrders) {
    usedMargin += parseFloat(String(po.marginReserved ?? "0"));
  }

  // Use the active balance — demoBalance in demo mode, balance in real mode
  const balance = parseFloat(String(isDemo ? account.demoBalance : account.balance));
  const equity = balance + floatingPnl;
  const freeMargin = equity - usedMargin;
  const marginLevel = usedMargin > 0 ? (equity / usedMargin) * 100 : 0;
  return { balance, equity, floatingPnl, usedMargin, freeMargin, marginLevel };
}

router.get("/account", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const account = await getOrCreateAccount(userId);
  const metrics = await computeAccountMetrics(account, userId);

  res.json(
    GetAccountResponse.parse({
      id: account.id,
      ...metrics,
      margin: metrics.usedMargin,
      currency: account.currency,
      leverage: account.leverage,
      accountType: (["real","silver","gold","platinum","vip"] as const).includes(account.accountType as never)
        ? account.accountType
        : "real",
      kycStatus: account.kycStatus ?? "unverified",
      demoBalance: parseFloat(String(account.demoBalance)),
      isDemoMode: account.isDemoMode,
    })
  );
});

router.patch("/account", requireAuth, accountRateLimit, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const account = await getOrCreateAccount(userId);

  const body = req.body as { isDemoMode?: boolean; kycStatus?: string; leverage?: number };
  const updates: Record<string, string | number | boolean> = {};

  let triggerKycNotification = false;

  // Toggle demo mode — client sends isDemoMode: true/false
  if (typeof body.isDemoMode === "boolean") {
    updates.isDemoMode = body.isDemoMode;
  }

  if (body.kycStatus && ["unverified", "pending", "verified"].includes(body.kycStatus)) {
    updates.kycStatus = body.kycStatus;
    if (body.kycStatus === "pending" && account.kycStatus === "unverified") {
      triggerKycNotification = true;
    }
  }
  if (body.leverage && [10, 25, 50, 100, 200, 500].includes(body.leverage)) {
    updates.leverage = body.leverage;
  }

  if (Object.keys(updates).length > 0) {
    await db.update(accountsTable).set(updates).where(eq(accountsTable.clerkUserId, userId));
  }

  if (triggerKycNotification) {
    try {
      const clerkUser = await clerkClient.users.getUser(userId);
      const email = clerkUser.emailAddresses[0]?.emailAddress ?? "—";
      const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || "—";
      void sendAdminNotification(
        `⏳ New KYC Application — ${email}`,
        kycSubmittedHtml(email, name, account.accountType)
      );
    } catch {
      // non-critical
    }
  }

  const [updated] = await db.select().from(accountsTable).where(eq(accountsTable.clerkUserId, userId));
  const metrics = await computeAccountMetrics(updated, userId);

  res.json(
    GetAccountResponse.parse({
      id: updated.id,
      ...metrics,
      margin: metrics.usedMargin,
      currency: updated.currency,
      leverage: updated.leverage,
      accountType: updated.accountType ?? "real",
      kycStatus: updated.kycStatus ?? "unverified",
      demoBalance: parseFloat(String(updated.demoBalance)),
      isDemoMode: updated.isDemoMode,
    })
  );
});

// Deposit — creates a pending request for admin review.
// Balance is NOT credited until an admin approves the request.
// User must provide payment proof (transaction ID, card details, etc.).
router.post("/account/deposit-request", requireAuth, depositRateLimit, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const { amount, method, paymentProof } = req.body as {
    amount?: number;
    method?: string;
    paymentProof?: string;
  };

  const parsedAmount = Number(amount);
  if (!parsedAmount || parsedAmount < 10 || parsedAmount > 1_000_000) {
    res.status(400).json({ error: "Amount must be between $10 and $1,000,000" });
    return;
  }

  if (!paymentProof || typeof paymentProof !== "string" || paymentProof.trim().length < 3) {
    res.status(400).json({ error: "Payment proof / transaction details are required." });
    return;
  }

  const validMethods = ["card", "bank", "crypto", "ewallet", "jazzcash", "easypaisa", "upi"];
  const depositMethod = validMethods.includes(method ?? "") ? method! : "card";

  // Create request as PENDING — do NOT credit balance yet.
  // Balance will be credited when an admin approves this request.
  const [request] = await db
    .insert(depositRequestsTable)
    .values({
      clerkUserId: userId,
      amount: parsedAmount.toFixed(2),
      method: depositMethod,
      status: "pending",
      paymentProof: paymentProof.trim(),
    })
    .returning();

  try {
    const clerkUser = await clerkClient.users.getUser(userId);
    const email = clerkUser.emailAddresses[0]?.emailAddress ?? "—";
    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || "—";
    void sendAdminNotification(
      `⏳ New Deposit Request — $${parsedAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} from ${email}`,
      depositRequestedHtml(email, name, parsedAmount, depositMethod)
    );
  } catch {
    // non-critical
  }

  res.json({
    ok: true,
    id: request.id,
    status: "pending",
    message: "Your deposit request has been submitted and is under review. Your balance will be credited once approved by our team.",
  });
});

// Withdrawal — requires KYC verification. Always uses real balance.
// FIX: Uses a DB transaction with atomic balance check-and-deduct to prevent double-spend.
router.post("/account/withdrawal-request", requireAuth, depositRateLimit, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const { amount, method, bankDetails } = req.body as {
    amount?: number;
    method?: string;
    bankDetails?: string;
  };

  const parsedAmount = Number(amount);
  if (!parsedAmount || parsedAmount < 10 || parsedAmount > 1_000_000) {
    res.status(400).json({ error: "Amount must be between $10 and $1,000,000" });
    return;
  }

  // FIX: KYC required before withdrawal
  const account = await getOrCreateAccount(userId);
  if (account.kycStatus !== "verified") {
    const kycMessage =
      account.kycStatus === "pending"
        ? "Your KYC verification is pending review. Withdrawals will be enabled once your identity is verified."
        : "KYC verification is required before you can withdraw funds. Please complete identity verification in your profile.";
    res.status(403).json({ error: kycMessage, kycRequired: true, kycStatus: account.kycStatus });
    return;
  }

  // Partner withdrawal rules — enforced only for users who OWN a partner account.
  // (referredByPartnerId on accounts identifies a *referred trader*, not the partner themselves.)
  // Commission earnings are credited directly to accounts.balance when earned, so
  // commissionWallet is a running total for display. The only locked capital is the
  // unseeded portion of the principal: locked = seededCapital × (1 − unlockedPct/100).
  const [ownPartner] = await db
    .select()
    .from(partnersTable)
    .where(eq(partnersTable.clerkUserId, userId));

  if (ownPartner) {
    // Lifecycle gate (VEL-IB-SPEC-2026-R1 §8): only active partners (and dormant
    // partners draining their wallet) may withdraw. Suspended/terminated cannot.
    if (!canWithdraw(ownPartner.status)) {
      res.status(403).json({
        error: `Your partner account is currently '${ownPartner.status}'. Withdrawals are unavailable in this state. Contact support.`,
        partnerStatusBlocked: true,
        partnerStatus: ownPartner.status,
      });
      return;
    }

    const seededCapital = parseFloat(String(ownPartner.seededCapital));
    const balance = parseFloat(String(account.balance));
    const lockedPrincipal = seededCapital * (1 - ownPartner.capitalUnlockedPct / 100);
    const maxWithdrawable = Math.max(0, balance - lockedPrincipal);

    if (parsedAmount > maxWithdrawable) {
      const unlockedPrincipal = seededCapital * (ownPartner.capitalUnlockedPct / 100);
      res.status(400).json({
        error: `Withdrawal exceeds your withdrawable balance of $${maxWithdrawable.toFixed(2)}. Your principal is locked until you reach more referral milestones — currently ${ownPartner.capitalUnlockedPct}% unlocked ($${unlockedPrincipal.toFixed(2)} of $${seededCapital.toFixed(2)}).`,
        partnerWithdrawalLimit: true,
        maxWithdrawable: parseFloat(maxWithdrawable.toFixed(2)),
        breakdown: {
          balance: parseFloat(balance.toFixed(2)),
          seededCapital,
          lockedPrincipal: parseFloat(lockedPrincipal.toFixed(2)),
          unlockedPrincipal: parseFloat(unlockedPrincipal.toFixed(2)),
          capitalUnlockedPct: ownPartner.capitalUnlockedPct,
        },
      });
      return;
    }
  }

  const validMethods = ["bank", "crypto", "ewallet", "jazzcash", "easypaisa", "upi"];
  const withdrawMethod = validMethods.includes(method ?? "") ? method! : "bank";

  // FIX: Wrap balance check + deduct in a transaction to prevent double-spend race condition.
  // The UPDATE with WHERE balance >= amount is atomic — if two requests race, only one
  // will find balance >= amount and proceed; the other gets 0 rows updated.
  let withdrawalRequest: typeof import("@workspace/db").withdrawalRequestsTable.$inferSelect;

  // Pre-compute partner lock for use in the atomic SQL predicate.
  // Using the pre-read value is safe: capitalUnlockedPct only ever increases
  // (as more CPA referrals arrive), so a stale read is conservative (tighter cap).
  const lockedPrincipal = ownPartner
    ? parseFloat(String(ownPartner.seededCapital)) * (1 - ownPartner.capitalUnlockedPct / 100)
    : null;

  try {
    const result = await db.transaction(async (tx) => {
      // Atomic conditional deduct — enforces both:
      //   (a) balance >= parsedAmount           (standard insufficient-balance guard)
      //   (b) (balance - parsedAmount) >= locked (partner principal-lock guard, if applicable)
      // Both checks live inside the same UPDATE WHERE, making them race-condition-safe.
      const whereClause = lockedPrincipal !== null
        ? sql`${accountsTable.clerkUserId} = ${userId} AND balance >= ${parsedAmount.toFixed(2)}::numeric AND (balance - ${parsedAmount.toFixed(2)}::numeric) >= ${lockedPrincipal.toFixed(2)}::numeric`
        : sql`${accountsTable.clerkUserId} = ${userId} AND balance >= ${parsedAmount.toFixed(2)}::numeric`;

      const updated = await tx
        .update(accountsTable)
        .set({ balance: sql`balance - ${parsedAmount.toFixed(2)}::numeric` })
        .where(whereClause)
        .returning({ newBalance: accountsTable.balance });

      if (updated.length === 0) {
        throw new Error(lockedPrincipal !== null ? "PARTNER_LOCK" : "INSUFFICIENT_BALANCE");
      }

      const [req] = await tx
        .insert(withdrawalRequestsTable)
        .values({
          clerkUserId: userId,
          amount: parsedAmount.toFixed(2),
          method: withdrawMethod,
          bankDetails: bankDetails ?? null,
          status: "pending",
        })
        .returning();

      await recordTransaction(tx, {
        clerkUserId: userId,
        accountId: account.id,
        type: "withdrawal_hold",
        amount: (-parsedAmount).toFixed(2),
        balanceAfter: parseFloat(String(updated[0]!.newBalance)).toFixed(2),
        isDemo: false,
        refType: "withdrawal_request",
        refId: req.id,
        description: `Withdrawal request #${req.id} (${withdrawMethod}) — held pending review`,
      });

      return { request: req, newBalance: parseFloat(String(updated[0]!.newBalance)) };
    });

    withdrawalRequest = result.request;

    try {
      const clerkUser = await clerkClient.users.getUser(userId);
      const email = clerkUser.emailAddresses[0]?.emailAddress ?? "—";
      const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || "—";
      void sendAdminNotification(
        `🏦 New Withdrawal Request — $${parsedAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} from ${email}`,
        withdrawalRequestedHtml(email, name, parsedAmount, withdrawMethod, parseFloat(String(account.balance)))
      );
    } catch { /* non-critical */ }

    res.json({ ok: true, id: withdrawalRequest.id, newBalance: result.newBalance.toFixed(2) });
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_BALANCE") {
      res.status(400).json({ error: "Insufficient balance for this withdrawal." });
    } else if (err instanceof Error && err.message === "PARTNER_LOCK") {
      res.status(400).json({ error: "Withdrawal would breach your locked principal. More of your capital unlocks as you refer depositing clients." });
    } else {
      res.status(500).json({ error: "Withdrawal failed. Please try again." });
    }
  }
});

router.post("/account/kyc-submission", requireAuth, accountRateLimit, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const { frontPath, backPath, selfiePath, idType, idNumber, personal, financial } = req.body as {
    frontPath?: string;
    backPath?: string;
    selfiePath?: string;
    idType?: string;
    idNumber?: string;
    personal?: Record<string, unknown>;
    financial?: Record<string, unknown>;
  };

  const updates: Record<string, string | null> = {
    kycStatus: "pending",
  };

  if (frontPath) updates.kycDocFront = frontPath;
  if (backPath) updates.kycDocBack = backPath;
  if (selfiePath) updates.kycDocSelfie = selfiePath;

  await db.update(accountsTable).set(updates).where(eq(accountsTable.clerkUserId, userId));

  try {
    const clerkUser = await clerkClient.users.getUser(userId);
    const email = clerkUser.emailAddresses[0]?.emailAddress ?? "—";
    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || "—";
    void sendAdminNotification(
      `⏳ New KYC Application — ${email}`,
      kycSubmittedHtml(email, name, "real")
    );
  } catch { /* non-critical */ }

  res.json({ ok: true, kycStatus: "pending" });
});

router.get("/account/transactions", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const limitRaw = parseInt(String(req.query.limit ?? "50"), 10);
  const limit = Math.min(200, Math.max(1, Number.isNaN(limitRaw) ? 50 : limitRaw));
  const offsetRaw = parseInt(String(req.query.offset ?? "0"), 10);
  const offset = Math.max(0, Number.isNaN(offsetRaw) ? 0 : offsetRaw);

  const typeFilter = typeof req.query.type === "string" ? req.query.type : null;
  const modeFilter = req.query.mode === "demo" ? true : req.query.mode === "real" ? false : null;

  const conditions = [eq(transactionsTable.clerkUserId, userId)];
  if (typeFilter) conditions.push(eq(transactionsTable.type, typeFilter));
  if (modeFilter !== null) conditions.push(eq(transactionsTable.isDemo, modeFilter));

  const rows = await db
    .select()
    .from(transactionsTable)
    .where(and(...conditions))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(
    rows.map((r) => ({
      id: r.id,
      type: r.type,
      amount: parseFloat(r.amount),
      balanceAfter: r.balanceAfter ? parseFloat(r.balanceAfter) : null,
      currency: r.currency,
      isDemo: r.isDemo,
      refType: r.refType ?? null,
      refId: r.refId ?? null,
      description: r.description ?? null,
      createdAt: r.createdAt.toISOString(),
    }))
  );
});

router.get("/account/equity-history", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const account = await getOrCreateAccount(userId);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const closedOrders = await db
    .select()
    .from(ordersTable)
    .where(and(
      eq(ordersTable.clerkUserId, userId),
      sql`${ordersTable.closeTime} >= ${thirtyDaysAgo.toISOString()}`,
    ))
    .orderBy(asc(ordersTable.closeTime));

  if (closedOrders.length === 0) {
    res.json([]);
    return;
  }

  const currentBalance = parseFloat(String(account.isDemoMode ? account.demoBalance : account.balance));
  const totalProfit = closedOrders.reduce((sum, o) => sum + parseFloat(String(o.profit)), 0);
  let runningBalance = currentBalance - totalProfit;

  const points: Array<{ date: string; equity: number }> = [];

  for (const order of closedOrders) {
    runningBalance += parseFloat(String(order.profit));
    points.push({
      date: order.closeTime.toISOString(),
      equity: parseFloat(runningBalance.toFixed(2)),
    });
  }

  // Cap at 90 data points by sampling evenly
  if (points.length > 90) {
    const step = points.length / 90;
    const sampled: typeof points = [];
    for (let i = 0; i < 90; i++) {
      const idx = Math.min(Math.round(i * step), points.length - 1);
      sampled.push(points[idx]!);
    }
    // Always include the last point
    if (sampled[sampled.length - 1] !== points[points.length - 1]) {
      sampled[sampled.length - 1] = points[points.length - 1]!;
    }
    res.json(sampled);
    return;
  }

  res.json(points);
});

router.post("/account/update-push-token", requireAuth, accountRateLimit, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const { token } = req.body as { token?: string };
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "token required" });
    return;
  }
  await db
    .update(accountsTable)
    .set({ pushToken: token })
    .where(eq(accountsTable.clerkUserId, userId));
  res.json({ ok: true });
});

export default router;
