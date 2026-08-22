// Partner portal routes — implements docs/ib-sub-ib-programme.md (VEL-IB-SPEC-2026-R1).
//
// Replaces the legacy partner program. Removed by design:
//   - hardcoded email→IB auto-claim and auto-provisioning hacks
//   - auto-created withdrawal records / pre-loaded wallet figures
//   - instant commission crediting (earnings now accrue PENDING and settle via
//     the admin-approved monthly run — see lib/partnerProgram.ts)
//
// Attribution rules (spec §2): permanent once set; self-referral refused;
// retroactive linking only within RETROACTIVE_ATTRIBUTION_WINDOW_DAYS of the
// client account's creation, via the admin attribution endpoint.

import { Router, type IRouter, type Request } from "express";
import { eq, and, count, desc, inArray, sql } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
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
import { RETROACTIVE_ATTRIBUTION_WINDOW_DAYS, canWithdraw } from "../lib/partnerProgramMath";

const router: IRouter = Router();

// ── Milestone thresholds → unlock percentages (spec §3.4) ──────────────────
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

function referralLinkFor(req: Request, code: string): string {
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "veloztrade.com";
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  return `${proto}://${host}/sign-up?ref=${code}`;
}

async function sumCommissions(partnerId: number, sourceType?: string, state?: string): Promise<number> {
  const conditions = [eq(partnerCommissionsTable.partnerId, partnerId)];
  if (sourceType) conditions.push(eq(partnerCommissionsTable.sourceType, sourceType));
  if (state) conditions.push(eq(partnerCommissionsTable.state, state));
  const [row] = await db
    .select({ total: sql<string>`COALESCE(SUM(${partnerCommissionsTable.amount}), 0)` })
    .from(partnerCommissionsTable)
    .where(and(...conditions));
  return parseFloat(String(row?.total ?? "0"));
}

// GET /api/partner/me — dashboard stats for the authenticated partner
router.get("/partner/me", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;

  const [partner] = await db
    .select()
    .from(partnersTable)
    .where(eq(partnersTable.clerkUserId, userId));

  // Allow admin to query ?userId=... for any partner
  let targetPartner = partner;
  if (!targetPartner && req.query.userId) {
    try {
      const clerkUser = await clerkClient.users.getUser(userId);
      const isAdmin = clerkUser.publicMetadata?.role === "admin";
      if (isAdmin) {
        const [p] = await db
          .select()
          .from(partnersTable)
          .where(eq(partnersTable.clerkUserId, String(req.query.userId)));
        targetPartner = p;
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

  // Four-stream breakdown (spec §3) — settled vs pending
  const [cpaEarned, revShareEarned, lotRebateEarned, overrideEarned] = await Promise.all([
    sumCommissions(targetPartner.id, "cpa"),
    sumCommissions(targetPartner.id, "rev_share"),
    sumCommissions(targetPartner.id, "lot_rebate"),
    sumCommissions(targetPartner.id, "parent_override"),
  ]);
  const pendingAmount = await sumCommissions(targetPartner.id, undefined, "pending");

  const totalReferrals = Number(totalReferralsRow?.cnt ?? 0);
  const depositingReferrals = Number(depositingRow?.cnt ?? 0);
  const seededCapital = parseFloat(String(targetPartner.seededCapital));
  const balance = parseFloat(String(account?.balance ?? "0"));
  const unlockedPct = targetPartner.capitalUnlockedPct;
  const commissionWallet = parseFloat(String(targetPartner.commissionWallet));

  // Commission earnings reach accounts.balance only when a run is approved.
  // Locked principal = seededCapital × (1 − unlockedPct/100); withdrawable is the rest.
  const lockedPrincipal = seededCapital * (1 - unlockedPct / 100);
  const withdrawableBalance = Math.max(0, balance - lockedPrincipal);
  const unlockedPrincipal = seededCapital * (unlockedPct / 100);

  // Next milestone
  let nextMilestoneAt: number | null = null;
  for (let i = MILESTONES.length - 1; i >= 0; i--) {
    if (depositingReferrals < MILESTONES[i]!.depositors) {
      nextMilestoneAt = MILESTONES[i]!.depositors;
    }
  }

  res.json({
    id: targetPartner.id,
    name: targetPartner.name,
    referralCode: targetPartner.referralCode,
    referralLink: referralLinkFor(req, targetPartner.referralCode),
    status: targetPartner.status,
    parentPartnerId: targetPartner.parentPartnerId ?? null,
    tier: targetPartner.tier,
    legacyId: targetPartner.legacyId,
    seededCapital,
    cpaRate: parseFloat(String(targetPartner.cpaRate)),
    revSharePct: parseFloat(String(targetPartner.revSharePct)),
    totalReferrals,
    depositingReferrals,
    streams: {
      cpaEarned: parseFloat(cpaEarned.toFixed(2)),
      revShareEarned: parseFloat(revShareEarned.toFixed(2)),
      lotRebateEarned: parseFloat(lotRebateEarned.toFixed(2)),
      parentOverrideEarned: parseFloat(overrideEarned.toFixed(2)),
      pendingAmount: parseFloat(pendingAmount.toFixed(2)),
    },
    cpaEarned: parseFloat(cpaEarned.toFixed(2)),
    revShareEarned: parseFloat(revShareEarned.toFixed(2)),
    capitalUnlockedPct: unlockedPct,
    commissionWallet: parseFloat(commissionWallet.toFixed(2)),
    withdrawableBalance: parseFloat(withdrawableBalance.toFixed(2)),
    withdrawalsEnabled: canWithdraw(targetPartner.status),
    nextMilestoneAt,
    balance: parseFloat(balance.toFixed(2)),
    createdAt: targetPartner.createdAt,
  });
});

// GET /api/partner/me/commissions — full audit trail incl. run state
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
    .orderBy(desc(partnerCommissionsTable.createdAt))
    .limit(500);

  res.json(rows.map((r) => ({
    id: r.id,
    sourceType: r.sourceType,
    amount: parseFloat(String(r.amount)),
    state: r.state,
    runMonth: r.runMonth ?? null,
    lots: r.lots != null ? parseFloat(String(r.lots)) : null,
    reason: r.reason ?? null,
    refPositionId: r.refPositionId ?? null,
    refClerkUserId: r.refClerkUserId ?? null,
    createdAt: r.createdAt,
  })));
});

