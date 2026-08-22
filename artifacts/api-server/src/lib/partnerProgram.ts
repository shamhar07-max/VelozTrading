// Database operations for the IB/Sub-IB commission engine (VEL-IB-SPEC-2026-R1 §4).
// Pure math/lifecycle helpers live in partnerProgramMath.ts and are re-exported here.

import { and, eq, gte, inArray, sql } from "drizzle-orm";
import type { Tx } from "./ledger";
import { recordTransaction, usd } from "./ledger";
import {
  db,
  accountsTable,
  partnersTable,
  partnerCommissionsTable,
  referralsTable,
} from "@workspace/db";

import { runMonthFor, round2, utcMonthStart, canAccrue, computeRebateSplit, type PartnerRole, type PartnerTier, CPA_QUALIFYING_DEPOSIT_USD } from "./partnerProgramMath";

export * from "./partnerProgramMath";

// ── Accrual: closed real trades → PENDING rebate/override lines ────────────

/**
 * Accrue lot rebate (+ parent override for sub-IB volume) for one closed REAL trade.
 * Writes pending rows only — settlement happens at run approval.
 */
export async function accrueForClosedPosition(
  tx: Tx,
  params: { positionId: number; clientId: string; lots: number },
): Promise<void> {
  if (!(params.lots > 0)) return;

  const [account] = await tx
    .select({ referredByPartnerId: accountsTable.referredByPartnerId })
    .from(accountsTable)
    .where(eq(accountsTable.clerkUserId, params.clientId));
  if (!account?.referredByPartnerId) return;

  const [partner] = await tx
    .select()
    .from(partnersTable)
    .where(eq(partnersTable.id, account.referredByPartnerId));
  if (!partner || !canAccrue(partner.status)) return;

  const monthStart = utcMonthStart();
  const [vol] = await tx
    .select({
      total: sql<string>`COALESCE(SUM(${partnerCommissionsTable.lots}), 0)`,
    })
    .from(partnerCommissionsTable)
    .where(
      and(
        eq(partnerCommissionsTable.partnerId, partner.id),
        eq(partnerCommissionsTable.sourceType, "lot_rebate"),
        gte(partnerCommissionsTable.createdAt, monthStart),
      ),
    );
  const lotsThisMonth = parseFloat(String(vol?.total ?? "0"));

  const role: PartnerRole = partner.parentPartnerId == null ? "ib" : "subIb";
  const split = computeRebateSplit({
    role,
    tier: (partner.tier as PartnerTier) ?? "tier1",
    lots: params.lots,
    partnerLotsThisMonth: lotsThisMonth,
  });

  if (split.rebate > 0) {
    await tx.insert(partnerCommissionsTable).values({
      partnerId: partner.id,
      sourceType: "lot_rebate",
      amount: split.rebate.toFixed(2),
      lots: params.lots.toFixed(2),
      refPositionId: params.positionId,
      refClerkUserId: params.clientId,
      state: "pending",
    });
  }

  if (split.parentOverride > 0 && partner.parentPartnerId != null) {
    await tx.insert(partnerCommissionsTable).values({
      partnerId: partner.parentPartnerId,
      sourceType: "parent_override",
      amount: split.parentOverride.toFixed(2),
      lots: params.lots.toFixed(2),
      refPositionId: params.positionId,
      refClerkUserId: params.clientId,
      state: "pending",
    });
  }
}

export interface QueuedCpa {
  partnerId: number;
  partnerClerkUserId: string;
  partnerName: string;
  cpaAmount: number;
}

/**
 * CPA trigger on deposit approval. Qualifying deposit ≥ $250, once per
 * (partner, client) pair, guarded by referrals.cpaPaid. Writes a pending row.
 */
export async function queueCpaIfQualified(
  tx: Tx,
  params: { clientId: string; depositAmount: number },
): Promise<QueuedCpa | null> {
  if (params.depositAmount < CPA_QUALIFYING_DEPOSIT_USD) return null;

  const [acc] = await tx
    .select({ referredByPartnerId: accountsTable.referredByPartnerId })
    .from(accountsTable)
    .where(eq(accountsTable.clerkUserId, params.clientId));
  const partnerId = acc?.referredByPartnerId;
  if (!partnerId) return null;

  const [referral] = await tx
    .select()
    .from(referralsTable)
    .where(
      and(
        eq(referralsTable.partnerId, partnerId),
        eq(referralsTable.referredClerkUserId, params.clientId),
      ),
    );

  if (referral?.cpaPaid) {
    // Already paid — just make sure the referral shows as qualified.
    if (referral.depositStatus === "none") {
      await tx
        .update(referralsTable)
        .set({ depositStatus: "active" })
        .where(eq(referralsTable.id, referral.id));
    }
    return null;
  }

  const [partner] = await tx
    .select()
    .from(partnersTable)
    .where(eq(partnersTable.id, partnerId));
  if (!partner || !canAccrue(partner.status)) return null;

  const cpaAmount = parseFloat(String(partner.cpaRate));

  await tx.insert(partnerCommissionsTable).values({
    partnerId,
    sourceType: "cpa",
    amount: cpaAmount.toFixed(2),
    refClerkUserId: params.clientId,
    state: "pending",
  });

  if (referral) {
    await tx
      .update(referralsTable)
      .set({ cpaPaid: true, depositStatus: "active" })
      .where(eq(referralsTable.id, referral.id));
  }

  return {
    partnerId,
    partnerClerkUserId: partner.clerkUserId,
    partnerName: partner.name,
    cpaAmount,
  };
}

/** Aggregate pending commissions grouped by partner and stream for a run month. */
export async function getPendingRunSummary(
  month?: string,
): Promise<
  Array<{
    partnerId: number;
    sourceType: string;
    total: string;
    lines: number;
  }>
