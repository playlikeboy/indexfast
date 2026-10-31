ALTER TABLE "submission_jobs" ADD COLUMN "throttle_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "api_usage_events_created_idx" ON "api_usage_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "submission_jobs_queued_claim_idx" ON "submission_jobs" USING btree ("priority","next_run_at","created_at") WHERE "submission_jobs"."status" = 'queued';--> statement-breakpoint
CREATE INDEX "submissions_created_idx" ON "submissions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "urls_site_created_idx" ON "urls" USING btree ("site_id","created_at");