// GET /api/partner/referral-code/:code — public lookup of an active partner by code
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

// POST /api/partner/register-ref — first-load attribution when ?ref= was present at signup.
// Permanent per spec §2; allowed only while the client account is inside the retroactive
// window measured from account creation.
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

  // Don't overwrite existing attribution — it is permanent (spec §2).
  if (account.referredByPartnerId) {
    res.json({ ok: true, alreadySet: true });
    return;
  }

  // Retroactive window: signup links resolve on first load anyway, but guard against
  // stale clients trying to claim attribution long after registration.
  const ageDays = (Date.now() - new Date(account.createdAt).getTime()) / 86_400_000;
  if (ageDays > RETROACTIVE_ATTRIBUTION_WINDOW_DAYS) {
    res.status(400).json({ error: "Attribution window has expired. Contact support." });
    return;
  }

  // Self-referral prohibition (spec §7)
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
        "New Referral Sign-Up — VelozTrade",
        partnerNewReferralSignupHtml(partner.name, newUserEmail, totalReferrals),
      );
    }
  } catch { /* non-critical */ }

  res.json({ ok: true });
});

// ── IB Panel — top-level IBs (parentPartnerId is null) ──────────────────────

async function findPartnerForUser(userId: string) {
  const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.clerkUserId, userId));
  return partner ?? null;
}

