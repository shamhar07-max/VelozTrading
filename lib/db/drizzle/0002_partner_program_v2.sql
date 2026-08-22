-- VEL-IB-SPEC-2026-R1: commission-run lifecycle for the rebuilt IB/Sub-IB programme.
-- partner_commissions becomes a pending→approved ledger; legacy rows were credited
-- instantly under the old program and are grandfathered as approved.
ALTER TABLE "partner_commissions" ADD COLUMN "state" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_commissions" ADD COLUMN "run_month" text;--> statement-breakpoint
ALTER TABLE "partner_commissions" ADD COLUMN "lots" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "partner_commissions" ADD COLUMN "reason" text;--> statement-breakpoint
UPDATE "partner_commissions" SET "state" = 'approved';--> statement-breakpoint
CREATE INDEX "partner_commissions_state_idx" ON "partner_commissions" ("state");--> statement-breakpoint
CREATE INDEX "partner_commissions_partner_state_idx" ON "partner_commissions" ("partner_id", "state");
