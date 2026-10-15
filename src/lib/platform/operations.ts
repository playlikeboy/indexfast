/**
 * Read/write operations shared by the REST API (/api/v1) and the MCP server. These are thin
 * adapters over the automation engine: they translate "site id or domain" references, shape
 * responses for machines, and never duplicate business rules (those live in service.ts).
 */
import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { alerts, checks, siteSitemaps, sites, submissions, urls } from "@/db/schema";
import {
	addSitemapSourceForUser,
	createSiteForUser as createSite,
	discoverSitemapsForUser,
	getIndexNowSetup,
	resolveSiteForUser,
	submitPendingForUser,
	submitUrlsForUser,
	syncSitemapsForUser,
	verifySiteForUser,
} from "@/lib/automation/service";
import { getUserAccess } from "./entitlements";
import { formatLimit } from "./plans";
import { getSiteHost, normalizeUrlForHost } from "@/lib/url-utils";
import { getDirectoriesByPriority } from "@/lib/resources/directories";
import { getToolsByPriority } from "@/lib/resources/tools";

export type UrlFilter = "all" | "new" | "pending" | "submitted" | "failed";

/** Human/agent readable install steps for the ownership + IndexNow key file. */
function setupInstructions(setup: Awaited<ReturnType<typeof getIndexNowSetup>>, verified: boolean) {
	if (verified) {
		return { done: true, message: "Verified. New and updated URLs are submitted automatically." };
	}
	return {
		done: false,
		message: `Create a file named ${setup.fileName} at your site root containing exactly: ${setup.fileContent}. Deploy, then call verify_site.`,
		file: { name: setup.fileName, content: setup.fileContent, url: setup.keyLocation },
		hints: {
			nextjs: `public/${setup.fileName}`,
			vite_react_astro_sveltekit: `public/${setup.fileName} (SvelteKit: static/${setup.fileName})`,
			wordpress: `Upload ${setup.fileName} to the WordPress root folder (next to wp-config.php)`,
			static_html: `${setup.fileName} next to index.html`,
		},
	};
}

export async function getAccountStatus(userId: string) {
	const { entitlement, pausedSiteIds } = await getUserAccess(userId);
	const siteRows = await listSitesForUser(userId);
	return {
		plan: entitlement.plan.name,
		status: entitlement.status,
		expiresAt: entitlement.expiresAt,
		limits: {
			sites: formatLimit(entitlement.limits.sites),
			urlsPerSite: formatLimit(entitlement.limits.urlsPerSite),
			syncEvery: entitlement.limits.syncIntervalMinutes >= 1440 ? "24 hours" : "1 hour",
			monthlyApiRequests: formatLimit(entitlement.limits.monthlyApiRequests),
		},
		sites: siteRows.map((site) => ({ ...site, paused: pausedSiteIds.has(site.id) })),
		upgradeUrl: "https://indexfast.co/dashboard/billing",
	};
}

export async function listSitesForUser(userId: string) {
	const rows = await db
		.select({
			id: sites.id,
			domain: sites.domain,
			host: sites.indexingHost,
			verified: sites.verified,
			automationEnabled: sites.automationEnabled,
			sitemapUrl: sites.sitemapUrl,
			createdAt: sites.createdAt,
		})
		.from(sites)
		.where(eq(sites.userId, userId))
		.orderBy(sites.createdAt);

	if (rows.length === 0) {
		return [];
	}
	const counts = await db
		.select({
			siteId: urls.siteId,
			total: sql<number>`cast(count(*) as int)`,
			submitted: sql<number>`cast(count(*) filter (where ${urls.lastSubmissionStatus} = 'success') as int)`,
		})
		.from(urls)
		.where(inArray(urls.siteId, rows.map((row) => row.id)))
		.groupBy(urls.siteId);
	const bySite = new Map(counts.map((row) => [row.siteId, row]));
	return rows.map((row) => ({ ...row, urls: bySite.get(row.id)?.total ?? 0, submitted: bySite.get(row.id)?.submitted ?? 0 }));
}

export async function createSiteForUser(input: { userId: string; domain: string; name?: string; sitemapUrl?: string }) {
	const result = await createSite(input);
	return {
		site: result.site,
		sitemaps: result.discovered,
		sync: result.sync ? { urlsFound: result.sync.urlCount, newUrls: result.sync.newCount, failures: result.sync.failures } : null,
		warning: result.warning,
		setup: setupInstructions(result.setup, false),
	};
}

