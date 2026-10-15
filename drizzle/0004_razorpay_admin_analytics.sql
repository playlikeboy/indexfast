CREATE TABLE "cron_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"summary" jsonb,
	"error_message" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "page_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" text NOT NULL,
	"referrer" text,
	"country" text,
	"device" text,
	"visitor_hash" text NOT NULL,
	"user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"provider" text DEFAULT 'razorpay' NOT NULL,
	"order_id" text NOT NULL,
	"payment_id" text,
	"plan" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'created' NOT NULL,
	"period_start" timestamp,
	"period_end" timestamp,
	"failure_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sitemaps" ADD COLUMN "url_count" integer;--> statement-breakpoint
ALTER TABLE "sitemaps" ADD COLUMN "new_count" integer;--> statement-breakpoint
ALTER TABLE "sitemaps" ADD COLUMN "changed_count" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_seen_at" timestamp;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cron_runs_started_idx" ON "cron_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "page_views_created_idx" ON "page_views" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "page_views_path_created_idx" ON "page_views" USING btree ("path","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_order_unique_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_user_created_idx" ON "payments" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "payments_status_created_idx" ON "payments" USING btree ("status","created_at");--> statement-breakpoint
-- Collapse pre-existing duplicate open jobs so the partial unique index below can be built.
DELETE FROM "submission_jobs" a USING "submission_jobs" b WHERE a."site_id" = b."site_id" AND a."loc" = b."loc" AND a."engine" = b."engine" AND a."status" in ('queued', 'processing') AND b."status" in ('queued', 'processing') AND a."created_at" > b."created_at";--> statement-breakpoint
DELETE FROM "submission_jobs" a USING "submission_jobs" b WHERE a."site_id" = b."site_id" AND a."loc" = b."loc" AND a."engine" = b."engine" AND a."status" in ('queued', 'processing') AND b."status" in ('queued', 'processing') AND a."created_at" = b."created_at" AND a."id"::text > b."id"::text;--> statement-breakpoint
CREATE UNIQUE INDEX "submission_jobs_open_unique_idx" ON "submission_jobs" USING btree ("site_id","loc","engine") WHERE "submission_jobs"."status" in ('queued', 'processing');