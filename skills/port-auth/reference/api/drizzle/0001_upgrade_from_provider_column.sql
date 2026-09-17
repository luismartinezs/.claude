-- Hand-edited: the generated migration could not run against existing rows.
-- Accounts keep their data, provider columns move to identities, and live
-- sessions survive because their stored tokens are hashed in place.
CREATE TABLE "identities" (
	"provider" text NOT NULL,
	"subject" text NOT NULL,
	"account_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "identities_provider_subject_pk" PRIMARY KEY("provider","subject")
);
--> statement-breakpoint
CREATE TABLE "login_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "identities" ADD CONSTRAINT "identities_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
UPDATE "accounts" SET "email" = lower(trim("email"));--> statement-breakpoint
-- The former local stub stored "dev:<email>" as the Google subject; those become email identities.
INSERT INTO "identities" ("provider", "subject", "account_id", "created_at")
SELECT
	CASE WHEN "google_sub" LIKE 'dev:%' THEN 'email' ELSE 'google' END,
	CASE WHEN "google_sub" LIKE 'dev:%' THEN "email" ELSE "google_sub" END,
	"id",
	"created_at"
FROM "accounts";--> statement-breakpoint
DROP INDEX "accounts_google_sub_idx";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "google_sub";--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_email_idx" ON "accounts" USING btree ("email");--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "token_hash" text;--> statement-breakpoint
UPDATE "sessions" SET "token_hash" = encode(sha256(convert_to("id", 'UTF8')), 'hex');--> statement-breakpoint
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_pkey";--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "token_hash" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD PRIMARY KEY ("token_hash");--> statement-breakpoint
CREATE INDEX "identities_account_idx" ON "identities" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "login_tokens_expires_idx" ON "login_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sessions_account_idx" ON "sessions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");