export async function getSiteDetailsForUser(userId: string, siteRef: string) {
	const site = await resolveSiteForUser(userId, siteRef);
	const [setup, sources, [stats], openAlerts] = await Promise.all([
		getIndexNowSetup(site),
		db.select().from(siteSitemaps).where(eq(siteSitemaps.siteId, site.id)).orderBy(desc(siteSitemaps.isPrimary)),
		db
			.select({
				total: sql<number>`cast(count(*) as int)`,
				submitted: sql<number>`cast(count(*) filter (where ${urls.lastSubmissionStatus} = 'success') as int)`,
				failed: sql<number>`cast(count(*) filter (where ${urls.lastSubmissionStatus} = 'failed') as int)`,
				pending: sql<number>`cast(count(*) filter (where ${urls.lastSubmittedAt} is null) as int)`,
				newLast7d: sql<number>`cast(count(*) filter (where ${urls.createdAt} > now() - interval '7 days') as int)`,
			})
			.from(urls)
			.where(eq(urls.siteId, site.id)),
		db
			.select({ title: alerts.title, message: alerts.message, createdAt: alerts.createdAt })
			.from(alerts)
			.where(and(eq(alerts.siteId, site.id), eq(alerts.resolved, false)))
			.orderBy(desc(alerts.createdAt))
			.limit(10),
	]);

	return {
		id: site.id,
		domain: site.domain,
		host: getSiteHost(site),
		verified: site.verified,
		automationEnabled: site.automationEnabled,
		setup: setupInstructions(setup, site.verified),
		sitemaps: sources.map((source) => ({
			id: source.id,
			url: source.url,
			status: source.status,
			lastSyncAt: source.lastSyncAt,
			error: source.lastErrorMessage,
		})),
		urls: stats,
		issues: openAlerts,
	};
}

export async function verifySiteForApi(userId: string, siteRef: string) {
	const site = await resolveSiteForUser(userId, siteRef);
	return verifySiteForUser(userId, site.id);
}

export async function listSitemapsForUser(userId: string, siteRef: string) {
	const site = await resolveSiteForUser(userId, siteRef);
	return db
		.select()
		.from(siteSitemaps)
		.where(eq(siteSitemaps.siteId, site.id))
		.orderBy(desc(siteSitemaps.isPrimary), desc(siteSitemaps.createdAt));
}

export async function addSitemapForApi(userId: string, siteRef: string, sitemapUrl: string, isPrimary = false) {
	const site = await resolveSiteForUser(userId, siteRef);
	return addSitemapSourceForUser(userId, site.id, sitemapUrl, isPrimary || undefined);
}

export async function discoverSitemapsForApi(userId: string, siteRef: string) {
	const site = await resolveSiteForUser(userId, siteRef);
	return discoverSitemapsForUser(userId, site.id);
}

export async function syncSitemapsForApi(userId: string, siteRef: string, sourceId?: string) {
	const site = await resolveSiteForUser(userId, siteRef);
	return syncSitemapsForUser(userId, site.id, sourceId);
}

export async function listUrlsForUser(userId: string, siteRef: string, limit = 100, filter: UrlFilter = "all") {
	const site = await resolveSiteForUser(userId, siteRef);
	const conditions = [eq(urls.siteId, site.id)];
	if (filter === "pending") conditions.push(isNull(urls.lastSubmittedAt));
	if (filter === "submitted") conditions.push(eq(urls.lastSubmissionStatus, "success"));
	if (filter === "failed") conditions.push(eq(urls.lastSubmissionStatus, "failed"));
	if (filter === "new") conditions.push(sql`${urls.createdAt} > now() - interval '7 days'`);

	return db
		.select({
			id: urls.id,
			loc: urls.loc,
			lastmod: urls.lastmod,
			firstSeenAt: urls.createdAt,
			lastSeenInSitemapAt: urls.lastSeenInSitemapAt,
			lastSubmittedAt: urls.lastSubmittedAt,
			lastSubmissionStatus: urls.lastSubmissionStatus,
			httpStatus: urls.httpStatus,
			indexingStatus: urls.indexingStatus,
		})
		.from(urls)
		.where(and(...conditions))
		.orderBy(desc(urls.createdAt))
		.limit(Math.min(Math.max(limit, 1), 1000));
}

export async function submitUrlForApi(userId: string, siteRef: string, urlLoc: string) {
	const site = await resolveSiteForUser(userId, siteRef);
	return submitUrlsForUser(userId, site.id, [urlLoc]);
}

export async function bulkSubmitUrlsForApi(userId: string, siteRef: string, urlList: string[]) {
	const site = await resolveSiteForUser(userId, siteRef);
	return submitUrlsForUser(userId, site.id, urlList);
}

export async function submitPendingForApi(userId: string, siteRef: string) {
	const site = await resolveSiteForUser(userId, siteRef);
	return submitPendingForUser(userId, site.id);
}

