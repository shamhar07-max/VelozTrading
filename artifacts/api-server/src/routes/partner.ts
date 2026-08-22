import { Router, type IRouter, type Request } from "express";
import { eq, and, count, sql } from "drizzle-orm";
import { getAuth, clerkClient } from "@clerk/express";
import {
  db,
  accountsTable,
  partnersTable,
  referralsTable,
  partnerCommissionsTable,
  withdrawalRequestsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { accountRateLimit } from "../middlewares/rateLimit";
import { sendUserNotification, partnerNewReferralSignupHtml } from "../lib/notifications";

const router: IRouter = Router();

// ── Milestone thresholds → unlock percentages ──────────────────────────────
const MILESTONES = [
  { depositors: 100, pct: 100 },
  { depositors: 50,  pct: 75  },
  { depositors: 25,  pct: 50  },
  { depositors: 10,  pct: 25  },
];

export async function recalcPartnerUnlock(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  partnerId: number
): Promise<number> {
  const [row] = await tx
    .select({ cnt: count() })
    .from(referralsTable)
    .where(and(
      eq(referralsTable.partnerId, partnerId),
      eq(referralsTable.depositStatus, "active"),
    ));

  const activeDepositors = Number(row?.cnt ?? 0);
  let unlockedPct = 0;
  for (const m of MILESTONES) {
    if (activeDepositors >= m.depositors) { unlockedPct = m.pct; break; }
  }

  await tx
    .update(partnersTable)
    .set({ capitalUnlockedPct: unlockedPct })
    .where(eq(partnersTable.id, partnerId));

  return unlockedPct;
}

// GET /api/partner/me — returns stats for the authenticated partner (or admin)
router.get("/partner/me", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;

  const [partner] = await db
    .select()
    .from(partnersTable)
    .where(eq(partnersTable.clerkUserId, userId));

  // Allow admin to query ?userId=... for any partner
  let targetPartner = partner;
  if (!targetPartner) {
    try {
      const clerkUser = await clerkClient.users.getUser(userId);
      const isAdmin = clerkUser.emailAddresses.some(
        (e) => e.emailAddress === "shamhar07@gmail.com"
      );
      if (isAdmin) {
        const { userId: queryUserId } = req.query as { userId?: string };
        if (queryUserId) {
          const [p] = await db
            .select()
            .from(partnersTable)
            .where(eq(partnersTable.clerkUserId, queryUserId));
          targetPartner = p;
        }
      }
    } catch { /* ignore */ }
  }

  if (!targetPartner) {
    res.status(404).json({ error: "No partner account found for this user." });
    return;
  }

  const [account] = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.clerkUserId, targetPartner.clerkUserId));

  const [totalReferralsRow] = await db
    .select({ cnt: count() })
    .from(referralsTable)
    .where(eq(referralsTable.partnerId, targetPartner.id));

  const [depositingRow] = await db
    .select({ cnt: count() })
    .from(referralsTable)
    .where(and(
      eq(referralsTable.partnerId, targetPartner.id),
      eq(referralsTable.depositStatus, "active"),
    ));

  const [cpaRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
    .from(partnerCommissionsTable)
    .where(and(
      eq(partnerCommissionsTable.partnerId, targetPartner.id),
      eq(partnerCommissionsTable.sourceType, "cpa"),
    ));

  const [revRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
    .from(partnerCommissionsTable)
    .where(and(
      eq(partnerCommissionsTable.partnerId, targetPartner.id),
      eq(partnerCommissionsTable.sourceType, "rev_share"),
    ));

  const totalReferrals = Number(totalReferralsRow?.cnt ?? 0);
  const depositingReferrals = Number(depositingRow?.cnt ?? 0);
  const cpaEarned = parseFloat(String(cpaRow?.total ?? "0"));
  const revShareEarned = parseFloat(String(revRow?.total ?? "0"));
  const seededCapital = parseFloat(String(targetPartner.seededCapital));
  const balance = parseFloat(String(account?.balance ?? "0"));
  const unlockedPct = targetPartner.capitalUnlockedPct;
  const commissionWallet = parseFloat(String(targetPartner.commissionWallet));

  // Commission earnings are credited directly to accounts.balance when earned.
  // commissionWallet is a display/audit running total, NOT a separate ledger.
  // balance = seededCapital + tradingProfit + commissions (all in one pool).
  // Locked principal = seededCapital × (1 − unlockedPct/100).
  // Withdrawable = balance − lockedPrincipal (matches withdrawal enforcement logic).
  const lockedPrincipal = seededCapital * (1 - unlockedPct / 100);
  const withdrawableBalance = Math.max(0, balance - lockedPrincipal);
  const unlockedPrincipal = seededCapital * (unlockedPct / 100);
  // Display-only: trading profit estimate (balance above seeded, excluding commissions)
  const tradingProfit = Math.max(0, balance - seededCapital - cpaEarned - revShareEarned);

  // Next milestone
  let nextMilestoneAt: number | null = null;
  for (let i = MILESTONES.length - 1; i >= 0; i--) {
    if (depositingReferrals < MILESTONES[i]!.depositors) {
      nextMilestoneAt = MILESTONES[i]!.depositors;
    }
  }

  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "veloztrade.com";
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const referralLink = `${proto}://${host}/sign-up?ref=${targetPartner.referralCode}`;

  res.json({
    id: targetPartner.id,
    name: targetPartner.name,
    referralCode: targetPartner.referralCode,
    referralLink,
    status: targetPartner.status,
    seededCapital,
    cpaRate: parseFloat(String(targetPartner.cpaRate)),
    revSharePct: parseFloat(String(targetPartner.revSharePct)),
    totalReferrals,
    depositingReferrals,
    cpaEarned,
    revShareEarned,
    tradingProfit: parseFloat(tradingProfit.toFixed(2)),
    capitalUnlockedPct: unlockedPct,
    commissionWallet: parseFloat(commissionWallet.toFixed(2)),
    withdrawableBalance: parseFloat(withdrawableBalance.toFixed(2)),
    nextMilestoneAt,
    balance: parseFloat(balance.toFixed(2)),
    createdAt: targetPartner.createdAt,
  });
});

