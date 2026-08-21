import { pgTable, serial, integer, text, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const referralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").notNull(),
  referredClerkUserId: text("referred_clerk_user_id").notNull(),
  depositStatus: text("deposit_status").notNull().default("none"),
  cpaPaid: boolean("cpa_paid").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("referrals_partner_user_uniq").on(t.partnerId, t.referredClerkUserId),
]);

export const insertReferralSchema = createInsertSchema(referralsTable).omit({ id: true, createdAt: true });
export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type Referral = typeof referralsTable.$inferSelect;
