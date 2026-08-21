import { pgTable, serial, text, numeric, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { accountsTable } from "./accounts";

export const pendingOrdersTable = pgTable("pending_orders", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => accountsTable.id),
  clerkUserId: text("clerk_user_id").notNull(),
  symbol: text("symbol").notNull(),
  symbolName: text("symbol_name").notNull().default(""),
  direction: text("direction").notNull(),
  orderType: text("order_type").notNull().default("buy_limit"),
  volume: numeric("volume", { precision: 18, scale: 2 }).notNull(),
  limitPrice: numeric("limit_price", { precision: 18, scale: 8 }).notNull(),
  stopPrice: numeric("stop_price", { precision: 18, scale: 8 }),
  trailingDistance: numeric("trailing_distance", { precision: 18, scale: 8 }),
  trailingPeak: numeric("trailing_peak", { precision: 18, scale: 8 }),
  stopLoss: numeric("stop_loss", { precision: 18, scale: 8 }),
  takeProfit: numeric("take_profit", { precision: 18, scale: 8 }),
  marginReserved: numeric("margin_reserved", { precision: 18, scale: 2 }).notNull().default("0"),
  isDemo: boolean("is_demo").notNull().default(false),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("pending_orders_clerk_user_id_idx").on(t.clerkUserId),
  index("pending_orders_status_idx").on(t.status),
]);

export const insertPendingOrderSchema = createInsertSchema(pendingOrdersTable).omit({ id: true, createdAt: true });
export type InsertPendingOrder = z.infer<typeof insertPendingOrderSchema>;
export type PendingOrder = typeof pendingOrdersTable.$inferSelect;