export async function listSubmissionsForUser(userId: string, siteRef: string, limit = 100) {
	const site = await resolveSiteForUser(userId, siteRef);
	return db
		.select({
			loc: submissions.loc,
			engine: submissions.engine,
			status: submissions.status,
			responseMessage: submissions.responseMessage,
			attempt: submissions.attempt,
			createdAt: submissions.createdAt,
		})
		.from(submissions)
		.where(eq(submissions.siteId, site.id))
		.orderBy(desc(submissions.createdAt))
		.limit(Math.min(Math.max(limit, 1), 500));
}

export async function listAlertsForUser(userId: string, limit = 100) {
	return db
		.select({
			id: alerts.id,
			siteId: alerts.siteId,
			domain: sites.domain,
			title: alerts.title,
			message: alerts.message,
			alertType: alerts.alertType,
			resolved: alerts.resolved,
			createdAt: alerts.createdAt,
		})
		.from(alerts)
		.innerJoin(sites, eq(alerts.siteId, sites.id))
		.where(eq(sites.userId, userId))
		.orderBy(desc(alerts.createdAt))
		.limit(Math.min(Math.max(limit, 1), 500));
}

/** Live indexability check (status, noindex, canonical) for one URL on a site. */
export async function runDiagnosticsForUser(input: { userId: string; siteId: string; urlId?: string; url?: string }) {
	const site = await resolveSiteForUser(input.userId, input.siteId);

	let urlRow: { id: string; loc: string } | undefined;
	if (input.urlId) {
		[urlRow] = await db
			.select({ id: urls.id, loc: urls.loc })
			.from(urls)
			.where(and(eq(urls.id, input.urlId), eq(urls.siteId, site.id)))
			.limit(1);
	} else if (input.url) {
		const loc = normalizeUrlForHost(input.url, getSiteHost(site));
		[urlRow] = await db
			.insert(urls)
			.values({ siteId: site.id, loc })
			.onConflictDoUpdate({ target: [urls.siteId, urls.loc], set: { loc: sql`excluded.loc` } })
			.returning({ id: urls.id, loc: urls.loc });
	}
	if (!urlRow) {
		throw new Error("URL not found.");
	}

	const { evaluateUrlDiagnostics } = await import("@/lib/automation/diagnostics");
	const result = await evaluateUrlDiagnostics(urlRow.loc);
	const checkedAt = new Date();

	await Promise.all([
		db.insert(checks).values({
			urlId: urlRow.id,
			checkType: "diagnostics",
			status: result.status,
			details: {
				httpStatus: result.httpStatus,
				noindex: result.noindex,
				noindexSource: result.noindexSource,
				canonical: result.canonical,
				isCanonicalMatch: result.isCanonicalMatch,
				title: result.title,
				blockers: result.blockers,
				finalUrl: result.finalUrl,
			},
			checkedAt,
		}),
		db
			.update(urls)
			.set({
				httpStatus: result.httpStatus,
				// Diagnostics can only prove a page is *indexable*, not that it is indexed.
				indexingStatus: result.status === "fail" ? "blockers" : "unknown",
				lastCheckedAt: checkedAt,
			})
			.where(eq(urls.id, urlRow.id)),
	]);

	return {
		urlId: urlRow.id,
		loc: urlRow.loc,
		httpStatus: result.httpStatus,
		noindex: result.noindex,
		canonical: result.canonical,
		canonicalMatches: result.isCanonicalMatch,
		title: result.title,
		status: result.status,
		blockers: result.blockers,
	};
}

export async function getLatestCheck(urlId: string) {
	const [row] = await db.select().from(checks).where(and(eq(checks.urlId, urlId), isNotNull(checks.details))).orderBy(desc(checks.checkedAt)).limit(1);
	return row ?? null;
}

export function listDirectoryResources(priority?: "P0" | "P1" | "P2" | "P3") {
	return getDirectoriesByPriority(priority);
}

export function listSeoToolResources(priority?: "P0" | "P1" | "P2" | "P3") {
	return getToolsByPriority(priority);
}

export function recommendSeoResources(goal: string) {
	const normalizedGoal = goal.toLowerCase();
	if (normalizedGoal.includes("ai") || normalizedGoal.includes("agent") || normalizedGoal.includes("mcp")) {
		return {
			directories: getDirectoriesByPriority().filter((item) => item.category === "ai" || item.category === "agent").slice(0, 15),
			tools: getToolsByPriority().filter((item) => item.category === "ai-seo" || item.category === "structured-data").slice(0, 8),
		};
	}
	if (normalizedGoal.includes("startup") || normalizedGoal.includes("launch") || normalizedGoal.includes("yc")) {
		return {
			directories: getDirectoriesByPriority().filter((item) => item.category === "launch" || item.category === "startup").slice(0, 20),
			tools: getToolsByPriority("P0").slice(0, 8),
		};
	}
	return { directories: getDirectoriesByPriority().slice(0, 20), tools: getToolsByPriority().slice(0, 12) };
}
