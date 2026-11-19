-- Public /contact and /feedback submissions (2026-11-19). The row is written before the
-- notification email, so email_status records whether Resend accepted it.
-- drizzle-kit also emitted conversion_events here because 0009 had no snapshot; those
-- statements were removed (0009 already creates it). 0010_snapshot.json covers both tables.
CREATE TABLE "contact_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"topic" text,
	"rating" integer,
	"message" text NOT NULL,
	"page_path" text,
	"user_id" text,
	"email_status" text DEFAULT 'pending' NOT NULL,
	"email_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "contact_messages_created_idx" ON "contact_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "contact_messages_email_created_idx" ON "contact_messages" USING btree ("email","created_at");
