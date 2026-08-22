import { Router, type IRouter } from "express";
import { eq, and, count, sql, desc } from "drizzle-orm";
import { clerkClient, getAuth } from "@clerk/express";
import { db, accountsTable, positionsTable, ordersTable, depositRequestsTable, withdrawalRequestsTable, cryptoDepositsTable, partnersTable, referralsTable, partnerCommissionsTable, transactionsTable } from "@workspace/db";
import { recalcPartnerUnlock } from "./partner";
import { priceCache, changePercentCache, getWssClientCount } from "../ws/priceStreamer";
import { requireAdmin } from "../middlewares/requireAdmin";
import { adminRateLimit, bootstrapRateLimit } from "../middlewares/rateLimit";
import { recordTransaction } from "../lib/ledger";
import { getPrice } from "../lib/twelvedata";
import { INSTRUMENT_MAP, LEVERAGE_BY_TYPE } from "../lib/instruments";
import {
  sendUserNotification,
  depositApprovedHtml,
  depositRejectedHtml,
  withdrawalApprovedHtml,
  withdrawalRejectedHtml,
  kycApprovedHtml,
  kycRejectedHtml,
  tierUpgradeHtml,
  cryptoDepositConfirmedHtml,
  partnerCpaEarnedHtml,
} from "../lib/notifications";

const router: IRouter = Router();

// Account tier thresholds (matching home page ACCOUNT_TYPES)
const TIER_THRESHOLDS: Array<{ tier: string; min: number }> = [
  { tier: "vip",      min: 50000 },
  { tier: "platinum", min: 10000 },
  { tier: "gold",     min: 2500 },
  { tier: "silver",   min: 250 },
];

const TIER_ORDER: Record<string, number> = { real: 0, silver: 1, gold: 2, platinum: 3, vip: 4 };

function calcTier(totalDeposited: number): string {
  for (const { tier, min } of TIER_THRESHOLDS) {
    if (totalDeposited >= min) return tier;
  }
  return "real";
}

// Recalculate and apply account tier based on cumulative approved deposits.
// Must be called inside a transaction (tx) after crediting balance on deposit approval.
async function recalcAccountTier(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  clerkUserId: string
): Promise<string> {
  const [depSum] = await tx
    .select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
    .from(depositRequestsTable)
    .where(and(
      eq(depositRequestsTable.clerkUserId, clerkUserId),
      eq(depositRequestsTable.status, "approved")
    ));

  const [cryptoSum] = await tx
    .select({ total: sql<string>`COALESCE(SUM(${cryptoDepositsTable.amountUsdt}::numeric), 0)` })
    .from(cryptoDepositsTable)
    .where(and(
      eq(cryptoDepositsTable.clerkUserId, clerkUserId),
      eq(cryptoDepositsTable.status, "approved")
    ));

  const totalDeposited =
    parseFloat(String(depSum?.total ?? 0)) +
    parseFloat(String(cryptoSum?.total ?? 0));

  const tier = calcTier(totalDeposited);

  await tx
    .update(accountsTable)
    .set({ accountType: tier })
    .where(eq(accountsTable.clerkUserId, clerkUserId));

  return tier;
}

// Bootstrap: sets the calling user as admin if no admin exists yet (one-time setup).
// Requires a BOOTSTRAP_SECRET env var — send it as "Authorization: Bearer <secret>".
// If BOOTSTRAP_SECRET is not set, this endpoint is disabled.
router.post("/admin/bootstrap", bootstrapRateLimit, async (req, res): Promise<void> => {
  const bootstrapSecret = process.env.BOOTSTRAP_SECRET;
  if (!bootstrapSecret) {
    res.status(503).json({
      error: "Bootstrap is disabled. Set BOOTSTRAP_SECRET in your environment to enable first-time admin setup, or assign the admin role directly in Clerk Dashboard.",
    });
    return;
  }

  const authHeader = req.headers.authorization ?? "";
  if (!authHeader.startsWith("Bearer ") || authHeader.slice(7) !== bootstrapSecret) {
    req.log.warn({ path: req.path }, "bootstrap: invalid or missing secret");
    res.status(401).json({ error: "Invalid or missing bootstrap secret." });
    return;
  }

  const userId = getAuth(req)?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  // Check if any existing admin exists in Clerk
  let offset = 0;
  const pageSize = 200;
  let existingAdmin: string | null = null;
  while (true) {
    const page = await clerkClient.users.getUserList({ limit: pageSize, offset });
    const found = page.data.find((u) => u.publicMetadata?.role === "admin");
    if (found) { existingAdmin = found.id; break; }
    if (page.data.length < pageSize) break;
    offset += pageSize;
  }

  if (existingAdmin) {
    res.status(409).json({ error: "An admin already exists. Use Clerk Dashboard to manage roles." });
    return;
  }

  await clerkClient.users.updateUserMetadata(userId, {
    publicMetadata: { role: "admin" },
  });

  req.log.info({ userId, path: req.path }, "bootstrap: admin role granted");
  res.json({ ok: true, message: "You are now admin. Please reload the page." });
});

router.get("/admin/stats", requireAdmin, async (_req, res): Promise<void> => {
  const [accountRow] = await db.select({ count: count() }).from(accountsTable);
  const [positionRow] = await db.select({ count: count() }).from(positionsTable);
  const [orderRow] = await db.select({ count: count() }).from(ordersTable);
  const [balanceRow] = await db
    .select({ total: sql<string>`coalesce(sum(balance::numeric), 0)` })
    .from(accountsTable);

  const prices = Array.from(priceCache.entries()).map(([symbol, cached]) => ({
    symbol,
    price: cached.price,
    changePercent: changePercentCache.get(symbol) ?? 0,
  }));

  res.json({
    accounts: accountRow?.count ?? 0,
    openPositions: positionRow?.count ?? 0,
    totalOrders: orderRow?.count ?? 0,
    totalBalance: parseFloat(balanceRow?.total ?? "0"),
    wsClients: getWssClientCount(),
    symbolsTracked: priceCache.size,
    prices,
  });
});