// GET /api/partner/me/commissions — audit trail
router.get("/partner/me/commissions", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;

  const [partner] = await db
    .select()
    .from(partnersTable)
    .where(eq(partnersTable.clerkUserId, userId));

  if (!partner) {
    res.status(404).json({ error: "No partner account found." });
    return;
  }

  const rows = await db
    .select()
    .from(partnerCommissionsTable)
    .where(eq(partnerCommissionsTable.partnerId, partner.id))
    .orderBy(partnerCommissionsTable.createdAt);

  res.json(rows.map((r) => ({
    id: r.id,
    sourceType: r.sourceType,
    amount: parseFloat(String(r.amount)),
    refPositionId: r.refPositionId ?? null,
    refClerkUserId: r.refClerkUserId ?? null,
    createdAt: r.createdAt,
  })));
});

// GET /api/partner/referral-code — public: look up a partner by referral code
router.get("/partner/referral-code/:code", async (req, res): Promise<void> => {
  const code = (req.params.code as string).toUpperCase();
  const [partner] = await db
    .select({ id: partnersTable.id, name: partnersTable.name, referralCode: partnersTable.referralCode })
    .from(partnersTable)
    .where(and(
      eq(partnersTable.referralCode, code),
      eq(partnersTable.status, "active"),
    ));

  if (!partner) {
    res.status(404).json({ error: "Invalid or inactive referral code." });
    return;
  }

  res.json({ id: partner.id, name: partner.name, referralCode: partner.referralCode });
});

// POST /api/partner/register-ref — called on first account load when ?ref= was in URL
router.post("/partner/register-ref", requireAuth, accountRateLimit, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const { code, referralCode } = req.body as { code?: string; referralCode?: string };
  const raw = referralCode ?? code;

  if (!raw || typeof raw !== "string") {
    res.status(400).json({ error: "referralCode required" });
    return;
  }

  const normalizedCode = raw.toUpperCase().trim();

  const [partner] = await db
    .select()
    .from(partnersTable)
    .where(and(
      eq(partnersTable.referralCode, normalizedCode),
      eq(partnersTable.status, "active"),
    ));

  if (!partner) {
    res.status(404).json({ error: "Invalid or inactive referral code." });
    return;
  }

  const [account] = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.clerkUserId, userId));

  if (!account) {
    res.status(404).json({ error: "Account not found." });
    return;
  }

  // Don't overwrite if already referred
  if (account.referredByPartnerId) {
    res.json({ ok: true, alreadySet: true });
    return;
  }

  // Don't allow partner to refer themselves
  if (partner.clerkUserId === userId) {
    res.status(400).json({ error: "Self-referral is not permitted." });
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(accountsTable)
      .set({ referredByPartnerId: partner.id, referralCode: normalizedCode })
      .where(eq(accountsTable.clerkUserId, userId));

    await tx
      .insert(referralsTable)
      .values({
        partnerId: partner.id,
        referredClerkUserId: userId,
        depositStatus: "none",
        cpaPaid: false,
      });
  });

  // Notify partner of the new sign-up (non-critical — fire-and-forget)
  try {
    const [refCountRow] = await db
      .select({ cnt: count() })
      .from(referralsTable)
      .where(eq(referralsTable.partnerId, partner.id));
    const totalReferrals = Number(refCountRow?.cnt ?? 1);

    const partnerClerkUser = await clerkClient.users.getUser(partner.clerkUserId);
    const partnerEmail = partnerClerkUser.emailAddresses[0]?.emailAddress;
    const newUserClerkUser = await clerkClient.users.getUser(userId);
    const newUserEmail = newUserClerkUser.emailAddresses[0]?.emailAddress ?? userId;

    if (partnerEmail) {
      void sendUserNotification(
        partnerEmail,
        "🙋 New Referral Sign-Up — VelozTrade",
        partnerNewReferralSignupHtml(partner.name, newUserEmail, totalReferrals),
      );
    }
  } catch { /* non-critical */ }

  res.json({ ok: true });
});

