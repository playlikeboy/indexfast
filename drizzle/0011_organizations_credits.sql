CREATE TABLE "credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" text,
	"site_id" uuid,
	"kind" text NOT NULL,
	"feature" text,
	"provider" text,
	"endpoint" text,
	"credits" integer NOT NULL,
	"provider_cost_micro_usd" integer DEFAULT 0 NOT NULL,
	"byok" boolean DEFAULT false NOT NULL,
	"ref" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"personal" boolean DEFAULT false NOT NULL,
	"credit_period" text,
	"monthly_credits" integer DEFAULT 0 NOT NULL,
	"purchased_credits" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"endpoint" text NOT NULL,
	"payload" jsonb NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"encrypted_secret" text NOT NULL,
	"label" text,
	"last_validated_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"keyword" text NOT NULL,
	"location_code" integer NOT NULL,
	"language_code" text NOT NULL,
	"search_volume" integer,
	"cpc" text,
	"competition" text,
	"keyword_difficulty" integer,
	"intent" text,
	"monthly_searches" jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metrics_at" timestamp,
	"created_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_credentials" ADD CONSTRAINT "provider_credentials_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_keywords" ADD CONSTRAINT "saved_keywords_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_keywords" ADD CONSTRAINT "saved_keywords_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_ledger_org_created_idx" ON "credit_ledger" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_org_ref_unique_idx" ON "credit_ledger" USING btree ("organization_id","ref");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_members_org_user_unique_idx" ON "organization_members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "organization_members_user_idx" ON "organization_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "organizations_owner_idx" ON "organizations" USING btree ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_personal_owner_unique_idx" ON "organizations" USING btree ("owner_user_id") WHERE "organizations"."personal" = true;--> statement-breakpoint
CREATE INDEX "provider_cache_expires_idx" ON "provider_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_credentials_org_provider_unique_idx" ON "provider_credentials" USING btree ("organization_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_keywords_site_kw_unique_idx" ON "saved_keywords" USING btree ("site_id","keyword","location_code","language_code");--> statement-breakpoint
CREATE INDEX "saved_keywords_org_idx" ON "saved_keywords" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sites_organization_idx" ON "sites" USING btree ("organization_id");--> statement-breakpoint
-- Backfill (additive, idempotent): one personal organization per existing user, its owner
-- membership, and every site attached to its creator's personal organization.
INSERT INTO "organizations" ("name", "owner_user_id", "personal")
SELECT 'Personal', u."id", true FROM "users" u
WHERE NOT EXISTS (SELECT 1 FROM "organizations" o WHERE o."owner_user_id" = u."id" AND o."personal" = true);--> statement-breakpoint
INSERT INTO "organization_members" ("organization_id", "user_id", "role")
SELECT o."id", o."owner_user_id", 'owner' FROM "organizations" o WHERE o."personal" = true
ON CONFLICT ("organization_id", "user_id") DO NOTHING;--> statement-breakpoint
UPDATE "sites" s SET "organization_id" = o."id"
FROM "organizations" o
WHERE s."organization_id" IS NULL AND o."owner_user_id" = s."user_id" AND o."personal" = true;
