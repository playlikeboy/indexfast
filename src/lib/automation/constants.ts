/**
 * Hard runtime bounds for the automation pipeline. These protect the Cloudflare Worker
 * (memory/CPU/wall time) and the search engines' rate limits. Per-plan limits (sites, URLs
 * per site, sync interval) live in src/lib/platform/plans.ts, not here.
 */
export const AUTOMATION_LIMITS = {
	maxUrlsPerSitemap: 50_000, // Absolute ceiling; the plan's urlsPerSite is usually lower
	maxSitesPerRun: 40, // Sitemap syncs per cron tick
	maxSubmissionJobsPerRun: 2_000, // Queue jobs drained per cron tick
	maxManualJobsInline: 200, // Jobs processed synchronously after a dashboard/MCP submit
	cronTimeBudgetMs: 10 * 60 * 1000, // Stop starting new work after this; cron wall limit is 15 min
	upsertChunkSize: 500, // Rows per INSERT ... ON CONFLICT (keeps params < Postgres limit)
	maxSubmitAttempts: 3, // Then the job is marked failed and an alert is raised
	staleLockMinutes: 15, // 'processing' jobs older than this were orphaned by a crashed run
	resubmitCooldownHours: 24, // Do not resubmit an unchanged URL more often than this
} as const;

// IndexNow accepts up to 10,000 URLs per POST; Bing's SubmitUrlBatch caps at 500 and has a
// small daily quota, so it gets a smaller batch.
export const ENGINE_BATCH_SIZE = {
	indexnow: 1_000,
	bing: 100,
} as const;

export type SubmissionEngine = keyof typeof ENGINE_BATCH_SIZE;

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
export const BING_API_BASE = "https://ssl.bing.com/webmaster/api.svc/json";