// ── IB Panel — for top-level IBs (parentPartnerId is null) ──────────────────
router.get("/ib/me", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  let clerkEmail: string | null = null;
  try { const u = await clerkClient.users.getUser(userId); clerkEmail = u.emailAddresses[0]?.emailAddress ?? null; } catch { /* ignore */ }

  // 1) Direct lookup by clerkUserId
  let [partner] = await db.select().from(partnersTable).where(eq(partnersTable.clerkUserId, userId));

  // 2) Fallback: claim seeded IB by email (rohitkatariya1820@gmail.com → VT-IB-IN-001)
  // This auto-migrates the mock placeholder to the real Clerk user on first login.
  if (!partner && clerkEmail) {
    const emailLower = clerkEmail.toLowerCase();
    let targetCode: string | null = null;
    if (emailLower === "rohitkatariya1820@gmail.com") targetCode = "VT-IB-IN-001";

    if (targetCode) {
      const [seeded] = await db.select().from(partnersTable).where(eq(partnersTable.referralCode, targetCode));
      if (seeded) {
        if (seeded.clerkUserId.startsWith("mock_")) {
          await db.update(partnersTable).set({ clerkUserId: userId }).where(eq(partnersTable.id, seeded.id));
          await db.update(accountsTable).set({ clerkUserId: userId }).where(eq(accountsTable.clerkUserId, `mock_${targetCode.toLowerCase()}`));
          partner = { ...seeded, clerkUserId: userId } as any;
        } else if (seeded.clerkUserId === userId) {
          partner = seeded;
        } else {
          partner = seeded;
        }
      } else if (emailLower === "rohitkatariya1820@gmail.com" && targetCode === "VT-IB-IN-001") {
        // Auto-create Rohit's IB if DB was never seeded — ensures panel is visible on first login
        const [newPartner] = await db.insert(partnersTable).values({
          clerkUserId: userId,
          name: "Rohit Kumar Ramesh Chand",
          referralCode: "VT-IB-IN-001",
          legacyId: "VELIBIN1810001",
          seededCapital: "50000",
          cpaRate: "50.00",
          revSharePct: "0.3000",
          capitalUnlockedPct: 50,
          commissionWallet: "18450.00",
          status: "active",
          tier: "tier1",
        }).returning();
        // Ensure account exists
        const [existingAcc] = await db.select().from(accountsTable).where(eq(accountsTable.clerkUserId, userId));
        if (!existingAcc) {
          await db.insert(accountsTable).values({
            clerkUserId: userId,
            balance: "48750.00",
            demoBalance: "10000.00",
            isDemoMode: false,
            currency: "USD",
            leverage: 200,
            accountType: "real",
            kycStatus: "verified",
            mockName: "Rohit Kumar Ramesh Chand",
            mockEmail: "rohitkatariya1820@gmail.com",
            isMock: false,
          });
        }
        // Create the approved withdrawal record if missing
        const [existingWd] = await db.select().from(withdrawalRequestsTable).where(eq(withdrawalRequestsTable.clerkUserId, userId));
        if (!existingWd) {
          await db.insert(withdrawalRequestsTable).values({
            clerkUserId: userId,
            amount: "3293.00",
            method: "bank",
            bankDetails: "Beneficiary: Rohit Kumar Ramesh Chand — INR 275,000 (≈ $3,293 USD) IB commission withdrawal — credited to registered bank",
            status: "approved",
            notes: "INR 275,000 (~$3,293 @ ₹83.5) — IB commission payout for $3.2M book",
          });
        }
        partner = newPartner as any;
      }
    }
  }

  if (!partner || (partner as any).parentPartnerId) {
    res.status(404).json({ error: "No IB account found for this user." });
    return;
  }

  // Gather IB stats: direct clients + sub-IBs + sub-IB clients
  const subIbs = await db.select().from(partnersTable).where(eq(partnersTable.parentPartnerId, partner.id));
  const subIbIds = subIbs.map(s => s.id);
  const allPartnerIds = [partner.id, ...subIbIds];

  let totalClients = 0; let totalAum = 0;
  for (const pid of allPartnerIds) {
    const [cnt] = await db.select({ cnt: count() }).from(referralsTable).where(eq(referralsTable.partnerId, pid));
    totalClients += Number(cnt?.cnt ?? 0);
    const [sum] = await db.select({ total: sql<string>`COALESCE(SUM(balance::numeric),0)` }).from(accountsTable).where(eq(accountsTable.referredByPartnerId, pid));
    totalAum += parseFloat(String(sum?.total ?? "0"));
  }

  res.json({
    id: partner.id,
    name: partner.name,
    referralCode: partner.referralCode,
    legacyId: (partner as any).legacyId,
    tier: (partner as any).tier,
    seededCapital: parseFloat(String(partner.seededCapital)),
    status: partner.status,
    totalClients,
    totalAum: parseFloat(totalAum.toFixed(2)),
    subIbs: subIbs.map(s => ({ id: s.id, name: s.name, referralCode: s.referralCode, legacyId: (s as any).legacyId })),
    subIbCount: subIbs.length,
  });
});

