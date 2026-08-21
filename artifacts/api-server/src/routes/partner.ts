import { Router, type IRouter, type Request } from "express";
import { eq, and, count, sql } from "drizzle-orm";
import { getAuth, clerkClient } from "@clerk/express";
import {
  db,
  accountsTable,
  partnersTable,
  referralsTable,
  partnerCommissionsTable,
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
