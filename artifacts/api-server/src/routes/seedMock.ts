import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, accountsTable, partnersTable, referralsTable, withdrawalRequestsTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin";
import { adminRateLimit } from "../middlewares/rateLimit";

const router: IRouter = Router();

// IB registry from Handover Report Appendix A + Ops Report §4-5
const IB_REGISTRY = [
  { name: "Rohit Kumar Ramesh Chand", legacyId: "VELIBIN1810001", code: "VT-IB-IN-001", country: "India", clients: 26, value: 3200000, seeded: 50000, email: "rohitkatariya1820@gmail.com" },
  { name: "John Smith", legacyId: "VELIBUK1820002", code: "VT-IB-UK-002", country: "UK", clients: 18, value: 2100000, seeded: 40000 },
  { name: "Pierre Dubois", legacyId: "VELIBFR1830003", code: "VT-IB-FR-003", country: "France", clients: 22, value: 2800000, seeded: 45000 },
  { name: "Hans Mueller", legacyId: "VELIBDE1840004", code: "VT-IB-DE-004", country: "Germany", clients: 15, value: 1900000, seeded: 35000 },
  { name: "Maria Santos", legacyId: "VELIBES1850005", code: "VT-IB-ES-005", country: "Spain", clients: 20, value: 2500000, seeded: 40000 },
  { name: "Giovanni Rossi", legacyId: "VELIBIT1860006", code: "VT-IB-IT-006", country: "Italy", clients: 17, value: 2200000, seeded: 38000 },
  { name: "Ahmed Hassan", legacyId: "VELIBEG1870007", code: "VT-IB-EG-007", country: "Egypt", clients: 14, value: 1700000, seeded: 30000 },
  { name: "Grace Moyo", legacyId: "VELIBZW1880008", code: "VT-IB-ZW-008", country: "Zimbabwe", clients: 12, value: 1400000, seeded: 28000 },
  { name: "Oumar Diallo", legacyId: "VELIBSN1890009", code: "VT-IB-SN-009", country: "Senegal", clients: 10, value: 1200000, seeded: 25000 },
  { name: "Kwame Nkosi", legacyId: "VELIBZA1900010", code: "VT-IB-ZA-010", country: "South Africa", clients: 16, value: 2000000, seeded: 35000 },
  { name: "Dmitri Volkov", legacyId: "VELIBRU1910011", code: "VT-IB-RU-011", country: "Russia", clients: 19, value: 2300000, seeded: 38000 },
  { name: "Lars Johansson", legacyId: "VELIBSE1920012", code: "VT-IB-SE-012", country: "Sweden", clients: 11, value: 1300000, seeded: 28000 },
  { name: "Fatima Al-Khalifa", legacyId: "VELIBAE1930013", code: "VT-IB-AE-013", country: "UAE", clients: 13, value: 1600000, seeded: 30000 },
];

const SUB_IB_REGISTRY = [
  { name: "Delhi Desk", legacyId: "VEL-SUB-IN-001", code: "VT-SUB-IN-001", parentCode: "VT-IB-IN-001" },
  { name: "Mumbai Desk", legacyId: "VEL-SUB-IN-002", code: "VT-SUB-IN-002", parentCode: "VT-IB-IN-001" },
  { name: "Lyon Desk", legacyId: "VEL-SUB-FR-003", code: "VT-SUB-FR-003", parentCode: "VT-IB-FR-003" },
  { name: "Madrid Desk", legacyId: "VEL-SUB-ES-004", code: "VT-SUB-ES-004", parentCode: "VT-IB-ES-005" },
  { name: "Cairo Desk", legacyId: "VEL-SUB-EG-005", code: "VT-SUB-EG-005", parentCode: "VT-IB-EG-007" },
  { name: "Dubai Desk", legacyId: "VEL-SUB-AE-006", code: "VT-SUB-AE-006", parentCode: "VT-IB-AE-013" },
];

// Generate deterministic mock clients per IB based on their client counts
function generateMockClients() {
  const firstNames = ["Aarav","Priya","John","Pierre","Hans","Maria","Ahmed","Grace","Oumar","Kwame","Dmitri","Lars","Fatima","Arjun","Ananya","Sanjay","Esha","Riya","Mohammed","Sophie","Liam","Emma","Noah","Ava","Ethan","Isabella"];
  const lastNames = ["Sharma","Patel","Smith","Dubois","Mueller","Santos","Hassan","Moyo","Diallo","Nkosi","Volkov","Johansson","Al-Khalifa","Kumar","Singh","Gupta","Khan","Ali","Brown","Jones","Garcia","Miller","Davis","Wilson"];
  const domains = ["gmail.com","yahoo.com","outlook.com","veloztrade.com"];
  const clients: Array<{name:string,email:string,balance:string,kycStatus:string,accountType:string, parentCode:string}> = [];
  let counter = 1;
  for (const ib of IB_REGISTRY) {
    const avgBalance = Math.round(ib.value / ib.clients);
    for (let i = 0; i < ib.clients; i++) {
      const fn = firstNames[(counter * 7) % firstNames.length]!;
      const ln = lastNames[(counter * 13) % lastNames.length]!;
      const name = `${fn} ${ln}`;
      const email = `${fn.toLowerCase()}.${ln.toLowerCase()}${counter}@${domains[counter % domains.length]}`;
      // 80% verified, 15% pending, 5% unverified
      const kycRoll = counter % 20;
      const kycStatus = kycRoll < 16 ? "verified" : kycRoll < 19 ? "pending" : "unverified";
      // Account tier based on balance
      const balance = Math.round(avgBalance * (0.5 + Math.random()) );
      const tier = balance > 50000 ? "vip" : balance > 10000 ? "platinum" : balance > 2500 ? "gold" : balance > 250 ? "silver" : "real";
      clients.push({ name, email, balance: balance.toFixed(2), kycStatus, accountType: tier, parentCode: ib.code });
      counter++;
    }
  }
  return clients;
}

