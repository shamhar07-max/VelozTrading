import { pgTable, serial, text, numeric, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";

// Immutable financial ledger — one row per balance mutation (Peatio-style
// AccountVersion pattern). Balances in `accounts` remain the live value; this
// table is the append-only audit trail used for reconciliation, statements,
// and dispute investigation. Rows are never updated or deleted.
//
// `amount` is the signed delta applied to the account (positive = credit).
// The affected bucket is identified by isDemo + the balance column that moved:
//   - isDemo=false → accounts.balance
//   - isDemo=true  → accounts.demo_balance
export const transactionsTable = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    accountId: integer("account_id"),
    // deposit | deposit_crypto | withdrawal_hold | withdrawal_refund |
    // trade_commission | trade_close | swap_accrual | stop_out |
    // partner_cpa | partner_rev_share | admin_adjustment | bootstrap_seed
    type: text("type").notNull(),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    balanceAfter: numeric("balance_after", { precision: 18, scale: 2 }),
    currency: text("currency").notNull().default("USD"),
    isDemo: boolean("is_demo").notNull().default(false),
    // Source record that produced this movement, e.g. 'deposit_request',
    // 'crypto_deposit', 'withdrawal_request', 'position', 'order'
    refType: text("ref_type"),
    refId: integer("ref_id"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("transactions_user_created_idx").on(table.clerkUserId, table.createdAt),
    index("transactions_ref_idx").on(table.refType, table.refId),
  ],
);

export type Transaction = typeof transactionsTable.$inferSelect;
export type NewTransaction = typeof transactionsTable.$inferInsert;