router.get("/admin/users", requireAdmin, async (_req, res): Promise<void> => {
  const [accounts, allPositions] = await Promise.all([
    db.select().from(accountsTable).orderBy(desc(accountsTable.createdAt)),
    db.select().from(positionsTable),
  ]);

  // Group positions by clerkUserId for O(1) lookup
  const positionsByUser = new Map<string, typeof allPositions>();
  for (const pos of allPositions) {
    const list = positionsByUser.get(pos.clerkUserId) ?? [];
    list.push(pos);
    positionsByUser.set(pos.clerkUserId, list);
  }

  // FIX: Paginate Clerk user list — previously hardcoded limit:500 which breaks at scale
  const clerkMap = new Map<string, Awaited<ReturnType<typeof clerkClient.users.getUser>>>();
  let offset = 0;
  const pageSize = 200;
  while (true) {
    const page = await clerkClient.users.getUserList({ limit: pageSize, offset });
    page.data.forEach((u) => clerkMap.set(u.id, u));
    if (page.data.length < pageSize) break;
    offset += pageSize;
  }

  const result = accounts.map((acc: any) => {
    const cu = clerkMap.get(acc.clerkUserId);
    const isMock = acc.isMock || acc.clerkUserId.startsWith("mock_");
    const balance = parseFloat(acc.balance);

    // Compute margin metrics from cached prices — no external API calls
    const userPositions = positionsByUser.get(acc.clerkUserId) ?? [];
    let floatingPnl = 0;
    let usedMargin = 0;
    for (const pos of userPositions) {
      const cached = priceCache.get(pos.symbol);
      const instrument = INSTRUMENT_MAP.get(pos.symbol);
      const lotSize = instrument?.lotSize ?? 1;
      const lev = LEVERAGE_BY_TYPE[instrument?.type ?? "forex"] ?? 100;
      const currentPrice = cached?.price ?? parseFloat(String(pos.openPrice));
      const openPrice = parseFloat(String(pos.openPrice));
      const volume = parseFloat(String(pos.volume));
      const pnl = (pos.direction === "buy" ? (currentPrice - openPrice) : (openPrice - currentPrice)) * volume * lotSize;
      floatingPnl += pnl;
      usedMargin += (currentPrice * volume * lotSize) / lev;
    }
    const equity = balance + floatingPnl;
    const freeMargin = equity - usedMargin;
    const marginLevel = usedMargin > 0 ? (equity / usedMargin) * 100 : 0;

    return {
      clerkUserId: acc.clerkUserId,
      email: isMock ? (acc.mockEmail ?? "—") : (cu?.emailAddresses[0]?.emailAddress ?? "—"),
      name: isMock ? (acc.mockName ?? acc.clerkUserId) : ([cu?.firstName, cu?.lastName].filter(Boolean).join(" ") || "—"),
      imageUrl: isMock ? null : (cu?.imageUrl ?? null),
      balance,
      equity: parseFloat(equity.toFixed(2)),
      floatingPnl: parseFloat(floatingPnl.toFixed(2)),
      usedMargin: parseFloat(usedMargin.toFixed(2)),
      freeMargin: parseFloat(freeMargin.toFixed(2)),
      marginLevel: parseFloat(marginLevel.toFixed(2)),
      openPositions: userPositions.length,
      leverage: acc.leverage,
      accountType: acc.accountType,
      kycStatus: acc.kycStatus,
      kycDocFront: acc.kycDocFront ?? null,
      kycDocBack: acc.kycDocBack ?? null,
      kycDocSelfie: acc.kycDocSelfie ?? null,
      createdAt: acc.createdAt,
      isAdmin: cu?.publicMetadata?.role === "admin",
    };
  });

  res.json(result);
});

router.post("/admin/users/:clerkUserId/reset-balance", requireAdmin, adminRateLimit, async (req, res): Promise<void> => {
  const clerkUserId = req.params.clerkUserId as string;

  let resetBalance = "0.00";

  await db.transaction(async (tx) => {
    await tx.delete(positionsTable).where(eq(positionsTable.clerkUserId, clerkUserId));

    const [account] = await tx.select().from(accountsTable).where(eq(accountsTable.clerkUserId, clerkUserId));
    resetBalance = account?.accountType === "real" ? "0.00" : "10000.00";

    await tx
      .update(accountsTable)
      .set({ balance: resetBalance })
      .where(eq(accountsTable.clerkUserId, clerkUserId));

    if (account) {
      const delta = parseFloat(resetBalance) - parseFloat(String(account.balance));
      if (delta !== 0) {
        await recordTransaction(tx, {
          clerkUserId,
          accountId: account.id,
          type: "admin_adjustment",
          amount: delta.toFixed(2),
          balanceAfter: resetBalance,
          isDemo: false,
          refType: "admin_reset",
          description: `Admin balance reset → $${resetBalance} (positions cleared)`,
        });
      }
    }
  });

  res.json({ ok: true, newBalance: resetBalance });
});

router.patch("/admin/users/:clerkUserId/balance", requireAdmin, adminRateLimit, async (req, res): Promise<void> => {
  const clerkUserId = req.params.clerkUserId as string;
  const { balance } = req.body as { balance: number };
  if (typeof balance !== "number" || balance < 0) {
    res.status(400).json({ error: "Invalid balance" });
    return;
  }
  const [account] = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.clerkUserId, clerkUserId));
  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  const newBalance = balance.toFixed(2);
  await db.transaction(async (tx) => {
    await tx
      .update(accountsTable)
      .set({ balance: newBalance })
      .where(eq(accountsTable.clerkUserId, clerkUserId));

    const delta = balance - parseFloat(String(account.balance));
    if (delta !== 0) {
      await recordTransaction(tx, {
        clerkUserId,
        accountId: account.id,
        type: "admin_adjustment",
        amount: delta.toFixed(2),
        balanceAfter: newBalance,
        isDemo: false,
        refType: "admin_edit",
        description: `Admin set balance $${parseFloat(String(account.balance)).toFixed(2)} → ${newBalance}`,
      });
    }
  });
  res.json({ ok: true });
});

router.patch("/admin/users/:clerkUserId/leverage", requireAdmin, adminRateLimit, async (req, res): Promise<void> => {
  const clerkUserId = req.params.clerkUserId as string;
  const { leverage } = req.body as { leverage: number };
  if (!Number.isInteger(leverage) || leverage < 1 || leverage > 1000) {
    res.status(400).json({ error: "Invalid leverage (1–1000)" });
    return;
  }
  await db
    .update(accountsTable)
    .set({ leverage })
    .where(eq(accountsTable.clerkUserId, clerkUserId));
  res.json({ ok: true });
});

router.get("/admin/positions", requireAdmin, async (_req, res): Promise<void> => {
  const positions = await db
    .select()
    .from(positionsTable)
    .orderBy(desc(positionsTable.openTime));

  const result = positions.map((pos) => {
    const cached = priceCache.get(pos.symbol);
    const vol = parseFloat(pos.volume);
    const open = parseFloat(pos.openPrice);
    const adminInstrument = INSTRUMENT_MAP.get(pos.symbol);
    const adminLotSize = adminInstrument?.lotSize ?? 1;
    const currentPrice = cached?.price ?? open;
    const pnl =
      ((pos.direction === "buy"
        ? (currentPrice - open)
        : (open - currentPrice)) * vol) * adminLotSize;
    return {
      id: pos.id,
      clerkUserId: pos.clerkUserId,
      symbol: pos.symbol,
      symbolName: pos.symbolName,
      direction: pos.direction,
      volume: vol,
      openPrice: open,
      currentPrice,
      pnl: parseFloat(pnl.toFixed(2)),
      stopLoss: pos.stopLoss ? parseFloat(pos.stopLoss) : null,
      takeProfit: pos.takeProfit ? parseFloat(pos.takeProfit) : null,
      openTime: pos.openTime,
    };
  });

  res.json(result);
});

