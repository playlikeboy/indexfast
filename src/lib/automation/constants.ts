export const AUTOMATION_LIMITS = {
	maxSitesPerRun: 5,
	maxUrlsPerSitemap: 1000,
	maxSubmissionJobsPerRun: 100,
	engineBatchSize: 50,
	maxSubmissionAttempts: 3,
	staleProcessingLockMs: 30 * 60 * 1000,
} as const;

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
export const BING_API_BASE = "https://ssl.bing.com/webmaster/api.svc/json";
