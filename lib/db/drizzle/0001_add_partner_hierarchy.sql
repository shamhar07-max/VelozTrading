ALTER TABLE "partners" ADD COLUMN "parent_partner_id" integer REFERENCES "partners"("id");--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "legacy_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "partners_legacy_id_unique" ON "partners" ("legacy_id");--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "tier" text DEFAULT 'tier1' NOT NULL;--> statement-breakpoint
CREATE INDEX "partners_parent_idx" ON "partners" ("parent_partner_id");--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "mock_name" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "mock_email" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "is_mock" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "accounts_is_mock_idx" ON "accounts" ("is_mock");--> statement-breakpoint
