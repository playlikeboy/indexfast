ALTER TABLE "submission_jobs" ADD COLUMN "priority" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "submission_jobs" ADD COLUMN "http_status" integer;--> statement-breakpoint
ALTER TABLE "submission_jobs" ADD COLUMN "retry_after_at" timestamp;--> statement-breakpoint
ALTER TABLE "urls" ADD COLUMN "last_submitted_engine" text;--> statement-breakpoint
CREATE INDEX "submission_jobs_site_status_idx" ON "submission_jobs" USING btree ("site_id","status");