router.delete("/admin/positions/:id", requireAdmin, adminRateLimit, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [pos] = await db.select().from(positionsTable).where(eq(positionsTable.id, id));
  if (!pos) { res.status(404).json({ error: "Position not found" }); return; }

  const { customClosePrice } = (req.body ?? {}) as { customClosePrice?: number };

  let resolvedPrice: number;
  if (typeof customClosePrice === "number" && customClosePrice > 0) {
    resolvedPrice = customClosePrice;
  } else {
    const priceData = await getPrice(pos.symbol);
    resolvedPrice = priceData?.price ?? parseFloat(pos.openPrice);
  }

  const vol = parseFloat(pos.volume);
  const open = parseFloat(pos.openPrice);
  const delInstrument = INSTRUMENT_MAP.get(pos.symbol);
  const delLotSize = delInstrument?.lotSize ?? 1;
  const pnl =
    ((pos.direction === "buy"
      ? (resolvedPrice - open)
      : (open - resolvedPrice)) * vol) * delLotSize;

  await db.transaction(async (tx) => {
    await tx.delete(positionsTable).where(eq(positionsTable.id, id));
    await tx
      .insert(ordersTable)
      .values({
        accountId: pos.accountId,
        clerkUserId: pos.clerkUserId,
        symbol: pos.symbol,
        symbolName: pos.symbolName,
        direction: pos.direction,
        volume: pos.volume,
        openPrice: pos.openPrice,
        closePrice: String(resolvedPrice),
        stopLoss: pos.stopLoss,
        takeProfit: pos.takeProfit,
        profit: String(pnl.toFixed(2)),
        swap: pos.swap,
        commission: pos.commission,
        openTime: pos.openTime,
      });
    await tx
      .update(accountsTable)
      .set({ balance: sql`balance + ${pnl.toFixed(2)}::numeric` })
      .where(eq(accountsTable.clerkUserId, pos.clerkUserId));
    await recordTransaction(tx, {
      clerkUserId: pos.clerkUserId,
      accountId: pos.accountId,
      type: "admin_adjustment",
      amount: pnl.toFixed(2),
      isDemo: pos.isDemo,
      refType: "position",
      refId: pos.id,
      description: `Admin force-close ${pos.symbol} @ ${resolvedPrice} (PnL applied)`,
    });
  });

  res.json({ ok: true, closedAt: resolvedPrice, pnl: parseFloat(pnl.toFixed(2)) });
});

