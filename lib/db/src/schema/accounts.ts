import { pgTable, serial, text, numeric, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const accountsTable = pgTable("accounts", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  balance: numeric("balance", { precision: 18, scale: 2 }).notNull().default("0.00"),
  demoBalance: numeric("demo_balance", { precision: 18, scale: 2 }).notNull().default("10000.00"),
  isDemoMode: boolean("is_demo_mode").notNull().default(false),
  currency: text("currency").notNull().default("USD"),
  leverage: integer("leverage").notNull().default(100),
  accountType: text("account_type").notNull().default("real"),
  kycStatus: text("kyc_status").notNull().default("unverified"),
  kycDocFront: text("kyc_doc_front"),
  kycDocBack: text("kyc_doc_back"),
  kycDocSelfie: text("kyc_doc_selfie"),
  pushToken: text("push_token"),
  referralCode: text("referral_code"),
  referredByPartnerId: integer("referred_by_partner_id"),
  mockName: text("mock_name"),
  mockEmail: text("mock_email"),
  isMock: boolean("is_mock").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAccountSchema = createInsertSchema(accountsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accountsTable.$inferSelect;
