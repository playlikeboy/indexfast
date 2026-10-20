import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, integer, boolean, uuid, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";

// Users table mapping to Stack Auth profiles.
// Entitlement = billingTier + planExpiresAt. A null planExpiresAt on a paid tier means a
// legacy Dodo subscription whose lifecycle is driven by Dodo webhooks, not by expiry.
export const users = pgTable(
	"users",
	{
		id: text("id").primaryKey(), // Stack Auth user ID
		email: text("email").notNull(),
		billingTier: text("billing_tier").default("free").notNull(), // 'free', 'pro', 'unlimited' (+ hidden legacy: 'indie', 'growth', 'agency', 'scale')
		planExpiresAt: timestamp("plan_expires_at"), // End of the prepaid Razorpay period; see docs/billing.md for the grace policy
		lastSeenAt: timestamp("last_seen_at"), // Throttled dashboard activity marker for admin analytics
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [index("users_email_idx").on(table.email)],
);

// Razorpay payment ledger. One row per checkout order; the row is the source of truth for
// which period a payment bought, so activation is idempotent across the client verify call
// and the webhook (whichever arrives first wins via a conditional status update).
export const payments = pgTable(
	"payments",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.references(() => users.id, { onDelete: "cascade" })
			.notNull(),
		provider: text("provider").default("razorpay").notNull(),
		orderId: text("order_id").notNull(),
		paymentId: text("payment_id"),
		plan: text("plan").notNull(), // 'pro' | 'unlimited'
		amount: integer("amount").notNull(), // Minor currency units (cents / paise)
		currency: text("currency").notNull(),
		status: text("status").default("created").notNull(), // 'created', 'paid', 'failed', 'refunded'
		periodStart: timestamp("period_start"),
		periodEnd: timestamp("period_end"),
		failureReason: text("failure_reason"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("payments_order_unique_idx").on(table.orderId),
		index("payments_user_created_idx").on(table.userId, table.createdAt),
		index("payments_status_created_idx").on(table.status, table.createdAt),
	],
);

// First-party, cookie-less page view analytics for the admin panel. visitorHash is a
// daily-rotating SHA-256 of ip+ua so we can count uniques without storing PII.
export const pageViews = pgTable(
	"page_views",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		path: text("path").notNull(),
		referrer: text("referrer"), // Referrer host only, never the full URL
		country: text("country"),
		device: text("device"), // 'mobile' | 'desktop' | 'tablet'
		visitorHash: text("visitor_hash").notNull(),
		userId: text("user_id"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("page_views_created_idx").on(table.createdAt),
		index("page_views_path_created_idx").on(table.path, table.createdAt),
	],
);

// One row per scheduled automation run so the admin panel can prove the cron is alive.
export const cronRuns = pgTable(
	"cron_runs",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		status: text("status").default("running").notNull(), // 'running', 'success', 'failed'
		summary: jsonb("summary"),
		errorMessage: text("error_message"),
		startedAt: timestamp("started_at").defaultNow().notNull(),
		finishedAt: timestamp("finished_at"),
	},
	(table) => [index("cron_runs_started_idx").on(table.startedAt)],
);

// Hashed IndexFast API keys for REST, MCP, and CLI access
export const apiKeys = pgTable(
	"api_keys",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.references(() => users.id, { onDelete: "cascade" })
			.notNull(),
		name: text("name").notNull(),
		keyPrefix: text("key_prefix").notNull(),
		keyHash: text("key_hash").notNull(),
		scopes: jsonb("scopes").notNull(),
		status: text("status").default("active").notNull(), // 'active', 'revoked'
		lastUsedAt: timestamp("last_used_at"),
		expiresAt: timestamp("expires_at"),
		revokedAt: timestamp("revoked_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("api_keys_user_id_idx").on(table.userId),
		index("api_keys_status_idx").on(table.status),
		uniqueIndex("api_keys_key_hash_unique_idx").on(table.keyHash),
	],
);

