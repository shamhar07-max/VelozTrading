// Dev/staging seeding endpoint — VEL-IB-SPEC-2026-R1 §10 legacy migration map.
//
// Seeds ONLY the IB / sub-IB network structure (13 IBs + 6 sub-IB desks with
// correct parent linkage) so dashboards, panels and the commission engine can be
// exercised locally. It deliberately does NOT create:
//   - fake client accounts or referral rows
//   - seeded balances, commission-wallet figures or unlock percentages
//   - withdrawal records of any kind
//   - any ?scale= bulk synthetic-client generator (removed)
//
// Load-test volume belongs in clearly-flagged fixtures (see ~/veloztrade-seed),
// never inside the platform as pseudo-real accounts.

import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, accountsTable, partnersTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin";
import { adminRateLimit } from "../middlewares/rateLimit";

const router: IRouter = Router();

// Legacy registry — Handover Report Appendix A + Ops Report §4–5 (VEL-IB-SPEC-2026-R1 §10).
// `clients`/`value` are quoted book aggregates kept for reference/reconciliation targets;
// they are NOT inserted anywhere as balances.
const IB_REGISTRY = [
  { name: "Rohit Kumar Ramesh Chand", legacyId: "VELIBIN1810001", code: "VT-IB-IN-001", country: "India", clients: 26, value: 3200000 },
  { name: "John Smith", legacyId: "VELIBUK1820002", code: "VT-IB-UK-002", country: "UK", clients: 18, value: 2100000 },
  { name: "Pierre Dubois", legacyId: "VELIBFR1830003", code: "VT-IB-FR-003", country: "France", clients: 22, value: 2800000 },
  { name: "Hans Mueller", legacyId: "VELIBDE1840004", code: "VT-IB-DE-004", country: "Germany", clients: 15, value: 1900000 },
  { name: "Maria Santos", legacyId: "VELIBES1850005", code: "VT-IB-ES-005", country: "Spain", clients: 20, value: 2500000 },
  { name: "Giovanni Rossi", legacyId: "VELIBIT1860006", code: "VT-IB-IT-006", country: "Italy", clients: 17, value: 2200000 },
  { name: "Ahmed Hassan", legacyId: "VELIBEG1870007", code: "VT-IB-EG-007", country: "Egypt", clients: 14, value: 1700000 },
  { name: "Grace Moyo", legacyId: "VELIBZW1880008", code: "VT-IB-ZW-008", country: "Zimbabwe", clients: 12, value: 1400000 },
  { name: "Oumar Diallo", legacyId: "VELIBSN1890009", code: "VT-IB-SN-009", country: "Senegal", clients: 10, value: 1200000 },
  { name: "Kwame Nkosi", legacyId: "VELIBZA1900010", code: "VT-IB-ZA-010", country: "South Africa", clients: 16, value: 2000000 },
  { name: "Dmitri Volkov", legacyId: "VELIBRU1910011", code: "VT-IB-RU-011", country: "Russia", clients: 19, value: 2300000 },
  { name: "Lars Johansson", legacyId: "VELIBSE1920012", code: "VT-IB-SE-012", country: "Sweden", clients: 11, value: 1300000 },
  { name: "Fatima Al-Khalifa", legacyId: "VELIBAE1930013", code: "VT-IB-AE-013", country: "UAE", clients: 13, value: 1600000 },
];

const SUB_IB_REGISTRY = [
  { name: "Delhi Desk", legacyId: "VEL-SUB-IN-001", code: "VT-SUB-IN-001", parentCode: "VT-IB-IN-001" },
  { name: "Mumbai Desk", legacyId: "VEL-SUB-IN-002", code: "VT-SUB-IN-002", parentCode: "VT-IB-IN-001" },
  { name: "Lyon Desk", legacyId: "VEL-SUB-FR-003", code: "VT-SUB-FR-003", parentCode: "VT-IB-FR-003" },
  { name: "Madrid Desk", legacyId: "VEL-SUB-ES-004", code: "VT-SUB-ES-004", parentCode: "VT-IB-ES-005" },
  { name: "Cairo Desk", legacyId: "VEL-SUB-EG-005", code: "VT-SUB-EG-005", parentCode: "VT-IB-EG-007" },
  { name: "Dubai Desk", legacyId: "VEL-SUB-AE-006", code: "VT-SUB-AE-006", parentCode: "VT-IB-AE-013" },
];

