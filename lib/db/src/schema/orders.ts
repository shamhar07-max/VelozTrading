import { pgTable, serial, text, numeric, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { accountsTable } from "./accounts";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => accountsTable.id),
  clerkUserId: text("clerk_user_id").notNull(),
  symbol: text("symbol").notNull(),
  symbolName: text("symbol_name").notNull().default(""),
  direction: text("direction").notNull(),
  volume: numeric("volume", { precision: 18, scale: 2 }).notNull(),
  openPrice: numeric("open_price", { precision: 18, scale: 8 }).notNull(),
  closePrice: numeric("close_price", { precision: 18, scale: 8 }).notNull(),
  stopLoss: numeric("stop_loss", { precision: 18, scale: 8 }),
  takeProfit: numeric("take_profit", { precision: 18, scale: 8 }),
  profit: numeric("profit", { precision: 18, scale: 2 }).notNull(),
  swap: numeric("swap", { precision: 18, scale: 2 }).notNull().default("0"),
  commission: numeric("commission", { precision: 18, scale: 2 }).notNull().default("0"),
  openTime: timestamp("open_time", { withTimezone: true }).notNull(),
  closeTime: timestamp("close_time", { withTimezone: true }).notNull().defaultNow(),
  journalNote: text("journal_note"),
  strategyTag: text("strategy_tag"),
  sentimentRating: integer("sentiment_rating"),
}, (t) => [
  index("orders_clerk_user_id_idx").on(t.clerkUserId),
]);

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, closeTime: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