// API/MCP/CLI usage events for billing gates, debugging, and audit history
export const apiUsageEvents = pgTable(
	"api_usage_events",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		apiKeyId: uuid("api_key_id").references(() => apiKeys.id, { onDelete: "set null" }),
		userId: text("user_id")
			.references(() => users.id, { onDelete: "cascade" })
			.notNull(),
		method: text("method").notNull(),
		route: text("route").notNull(),
		statusCode: integer("status_code").notNull(),
		metadata: jsonb("metadata"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("api_usage_events_user_created_idx").on(table.userId, table.createdAt),
		index("api_usage_events_key_created_idx").on(table.apiKeyId, table.createdAt),
	],
);

// DodoPayments customer records mapped to Stack users
export const billingCustomers = pgTable(
	"billing_customers",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.references(() => users.id, { onDelete: "cascade" })
			.notNull(),
		dodoCustomerId: text("dodo_customer_id").notNull(),
		email: text("email").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("billing_customers_user_unique_idx").on(table.userId),
		uniqueIndex("billing_customers_dodo_customer_unique_idx").on(table.dodoCustomerId),
	],
);

// Active and historical subscription state from DodoPayments webhooks
export const subscriptions = pgTable(
	"subscriptions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.references(() => users.id, { onDelete: "cascade" })
			.notNull(),
		dodoSubscriptionId: text("dodo_subscription_id").notNull(),
		dodoProductId: text("dodo_product_id"),
		plan: text("plan").default("free").notNull(), // 'free', 'indie', 'growth', 'agency', 'scale'
		status: text("status").default("inactive").notNull(),
		currentPeriodStart: timestamp("current_period_start"),
		currentPeriodEnd: timestamp("current_period_end"),
		cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("subscriptions_user_id_idx").on(table.userId),
		index("subscriptions_status_idx").on(table.status),
		uniqueIndex("subscriptions_dodo_subscription_unique_idx").on(table.dodoSubscriptionId),
	],
);

// Raw Dodo webhook event ledger for idempotency and debugging
export const billingEvents = pgTable(
	"billing_events",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		eventId: text("event_id").notNull(),
		eventType: text("event_type").notNull(),
		userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
		payload: jsonb("payload").notNull(),
		processedAt: timestamp("processed_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("billing_events_event_unique_idx").on(table.eventId),
		index("billing_events_user_created_idx").on(table.userId, table.createdAt),
	],
);

// Websites being monitored by users
export const sites = pgTable(
	"sites",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.references(() => users.id, { onDelete: "cascade" })
			.notNull(),
		domain: text("domain").notNull(), // e.g., 'example.com'
		indexingHost: text("indexing_host"), // Exact host used for IndexNow, preserving www when present
		name: text("name").notNull(), // e.g., 'Example Blog'
		verified: boolean("verified").default(false).notNull(),
		automationEnabled: boolean("automation_enabled").default(false).notNull(),
		verificationToken: text("verification_token").notNull(),
		sitemapUrl: text("sitemap_url"), // Main monitored sitemap URL
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("sites_user_id_idx").on(table.userId),
		uniqueIndex("sites_user_domain_unique_idx").on(table.userId, table.domain),
	],
);

// Configured sitemap sources for each site
export const siteSitemaps = pgTable(
	"site_sitemaps",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		siteId: uuid("site_id")
			.references(() => sites.id, { onDelete: "cascade" })
			.notNull(),
		url: text("url").notNull(),
		isPrimary: boolean("is_primary").default(false).notNull(),
		status: text("status").default("active").notNull(), // 'active', 'disabled', 'failed'
		lastDiscoveredAt: timestamp("last_discovered_at"),
		lastSyncAt: timestamp("last_sync_at"),
		lastErrorAt: timestamp("last_error_at"),
		lastErrorMessage: text("last_error_message"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("site_sitemaps_site_id_idx").on(table.siteId),
		index("site_sitemaps_site_primary_idx").on(table.siteId, table.isPrimary),
		uniqueIndex("site_sitemaps_site_url_unique_idx").on(table.siteId, table.url),
	],
);