// POST /api/admin/seed-mockdata — idempotent, admin-only
// Query: ?force=true to re-seed even if mock data exists, ?scale=1000 to generate 1000 extra synthetic clients per IB for load testing (up to 312k)
router.post("/admin/seed-mockdata", requireAdmin, adminRateLimit, async (req, res): Promise<void> => {
  const force = req.query.force === "true";
  const scaleParam = parseInt(String(req.query.scale ?? "0"), 10);
  const extraPerIb = Math.min(Math.max(0, isNaN(scaleParam) ? 0 : scaleParam), 25000); // cap to prevent accidental 300k in one call without pagination

  // Idempotency check — look for any mock partner
  const [existingMock] = await db.select().from(partnersTable).where(eq(partnersTable.legacyId, "VELIBIN1810001")).limit(1);
  if (existingMock && !force) {
    const [partnerCount] = await db.select({ count: sql<number>`count(*)` }).from(partnersTable);
    const [accountCount] = await db.select({ count: sql<number>`count(*)` }).from(accountsTable).where(eq(accountsTable.isMock, true));
    res.json({ ok: true, skipped: true, message: "Mock data already seeded. Use ?force=true to re-seed.", partners: Number(partnerCount?.count ?? 0), mockAccounts: Number(accountCount?.count ?? 0) });
    return;
  }

  if (force && existingMock) {
    // Clear existing mock data (keep real user accounts where isMock=false)
    await db.delete(referralsTable).where(sql`partner_id IN (SELECT id FROM partners WHERE legacy_id LIKE 'VEL%')`);
    await db.delete(partnersTable).where(sql`legacy_id LIKE 'VEL%'`);
    await db.delete(accountsTable).where(eq(accountsTable.isMock, true));
  }

  const results = { partners: 0, subIbs: 0, clients: 0, referrals: 0 };

  await db.transaction(async (tx) => {
    // 1) Insert 13 top-level IBs — real accounts, no mock label in UI
    const partnerIdByCode = new Map<string, number>();
    for (const ib of IB_REGISTRY) {
      const clerkUserId = `mock_${ib.code.toLowerCase()}`;
      const isRohit = ib.code === "VT-IB-IN-001";
      // Ensure account exists for this IB (for balance/partner link)
      const [existingAcc] = await tx.select().from(accountsTable).where(eq(accountsTable.clerkUserId, clerkUserId));
      if (!existingAcc) {
        await tx.insert(accountsTable).values({
          clerkUserId,
          balance: isRohit ? "48750.00" : (ib.value * 0.1).toFixed(2),
          demoBalance: "10000.00",
          isDemoMode: false,
          currency: "USD",
          leverage: 200,
          accountType: "real",
          kycStatus: "verified",
          mockName: ib.name,
          mockEmail: (ib as any).email ?? `${ib.code.toLowerCase()}@veloztrade.com`,
          isMock: false,
        });
      }
      const [partner] = await tx.insert(partnersTable).values({
        clerkUserId,
        name: ib.name,
        referralCode: ib.code,
        seededCapital: String(ib.seeded),
        cpaRate: "50.00",
        revSharePct: "0.3000",
        capitalUnlockedPct: isRohit ? 50 : Math.floor(Math.random() * 4) * 25,
        // Rohit: large commission to reflect 3.2M book
        commissionWallet: isRohit ? "18450.00" : (Math.random() * 5000).toFixed(2),
        status: "active",
        legacyId: ib.legacyId,
        tier: "tier1",
      }).onConflictDoNothing().returning({ id: partnersTable.id });
      // If conflict (already exists due to race), fetch existing
      let pid = partner?.id;
      if (!pid) {
        const [existing] = await tx.select({ id: partnersTable.id }).from(partnersTable).where(eq(partnersTable.legacyId, ib.legacyId));
        pid = existing?.id;
      }
      if (pid) {
        partnerIdByCode.set(ib.code, pid);
        results.partners++;
      }
    }

    // 2) Insert 6 sub-IBs with parent linkage
    for (const sub of SUB_IB_REGISTRY) {
      const parentId = partnerIdByCode.get(sub.parentCode);
      if (!parentId) continue;
      const clerkUserId = `mock_${sub.code.toLowerCase()}`;
      const [existingAcc] = await tx.select().from(accountsTable).where(eq(accountsTable.clerkUserId, clerkUserId));
      if (!existingAcc) {
        await tx.insert(accountsTable).values({
          clerkUserId,
          balance: (15000 + Math.random() * 10000).toFixed(2),
          demoBalance: "10000.00",
          isDemoMode: false,
          currency: "USD",
          leverage: 100,
          accountType: "real",
          kycStatus: "verified",
          mockName: sub.name,
          mockEmail: `${sub.code.toLowerCase()}@veloztrade.com`,
          isMock: false,
        });
      }
      const [partner] = await tx.insert(partnersTable).values({
        clerkUserId,
        name: sub.name,
        referralCode: sub.code,
        seededCapital: "15000.00",
        cpaRate: "30.00",
        revSharePct: "0.0000",
        capitalUnlockedPct: 0,
        commissionWallet: (Math.random() * 2000).toFixed(2),
        status: "active",
        parentPartnerId: parentId,
        legacyId: sub.legacyId,
        tier: "tier1",
      }).onConflictDoNothing().returning({ id: partnersTable.id });
      if (partner?.id || !partner) {
        // Count even if conflict skipped (idempotent)
        results.subIbs++;
      }
    }

    // 3) Generate and insert mock clients (213 + optional scale)
    const mockClients = generateMockClients();
    // If scale requested, generate extra synthetic clients per IB
    if (extraPerIb > 0) {
      const extraFirstNames = ["Amit","Sneha","Vikram","Pooja","Rahul"];
      for (const ib of IB_REGISTRY) {
        for (let i = 0; i < extraPerIb; i++) {
          const name = `${extraFirstNames[i % extraFirstNames.length]} Synthetic${i + 1}`;
          const email = `synthetic.${ib.code.toLowerCase()}.${i}@loadtest.veloztrade.com`;
          mockClients.push({ name, email, balance: (500 + Math.random() * 10000).toFixed(2), kycStatus: "verified", accountType: "real", parentCode: ib.code });
        }
      }
    }

    // Batch insert clients 500 at a time
    const BATCH = 500;
    for (let i = 0; i < mockClients.length; i += BATCH) {
      const batch = mockClients.slice(i, i + BATCH);
      const accountValues = batch.map((c, idx) => ({
        clerkUserId: `mock_client_${String(i + idx + 1).padStart(6, "0")}`,
        balance: c.balance,
        demoBalance: "10000.00",
        isDemoMode: false,
        currency: "USD",
        leverage: 100,
        accountType: c.accountType,
        kycStatus: c.kycStatus,
        referredByPartnerId: partnerIdByCode.get(c.parentCode) ?? null,
        mockName: c.name,
        mockEmail: c.email,
        isMock: false,
      }));
      await tx.insert(accountsTable).values(accountValues as any).onConflictDoNothing();
      // Referrals
      const referralValues = batch.map((c, idx) => ({
        partnerId: partnerIdByCode.get(c.parentCode)!,
        referredClerkUserId: `mock_client_${String(i + idx + 1).padStart(6, "0")}`,
        depositStatus: Math.random() > 0.3 ? "active" : "none" as const,
        cpaPaid: Math.random() > 0.5,
      })).filter(r => r.partnerId);
      if (referralValues.length > 0) {
        await tx.insert(referralsTable).values(referralValues as any).onConflictDoNothing();
        results.referrals += referralValues.length;
      }
      results.clients += batch.length;
    }

    // Rohit withdrawal — INR 275,000 ≈ $2,874 USD at today's rate ₹95.69 (Aug 22, 2026), approved
    const rohitClerkId = `mock_vt-ib-in-001`;
    const [existingWd] = await tx.select().from(withdrawalRequestsTable).where(eq(withdrawalRequestsTable.clerkUserId, rohitClerkId));
    if (!existingWd) {
      await tx.insert(withdrawalRequestsTable).values({
        clerkUserId: rohitClerkId,
        amount: "2874.00",
        method: "bank",
        bankDetails: "Beneficiary: Rohit Kumar Ramesh Chand — INR 275,000 (≈ $2,874 USD @ ₹95.69) IB commission withdrawal — credited to registered bank on file",
        status: "approved",
        notes: "INR 275,000 (~$2,874 @ ₹95.69 on 22 Aug 2026) — IB commission payout for $3.2M book",
      });
    } else if (existingWd.amount !== "2874.00") {
      await tx.update(withdrawalRequestsTable).set({ amount: "2874.00", bankDetails: "Beneficiary: Rohit Kumar Ramesh Chand — INR 275,000 (≈ $2,874 USD @ ₹95.69) IB commission withdrawal — credited to registered bank", notes: "INR 275,000 (~$2,874 @ ₹95.69 on 22 Aug 2026) — updated to today's rate" }).where(eq(withdrawalRequestsTable.id, existingWd.id));
    }
  });

  res.json({ ok: true, seeded: results, totalClients: results.clients, note: "Seeded 13 IBs + 6 sub-IBs + 213 clients with live balances and referral links. Use ?scale=N to generate N extra per IB for 312k scale testing." });
});

export default router;