// Ledger audit trail — every balance movement across all users (admin view)
router.get("/admin/transactions", requireAdmin, async (req, res): Promise<void> => {
  const { userId, type } = req.query as Record<string, string>;
  const PAGE = Math.max(1, parseInt(String(req.query.page ?? "1")) || 1);
  const LIMIT = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "100")) || 100));

  const conditions = [];
  if (userId) conditions.push(eq(transactionsTable.clerkUserId, userId));
  if (type) conditions.push(eq(transactionsTable.type, type));

  const rows = await db
    .select()
    .from(transactionsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(transactionsTable.createdAt))
    .limit(LIMIT)
    .offset((PAGE - 1) * LIMIT);

  res.json({
    page: PAGE,
    limit: LIMIT,
    items: rows.map((r) => ({
      id: r.id,
      clerkUserId: r.clerkUserId,
      type: r.type,
      amount: parseFloat(r.amount),
      balanceAfter: r.balanceAfter ? parseFloat(r.balanceAfter) : null,
      isDemo: r.isDemo,
      refType: r.refType ?? null,
      refId: r.refId ?? null,
      description: r.description ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

router.patch("/admin/users/:clerkUserId/kyc", requireAdmin, adminRateLimit, async (req, res): Promise<void> => {
  const clerkUserId = req.params.clerkUserId as string;
  const { kycStatus, notes } = req.body as { kycStatus: string; notes?: string };
  const validStatuses = ["unverified", "pending", "verified", "rejected"];
  if (!validStatuses.includes(kycStatus)) {
    res.status(400).json({ error: "Invalid kycStatus" });
    return;
  }
  await db
    .update(accountsTable)
    .set({ kycStatus })
    .where(eq(accountsTable.clerkUserId, clerkUserId));

  try {
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || "Trader";
    if (email) {
      if (kycStatus === "verified") {
        void sendUserNotification(email, "✅ KYC Verified — VelozTrade", kycApprovedHtml(name));
      } else if (kycStatus === "rejected") {
        void sendUserNotification(email, "❌ KYC Verification Unsuccessful — VelozTrade", kycRejectedHtml(name, notes));
      }
    }
  } catch { /* non-critical */ }

  res.json({ ok: true });
});

router.post("/admin/users/:clerkUserId/set-admin", requireAdmin, adminRateLimit, async (req, res): Promise<void> => {
  const clerkUserId = req.params.clerkUserId as string;
  const { isAdmin } = req.body as { isAdmin: boolean };
  await clerkClient.users.updateUserMetadata(clerkUserId, {
    publicMetadata: { role: isAdmin ? "admin" : "user" },
  });
  res.json({ ok: true });
});

// ──────────────────────────────────────────────
// Deposit Requests
// ──────────────────────────────────────────────

router.get("/admin/deposits", requireAdmin, async (_req, res): Promise<void> => {
  const requests = await db
    .select()
    .from(depositRequestsTable)
    .orderBy(desc(depositRequestsTable.createdAt));

  const clerkMap = new Map<string, Awaited<ReturnType<typeof clerkClient.users.getUser>>>();
  let depositOffset = 0;
  const depositPageSize = 200;
  while (true) {
    const page = await clerkClient.users.getUserList({ limit: depositPageSize, offset: depositOffset });
    page.data.forEach((u) => clerkMap.set(u.id, u));
    if (page.data.length < depositPageSize) break;
    depositOffset += depositPageSize;
  }

  const result = requests.map((r) => {
    const cu = clerkMap.get(r.clerkUserId);
    return {
      id: r.id,
      clerkUserId: r.clerkUserId,
      email: cu?.emailAddresses[0]?.emailAddress ?? "—",
      name: [cu?.firstName, cu?.lastName].filter(Boolean).join(" ") || "—",
      amount: parseFloat(r.amount),
      method: r.method,
      status: r.status,
      notes: r.notes,
      paymentProof: r.paymentProof ?? null,
      createdAt: r.createdAt,
      reviewedAt: r.reviewedAt,
    };
  });

  res.json(result);
});

router.patch("/admin/deposits/:id", requireAdmin, adminRateLimit, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { action, notes } = req.body as { action: "approve" | "reject"; notes?: string };
  if (action !== "approve" && action !== "reject") {
    res.status(400).json({ error: "action must be 'approve' or 'reject'" });
    return;
  }

  const [request] = await db
    .select()
    .from(depositRequestsTable)
    .where(eq(depositRequestsTable.id, id));

  if (!request) { res.status(404).json({ error: "Deposit request not found" }); return; }
  if (request.status !== "pending") {
    res.status(409).json({ error: "Request already reviewed" });
    return;
  }

  await db
    .update(depositRequestsTable)
    .set({ status: action === "approve" ? "approved" : "rejected", notes: notes ?? null, reviewedAt: new Date() })
    .where(eq(depositRequestsTable.id, id));

  // Capture old tier before transaction so we can detect upgrades
  let oldTier = "real";
  let newTier = "real";
  // Capture CPA email data to send after transaction commits
  let cpaEmailData: { partnerId: number; partnerClerkUserId: string; partnerName: string; cpaAmount: number } | null = null;
  if (action === "approve") {
    const [preAccount] = await db.select({ accountType: accountsTable.accountType })
      .from(accountsTable)
      .where(eq(accountsTable.clerkUserId, request.clerkUserId));
    oldTier = preAccount?.accountType ?? "real";

    await db.transaction(async (tx) => {
      await tx
        .update(accountsTable)
        .set({ balance: sql`balance + ${request.amount}::numeric` })
        .where(eq(accountsTable.clerkUserId, request.clerkUserId));
      await recordTransaction(tx, {
        clerkUserId: request.clerkUserId,
        type: "deposit",
        amount: request.amount,
        isDemo: false,
        refType: "deposit_request",
        refId: request.id,
        description: `Deposit approved — ${request.method}`,
      });
      newTier = await recalcAccountTier(tx, request.clerkUserId);

      // ── CPA commission trigger ──────────────────────────────────────────
      const depositAmount = parseFloat(request.amount);
      if (depositAmount >= 250) {
        const [acc] = await tx
          .select({ referredByPartnerId: accountsTable.referredByPartnerId })
          .from(accountsTable)
          .where(eq(accountsTable.clerkUserId, request.clerkUserId));

        const partnerId = acc?.referredByPartnerId;
        if (partnerId) {
          const [referral] = await tx
            .select()
            .from(referralsTable)
            .where(and(
              eq(referralsTable.partnerId, partnerId),
              eq(referralsTable.referredClerkUserId, request.clerkUserId),
            ));

          if (referral && !referral.cpaPaid) {
            const [partner] = await tx
              .select()
              .from(partnersTable)
              .where(eq(partnersTable.id, partnerId));

            if (partner && partner.status === "active") {
              const cpaAmount = parseFloat(String(partner.cpaRate));

              // Credit CPA to partner commission wallet (display/audit total)
              await tx
                .update(partnersTable)
                .set({ commissionWallet: sql`commission_wallet + ${cpaAmount.toFixed(2)}::numeric` })
                .where(eq(partnersTable.id, partnerId));

              // Also credit to partner's account balance so it is immediately withdrawable.
              // commissionWallet tracks the cumulative earned total for display; balance is
              // the live, consumable amount.
              await tx
                .update(accountsTable)
                .set({ balance: sql`balance + ${cpaAmount.toFixed(2)}::numeric` })
                .where(eq(accountsTable.clerkUserId, partner.clerkUserId));

              await recordTransaction(tx, {
                clerkUserId: partner.clerkUserId,
                type: "partner_cpa",
                amount: cpaAmount.toFixed(2),
                isDemo: false,
                refType: "deposit_request",
                refId: request.id,
                description: `CPA bonus — referred user ${request.clerkUserId} deposited $${depositAmount.toFixed(2)}`,
              });

              // Insert commission audit row
              await tx
                .insert(partnerCommissionsTable)
                .values({
                  partnerId,
                  sourceType: "cpa",
                  amount: cpaAmount.toFixed(2),
                  refClerkUserId: request.clerkUserId,
                });

              // Mark referral CPA as paid and deposit as active
              await tx
                .update(referralsTable)
                .set({ cpaPaid: true, depositStatus: "active" })
                .where(eq(referralsTable.id, referral.id));

              // Recalculate capital unlock milestone
              await recalcPartnerUnlock(tx, partnerId);

              // Capture for post-transaction email
              cpaEmailData = { partnerId, partnerClerkUserId: partner.clerkUserId, partnerName: partner.name, cpaAmount };
            }
          } else if (referral && referral.depositStatus === "none" && depositAmount >= 250) {
            // First deposit but CPA already paid (edge case guard) — still activate referral
            await tx
              .update(referralsTable)
              .set({ depositStatus: "active" })
              .where(eq(referralsTable.id, referral.id));
          }
        }
      }
    });
  }

  try {
    const clerkUser = await clerkClient.users.getUser(request.clerkUserId);
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || "Trader";
    const amount = parseFloat(request.amount);
    if (email) {
      if (action === "approve") {
        void sendUserNotification(email, `✅ Deposit Approved — $${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} — VelozTrade`, depositApprovedHtml(name, amount));
        // Send tier upgrade email if account tier improved
        if (newTier !== "real" && (TIER_ORDER[newTier] ?? 0) > (TIER_ORDER[oldTier] ?? 0)) {
          const [depSum] = await db
            .select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
            .from(depositRequestsTable)
            .where(and(eq(depositRequestsTable.clerkUserId, request.clerkUserId), eq(depositRequestsTable.status, "approved")));
          const totalDeposited = parseFloat(String(depSum?.total ?? 0));
          void sendUserNotification(
            email,
            `🎉 Account Upgraded to ${newTier.charAt(0).toUpperCase() + newTier.slice(1)} Tier — VelozTrade`,
            tierUpgradeHtml(name, newTier, totalDeposited)
          );
        }
      } else {
        void sendUserNotification(email, `❌ Deposit Not Approved — VelozTrade`, depositRejectedHtml(name, amount, notes));
      }
    }
  } catch { /* non-critical */ }

  // Send CPA-earned email to partner (non-critical — fire-and-forget)
  if (cpaEmailData) {
    const { partnerId: cpaPartnerId, partnerClerkUserId, partnerName, cpaAmount } = cpaEmailData;
    try {
      const partnerClerkUser = await clerkClient.users.getUser(partnerClerkUserId);
      const partnerEmail = partnerClerkUser.emailAddresses[0]?.emailAddress;
      const referredClerkUser = await clerkClient.users.getUser(request.clerkUserId);
      const referredEmail = referredClerkUser.emailAddresses[0]?.emailAddress ?? request.clerkUserId;

      if (partnerEmail) {
        const [totalRefRow] = await db
          .select({ cnt: count() })
          .from(referralsTable)
          .where(eq(referralsTable.partnerId, cpaPartnerId));
        const [depositingRefRow] = await db
          .select({ cnt: count() })
          .from(referralsTable)
          .where(and(
            eq(referralsTable.partnerId, cpaPartnerId),
            eq(referralsTable.depositStatus, "active"),
          ));

        void sendUserNotification(
          partnerEmail,
          `💸 You Earned a CPA Bonus — VelozTrade`,
          partnerCpaEarnedHtml(
            partnerName,
            referredEmail,
            cpaAmount,
            Number(totalRefRow?.cnt ?? 0),
            Number(depositingRefRow?.cnt ?? 0),
          ),
        );
      }
    } catch { /* non-critical */ }
  }

  res.json({ ok: true });
});

// ──────────────────────────────────────────────
// Crypto Deposits (on-chain scanner + manual)
// ──────────────────────────────────────────────

const CHAIN_NAMES_ADMIN: Record<number, string> = { 56: "BSC", 137: "Polygon" };
const EXPLORER_URLS_ADMIN: Record<number, string> = {
  56:  "https://bscscan.com/tx/",
  137: "https://polygonscan.com/tx/",
};

router.get("/admin/crypto-deposits", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(cryptoDepositsTable)
    .orderBy(desc(cryptoDepositsTable.creditedAt));

  const userIds = [...new Set(rows.map((r) => r.clerkUserId))];
  const clerkMap = new Map<string, Awaited<ReturnType<typeof clerkClient.users.getUser>>>();
  for (const userId of userIds) {
    try {
      const cu = await clerkClient.users.getUser(userId);
      clerkMap.set(userId, cu);
    } catch { /* skip missing */ }
  }

  const result = rows.map((r) => {
    const cu = clerkMap.get(r.clerkUserId);
    return {
      id:          r.id,
      clerkUserId: r.clerkUserId,
      email:       cu?.emailAddresses[0]?.emailAddress ?? "—",
      name:        [cu?.firstName, cu?.lastName].filter(Boolean).join(" ") || "—",
      txHash:      r.txHash,
      fromWallet:  r.fromWallet,
      chainId:     r.chainId,
      network:     CHAIN_NAMES_ADMIN[r.chainId] ?? `Chain ${r.chainId}`,
      amountUsdt:  parseFloat(r.amountUsdt),
      status:      r.status,
      explorerUrl: `${EXPLORER_URLS_ADMIN[r.chainId] ?? ""}${r.txHash}`,
      createdAt:   r.creditedAt,
      reviewedAt:  r.reviewedAt ?? null,
    };
  });

  res.json(result);
});

router.patch("/admin/crypto-deposits/:id", requireAdmin, adminRateLimit, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { action } = req.body as { action: "approve" | "reject" };
  if (action !== "approve" && action !== "reject") {
    res.status(400).json({ error: "action must be 'approve' or 'reject'" });
    return;
  }

  // Fetch the record first (outside the transaction) to return a meaningful 404/409
  const [record] = await db
    .select()
    .from(cryptoDepositsTable)
    .where(eq(cryptoDepositsTable.id, id));

  if (!record)                     { res.status(404).json({ error: "Crypto deposit not found" }); return; }
  if (record.status !== "pending") { res.status(409).json({ error: "Deposit already reviewed" });  return; }

  // Atomic: conditional-update the status first (guards against concurrent approvals),
  // then credit balance only when status changed from pending.
  await db.transaction(async (tx) => {
    const affected = await tx
      .update(cryptoDepositsTable)
      .set({ status: action === "approve" ? "approved" : "rejected", reviewedAt: new Date() })
      .where(and(eq(cryptoDepositsTable.id, id), eq(cryptoDepositsTable.status, "pending")))
      .returning({ id: cryptoDepositsTable.id });

    if (affected.length === 0) {
      // Another request already processed this deposit concurrently
      throw new Error("concurrent_review");
    }

    if (action === "approve") {
      const amountUsdt = parseFloat(record.amountUsdt);
      const credited = await tx
        .update(accountsTable)
        .set({ balance: sql`balance + ${amountUsdt.toFixed(2)}::numeric` })
        .where(eq(accountsTable.clerkUserId, record.clerkUserId))
        .returning({ id: accountsTable.id });

      if (credited.length === 0) {
        throw new Error("account_not_found");
      }

      await recordTransaction(tx, {
        clerkUserId: record.clerkUserId,
        type: "deposit_crypto",
        amount: amountUsdt.toFixed(2),
        isDemo: false,
        refType: "crypto_deposit",
        refId: record.id,
        description: `On-chain USDT deposit confirmed — ${record.txHash.slice(0, 18)}…`,
      });

      await recalcAccountTier(tx, record.clerkUserId);
    }
  }).catch((err: Error) => {
    if (err.message === "concurrent_review") {
      res.status(409).json({ error: "Deposit was already reviewed by another session." });
      return;
    }
    if (err.message === "account_not_found") {
      req.log.error({ id, clerkUserId: record.clerkUserId }, "admin: account not found when approving crypto deposit");
      res.status(500).json({ error: "Account not found — could not credit balance." });
      return;
    }
    throw err;
  });

  if (res.headersSent) return;

  if (action === "approve") {
    req.log.info({ id, clerkUserId: record.clerkUserId, amountUsdt: record.amountUsdt }, "admin: crypto deposit approved and balance credited");
  } else {
    req.log.info({ id, clerkUserId: record.clerkUserId }, "admin: crypto deposit rejected");
  }

  if (action === "approve") {
    // Architecture note: depositScanner.ts inserts all on-chain transfers as
    // "pending" — it never auto-credits. The balance is only credited here, on
    // admin approval, which is the authoritative "confirmed" event for this system.
    // Therefore the crypto deposit confirmation email correctly fires here.
    try {
      const clerkUser = await clerkClient.users.getUser(record.clerkUserId);
      const email = clerkUser.emailAddresses[0]?.emailAddress;
      const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || "Trader";
      const amountUsdt = parseFloat(record.amountUsdt);
      const network = CHAIN_NAMES_ADMIN[record.chainId] ?? `Chain ${record.chainId}`;
      if (email) {
        void sendUserNotification(
          email,
          `✅ Crypto Deposit Confirmed — ${amountUsdt.toLocaleString("en-US", { minimumFractionDigits: 2 })} USDT — VelozTrade`,
          cryptoDepositConfirmedHtml(name, amountUsdt, record.txHash, network)
        );

        // Send tier upgrade email if tier improved after crediting crypto deposit
        const [postAccount] = await db
          .select({ accountType: accountsTable.accountType })
          .from(accountsTable)
          .where(eq(accountsTable.clerkUserId, record.clerkUserId));
        const achievedTier = postAccount?.accountType ?? "real";
        if (achievedTier !== "real" && (TIER_ORDER[achievedTier] ?? 0) > 0) {
          // Compare against what tier was before this approval
          const [depSum] = await db
            .select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
            .from(depositRequestsTable)
            .where(and(eq(depositRequestsTable.clerkUserId, record.clerkUserId), eq(depositRequestsTable.status, "approved")));
          const [cryptoSum] = await db
            .select({ total: sql<string>`COALESCE(SUM(${cryptoDepositsTable.amountUsdt}::numeric), 0)` })
            .from(cryptoDepositsTable)
            .where(and(eq(cryptoDepositsTable.clerkUserId, record.clerkUserId), eq(cryptoDepositsTable.status, "approved")));
          const totalDeposited =
            parseFloat(String(depSum?.total ?? 0)) + parseFloat(String(cryptoSum?.total ?? 0));
          const prevTierTotal = totalDeposited - amountUsdt;
          const prevTier = calcTier(prevTierTotal);
          if ((TIER_ORDER[achievedTier] ?? 0) > (TIER_ORDER[prevTier] ?? 0)) {
            void sendUserNotification(
              email,
              `🎉 Account Upgraded to ${achievedTier.charAt(0).toUpperCase() + achievedTier.slice(1)} Tier — VelozTrade`,
              tierUpgradeHtml(name, achievedTier, totalDeposited)
            );
          }
        }
      }
    } catch { /* non-critical */ }
  }

  res.json({ ok: true });
});

// ──────────────────────────────────────────────
// Withdrawal Requests
// ──────────────────────────────────────────────

router.get("/admin/withdrawals", requireAdmin, async (_req, res): Promise<void> => {
  const requests = await db
    .select()
    .from(withdrawalRequestsTable)
    .orderBy(desc(withdrawalRequestsTable.createdAt));

  const withdrawClerkMap = new Map<string, Awaited<ReturnType<typeof clerkClient.users.getUser>>>();
  let withdrawOffset = 0;
  const withdrawPageSize = 200;
  while (true) {
    const page = await clerkClient.users.getUserList({ limit: withdrawPageSize, offset: withdrawOffset });
    page.data.forEach((u) => withdrawClerkMap.set(u.id, u));
    if (page.data.length < withdrawPageSize) break;
    withdrawOffset += withdrawPageSize;
  }

  const result = requests.map((r) => {
    const cu = withdrawClerkMap.get(r.clerkUserId);
    return {
      id:          r.id,
      clerkUserId: r.clerkUserId,
      email:       cu?.emailAddresses[0]?.emailAddress ?? "—",
      name:        [cu?.firstName, cu?.lastName].filter(Boolean).join(" ") || "—",
      amount:      parseFloat(r.amount),
      method:      r.method,
      bankDetails: r.bankDetails,
      status:      r.status,
      notes:       r.notes,
      createdAt:   r.createdAt,
      reviewedAt:  r.reviewedAt,
    };
  });

  res.json(result);
});

router.patch("/admin/withdrawals/:id", requireAdmin, adminRateLimit, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { action, notes } = req.body as { action: "approve" | "reject"; notes?: string };
  if (action !== "approve" && action !== "reject") {
    res.status(400).json({ error: "action must be 'approve' or 'reject'" });
    return;
  }

  const [request] = await db
    .select()
    .from(withdrawalRequestsTable)
    .where(eq(withdrawalRequestsTable.id, id));

  if (!request)                     { res.status(404).json({ error: "Withdrawal request not found" }); return; }
  if (request.status !== "pending") { res.status(409).json({ error: "Request already reviewed" });    return; }

  await db
    .update(withdrawalRequestsTable)
    .set({ status: action === "approve" ? "approved" : "rejected", notes: notes ?? null, reviewedAt: new Date() })
    .where(eq(withdrawalRequestsTable.id, id));

  if (action === "reject") {
    // Refund the held balance back to the user (was deducted at submission time)
    await db.transaction(async (tx) => {
      const [refunded] = await tx
        .update(accountsTable)
        .set({ balance: sql`balance + ${request.amount}::numeric` })
        .where(eq(accountsTable.clerkUserId, request.clerkUserId))
        .returning({ balance: accountsTable.balance });

      await recordTransaction(tx, {
        clerkUserId: request.clerkUserId,
        type: "withdrawal_refund",
        amount: request.amount,
        balanceAfter: refunded?.balance ?? null,
        isDemo: false,
        refType: "withdrawal_request",
        refId: request.id,
        description: `Withdrawal #${request.id} rejected — held funds returned${notes ? ` (${notes})` : ""}`,
      });
    });
  }
  // NOTE: On approve we do NOT deduct again — balance was already deducted
  // atomically when the user submitted the withdrawal request.

  try {
    const clerkUser = await clerkClient.users.getUser(request.clerkUserId);
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || "Trader";
    const amount = parseFloat(request.amount);
    if (email) {
      if (action === "approve") {
        void sendUserNotification(email, `✅ Withdrawal Approved — $${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} — VelozTrade`, withdrawalApprovedHtml(name, amount));
      } else {
        void sendUserNotification(email, `⚠️ Withdrawal Not Processed — VelozTrade`, withdrawalRejectedHtml(name, amount, notes));
      }
    }
  } catch { /* non-critical */ }

  res.json({ ok: true });
});

// ──────────────────────────────────────────────
// Partner Management (admin)
// ──────────────────────────────────────────────

router.get("/admin/partners", requireAdmin, async (_req, res): Promise<void> => {
  const partners = await db
    .select()
    .from(partnersTable)
    .orderBy(desc(partnersTable.createdAt));

  const result = await Promise.all(
    partners.map(async (p) => {
      const [acc] = await db
        .select({ balance: accountsTable.balance })
        .from(accountsTable)
        .where(eq(accountsTable.clerkUserId, p.clerkUserId));

      const [refCount] = await db
        .select({ cnt: count() })
        .from(referralsTable)
        .where(eq(referralsTable.partnerId, p.id));

      const [depCount] = await db
        .select({ cnt: count() })
        .from(referralsTable)
        .where(and(
          eq(referralsTable.partnerId, p.id),
          eq(referralsTable.depositStatus, "active"),
        ));

      const [cpaSum] = await db
        .select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
        .from(partnerCommissionsTable)
        .where(and(
          eq(partnerCommissionsTable.partnerId, p.id),
          eq(partnerCommissionsTable.sourceType, "cpa"),
        ));

      const [revSum] = await db
        .select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
        .from(partnerCommissionsTable)
        .where(and(
          eq(partnerCommissionsTable.partnerId, p.id),
          eq(partnerCommissionsTable.sourceType, "rev_share"),
        ));

      let clerkName = p.name;
      try {
        const cu = await clerkClient.users.getUser(p.clerkUserId);
        const n = [cu.firstName, cu.lastName].filter(Boolean).join(" ");
        if (n) clerkName = n;
      } catch { /* skip */ }

      const seededCapital = parseFloat(String(p.seededCapital));
      const balance = parseFloat(String(acc?.balance ?? "0"));

      return {
        id: p.id,
        clerkUserId: p.clerkUserId,
        name: clerkName,
        referralCode: p.referralCode,
        seededCapital,
        cpaRate: parseFloat(String(p.cpaRate)),
        revSharePct: parseFloat(String(p.revSharePct)),
        capitalUnlockedPct: p.capitalUnlockedPct,
        commissionWallet: parseFloat(String(p.commissionWallet)),
        status: p.status,
        balance,
        tradingProfit: parseFloat(Math.max(0, balance - seededCapital).toFixed(2)),
        totalReferrals: Number(refCount?.cnt ?? 0),
        depositingReferrals: Number(depCount?.cnt ?? 0),
        cpaEarned: parseFloat(String(cpaSum?.total ?? "0")),
        revShareEarned: parseFloat(String(revSum?.total ?? "0")),
        createdAt: p.createdAt,
      };
    })
  );

  res.json(result);
});

router.get("/admin/partners/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [partner] = await db
    .select()
    .from(partnersTable)
    .where(eq(partnersTable.id, id));

  if (!partner) { res.status(404).json({ error: "Partner not found" }); return; }

  const commissions = await db
    .select()
    .from(partnerCommissionsTable)
    .where(eq(partnerCommissionsTable.partnerId, id))
    .orderBy(desc(partnerCommissionsTable.createdAt));

  const referrals = await db
    .select()
    .from(referralsTable)
    .where(eq(referralsTable.partnerId, id))
    .orderBy(desc(referralsTable.createdAt));

  res.json({
    partner: {
      id: partner.id,
      clerkUserId: partner.clerkUserId,
      name: partner.name,
      referralCode: partner.referralCode,
      seededCapital: parseFloat(String(partner.seededCapital)),
      cpaRate: parseFloat(String(partner.cpaRate)),
      revSharePct: parseFloat(String(partner.revSharePct)),
      capitalUnlockedPct: partner.capitalUnlockedPct,
      commissionWallet: parseFloat(String(partner.commissionWallet)),
      status: partner.status,
      createdAt: partner.createdAt,
    },
    commissions: commissions.map((c) => ({
      id: c.id,
      sourceType: c.sourceType,
      amount: parseFloat(String(c.amount)),
      refPositionId: c.refPositionId ?? null,
      refClerkUserId: c.refClerkUserId ?? null,
      createdAt: c.createdAt,
    })),
    referrals: referrals.map((r) => ({
      id: r.id,
      referredClerkUserId: r.referredClerkUserId,
      depositStatus: r.depositStatus,
      cpaPaid: r.cpaPaid,
      createdAt: r.createdAt,
    })),
  });
});

