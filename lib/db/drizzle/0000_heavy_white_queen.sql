CREATE TYPE "public"."alert_condition" AS ENUM('above', 'below');--> statement-breakpoint
CREATE TYPE "public"."alert_status" AS ENUM('active', 'triggered', 'cancelled');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"balance" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"demo_balance" numeric(18, 2) DEFAULT '10000.00' NOT NULL,
	"is_demo_mode" boolean DEFAULT false NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"leverage" integer DEFAULT 100 NOT NULL,
	"account_type" text DEFAULT 'real' NOT NULL,
	"kyc_status" text DEFAULT 'unverified' NOT NULL,
	"kyc_doc_front" text,
	"kyc_doc_back" text,
	"kyc_doc_selfie" text,
	"push_token" text,
	"referral_code" text,
	"referred_by_partner_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"clerk_user_id" text NOT NULL,
	"symbol" text NOT NULL,
	"symbol_name" text DEFAULT '' NOT NULL,
	"direction" text NOT NULL,
	"volume" numeric(18, 2) NOT NULL,
	"open_price" numeric(18, 8) NOT NULL,
	"stop_loss" numeric(18, 8),
	"take_profit" numeric(18, 8),
	"swap" numeric(18, 2) DEFAULT '0' NOT NULL,
	"commission" numeric(18, 2) DEFAULT '0' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"open_time" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"clerk_user_id" text NOT NULL,
	"symbol" text NOT NULL,
	"symbol_name" text DEFAULT '' NOT NULL,
	"direction" text NOT NULL,
	"volume" numeric(18, 2) NOT NULL,
	"open_price" numeric(18, 8) NOT NULL,
	"close_price" numeric(18, 8) NOT NULL,
	"stop_loss" numeric(18, 8),
	"take_profit" numeric(18, 8),
	"profit" numeric(18, 2) NOT NULL,
	"swap" numeric(18, 2) DEFAULT '0' NOT NULL,
	"commission" numeric(18, 2) DEFAULT '0' NOT NULL,
	"open_time" timestamp with time zone NOT NULL,
	"close_time" timestamp with time zone DEFAULT now() NOT NULL,
	"journal_note" text,
	"strategy_tag" text,
	"sentiment_rating" integer
);
--> statement-breakpoint
CREATE TABLE "pending_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"clerk_user_id" text NOT NULL,
	"symbol" text NOT NULL,
	"symbol_name" text DEFAULT '' NOT NULL,
	"direction" text NOT NULL,
	"order_type" text DEFAULT 'buy_limit' NOT NULL,
	"volume" numeric(18, 2) NOT NULL,
	"limit_price" numeric(18, 8) NOT NULL,
	"stop_price" numeric(18, 8),
	"trailing_distance" numeric(18, 8),
	"trailing_peak" numeric(18, 8),
	"stop_loss" numeric(18, 8),
	"take_profit" numeric(18, 8),
	"margin_reserved" numeric(18, 2) DEFAULT '0' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"symbol" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watchlist_user_symbol_unique" UNIQUE("clerk_user_id","symbol")
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"symbol" text NOT NULL,
	"target_price" numeric(20, 8) NOT NULL,
	"condition" "alert_condition" NOT NULL,
	"status" "alert_status" DEFAULT 'active' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"triggered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "deposit_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"method" text DEFAULT 'card' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"payment_proof" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "withdrawal_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"method" text DEFAULT 'bank' NOT NULL,
	"bank_details" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "crypto_deposits" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"tx_hash" text NOT NULL,
	"from_wallet" text NOT NULL,
	"chain_id" integer NOT NULL,
	"amount_usdt" numeric(18, 6) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"credited_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crypto_deposits_tx_hash_unique" UNIQUE("tx_hash")
);
--> statement-breakpoint
CREATE TABLE "wallet_addresses" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"wallet_address" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_addresses_wallet_address_unique" UNIQUE("wallet_address")
);
--> statement-breakpoint
CREATE TABLE "deposit_scan_state" (
	"chain_id" integer PRIMARY KEY NOT NULL,
	"last_scanned_block" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_snapshots" (
	"symbol" text PRIMARY KEY NOT NULL,
	"price" numeric(24, 8) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"content" text NOT NULL,
	"symbol" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"name" text NOT NULL,
	"referral_code" text NOT NULL,
	"seeded_capital" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"cpa_rate" numeric(10, 2) DEFAULT '50.00' NOT NULL,
	"rev_share_pct" numeric(5, 4) DEFAULT '0.3000' NOT NULL,
	"capital_unlocked_pct" integer DEFAULT 0 NOT NULL,
	"commission_wallet" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partners_clerk_user_id_unique" UNIQUE("clerk_user_id"),
	CONSTRAINT "partners_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" serial PRIMARY KEY NOT NULL,
	"partner_id" integer NOT NULL,
	"referred_clerk_user_id" text NOT NULL,
	"deposit_status" text DEFAULT 'none' NOT NULL,
	"cpa_paid" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referrals_partner_user_uniq" UNIQUE("partner_id","referred_clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "partner_commissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"partner_id" integer NOT NULL,
	"source_type" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"ref_position_id" integer,
	"ref_clerk_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"account_id" integer,
	"type" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"balance_after" numeric(18, 2),
	"currency" text DEFAULT 'USD' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"ref_type" text,
	"ref_id" integer,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_orders" ADD CONSTRAINT "pending_orders_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "positions_clerk_user_id_idx" ON "positions" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "orders_clerk_user_id_idx" ON "orders" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "pending_orders_clerk_user_id_idx" ON "pending_orders" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "pending_orders_status_idx" ON "pending_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "alerts_clerk_user_id_idx" ON "alerts" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "social_posts_clerk_user_id_idx" ON "social_posts" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "transactions_user_created_idx" ON "transactions" USING btree ("clerk_user_id","created_at");--> statement-breakpoint
CREATE INDEX "transactions_ref_idx" ON "transactions" USING btree ("ref_type","ref_id");