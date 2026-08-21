import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const walletAddressesTable = pgTable("wallet_addresses", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  walletAddress: text("wallet_address").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WalletAddress = typeof walletAddressesTable.$inferSelect;