router.post("/admin/partners", requireAdmin, adminRateLimit, async (req, res): Promise<void> => {
  const {
    clerkUserId,
    name,
    referralCode,
    seededCapital,
    cpaRate,
    revSharePct,
  } = req.body as {
    clerkUserId?: string;
    name?: string;
    referralCode?: string;
    seededCapital?: number;
    cpaRate?: number;
    revSharePct?: number;
  };

  if (!clerkUserId || typeof clerkUserId !== "string") {
    res.status(400).json({ error: "clerkUserId required" });
    return;
  }
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name required" });
    return;
  }

  const seed = Number(seededCapital ?? 0);
  const cpa = Number(cpaRate ?? 50);
  const rev = Number(revSharePct ?? 0.3);

  if (seed < 0 || cpa < 0 || rev < 0 || rev > 1) {
    res.status(400).json({ error: "Invalid seededCapital, cpaRate, or revSharePct (revSharePct must be 0–1)" });
    return;
  }

  // Ensure the Clerk user exists
  try {
    await clerkClient.users.getUser(clerkUserId);
  } catch {
    res.status(404).json({ error: "Clerk user not found" });
    return;
  }

  // Generate referral code — unique across all partners
  let code = referralCode
    ? referralCode.toUpperCase().trim()
    : `VT-${name.replace(/\s+/g, "").toUpperCase().slice(0, 10)}`;

  // Check for collision on the base code
  const [codeClash] = await db
    .select({ id: partnersTable.id })
    .from(partnersTable)
    .where(eq(partnersTable.referralCode, code));

  if (codeClash) {
    if (referralCode) {
      // Caller supplied this exact code — return conflict instead of guessing
      res.status(409).json({ error: `Referral code '${code}' is already in use. Choose a different code.` });
      return;
    }
    // Auto-generated collision: append incrementing suffix until unique
    let found = false;
    for (let suffix = 2; suffix <= 99; suffix++) {
      const candidate = `${code}${suffix}`;
      const [clash] = await db
        .select({ id: partnersTable.id })
        .from(partnersTable)
        .where(eq(partnersTable.referralCode, candidate));
      if (!clash) { code = candidate; found = true; break; }
    }
    if (!found) {
      res.status(409).json({ error: "Could not generate a unique referral code. Supply one explicitly." });
      return;
    }
  }

  await db.transaction(async (tx) => {
    // Upsert account so partner has an account row
    const [existing] = await tx
      .select()
      .from(accountsTable)
      .where(eq(accountsTable.clerkUserId, clerkUserId));

    if (!existing) {
      await tx.insert(accountsTable).values({
        clerkUserId,
        balance: seed > 0 ? seed.toFixed(2) : "0.00",
        demoBalance: "10000.00",
        isDemoMode: false,
        currency: "USD",
        leverage: 100,
        accountType: "real",
        kycStatus: "verified",
      });
    } else if (seed > 0) {
      await tx
        .update(accountsTable)
        .set({ balance: seed.toFixed(2), kycStatus: "verified" })
        .where(eq(accountsTable.clerkUserId, clerkUserId));
    }

    await tx.insert(partnersTable).values({
      clerkUserId,
      name,
      referralCode: code,
      seededCapital: seed.toFixed(2),
      cpaRate: cpa.toFixed(2),
      revSharePct: rev.toFixed(4),
      capitalUnlockedPct: 0,
      commissionWallet: "0.00",
      status: "active",
    });
  });

  const [created] = await db
    .select()
    .from(partnersTable)
    .where(eq(partnersTable.clerkUserId, clerkUserId));

  req.log.info({ clerkUserId, code, seed }, "admin: partner created");
  res.status(201).json({
    ok: true,
    partner: {
      id: created!.id,
      clerkUserId: created!.clerkUserId,
      name: created!.name,
      referralCode: created!.referralCode,
      seededCapital: parseFloat(String(created!.seededCapital)),
      cpaRate: parseFloat(String(created!.cpaRate)),
      revSharePct: parseFloat(String(created!.revSharePct)),
      capitalUnlockedPct: created!.capitalUnlockedPct,
      status: created!.status,
    },
  });
});