router.get("/ib/me", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const partner = await findPartnerForUser(userId);

  if (!partner || partner.parentPartnerId != null) {
    res.status(404).json({ error: "No IB account found for this user." });
    return;
  }

  const subIbs = await db.select().from(partnersTable).where(eq(partnersTable.parentPartnerId, partner.id));
  const allPartnerIds = [partner.id, ...subIbs.map(s => s.id)];

  const [clientCnt] = await db
    .select({ cnt: count() })
    .from(referralsTable)
    .where(inArray(referralsTable.partnerId, allPartnerIds));
  const [aumRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(balance::numeric),0)` })
    .from(accountsTable)
    .where(inArray(accountsTable.referredByPartnerId, allPartnerIds));

  res.json({
    id: partner.id,
    name: partner.name,
    referralCode: partner.referralCode,
    legacyId: partner.legacyId,
    tier: partner.tier,
    status: partner.status,
    seededCapital: parseFloat(String(partner.seededCapital)),
    totalClients: Number(clientCnt?.cnt ?? 0),
    totalAum: parseFloat(String(aumRow?.total ?? "0")),
    subIbCount: subIbs.length,
    subIbs: subIbs.map(s => ({
      id: s.id,
      name: s.name,
      referralCode: s.referralCode,
      legacyId: s.legacyId,
      status: s.status,
    })),
  });
});

// GET /api/ib/clients — the IB's book (own + sub-IB desks unless ?includeSubIbs=false)
router.get("/ib/clients", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const partner = await findPartnerForUser(userId);
  if (!partner || partner.parentPartnerId != null) {
    res.status(404).json({ error: "No IB account found." });
    return;
  }

  const includeSub = req.query.includeSubIbs !== "false";
  const subIbs = includeSub ? await db.select().from(partnersTable).where(eq(partnersTable.parentPartnerId, partner.id)) : [];
  const allIds = [partner.id, ...subIbs.map(s => s.id)];

  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
  const offset = (page - 1) * limit;

  const allReferrals = await db
    .select()
    .from(referralsTable)
    .where(inArray(referralsTable.partnerId, allIds))
    .orderBy(desc(referralsTable.createdAt));

  const paged = allReferrals.slice(offset, offset + limit);
  const clerkIds = paged.map(r => r.referredClerkUserId);
  const accounts = clerkIds.length > 0
    ? await db.select().from(accountsTable).where(inArray(accountsTable.clerkUserId, clerkIds))
    : [];
  const accByClerk = new Map(accounts.map(a => [a.clerkUserId, a]));
  const codeById = new Map<number, string>([
    [partner.id, partner.referralCode],
    ...subIbs.map(s => [s.id, s.referralCode] as const),
  ]);

  // Masked identifiers for privacy (spec §7): partners see masked IDs, not raw emails.
  function mask(id: string): string {
    return id.length > 8 ? `${id.slice(0, 5)}…${id.slice(-3)}` : id;
  }

  const clients = paged.map(r => {
    const acc = accByClerk.get(r.referredClerkUserId);
    return {
      clerkUserId: mask(r.referredClerkUserId),
      name: acc ? mask(`${acc.mockName ?? ""}${acc.clerkUserId}`.trim() || acc.clerkUserId) : mask(r.referredClerkUserId),
      email: acc?.mockEmail ? mask(acc.mockEmail.split("@")[0]!) + "@…" : "—",
      balance: acc ? parseFloat(String(acc.balance)) : 0,
      demoBalance: acc ? parseFloat(String(acc.demoBalance)) : 0,
      accountType: acc?.accountType ?? "real",
      kycStatus: acc?.kycStatus ?? "unverified",
      leverage: acc?.leverage ?? 100,
      currency: acc?.currency ?? "USD",
      referredBy: codeById.get(r.partnerId) ?? partner.referralCode,
      depositStatus: r.depositStatus,
      cpaPaid: r.cpaPaid,
      createdAt: r.createdAt,
    };
  });

  res.json({ total: allReferrals.length, page, limit, clients });
});

// ── Sub-IB Panel — desks (parentPartnerId not null) ─────────────────────────

router.get("/sub-ib/me", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const partner = await findPartnerForUser(userId);
  if (!partner || partner.parentPartnerId == null) {
    res.status(404).json({ error: "No Sub-IB account found for this user." });
    return;
  }
  const [parent] = await db.select().from(partnersTable).where(eq(partnersTable.id, partner.parentPartnerId));
  const [clientCnt] = await db.select({ cnt: count() }).from(referralsTable).where(eq(referralsTable.partnerId, partner.id));
  const [aumRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(balance::numeric),0)` })
    .from(accountsTable)
    .where(eq(accountsTable.referredByPartnerId, partner.id));

  res.json({
    id: partner.id,
    name: partner.name,
    referralCode: partner.referralCode,
    legacyId: partner.legacyId,
    status: partner.status,
    parent: parent ? { id: parent.id, name: parent.name, referralCode: parent.referralCode } : null,
    totalClients: Number(clientCnt?.cnt ?? 0),
    totalAum: parseFloat(String(aumRow?.total ?? "0")),
    seededCapital: parseFloat(String(partner.seededCapital)),
  });
});

// GET /api/referral/stats — basic referral stats for any authenticated user
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

    res.json({
      isPartner: true,
      referralCode: partner.referralCode,
      referralLink: referralLinkFor(req, partner.referralCode),
      referredCount: Number(refCount?.cnt ?? 0),
    });
    return;
  }

  // Non-partner: deterministic placeholder code
  const code = `VT-${userId.replace(/^user_/, "").toUpperCase().slice(0, 10)}`;

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

  res.json({
    isPartner: false,
    referralCode: code,
    referralLink: referralLinkFor(req, code),
    referredCount,
  });
});

export default router;
