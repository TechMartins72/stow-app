CREATE TYPE "public"."lock_status" AS ENUM('active', 'released', 'exited');--> statement-breakpoint
CREATE TABLE "action_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"actor" text NOT NULL,
	"kind" text NOT NULL,
	"asset_id" text NOT NULL,
	"symbol" text NOT NULL,
	"notional_usd" numeric(38, 18) NOT NULL,
	"outcome" text NOT NULL,
	"violations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"gateway_ref" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "action_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "guardrails" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"max_daily_spend_usd" numeric(38, 18),
	"max_single_trade_usd" numeric(38, 18),
	"allowed_asset_ids" text[],
	"allow_perps" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guardrails" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "locks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"asset_id" text NOT NULL,
	"symbol" text NOT NULL,
	"amount" numeric(38, 18) NOT NULL,
	"unlock_at" timestamp with time zone NOT NULL,
	"schedule" jsonb,
	"status" "lock_status" DEFAULT 'active' NOT NULL,
	"goal_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"released_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "locks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"gateway_user_id" text,
	"risk_profile" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_gateway_user_id_unique" UNIQUE("gateway_user_id")
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "action_log" ADD CONSTRAINT "action_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardrails" ADD CONSTRAINT "guardrails_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locks" ADD CONSTRAINT "locks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_log_user_at_idx" ON "action_log" USING btree ("user_id","at");--> statement-breakpoint
CREATE INDEX "locks_user_status_idx" ON "locks" USING btree ("user_id","status");