router.patch("/admin/partners/:id", requireAdmin, adminRateLimit, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { status, cpaRate, revSharePct } = req.body as {
    status?: string;
    cpaRate?: number;
    revSharePct?: number;
  };

  const updates: Record<string, string | number> = {};
  if (status && ["active", "suspended", "closed"].includes(status)) updates.status = status;
  if (typeof cpaRate === "number" && cpaRate >= 0) updates.cpaRate = cpaRate.toFixed(2);
  if (typeof revSharePct === "number" && revSharePct >= 0 && revSharePct <= 1) updates.revSharePct = revSharePct.toFixed(4);

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }

  await db.update(partnersTable).set(updates).where(eq(partnersTable.id, id));
  res.json({ ok: true });
});

// ──────────────────────────────────────────────
// Orders management (admin)
// ──────────────────────────────────────────────

router.get("/admin/orders", requireAdmin, async (req, res): Promise<void> => {
  const { userId, symbol, direction, status, page = "1", limit = "100" } = req.query as Record<string, string>;
  const PAGE = Math.max(1, parseInt(page) || 1);
  const LIMIT = Math.min(200, Math.max(1, parseInt(limit) || 100));

  const openPositions = await db.select().from(positionsTable).orderBy(desc(positionsTable.openTime));
  const closedOrders  = await db.select().from(ordersTable).orderBy(desc(ordersTable.closeTime));

  type CombinedItem = {
    id: number; clerkUserId: string; status: "open" | "closed";
    symbol: string; symbolName: string; direction: string;
    volume: number; openPrice: number; closePrice: number | null;
    stopLoss: number | null; takeProfit: number | null;
    profit: number | null; swap: number; commission: number;
    openTime: Date; closeTime: Date | null;
    currentPrice?: number; pnl?: number;
  };

  const combined: CombinedItem[] = [
    ...openPositions.map(p => ({
      id: p.id, clerkUserId: p.clerkUserId, status: "open" as const,
      symbol: p.symbol, symbolName: p.symbolName, direction: p.direction,
      volume: parseFloat(String(p.volume)), openPrice: parseFloat(String(p.openPrice)),
      closePrice: null, stopLoss: p.stopLoss ? parseFloat(String(p.stopLoss)) : null,
      takeProfit: p.takeProfit ? parseFloat(String(p.takeProfit)) : null,
      profit: null, swap: parseFloat(String(p.swap)), commission: parseFloat(String(p.commission)),
      openTime: p.openTime, closeTime: null,
    })),
    ...closedOrders.map(o => ({
      id: o.id, clerkUserId: o.clerkUserId, status: "closed" as const,
      symbol: o.symbol, symbolName: o.symbolName, direction: o.direction,
      volume: parseFloat(String(o.volume)), openPrice: parseFloat(String(o.openPrice)),
      closePrice: parseFloat(String(o.closePrice)), stopLoss: o.stopLoss ? parseFloat(String(o.stopLoss)) : null,
      takeProfit: o.takeProfit ? parseFloat(String(o.takeProfit)) : null,
      profit: parseFloat(String(o.profit)), swap: parseFloat(String(o.swap)),
      commission: parseFloat(String(o.commission)), openTime: o.openTime, closeTime: o.closeTime,
    })),
  ];

  let filtered = combined;
  if (userId) filtered = filtered.filter(o => o.clerkUserId === userId);
  if (symbol) filtered = filtered.filter(o => o.symbol.toLowerCase().includes(symbol.toLowerCase()));
  if (direction === "buy" || direction === "sell") filtered = filtered.filter(o => o.direction === direction);
  if (status === "open") filtered = filtered.filter(o => o.status === "open");
  if (status === "closed") filtered = filtered.filter(o => o.status === "closed");
  const { from, to } = req.query as Record<string, string>;
  if (from) { const d = new Date(from); if (!isNaN(d.getTime())) filtered = filtered.filter(o => o.openTime >= d); }
  if (to)   { const d = new Date(to);   if (!isNaN(d.getTime())) filtered = filtered.filter(o => o.openTime <= d); }

  filtered.sort((a, b) => new Date(b.openTime).getTime() - new Date(a.openTime).getTime());

  const total = filtered.length;
  const items = filtered.slice((PAGE - 1) * LIMIT, PAGE * LIMIT).map(item => {
    if (item.status === "open") {
      const cached = priceCache.get(item.symbol);
      const currentPrice = cached?.price ?? item.openPrice;
      const instrument = INSTRUMENT_MAP.get(item.symbol);
      const lotSize = instrument?.lotSize ?? 1;
      const pnl = ((item.direction === "buy" ? (currentPrice - item.openPrice) : (item.openPrice - currentPrice)) * item.volume) * lotSize;
      return { ...item, currentPrice, pnl: parseFloat(pnl.toFixed(2)) };
    }
    return { ...item, currentPrice: null };
  });

  res.json({ total, page: PAGE, limit: LIMIT, items });
});

