import { db, transactionsTable, type NewTransaction } from "@workspace/db";

// Drizzle transaction executor type — same pattern used by routes/admin.ts
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbExecutor = typeof db | Tx;

export type LedgerEntry = Omit<NewTransaction, "id" | "createdAt">;

/**
 * Append an immutable row to the financial ledger. MUST be called inside the
 * same transaction as the balance mutation it describes so the ledger and the
 * balances stay consistent (all-or-nothing).
 *
 * `amount` is the signed delta applied to the account bucket:
 *   isDemo=false → accounts.balance, isDemo=true → accounts.demo_balance.
 */
export async function recordTransaction(
  exec: DbExecutor,
  entry: LedgerEntry,
): Promise<void> {
  await exec.insert(transactionsTable).values(entry);
}

/** Convenience wrapper for the common case: a signed USD amount as string. */
export function usd(n: number): string {
  return n.toFixed(2);
}
