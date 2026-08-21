import { pgTable, integer, text, timestamp } from "drizzle-orm/pg-core";

export const depositScanStateTable = pgTable("deposit_scan_state", {
  chainId: integer("chain_id").primaryKey(),
  lastScannedBlock: text("last_scanned_block").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type DepositScanState = typeof depositScanStateTable.$inferSelect;