router.patch("/admin/positions/:id", requireAdmin, adminRateLimit, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { sl, tp, openPrice, volume } = req.body as { sl?: number | null; tp?: number | null; openPrice?: number; volume?: number };
  const updates: Record<string, string | null> = {};
  if (sl !== undefined) updates.stopLoss  = sl  != null ? String(sl)  : null;
  if (tp !== undefined) updates.takeProfit = tp != null ? String(tp) : null;
  if (typeof openPrice === "number" && openPrice > 0) updates.openPrice = String(openPrice);
  if (typeof volume    === "number" && volume    > 0) updates.volume    = String(volume);

  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Nothing to update" }); return; }

  const [updated] = await db.update(positionsTable).set(updates).where(eq(positionsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Position not found" }); return; }
  res.json({ ok: true });
});

router.patch("/admin/orders/:id", requireAdmin, adminRateLimit, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { closePrice, profit, commission, swap } = req.body as { closePrice?: number; profit?: number; commission?: number; swap?: number };
  const updates: Record<string, string> = {};
  if (typeof closePrice  === "number") updates.closePrice  = String(closePrice);
  if (typeof profit      === "number") updates.profit      = String(profit);
  if (typeof commission  === "number") updates.commission  = String(commission);
  if (typeof swap        === "number") updates.swap        = String(swap);

  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Nothing to update" }); return; }

  const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!existing) { res.status(404).json({ error: "Order not found" }); return; }

  const oldNet = parseFloat(String(existing.profit)) + parseFloat(String(existing.swap)) + parseFloat(String(existing.commission));
  const newProfit     = typeof profit     === "number" ? profit     : parseFloat(String(existing.profit));
  const newSwap       = typeof swap       === "number" ? swap       : parseFloat(String(existing.swap));
  const newCommission = typeof commission === "number" ? commission : parseFloat(String(existing.commission));
  const newNet = newProfit + newSwap + newCommission;
  const delta = parseFloat((newNet - oldNet).toFixed(2));

  await db.transaction(async (tx) => {
    await tx.update(ordersTable).set(updates).where(eq(ordersTable.id, id));
    if (delta !== 0) {
      await tx
        .update(accountsTable)
        .set({ balance: sql`balance + ${delta.toFixed(2)}::numeric` })
        .where(eq(accountsTable.clerkUserId, existing.clerkUserId));
    }
  });

  res.json({ ok: true, balanceDelta: delta });
});

export default router;
