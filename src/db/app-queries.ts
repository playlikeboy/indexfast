/**
 * Read-only queries for dashboard pages. Every query is scoped by userId, and independent
 * reads run in parallel because each Neon HTTP query is a network round trip.
 * Writes never happen here; they go through src/lib/automation/service.ts.
 */
import { and, asc, desc, eq, ilike, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { alerts, apiKeys, apiUsageEvents, siteSitemaps, sites, submissionJobs, submissions, urls } from "@/db/schema";
import { getIndexNowSetup, getBingStatusForUser, getSiteForUser, getSiteQueueSummary } from "@/lib/automation/service";
import { getUserAccess } from "@/lib/platform/entitlements";
import { maskApiKeyPrefix } from "@/lib/platform/api-key-utils";

export type SiteStatus = "live" | "setup" | "paused" | "error";

const urlStats = {
	total: sql<number>`cast(count(*) as int)`,
	submitted: sql<number>`cast(count(*) filter (where ${urls.lastSubmissionStatus} = 'success') as int)`,
	failed: sql<number>`cast(count(*) filter (where ${urls.lastSubmissionStatus} = 'failed') as int)`,
	pending: sql<number>`cast(count(*) filter (where ${urls.lastSubmittedAt} is null) as int)`,
	new7d: sql<number>`cast(count(*) filter (where ${urls.createdAt} > now() - interval '7 days') as int)`,
};

export async function getDashboardHome(userId: string) {
	const [access, siteRows] = await Promise.all([
		getUserAccess(userId),
		db.select().from(sites).where(eq(sites.userId, userId)).orderBy(sites.createdAt),
	]);
	const siteIds = siteRows.map((site) => site.id);

	const [stats, sources, openAlerts] = siteIds.length
		? await Promise.all([
				db.select({ siteId: urls.siteId, ...urlStats }).from(urls).where(inArray(urls.siteId, siteIds)).groupBy(urls.siteId),
				db
					.select({
						siteId: siteSitemaps.siteId,
						lastSyncAt: sql<Date | null>`max(${siteSitemaps.lastSyncAt})`,
						failed: sql<number>`cast(count(*) filter (where ${siteSitemaps.status} = 'failed') as int)`,
						count: sql<number>`cast(count(*) as int)`,
					})
					.from(siteSitemaps)
					.where(inArray(siteSitemaps.siteId, siteIds))
					.groupBy(siteSitemaps.siteId),
				db
					.select({ siteId: alerts.siteId, count: sql<number>`cast(count(*) as int)` })
					.from(alerts)
					.where(and(inArray(alerts.siteId, siteIds), eq(alerts.resolved, false)))
					.groupBy(alerts.siteId),
			])
		: [[], [], []];

	const statsBySite = new Map(stats.map((row) => [row.siteId, row]));
	const sourcesBySite = new Map(sources.map((row) => [row.siteId, row]));
	const alertsBySite = new Map(openAlerts.map((row) => [row.siteId, row.count]));

	return {
		...access,
		sites: siteRows.map((site) => {
			const source = sourcesBySite.get(site.id);
			const paused = access.pausedSiteIds.has(site.id);
			let status: SiteStatus = site.verified && site.automationEnabled ? "live" : "setup";
			if (source?.failed) status = "error";
			if (paused) status = "paused";
			return {
				site,
				status,
				stats: statsBySite.get(site.id) ?? { total: 0, submitted: 0, failed: 0, pending: 0, new7d: 0 },
				lastSyncAt: source?.lastSyncAt ? new Date(source.lastSyncAt) : null,
				sitemapCount: source?.count ?? 0,
				openIssues: alertsBySite.get(site.id) ?? 0,
			};
		}),
	};
}

export type UrlTab = "all" | "new" | "pending" | "submitted" | "failed" | "queue";
export const URL_PAGE_SIZE = 50;

export async function getSitePage(userId: string, siteId: string, options: { tab: UrlTab; q: string; page: number }) {
	const site = await getSiteForUser(siteId, userId);
	if (!site) return null;

	const isQueueTab = options.tab === "queue";

	const urlFilters: SQL[] = [eq(urls.siteId, siteId)];
	if (options.tab === "pending") urlFilters.push(isNull(urls.lastSubmittedAt));
	if (options.tab === "submitted") urlFilters.push(eq(urls.lastSubmissionStatus, "success"));
	if (options.tab === "failed") urlFilters.push(eq(urls.lastSubmissionStatus, "failed"));
	if (options.tab === "new") urlFilters.push(sql`${urls.createdAt} > now() - interval '7 days'`);
	if (options.q && !isQueueTab) urlFilters.push(ilike(urls.loc, `%${options.q.replace(/[%_\\]/g, (char) => `\\${char}`)}%`));

	const queueFilters: SQL[] = [eq(submissionJobs.siteId, siteId)];
	if (options.q && isQueueTab) queueFilters.push(ilike(submissionJobs.loc, `%${options.q.replace(/[%_\\]/g, (char) => `\\${char}`)}%`));

	const [
		access,
		setup,
		sources,
		[stats],
		urlRows,
		urlCountRow,
		queueRows,
		queueCountRow,
		activity,
		issues,
		bing,
		queueSummary,
	] = await Promise.all([
		getUserAccess(userId),
		getIndexNowSetup(site),
		db.select().from(siteSitemaps).where(eq(siteSitemaps.siteId, siteId)).orderBy(desc(siteSitemaps.isPrimary), siteSitemaps.createdAt),
		db.select(urlStats).from(urls).where(eq(urls.siteId, siteId)),
		!isQueueTab
			? db
					.select({
						id: urls.id,
						loc: urls.loc,
						createdAt: urls.createdAt,
						lastmod: urls.lastmod,
						lastSubmittedAt: urls.lastSubmittedAt,
						lastSubmissionStatus: urls.lastSubmissionStatus,
						lastSubmittedEngine: urls.lastSubmittedEngine,
						httpStatus: urls.httpStatus,
						indexingStatus: urls.indexingStatus,
					})
					.from(urls)
					.where(and(...urlFilters))
					.orderBy(desc(urls.createdAt), urls.loc)
					.limit(URL_PAGE_SIZE)
					.offset((options.page - 1) * URL_PAGE_SIZE)
			: Promise.resolve([]),
		!isQueueTab
			? db.select({ filtered: sql<number>`cast(count(*) as int)` }).from(urls).where(and(...urlFilters))
			: Promise.resolve([{ filtered: 0 }]),
		isQueueTab
			? db
					.select({
						id: submissionJobs.id,
						loc: submissionJobs.loc,
						engine: submissionJobs.engine,
						reason: submissionJobs.reason,
						status: submissionJobs.status,
						priority: submissionJobs.priority,
						attempts: submissionJobs.attempts,
						httpStatus: submissionJobs.httpStatus,
						retryAfterAt: submissionJobs.retryAfterAt,
						nextRunAt: submissionJobs.nextRunAt,
						lastErrorMessage: submissionJobs.lastErrorMessage,
						createdAt: submissionJobs.createdAt,
						updatedAt: submissionJobs.updatedAt,
					})
					.from(submissionJobs)
					.where(and(...queueFilters))
					.orderBy(asc(submissionJobs.priority), asc(submissionJobs.nextRunAt), desc(submissionJobs.createdAt))
					.limit(URL_PAGE_SIZE)
					.offset((options.page - 1) * URL_PAGE_SIZE)
			: Promise.resolve([]),
		isQueueTab
			? db.select({ filtered: sql<number>`cast(count(*) as int)` }).from(submissionJobs).where(and(...queueFilters))
			: Promise.resolve([{ filtered: 0 }]),
		db
			.select({ loc: submissions.loc, engine: submissions.engine, status: submissions.status, responseMessage: submissions.responseMessage, createdAt: submissions.createdAt })
			.from(submissions)
			.where(eq(submissions.siteId, siteId))
			.orderBy(desc(submissions.createdAt))
			.limit(15),
		db.select().from(alerts).where(and(eq(alerts.siteId, siteId), eq(alerts.resolved, false))).orderBy(desc(alerts.createdAt)).limit(5),
		getBingStatusForUser(userId, siteId),
		getSiteQueueSummary(userId, siteId),
	]);

	const filtered = isQueueTab ? (queueCountRow[0]?.filtered ?? 0) : (urlCountRow[0]?.filtered ?? 0);
	const openJobs = queueSummary?.openTotal ?? 0;

	return {
		site,
		paused: access.pausedSiteIds.has(siteId),
		entitlement: access.entitlement,
		setup,
		sources,
		stats,
		urlRows,
		queueRows,
		queueSummary,
		filtered,
		activity,
		issues,
		bing,
		openJobs,
	};
}

export type SitePageData = NonNullable<Awaited<ReturnType<typeof getSitePage>>>;
export type DashboardHomeData = Awaited<ReturnType<typeof getDashboardHome>>;

export async function getConnectPage(userId: string) {
	const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
	const [access, keys, [usage], siteRows] = await Promise.all([
		getUserAccess(userId),
		db
			.select({ id: apiKeys.id, name: apiKeys.name, keyPrefix: apiKeys.keyPrefix, lastUsedAt: apiKeys.lastUsedAt, createdAt: apiKeys.createdAt })
			.from(apiKeys)
			.where(and(eq(apiKeys.userId, userId), eq(apiKeys.status, "active")))
			.orderBy(desc(apiKeys.createdAt)),
		db
			.select({ count: sql<number>`cast(count(*) as int)` })
			.from(apiUsageEvents)
			.where(and(eq(apiUsageEvents.userId, userId), sql`${apiUsageEvents.createdAt} >= ${monthStart}`)),
		db.select({ domain: sites.domain }).from(sites).where(eq(sites.userId, userId)).limit(1),
	]);
	return {
		entitlement: access.entitlement,
		keys: keys.map((key) => ({ ...key, masked: maskApiKeyPrefix(key.keyPrefix) })),
		usage: usage?.count ?? 0,
		exampleDomain: siteRows[0]?.domain ?? null,
	};
}

export type ConnectPageData = Awaited<ReturnType<typeof getConnectPage>>;
