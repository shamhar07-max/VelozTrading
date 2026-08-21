import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";

export const cryptoDepositsTable = pgTable("crypto_deposits", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  txHash: text("tx_hash").notNull().unique(),
  fromWallet: text("from_wallet").notNull(),
  chainId: integer("chain_id").notNull(),
  amountUsdt: numeric("amount_usdt", { precision: 18, scale: 6 }).notNull(),
  status: text("status").notNull().default("pending"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  creditedAt: timestamp("credited_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CryptoDeposit = typeof cryptoDepositsTable.$inferSelect;
