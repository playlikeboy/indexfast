CREATE TABLE "engine_quota_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quota_key" text NOT NULL,
	"window" text NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "engine_quota_usage_key_window_unique_idx" ON "engine_quota_usage" USING btree ("quota_key","window");--> statement-breakpoint
CREATE INDEX "engine_quota_usage_updated_idx" ON "engine_quota_usage" USING btree ("updated_at");