// ── Sub-IB Panel — for sub desks (parentPartnerId not null) ─────────────────
router.get("/sub-ib/me", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.clerkUserId, userId));
  if (!partner || !(partner as any).parentPartnerId) {
    res.status(404).json({ error: "No Sub-IB account found for this user." });
    return;
  }
  const [parent] = await db.select().from(partnersTable).where(eq(partnersTable.id, (partner as any).parentPartnerId));
  const [clientCnt] = await db.select({ cnt: count() }).from(referralsTable).where(eq(referralsTable.partnerId, partner.id));
  const [aumRow] = await db.select({ total: sql<string>`COALESCE(SUM(balance::numeric),0)` }).from(accountsTable).where(eq(accountsTable.referredByPartnerId, partner.id));
  res.json({
    id: partner.id,
    name: partner.name,
    referralCode: partner.referralCode,
    legacyId: (partner as any).legacyId,
    parent: parent ? { id: parent.id, name: parent.name, referralCode: parent.referralCode } : null,
    totalClients: Number(clientCnt?.cnt ?? 0),
    totalAum: parseFloat(String(aumRow?.total ?? "0")),
    seededCapital: parseFloat(String(partner.seededCapital)),
    status: partner.status,
  });
});

// GET /api/referral/stats — basic referral stats for any authenticated user
// Returns live referral code + referred-user count.
// Partners get their actual partner code and depositing referral count.
// Regular users get a deterministic code (VT-<userId>) and count of any
// referrals recorded against that code (typically 0 until they become a partner).
router.get("/referral/stats", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;

  const [partner] = await db
    .select()
    .from(partnersTable)
    .where(eq(partnersTable.clerkUserId, userId));

  if (partner) {
    const [refCount] = await db
      .select({ cnt: count() })
      .from(referralsTable)
      .where(eq(referralsTable.partnerId, partner.id));

    const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "veloztrade.com";
    const proto = req.headers["x-forwarded-proto"] ?? "https";
    const referralLink = `${proto}://${host}/sign-up?ref=${partner.referralCode}`;

    res.json({
      isPartner: true,
      referralCode: partner.referralCode,
      referralLink,
      referredCount: Number(refCount?.cnt ?? 0),
    });
    return;
  }

  // Non-partner: generate a deterministic code from the Clerk user ID
  const code = `VT-${userId.replace(/^user_/, "").toUpperCase().slice(0, 10)}`;
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "veloztrade.com";
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const referralLink = `${proto}://${host}/sign-up?ref=${code}`;

  // Count any referrals recorded for partners whose code matches (should be 0 for non-partners)
  const [partnerWithCode] = await db
    .select({ id: partnersTable.id })
    .from(partnersTable)
    .where(eq(partnersTable.referralCode, code));

  let referredCount = 0;
  if (partnerWithCode) {
    const [rc] = await db
      .select({ cnt: count() })
      .from(referralsTable)
      .where(eq(referralsTable.partnerId, partnerWithCode.id));
    referredCount = Number(rc?.cnt ?? 0);
  }

  res.json({ isPartner: false, referralCode: code, referralLink, referredCount });
});

export default router;
