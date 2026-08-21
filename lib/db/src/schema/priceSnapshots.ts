import { pgTable, text, numeric, timestamp } from "drizzle-orm/pg-core";

export const priceSnapshotsTable = pgTable("price_snapshots", {
  symbol: text("symbol").primaryKey(),
  price: numeric("price", { precision: 24, scale: 8 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type PriceSnapshot = typeof priceSnapshotsTable.$inferSelect;
