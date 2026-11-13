-- Conversion events for outreach attribution (2026-11-13).
-- Named funnel events only: landing_viewed, tool_used, account_created, trial_started.
-- No PII: batch is a send date (YYYYMMDD), lead_key is an 8-hex hash of the lead's
-- email (computed by the outreach side; the site never sees the email), visitor_hash
-- is the same daily-rotating hash the page_views beacon already uses (NULL for the
-- server-side trial_started event, which has no browser visitor).
-- "trial_started" = first paid-plan activation: IndexFast has no free-trial period
-- (Free is $0 forever; Pro/Unlimited are prepaid 30-day purchases), so the first
-- time a user activates a paid plan is the trial-start equivalent.
-- NOTE: this migration was hand-written (no drizzle-kit snapshot). Before the next
-- `bunx drizzle-kit generate`, see drizzle/meta/README.md.
CREATE TABLE "conversion_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event" text NOT NULL,
	"path" text NOT NULL,
	"visitor_hash" text,
	"user_id" text,
	"batch" text,
	"lead_key" text,
	"stage" text,
	"country" text,
	"device" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "conversion_events_event_created_idx" ON "conversion_events" USING btree ("event","created_at");--> statement-breakpoint
CREATE INDEX "conversion_events_batch_lead_idx" ON "conversion_events" USING btree ("batch","lead_key","event");--> statement-breakpoint
CREATE INDEX "conversion_events_user_idx" ON "conversion_events" USING btree ("user_id","event");
