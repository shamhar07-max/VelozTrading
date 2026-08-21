import { pgTable, serial, text, numeric, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { accountsTable } from "./accounts";

export const positionsTable = pgTable("positions", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => accountsTable.id),
  clerkUserId: text("clerk_user_id").notNull(),
  symbol: text("symbol").notNull(),
  symbolName: text("symbol_name").notNull().default(""),
  direction: text("direction").notNull(),
  volume: numeric("volume", { precision: 18, scale: 2 }).notNull(),
  openPrice: numeric("open_price", { precision: 18, scale: 8 }).notNull(),
  stopLoss: numeric("stop_loss", { precision: 18, scale: 8 }),
  takeProfit: numeric("take_profit", { precision: 18, scale: 8 }),
  swap: numeric("swap", { precision: 18, scale: 2 }).notNull().default("0"),
  commission: numeric("commission", { precision: 18, scale: 2 }).notNull().default("0"),
  isDemo: boolean("is_demo").notNull().default(false),
  openTime: timestamp("open_time", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("positions_clerk_user_id_idx").on(t.clerkUserId),
]);

export const insertPositionSchema = createInsertSchema(positionsTable).omit({ id: true, openTime: true });
export type InsertPosition = z.infer<typeof insertPositionSchema>;
export type Position = typeof positionsTable.$inferSelect;
