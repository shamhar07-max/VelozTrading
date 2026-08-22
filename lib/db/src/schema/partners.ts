import { pgTable, serial, text, numeric, integer, timestamp, type AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const partnersTable = pgTable("partners", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  name: text("name").notNull(),
  referralCode: text("referral_code").notNull().unique(),
  seededCapital: numeric("seeded_capital", { precision: 18, scale: 2 }).notNull().default("0.00"),
  cpaRate: numeric("cpa_rate", { precision: 10, scale: 2 }).notNull().default("50.00"),
  revSharePct: numeric("rev_share_pct", { precision: 5, scale: 4 }).notNull().default("0.3000"),
  capitalUnlockedPct: integer("capital_unlocked_pct").notNull().default(0),
  commissionWallet: numeric("commission_wallet", { precision: 18, scale: 2 }).notNull().default("0.00"),
  // Lifecycle: applied | vetting | active | suspended | terminated | dormant (VEL-IB-SPEC-2026-R1 §8)
  status: text("status").notNull().default("applied"),
  // Sub-IB hierarchy — null for top-level IBs, points to parent IB for sub-desks (Ops Report §5)
  parentPartnerId: integer("parent_partner_id").references((): AnyPgColumn => partnersTable.id),
  legacyId: text("legacy_id").unique(),
  tier: text("tier").notNull().default("tier1"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPartnerSchema = createInsertSchema(partnersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPartner = z.infer<typeof insertPartnerSchema>;
export type Partner = typeof partnersTable.$inferSelect;
