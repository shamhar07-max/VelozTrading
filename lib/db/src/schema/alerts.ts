import { pgTable, serial, text, numeric, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const alertConditionEnum = pgEnum("alert_condition", ["above", "below"]);
export const alertStatusEnum = pgEnum("alert_status", ["active", "triggered", "cancelled"]);

export const alertsTable = pgTable("alerts", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  symbol: text("symbol").notNull(),
  targetPrice: numeric("target_price", { precision: 20, scale: 8 }).notNull(),
  condition: alertConditionEnum("condition").notNull(),
  status: alertStatusEnum("status").notNull().default("active"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  triggeredAt: timestamp("triggered_at", { withTimezone: true }),
}, (t) => [
  index("alerts_clerk_user_id_idx").on(t.clerkUserId),
]);

export const insertAlertSchema = createInsertSchema(alertsTable).omit({
  id: true,
  status: true,
  createdAt: true,
  triggeredAt: true,
});
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alertsTable.$inferSelect;
