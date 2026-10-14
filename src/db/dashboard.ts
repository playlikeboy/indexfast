import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { alerts, sites, sitemaps, submissions, urls } from "@/db/schema";

const listLimit = 50;

function normalizeCount(value: number | string | null | undefined) {
	return Number(value ?? 0);
}

function toCountMap(rows: Array<{ siteId: string; value: number | string | null }>) {
	return new Map(rows.map((row) => [row.siteId, normalizeCount(row.value)]));
}

function sumCounts(rows: Array<{ value: number | string | null }>) {
	return rows.reduce((total, row) => total + normalizeCount(row.value), 0);
}

export async function getDashboardOverview(userId: string) {
	const siteRows = await db
		.select({
			id: sites.id,
			domain: sites.domain,
			name: sites.name,
			verified: sites.verified,
			sitemapUrl: sites.sitemapUrl,
			createdAt: sites.createdAt,
		})
		.from(sites)
		.where(eq(sites.userId, userId))
		.orderBy(desc(sites.createdAt));

	if (siteRows.length === 0) {
		return {
			stats: {
				totalSites: 0,
				verifiedSites: 0,
				pendingSites: 0,
				totalUrls: 0,
				pendingAlerts: 0,
				totalSubmissions: 0,
			},
			sites: [],
		};
	}

	const siteIds = siteRows.map((s) => s.id);

	const [urlCountRows, alertCountRows, submissionCountRows] = await Promise.all([
		db
			.select({
				siteId: urls.siteId,
				value: sql<number>`cast(count(${urls.id}) as int)`,
			})
			.from(urls)
			.where(inArray(urls.siteId, siteIds))
			.groupBy(urls.siteId),
		db
			.select({
				siteId: alerts.siteId,
				value: sql<number>`cast(count(${alerts.id}) as int)`,
			})
			.from(alerts)
			.where(and(inArray(alerts.siteId, siteIds), eq(alerts.resolved, false)))
			.groupBy(alerts.siteId),
		db
			.select({
				siteId: submissions.siteId,
				value: sql<number>`cast(count(${submissions.id}) as int)`,
			})
			.from(submissions)
			.where(inArray(submissions.siteId, siteIds))
			.groupBy(submissions.siteId),
	]);


	const urlCounts = toCountMap(urlCountRows);
	const alertCounts = toCountMap(alertCountRows);
	const submissionCounts = toCountMap(submissionCountRows);
	const verifiedSites = siteRows.filter((site) => site.verified).length;

	return {
		stats: {
			totalSites: siteRows.length,
			verifiedSites,
			pendingSites: siteRows.length - verifiedSites,
			totalUrls: sumCounts(urlCountRows),
			pendingAlerts: sumCounts(alertCountRows),
			totalSubmissions: sumCounts(submissionCountRows),
		},
		sites: siteRows.map((site) => ({
			...site,
			urlCount: urlCounts.get(site.id) ?? 0,
			pendingAlertCount: alertCounts.get(site.id) ?? 0,
			submissionCount: submissionCounts.get(site.id) ?? 0,
		})),
	};
}