// Per-site integrations such as IndexNow verification and automation state
export const siteIntegrations = pgTable(
	"site_integrations",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		siteId: uuid("site_id")
			.references(() => sites.id, { onDelete: "cascade" })
			.notNull(),
		provider: text("provider").notNull(), // 'indexnow'
		status: text("status").default("pending").notNull(), // 'pending', 'verified', 'failed', 'disabled'
		encryptedSecret: text("encrypted_secret"),
		publicConfig: jsonb("public_config"),
		automationEnabled: boolean("automation_enabled").default(false).notNull(),
		verifiedAt: timestamp("verified_at"),
		lastCheckedAt: timestamp("last_checked_at"),
		lastErrorAt: timestamp("last_error_at"),
		lastErrorMessage: text("last_error_message"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("site_integrations_site_id_idx").on(table.siteId),
		index("site_integrations_site_status_idx").on(table.siteId, table.status),
		uniqueIndex("site_integrations_site_provider_unique_idx").on(table.siteId, table.provider),
	],
);

// Per-user credentials for optional direct search engine APIs
export const userIntegrations = pgTable(
	"user_integrations",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.references(() => users.id, { onDelete: "cascade" })
			.notNull(),
		provider: text("provider").notNull(), // 'bing'
		status: text("status").default("pending").notNull(), // 'pending', 'verified', 'failed', 'disabled'
		encryptedSecret: text("encrypted_secret").notNull(),
		publicConfig: jsonb("public_config"),
		verifiedAt: timestamp("verified_at"),
		lastCheckedAt: timestamp("last_checked_at"),
		lastErrorAt: timestamp("last_error_at"),
		lastErrorMessage: text("last_error_message"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("user_integrations_user_id_idx").on(table.userId),
		index("user_integrations_user_status_idx").on(table.userId, table.status),
		uniqueIndex("user_integrations_user_provider_unique_idx").on(table.userId, table.provider),
	],
);

// Optional Google Indexing API setup, limited to eligible job/livestream URLs
export const googleIntegrations = pgTable(
	"google_integrations",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		siteId: uuid("site_id")
			.references(() => sites.id, { onDelete: "cascade" })
			.notNull(),
		status: text("status").default("pending").notNull(), // 'pending', 'verified', 'failed', 'disabled'
		credentialsJson: text("credentials_json"),
		eligibleContentTypes: jsonb("eligible_content_types").notNull(),
		publicConfig: jsonb("public_config"),
		verifiedAt: timestamp("verified_at"),
		lastCheckedAt: timestamp("last_checked_at"),
		lastErrorAt: timestamp("last_error_at"),
		lastErrorMessage: text("last_error_message"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("google_integrations_site_id_idx").on(table.siteId),
		index("google_integrations_status_idx").on(table.status),
		uniqueIndex("google_integrations_site_unique_idx").on(table.siteId),
	],
);

// Sync history of sitemaps
export const sitemaps = pgTable(
	"sitemaps",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		siteId: uuid("site_id")
			.references(() => sites.id, { onDelete: "cascade" })
			.notNull(),
		url: text("url").notNull(),
		status: text("status").default("pending").notNull(), // 'pending', 'syncing', 'success', 'failed'
		lastSyncTime: timestamp("last_sync_time"),
		errorMessage: text("error_message"),
		urlCount: integer("url_count"), // URLs seen in this sync (after host filtering + dedup)
		newCount: integer("new_count"), // URLs never seen before for this site
		changedCount: integer("changed_count"), // Known URLs whose <lastmod> moved forward
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("sitemaps_site_id_idx").on(table.siteId),
		index("sitemaps_site_created_idx").on(table.siteId, table.createdAt),
	],
);

// Monitored URLs discovered via sitemap or added manually
export const urls = pgTable(
	"urls",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		siteId: uuid("site_id")
			.references(() => sites.id, { onDelete: "cascade" })
			.notNull(),
		loc: text("loc").notNull(), // Absolute URL: https://example.com/blog/hello-world
		priority: text("priority").default("0.5").notNull(),
		lastmod: timestamp("lastmod"),
		changefreq: text("changefreq"),
		indexingStatus: text("indexing_status").default("unknown").notNull(), // 'indexed', 'not_indexed', 'unknown', 'blockers'
		gscStatus: text("gsc_status").default("unknown").notNull(), // Status from GSC API if linked
		httpStatus: integer("http_status"), // last HTTP response code (e.g., 200, 404, 301)
		lastCheckedAt: timestamp("last_checked_at"),
		lastSeenInSitemapAt: timestamp("last_seen_in_sitemap_at"),
		lastSubmittedAt: timestamp("last_submitted_at"),
		lastSubmissionStatus: text("last_submission_status"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("urls_site_id_idx").on(table.siteId),
		index("urls_site_status_idx").on(table.siteId, table.indexingStatus),
		index("urls_site_checked_idx").on(table.siteId, table.lastCheckedAt),
		uniqueIndex("urls_site_loc_unique_idx").on(table.siteId, table.loc),
	],
);

