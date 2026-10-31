/**
 * Hard runtime bounds for the automation pipeline. These protect the Cloudflare Worker
 * (memory/CPU/wall time) and the search engines' rate limits. Per-plan limits (sites, URLs
 * per site, sync interval) live in src/lib/platform/plans.ts, not here.
 */
export const AUTOMATION_LIMITS = {
	maxUrlsPerSitemap: 50_000, // Absolute ceiling; the plan's urlsPerSite is usually lower
	maxDueSitesScanned: 1_000, // Due sites loaded per cron tick; the time budget decides how many sync
	maxSitemapSourcesPerSite: 20, // Sources synced per site, and sitemaps kept from discovery
	maxSubmissionJobsPerRun: 2_000, // Queue jobs drained per cron tick
	maxManualJobsInline: 200, // Jobs processed synchronously after a dashboard/MCP submit
	maxDrainJobsInline: 1_000, // Upper bound for an on-demand "Process now" queue drain
	// The Worker cron wall limit is 15 min. A run killed mid-way leaves cron_runs at
	// 'running' and claimed jobs at 'processing', so each phase stops well before it.
	syncTimeBudgetMs: 6 * 60 * 1000, // Stop starting sitemap files/sources after this
	cronTimeBudgetMs: 10 * 60 * 1000, // Stop sending queue batches after this
	staleCronRunMinutes: 20, // A 'running' cron_runs row older than this was killed
	apiUsageRetentionDays: 90, // api_usage_events older than this are pruned by the cron
	upsertChunkSize: 500, // Rows per INSERT ... ON CONFLICT (keeps params < Postgres limit)
	maxSubmitAttempts: 3, // Network/5xx failures only; then the job is marked failed
	staleLockMinutes: 15, // 'processing' jobs older than this were orphaned by a crashed run
	resubmitCooldownHours: 24, // Do not resubmit a URL more often than this
	// IndexNow's 429 ("potential spam") is a per-host quota that lasts hours, not seconds:
	// a short cooldown just re-trips it. Start at 1h, double per consecutive 429, cap at 24h.
	throttleCooldownMinutes: 60, // Base backoff after a rate limit
	maxThrottleBackoffHours: 24, // Ceiling for rate-limit backoff; throttled jobs never fail
	retryJitterPercent: 0.2, // +/- 20% random jitter on retry backoff to prevent thundering herds
	// Back-to-back POSTs for the same host are what IndexNow flags as spam, so each queue run
	// sends at most this many IndexNow requests per site; the rest wait for the next run.
	indexNowRequestsPerSitePerRun: 1,
	// Wait before re-trying jobs whose engine is temporarily unusable (key pending re-check).
	engineUnavailableRetryMinutes: 60,
	// Jobs of a site paused by a plan downgrade wait this long between re-checks, so they do
	// not fill every run's claim while the user decides to upgrade or delete a site.
	pausedSiteRetryHours: 24,
	// Probes during sitemap discovery only need the head of a file (is it XML, is it an index).
	discoveryProbeMaxBytes: 1024 * 1024,
	discoveryProbeConcurrency: 3,
} as const;

// IndexNow accepts up to 10,000 URLs per POST; Bing's SubmitUrlBatch caps at 500 and has a
// small daily quota, so it gets a smaller batch. Google's Indexing API and Yandex's recrawl
// queue take one URL per request; Baidu accepts up to 2,000 newline-separated URLs.
export const ENGINE_BATCH_SIZE = {
	indexnow: 1_000,
	bing: 100,
	google_indexing_api: 1,
	yandex: 1,
	baidu: 500,
} as const;

export const ENGINE_LABELS: Record<keyof typeof ENGINE_BATCH_SIZE, string> = {
	indexnow: "IndexNow",
	bing: "Bing",
	google_indexing_api: "Google Indexing API",
	yandex: "Yandex",
	baidu: "Baidu",
};

/**
 * Google Search Console and per-engine quotas. Google documents URL Inspection at 2,000
 * calls/day and 600/minute per property; the Indexing API's default publish quota is 200/day
 * for the whole Google Cloud project, i.e. shared by every IndexFast user, so it is tracked
 * under one project-wide key. Daily Google quotas reset at midnight Pacific time.
 */
export const GOOGLE_LIMITS = {
	inspectionsPerPropertyPerDay: 2_000,
	inspectionsPerPropertyPerMinute: 600,
	indexingApiProjectPerDay: 200,
	maxInspectionsPerRun: 300, // URL inspections per cron tick, all sites together
	maxInspectionsPerSitePerRun: 50, // So one big site cannot use the whole tick
	inspectionTimeBudgetMs: 2 * 60 * 1000, // Runs after the queue, still inside the 15 min wall limit
	reinspectAfterDays: 7, // A URL is inspected again once its last check is this old
	quotaRetentionDays: 3, // engine_quota_usage rows older than this are pruned by the cron
	quotaTimeZone: "America/Los_Angeles",
} as const;

export type SubmissionEngine = keyof typeof ENGINE_BATCH_SIZE;

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
export const BING_API_BASE = "https://ssl.bing.com/webmaster/api.svc/json";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GSC_API_BASE = "https://www.googleapis.com/webmasters/v3";
export const GSC_INSPECTION_ENDPOINT = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";
export const GOOGLE_INDEXING_PUBLISH_ENDPOINT = "https://indexing.googleapis.com/v3/urlNotifications:publish";
export const YANDEX_API_BASE = "https://api.webmaster.yandex.net/v4";
// Baidu documents the push endpoint over plain HTTP; the token travels in the query string.
export const BAIDU_PUSH_ENDPOINT = "http://data.zz.baidu.com/urls";