export async function getSiteDashboard(userId: string, siteId: string) {
	const [site] = await db
		.select({
			id: sites.id,
			domain: sites.domain,
			name: sites.name,
			verified: sites.verified,
			verificationToken: sites.verificationToken,
			sitemapUrl: sites.sitemapUrl,
		})
		.from(sites)
		.where(and(eq(sites.id, siteId), eq(sites.userId, userId)))
		.limit(1);

	if (!site) {
		return null;
	}

	const [[urlCount], [alertCount], [submissionCount], recentUrls, recentSitemaps, recentAlerts] = await Promise.all([
		db
			.select({ value: sql<number>`cast(count(${urls.id}) as int)` })
			.from(urls)
			.where(eq(urls.siteId, site.id)),
		db
			.select({ value: sql<number>`cast(count(${alerts.id}) as int)` })
			.from(alerts)
			.where(and(eq(alerts.siteId, site.id), eq(alerts.resolved, false))),
		db
			.select({ value: sql<number>`cast(count(${submissions.id}) as int)` })
			.from(submissions)
			.where(eq(submissions.siteId, site.id)),
		db
			.select({
				id: urls.id,
				loc: urls.loc,
				indexingStatus: urls.indexingStatus,
				httpStatus: urls.httpStatus,
				lastCheckedAt: urls.lastCheckedAt,
				createdAt: urls.createdAt,
			})
			.from(urls)
			.where(eq(urls.siteId, site.id))
			.orderBy(desc(urls.createdAt))
			.limit(25),
		db
			.select({
				id: sitemaps.id,
				status: sitemaps.status,
				lastSyncTime: sitemaps.lastSyncTime,
				errorMessage: sitemaps.errorMessage,
				createdAt: sitemaps.createdAt,
			})
			.from(sitemaps)
			.where(eq(sitemaps.siteId, site.id))
			.orderBy(desc(sitemaps.createdAt))
			.limit(10),
		db
			.select({
				id: alerts.id,
				title: alerts.title,
				message: alerts.message,
				alertType: alerts.alertType,
				resolved: alerts.resolved,
				createdAt: alerts.createdAt,
			})
			.from(alerts)
			.where(eq(alerts.siteId, site.id))
			.orderBy(desc(alerts.createdAt))
			.limit(10),
	]);

	return {
		site,
		stats: {
			totalUrls: normalizeCount(urlCount?.value),
			pendingAlerts: normalizeCount(alertCount?.value),
			totalSubmissions: normalizeCount(submissionCount?.value),
		},
		recentUrls,
		recentSitemaps,
		recentAlerts,
	};
}

export async function getAlertCenter(userId: string) {
	const userSites = await db
		.select({ id: sites.id, name: sites.name })
		.from(sites)
		.where(eq(sites.userId, userId));

	if (userSites.length === 0) {
		return { alerts: [], total: 0, openTotal: 0 };
	}

	const siteMap = new Map(userSites.map((s) => [s.id, s.name]));
	const siteIds = userSites.map((s) => s.id);

	const [alertRowsRes, totalRes, openTotalRes] = await Promise.allSettled([
		db
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
			.where(inArray(alerts.siteId, siteIds))
			.orderBy(desc(alerts.createdAt))
			.limit(listLimit),
		db
			.select({ value: sql<number>`cast(count(${alerts.id}) as int)` })
			.from(alerts)
			.where(inArray(alerts.siteId, siteIds)),
		db
			.select({ value: sql<number>`cast(count(${alerts.id}) as int)` })
			.from(alerts)
			.where(and(inArray(alerts.siteId, siteIds), eq(alerts.resolved, false))),
	]);

	const alertRows = alertRowsRes.status === "fulfilled" ? alertRowsRes.value : [];
	const total = totalRes.status === "fulfilled" ? totalRes.value[0]?.value : 0;
	const openTotal = openTotalRes.status === "fulfilled" ? openTotalRes.value[0]?.value : 0;

	return {
		alerts: alertRows.map((a) => ({
			...a,
			siteName: siteMap.get(a.siteId) || "Unknown",
		})),
		total: normalizeCount(total),
		openTotal: normalizeCount(openTotal),
	};
}

export async function getSubmissionLog(userId: string) {
	const userSites = await db
		.select({ id: sites.id, name: sites.name })
		.from(sites)
		.where(eq(sites.userId, userId));

	if (userSites.length === 0) {
		return { submissions: [], total: 0 };
	}

	const siteMap = new Map(userSites.map((s) => [s.id, s.name]));
	const siteIds = userSites.map((s) => s.id);

	const [rowsRes, totalRes] = await Promise.allSettled([
		db
			.select({
				id: submissions.id,
				siteId: submissions.siteId,
				loc: submissions.loc,
				engine: submissions.engine,
				status: submissions.status,
				responseMessage: submissions.responseMessage,
				createdAt: submissions.createdAt,
			})
			.from(submissions)
			.where(inArray(submissions.siteId, siteIds))
			.orderBy(desc(submissions.createdAt))
			.limit(listLimit),
		db
			.select({ value: sql<number>`cast(count(${submissions.id}) as int)` })
			.from(submissions)
			.where(inArray(submissions.siteId, siteIds)),
	]);

	const rows = rowsRes.status === "fulfilled" ? rowsRes.value : [];
	const total = totalRes.status === "fulfilled" ? totalRes.value[0]?.value : 0;

	return {
		submissions: rows.map((s) => ({
			...s,
			siteName: siteMap.get(s.siteId) || "Unknown",
		})),
		total: normalizeCount(total),
	};
}