// Technical check results (diagnostic logs)
export const checks = pgTable(
	"checks",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		urlId: uuid("url_id")
			.references(() => urls.id, { onDelete: "cascade" })
			.notNull(),
		checkType: text("check_type").notNull(), // 'robots', 'noindex', 'canonical', 'http_status', 'load_time'
		status: text("status").notNull(), // 'pass', 'warn', 'fail'
		details: jsonb("details").notNull(), // Detailed JSON output payload of checker
		checkedAt: timestamp("checked_at").defaultNow().notNull(),
	},
	(table) => [
		index("checks_url_id_idx").on(table.urlId),
		index("checks_url_checked_idx").on(table.urlId, table.checkedAt),
	],
);

// Queue of URL submission work shared by dashboard actions and cron runs
export const submissionJobs = pgTable(
	"submission_jobs",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		siteId: uuid("site_id")
			.references(() => sites.id, { onDelete: "cascade" })
			.notNull(),
		urlId: uuid("url_id").references(() => urls.id, { onDelete: "set null" }),
		loc: text("loc").notNull(),
		engine: text("engine").notNull(), // 'indexnow', 'bing'
		reason: text("reason").default("new").notNull(), // 'new', 'changed', 'manual'
		status: text("status").default("queued").notNull(), // 'queued', 'processing', 'success', 'failed'
		attempts: integer("attempts").default(0).notNull(),
		nextRunAt: timestamp("next_run_at").defaultNow().notNull(),
		lockedAt: timestamp("locked_at"),
		lastErrorMessage: text("last_error_message"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("submission_jobs_site_id_idx").on(table.siteId),
		index("submission_jobs_status_due_idx").on(table.status, table.nextRunAt),
		index("submission_jobs_engine_status_idx").on(table.engine, table.status),
		// Queue-level dedup: at most one open job per (site, url, engine). Lets enqueue be a
		// single bulk INSERT ... ON CONFLICT DO NOTHING instead of a select-per-URL.
		uniqueIndex("submission_jobs_open_unique_idx")
			.on(table.siteId, table.loc, table.engine)
			.where(sql`${table.status} in ('queued', 'processing')`),
	],
);

// Submissions logs for IndexNow, Google Indexing API, or Bing submissions
export const submissions = pgTable(
	"submissions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		siteId: uuid("site_id")
			.references(() => sites.id, { onDelete: "cascade" })
			.notNull(),
		loc: text("loc").notNull(),
		engine: text("engine").notNull(), // 'indexnow', 'google_indexing_api', 'bing'
		status: text("status").notNull(), // 'submitted', 'success', 'failed'
		responseMessage: text("response_message"),
		attempt: integer("attempt").default(1).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("submissions_site_id_idx").on(table.siteId),
		index("submissions_site_created_idx").on(table.siteId, table.createdAt),
	],
);

// Alerts triggered (e.g. dropped indexing, 404/500 errors)
export const alerts = pgTable(
	"alerts",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		siteId: uuid("site_id")
			.references(() => sites.id, { onDelete: "cascade" })
			.notNull(),
		title: text("title").notNull(),
		message: text("message").notNull(),
		alertType: text("alert_type").notNull(), // 'indexing_drop', 'error_detected', 'sitemap_failure'
		resolved: boolean("resolved").default(false).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("alerts_site_id_idx").on(table.siteId),
		index("alerts_site_resolved_created_idx").on(table.siteId, table.resolved, table.createdAt),
	],
);
