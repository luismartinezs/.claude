-- Greenfield: the subscriptions table as Pawacook ended up with it (0002 + 0003).
-- Prefer generating from the ported schema; this is for review and non-Drizzle targets.
CREATE TABLE "subscriptions" (
	"account_id" text PRIMARY KEY NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"status" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_customer_idx" ON "subscriptions" USING btree ("stripe_customer_id");
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "product_key" text;