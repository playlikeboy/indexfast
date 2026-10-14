import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { alerts, checks, siteSitemaps, sites, submissions, urls } from "@/db/schema";
import {
	addSitemapSourceForUser,
	discoverSitemapsForUser,
	enqueueManualSubmissionForUser,
	ensureIndexNowIntegration,
	getSiteForUser,
	syncSitemapsForUser,
} from "@/lib/automation/service";
import { getErrorMessage, getSiteHost, normalizeHost, normalizeSitemapUrl, normalizeUrlForHost } from "@/lib/url-utils";
import { getDirectoriesByPriority } from "@/lib/resources/directories";
import { getToolsByPriority } from "@/lib/resources/tools";

export async function listSitesForUser(userId: string) {
	return db
		.select({
			id: sites.id,
			domain: sites.domain,
			indexingHost: sites.indexingHost,
			name: sites.name,
			verified: sites.verified,
			automationEnabled: sites.automationEnabled,
			sitemapUrl: sites.sitemapUrl,
			createdAt: sites.createdAt,
			updatedAt: sites.updatedAt,
		})
		.from(sites)
		.where(eq(sites.userId, userId))
		.orderBy(desc(sites.createdAt));
}

export async function createSiteForUser(input: { userId: string; domain: string; name: string; sitemapUrl?: string }) {
	const cleanHost = normalizeHost(input.domain);
	const cleanName = input.name.trim();
	const cleanSitemapUrl = normalizeSitemapUrl(input.sitemapUrl, cleanHost);

	if (!cleanName) {
		throw new Error("Site label is required.");
	}

	const [existing] = await db
		.select({ id: sites.id })
		.from(sites)
		.where(and(eq(sites.userId, input.userId), eq(sites.domain, cleanHost)))
		.limit(1);
	if (existing) {
		throw new Error("This domain is already connected.");
	}

	const [site] = await db
		.insert(sites)
		.values({
			userId: input.userId,
			domain: cleanHost,
			indexingHost: cleanHost,
			name: cleanName,
			verified: false,
			verificationToken: `indexfast-verification-${crypto.randomUUID()}`,
			sitemapUrl: cleanSitemapUrl,
		})
		.returning();

	await ensureIndexNowIntegration(site);
	if (cleanSitemapUrl) {
		await addSitemapSourceForUser(input.userId, site.id, cleanSitemapUrl, true);
	}

	return site;
}

export async function listSitemapsForUser(userId: string, siteId: string) {
	const site = await getSiteForUser(siteId, userId);
	if (!site) {
		throw new Error("Site not found.");
	}

	return db
		.select()
		.from(siteSitemaps)
		.where(eq(siteSitemaps.siteId, siteId))
		.orderBy(desc(siteSitemaps.isPrimary), desc(siteSitemaps.createdAt));
}

export async function addSitemapForApi(userId: string, siteId: string, sitemapUrl: string, isPrimary = false) {
	return addSitemapSourceForUser(userId, siteId, sitemapUrl, isPrimary);
}

export async function discoverSitemapsForApi(userId: string, siteId: string) {
	return discoverSitemapsForUser(userId, siteId);
}

export async function syncSitemapsForApi(userId: string, siteId: string, sourceId?: string) {
	return syncSitemapsForUser(userId, siteId, sourceId);
}

export async function listUrlsForUser(userId: string, siteId: string, limit = 100) {
	const site = await getSiteForUser(siteId, userId);
	if (!site) {
		throw new Error("Site not found.");
	}

	return db
		.select({
			id: urls.id,
			loc: urls.loc,
			indexingStatus: urls.indexingStatus,
			gscStatus: urls.gscStatus,
			httpStatus: urls.httpStatus,
			lastmod: urls.lastmod,
			lastCheckedAt: urls.lastCheckedAt,
			lastSubmittedAt: urls.lastSubmittedAt,
			lastSubmissionStatus: urls.lastSubmissionStatus,
			createdAt: urls.createdAt,
		})
		.from(urls)
		.where(eq(urls.siteId, siteId))
		.orderBy(desc(urls.createdAt))
		.limit(Math.min(Math.max(limit, 1), 500));
}

export async function submitUrlForApi(userId: string, siteId: string, urlLoc: string) {
	return enqueueManualSubmissionForUser(userId, siteId, urlLoc);
}

export async function bulkSubmitUrlsForApi(userId: string, siteId: string, urlList: string[]) {
	const results = [];
	for (const urlLoc of urlList.slice(0, 50)) {
		results.push({ url: urlLoc, result: await submitUrlForApi(userId, siteId, urlLoc).catch((error) => ({ error: getErrorMessage(error) })) });
	}
	return results;
}

export async function listSubmissionsForUser(userId: string, siteId: string, limit = 100) {
	const site = await getSiteForUser(siteId, userId);
	if (!site) {
		throw new Error("Site not found.");
	}

	return db
		.select()
		.from(submissions)
		.where(eq(submissions.siteId, siteId))
		.orderBy(desc(submissions.createdAt))
		.limit(Math.min(Math.max(limit, 1), 500));
}

export async function listAlertsForUser(userId: string, limit = 100) {
	return db
		.select({
			id: alerts.id,
			siteId: alerts.siteId,
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

export async function runDiagnosticsForUser(input: { userId: string; siteId: string; urlId?: string; url?: string }) {
	const site = await getSiteForUser(input.siteId, input.userId);
	if (!site) {
		throw new Error("Site not found.");
	}

	let urlRow: { id: string; loc: string } | undefined;
	if (input.urlId) {
		[urlRow] = await db
			.select({ id: urls.id, loc: urls.loc })
			.from(urls)
			.where(and(eq(urls.id, input.urlId), eq(urls.siteId, input.siteId)))
			.limit(1);
	} else if (input.url) {
		const loc = normalizeUrlForHost(input.url, getSiteHost(site));
		[urlRow] = await db
			.insert(urls)
			.values({
				siteId: input.siteId,
				loc,
				indexingStatus: "unknown",
				gscStatus: "unknown",
				lastSeenInSitemapAt: new Date(),
			})
			.onConflictDoUpdate({
				target: [urls.siteId, urls.loc],
				set: { lastSeenInSitemapAt: new Date() },
			})
			.returning({ id: urls.id, loc: urls.loc });
	}

	if (!urlRow) {
		throw new Error("URL not found.");
	}

	const { evaluateUrlDiagnostics } = await import("@/lib/automation/diagnostics");
	const result = await evaluateUrlDiagnostics(urlRow.loc);
	const checkedAt = new Date();

	await db.insert(checks).values({
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
	});

	await db
		.update(urls)
		.set({
			httpStatus: result.httpStatus,
			indexingStatus: result.status === "fail" ? "blockers" : result.httpStatus === 200 ? "indexed" : "not_indexed",
			lastCheckedAt: checkedAt,
		})
		.where(eq(urls.id, urlRow.id));

	return {
		urlId: urlRow.id,
		loc: urlRow.loc,
		httpStatus: result.httpStatus,
		noindex: result.noindex,
		canonical: result.canonical,
		status: result.status,
		blockers: result.blockers,
	};
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

	return {
		directories: getDirectoriesByPriority().slice(0, 20),
		tools: getToolsByPriority().slice(0, 12),
	};
}
