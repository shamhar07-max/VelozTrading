import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const partnerCommissionsTable = pgTable("partner_commissions", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").notNull(),
  sourceType: text("source_type").notNull(),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  refPositionId: integer("ref_position_id"),
  refClerkUserId: text("ref_clerk_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPartnerCommissionSchema = createInsertSchema(partnerCommissionsTable).omit({ id: true, createdAt: true });
export type InsertPartnerCommission = z.infer<typeof insertPartnerCommissionSchema>;
export type PartnerCommission = typeof partnerCommissionsTable.$inferSelect;