> {
  const conditions = [eq(partnerCommissionsTable.state, "pending")];
  if (month) {
    conditions.push(sql`to_char(${partnerCommissionsTable.createdAt}, 'YYYY-MM') = ${month}`);
  }
  return db
    .select({
      partnerId: partnerCommissionsTable.partnerId,
      sourceType: partnerCommissionsTable.sourceType,
      total: sql<string>`SUM(${partnerCommissionsTable.amount})`,
      lines: sql<number>`count(*)`,
    })
    .from(partnerCommissionsTable)
    .where(and(...conditions))
    .groupBy(partnerCommissionsTable.partnerId, partnerCommissionsTable.sourceType)
    .orderBy(partnerCommissionsTable.partnerId);
}

/**
 * Month-end settlement: approve all pending lines (optionally scoped to one month and/or
 * specific partners), credit each partner's tradeable balance + display wallet, and write
 * one mirrored ledger row per commission line. Idempotent by construction — already
 * approved/reversed lines are never touched twice.
 */
export async function approveCommissionRun(
  tx: Tx,
  opts: { month?: string; partnerIds?: number[] },
): Promise<{ partnersPaid: number; linesApproved: number; totalAmount: number }> {
  const conditions = [eq(partnerCommissionsTable.state, "pending")];
  if (opts.month) {
    conditions.push(sql`to_char(${partnerCommissionsTable.createdAt}, 'YYYY-MM') = ${opts.month}`);
  }
  if (opts.partnerIds?.length) {
    conditions.push(inArray(partnerCommissionsTable.partnerId, opts.partnerIds));
  }

  const pending = await tx
    .select()
    .from(partnerCommissionsTable)
    .where(and(...conditions));

  let totalAmount = 0;
  const seenPartners = new Set<number>();
  const runMonth = runMonthFor(new Date()); // from partnerProgramMath re-export

  for (const line of pending) {
    const amount = parseFloat(String(line.amount));
    if (!(amount > 0)) continue;

    const [partner] = await tx
      .select()
      .from(partnersTable)
      .where(eq(partnersTable.id, line.partnerId));
    if (!partner) continue;

    await tx
      .update(accountsTable)
      .set({ balance: sql`balance + ${amount.toFixed(2)}::numeric` })
      .where(eq(accountsTable.clerkUserId, partner.clerkUserId));

    await tx
      .update(partnersTable)
      .set({ commissionWallet: sql`commission_wallet + ${amount.toFixed(2)}::numeric` })
      .where(eq(partnersTable.id, partner.id));

    await recordTransaction(tx, {
      clerkUserId: partner.clerkUserId,
      type: "partner_commission_approved",
      amount: usd(amount),
      isDemo: false,
      refType: "partner_commission",
      refId: line.id,
      description: `Commission run ${runMonth} — ${line.sourceType}${line.reason ? ` (${line.reason})` : ""}`,
    });

    await tx
      .update(partnerCommissionsTable)
      .set({ state: "approved", runMonth: runMonth })
      .where(eq(partnerCommissionsTable.id, line.id));

    totalAmount += amount;
    seenPartners.add(line.partnerId);
  }

  return { partnersPaid: seenPartners.size, linesApproved: pending.length, totalAmount: round2(totalAmount) };
}

/**
 * Clawback a commission line. Pending lines flip straight to 'reversed' (nothing was ever
 * credited). Approved lines get a mirrored negative adjustment that debits the partner's
 * balance and wallet in the same transaction, so the ledger stays balanced.
 */
export async function reverseCommission(
  tx: Tx,
  params: { commissionId: number; reason: string },
): Promise<{ ok: true; reversedAmount: number } | { ok: false; error: string }> {
  if (!params.reason || !params.reason.trim()) {
    return { ok: false, error: "A reversal reason is required" };
  }

  const [line] = await tx
    .select()
    .from(partnerCommissionsTable)
    .where(eq(partnerCommissionsTable.id, params.commissionId));
  if (!line) return { ok: false, error: "Commission line not found" };
  if (line.state === "reversed") return { ok: false, error: "Line is already reversed" };

  const [partner] = await tx
    .select()
    .from(partnersTable)
    .where(eq(partnersTable.id, line.partnerId));
  if (!partner) return { ok: false, error: "Partner not found" };

  const amount = parseFloat(String(line.amount));

  await tx
    .update(partnerCommissionsTable)
    .set({ state: "reversed", reason: params.reason.trim() })
    .where(eq(partnerCommissionsTable.id, line.id));

  if (line.state === "approved" && amount > 0) {
    await tx
      .update(accountsTable)
      .set({ balance: sql`balance - ${amount.toFixed(2)}::numeric` })
      .where(eq(accountsTable.clerkUserId, partner.clerkUserId));

    await tx
      .update(partnersTable)
      .set({ commissionWallet: sql`GREATEST(commission_wallet - ${amount.toFixed(2)}::numeric, 0)` })
      .where(eq(partnersTable.id, partner.id));

    await tx.insert(partnerCommissionsTable).values({
      partnerId: partner.id,
      sourceType: "adjustment",
      amount: (-amount).toFixed(2),
      refPositionId: line.refPositionId,
      refClerkUserId: line.refClerkUserId,
      state: "approved",
      reason: `Clawback of line #${line.id}: ${params.reason.trim()}`,
    });

    await recordTransaction(tx, {
      clerkUserId: partner.clerkUserId,
      type: "partner_commission_clawback",
      amount: usd(-amount),
      isDemo: false,
      refType: "partner_commission",
      refId: line.id,
      description: `Clawback of commission line #${line.id} — ${params.reason.trim()}`,
    });
  }

  return { ok: true, reversedAmount: amount };
}