// POST /api/admin/seed-mockdata — idempotent, admin-only. Structure only.
// Query: ?force=true to re-seed even if it already exists.
router.post("/admin/seed-mockdata", requireAdmin, adminRateLimit, async (req, res): Promise<void> => {
  const force = req.query.force === "true";

  // Idempotency check — look for any previously seeded partner
  const [existing] = await db.select().from(partnersTable).where(eq(partnersTable.legacyId, "VELIBIN1810001")).limit(1);
  if (existing && !force) {
    const [partnerCount] = await db.select({ count: sql<number>`count(*)` }).from(partnersTable);
    res.json({
      ok: true,
      skipped: true,
      message: "Network structure already seeded. Use ?force=true to re-seed.",
      partners: Number(partnerCount?.count ?? 0),
    });
    return;
  }

  if (force && existing) {
    // Remove previously seeded structure only. Real user accounts (isMock=false,
    // non-mock clerk ids) are never touched; referrals are left alone because
    // structure seeding no longer creates any.
    await db.delete(partnersTable).where(sql`legacy_id LIKE 'VEL%'`);
  }

  const results = { ibs: 0, subIbs: 0 };

  await db.transaction(async (tx) => {
    const partnerIdByCode = new Map<string, number>();

    // 1) Top-level IBs — zero balances, zero wallet, standard terms.
    for (const ib of IB_REGISTRY) {
      const clerkUserId = `mock_${ib.code.toLowerCase()}`;
      const [existingAcc] = await tx.select().from(accountsTable).where(eq(accountsTable.clerkUserId, clerkUserId));
      if (!existingAcc) {
        await tx.insert(accountsTable).values({
          clerkUserId,
          balance: "0.00",
          demoBalance: "10000.00",
          isDemoMode: false,
          currency: "USD",
          leverage: 100,
          accountType: "real",
          mockName: `[STRUCTURE] ${ib.name}`,
          mockEmail: `${ib.code.toLowerCase()}@structure.veloztrade.invalid`,
          isMock: true,
        });
      }
      const [partner] = await tx.insert(partnersTable).values({
        clerkUserId,
        name: ib.name,
        referralCode: ib.code,
        seededCapital: "0.00",
        cpaRate: "50.00",
        revSharePct: "0.3000",
        capitalUnlockedPct: 0,
        commissionWallet: "0.00",
        status: "active",
        legacyId: ib.legacyId,
        tier: "tier1",
      }).onConflictDoNothing().returning({ id: partnersTable.id });

      let pid = partner?.id;
      if (!pid) {
        const [existingRow] = await tx.select({ id: partnersTable.id }).from(partnersTable).where(eq(partnersTable.legacyId, ib.legacyId));
        pid = existingRow?.id;
      }
      if (pid) {
        partnerIdByCode.set(ib.code, pid);
        results.ibs++;
      }
    }

    // 2) Sub-IB desks with validated two-tier parent linkage.
    for (const sub of SUB_IB_REGISTRY) {
      const parentId = partnerIdByCode.get(sub.parentCode);
      if (!parentId) continue;
      const clerkUserId = `mock_${sub.code.toLowerCase()}`;
      const [existingAcc] = await tx.select().from(accountsTable).where(eq(accountsTable.clerkUserId, clerkUserId));
      if (!existingAcc) {
        await tx.insert(accountsTable).values({
          clerkUserId,
          balance: "0.00",
          demoBalance: "10000.00",
          isDemoMode: false,
          currency: "USD",
          leverage: 100,
          accountType: "real",
          mockName: `[STRUCTURE] ${sub.name}`,
          mockEmail: `${sub.code.toLowerCase()}@structure.veloztrade.invalid`,
          isMock: true,
        });
      }
      const [partner] = await tx.insert(partnersTable).values({
        clerkUserId,
        name: sub.name,
        referralCode: sub.code,
        seededCapital: "0.00",
        cpaRate: "30.00",
        revSharePct: "0.0000",
        capitalUnlockedPct: 0,
        commissionWallet: "0.00",
        status: "active",
        parentPartnerId: parentId,
        legacyId: sub.legacyId,
        tier: "tier1",
      }).onConflictDoNothing().returning({ id: partnersTable.id });
      if (partner?.id || !partner) {
        results.subIbs++;
      }
    }
  });

  res.json({
    ok: true,
    seeded: results,
    note: "Seeded network structure only: 13 IBs + 6 sub-IB desks, zero balances and empty wallets. No clients, commissions, balances or payouts were fabricated. Book aggregates from the handover (213 clients / $26.2M) remain reconciliation TARGETS to be met from verified legacy records.",
  });
});

export default router;
