/**
 * Read-only aggregates for /admin. Platform-wide (not user-scoped), so these must only ever
 * be called after requireAdmin(). Kept to a fixed number of parallel queries so the panel
 * stays fast on Neon HTTP.
 */
import { and, desc, eq, gte, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	apiUsageEvents,
	cronRuns,
	pageViews,
	payments,
	siteSitemaps,
	sites,
	submissionJobs,
	submissions,
	urls,
	userIntegrations,
	users,
} from "@/db/schema";
import { PLANS, normalizeBillingTier, resolveEntitlement } from "@/lib/platform/plans";

const DAY_MS = 24 * 60 * 60 * 1000;
const int = (expression: ReturnType<typeof sql>) => sql<number>`cast(${expression} as int)`;

export async function getAdminOverview(rangeDays = 30) {
	const now = new Date();
	const since = new Date(now.getTime() - rangeDays * DAY_MS);
	const week = new Date(now.getTime() - 7 * DAY_MS);
	const today = new Date(now.getTime() - DAY_MS);

	const [
		userRows,
		[userCounts],
		[siteCounts],
		[urlCounts],
		[submissionCounts],
		[queue],
		queueByEngine,
		submissionsByEngine,
		recentSubmissions,
		[apiCount],
		apiUsageByRoute,
		revenue,
		recentPayments,
		dailyViews,
		[viewTotals],
		topPages,
		topReferrers,
		countries,
		devices,
		rawDailySignups,
		rawDailySubmissions,
		recentCron,
		failingSitemaps,
		topUsers,
		[bingIntegrations],
	] = await Promise.all([
		db.select({ billingTier: users.billingTier, planExpiresAt: users.planExpiresAt }).from(users).where(ne(users.billingTier, "free")),
		db
			.select({
				total: int(sql`count(*)`),
				new7d: int(sql`count(*) filter (where ${users.createdAt} >= ${week})`),
				newRange: int(sql`count(*) filter (where ${users.createdAt} >= ${since})`),
				activeToday: int(sql`count(*) filter (where ${users.lastSeenAt} >= ${today})`),
				active7d: int(sql`count(*) filter (where ${users.lastSeenAt} >= ${week})`),
			})
			.from(users),
		db
			.select({
				total: int(sql`count(*)`),
				verified: int(sql`count(*) filter (where ${sites.verified})`),
				live: int(sql`count(*) filter (where ${sites.verified} and ${sites.automationEnabled})`),
				new7d: int(sql`count(*) filter (where ${sites.createdAt} >= ${week})`),
				bingConnected: int(
					sql`count(*) filter (where exists (select 1 from ${userIntegrations} where ${userIntegrations.userId} = ${sites.userId} and ${userIntegrations.provider} = 'bing' and ${userIntegrations.status} = 'verified'))`,
				),
			})
			.from(sites),
		db
			.select({
				total: int(sql`count(*)`),
				new7d: int(sql`count(*) filter (where ${urls.createdAt} >= ${week})`),
				pending: int(sql`count(*) filter (where ${urls.lastSubmittedAt} is null)`),
				indexed: int(sql`count(*) filter (where ${urls.indexingStatus} = 'indexed')`),
			})
			.from(urls),
		db
			.select({
				total7d: int(sql`count(*) filter (where ${submissions.createdAt} >= ${week})`),
				success7d: int(sql`count(*) filter (where ${submissions.status} = 'success' and ${submissions.createdAt} >= ${week})`),
				totalRange: int(sql`count(*) filter (where ${submissions.createdAt} >= ${since})`),
				successRange: int(sql`count(*) filter (where ${submissions.status} = 'success' and ${submissions.createdAt} >= ${since})`),
			})
			.from(submissions),
		db
			.select({
				queued: int(sql`count(*) filter (where ${submissionJobs.status} = 'queued')`),
				processing: int(sql`count(*) filter (where ${submissionJobs.status} = 'processing')`),
				failed7d: int(sql`count(*) filter (where ${submissionJobs.status} = 'failed' and ${submissionJobs.updatedAt} >= ${week})`),
			})
			.from(submissionJobs)
			.where(inArray(submissionJobs.status, ["queued", "processing", "failed"])),
		db
			.select({
				engine: submissionJobs.engine,
				status: submissionJobs.status,
				count: int(sql`count(*)`),
			})
			.from(submissionJobs)
			.where(inArray(submissionJobs.status, ["queued", "processing", "failed"]))
			.groupBy(submissionJobs.engine, submissionJobs.status),
		db
			.select({
				engine: submissions.engine,
				status: submissions.status,
				count: int(sql`count(*)`),
			})
			.from(submissions)
			.where(gte(submissions.createdAt, since))
			.groupBy(submissions.engine, submissions.status),
		db
			.select({
				id: submissions.id,
				domain: sites.domain,
				engine: submissions.engine,
				status: submissions.status,
				responseMessage: submissions.responseMessage,
				attempt: submissions.attempt,
				createdAt: submissions.createdAt,
			})
			.from(submissions)
			.innerJoin(sites, eq(submissions.siteId, sites.id))
			.orderBy(desc(submissions.createdAt))
			.limit(15),
		db.select({ count: int(sql`count(*)`) }).from(apiUsageEvents).where(gte(apiUsageEvents.createdAt, week)),
		db
			.select({
				route: apiUsageEvents.route,
				method: apiUsageEvents.method,
				count: int(sql`count(*)`),
			})
			.from(apiUsageEvents)
			.where(gte(apiUsageEvents.createdAt, since))
			.groupBy(apiUsageEvents.route, apiUsageEvents.method)
			.orderBy(desc(sql`count(*)`))
			.limit(8),
		db
			.select({
				currency: payments.currency,
				total: int(sql`coalesce(sum(${payments.amount}), 0)`),
				range: int(sql`coalesce(sum(${payments.amount}) filter (where ${payments.createdAt} >= ${since}), 0)`),
				count: int(sql`count(*)`),
			})
			.from(payments)
			.where(eq(payments.status, "paid"))
			.groupBy(payments.currency),
		db
			.select({
				id: payments.id,
				email: users.email,
				plan: payments.plan,
				amount: payments.amount,
				currency: payments.currency,
				status: payments.status,
				createdAt: payments.createdAt,
			})
			.from(payments)
			.innerJoin(users, eq(payments.userId, users.id))
			.where(ne(payments.status, "created"))
			.orderBy(desc(payments.createdAt))
			.limit(15),
		db
			.select({
				day: sql<string>`to_char(date_trunc('day', ${pageViews.createdAt}), 'YYYY-MM-DD')`,
				views: int(sql`count(*)`),
				visitors: int(sql`count(distinct ${pageViews.visitorHash})`),
			})
			.from(pageViews)
			.where(gte(pageViews.createdAt, since))
			.groupBy(sql`1`)
			.orderBy(sql`1`),
		db
			.select({ views: int(sql`count(*)`), visitors: int(sql`count(distinct ${pageViews.visitorHash})`) })
			.from(pageViews)
			.where(gte(pageViews.createdAt, since)),
		topBy(pageViews.path, since),
		topBy(pageViews.referrer, since, isNotNull(pageViews.referrer)),
		topBy(pageViews.country, since, isNotNull(pageViews.country)),
		topBy(pageViews.device, since, isNotNull(pageViews.device)),
		db
			.select({ day: sql<string>`to_char(date_trunc('day', ${users.createdAt}), 'YYYY-MM-DD')`, count: int(sql`count(*)`) })
			.from(users)
			.where(gte(users.createdAt, since))
			.groupBy(sql`1`)
			.orderBy(sql`1`),
		db
			.select({
				day: sql<string>`to_char(date_trunc('day', ${submissions.createdAt}), 'YYYY-MM-DD')`,
				count: int(sql`count(*)`),
				success: int(sql`count(*) filter (where ${submissions.status} = 'success')`),
			})
			.from(submissions)
			.where(gte(submissions.createdAt, since))
			.groupBy(sql`1`)
			.orderBy(sql`1`),
		db.select().from(cronRuns).orderBy(desc(cronRuns.startedAt)).limit(12),
		db
			.select({ url: siteSitemaps.url, error: siteSitemaps.lastErrorMessage, at: siteSitemaps.lastErrorAt, email: users.email })
			.from(siteSitemaps)
			.innerJoin(sites, eq(siteSitemaps.siteId, sites.id))
			.innerJoin(users, eq(sites.userId, users.id))
			.where(eq(siteSitemaps.status, "failed"))
			.orderBy(desc(siteSitemaps.lastErrorAt))
			.limit(10),
		db
			.select({
				id: users.id,
				email: users.email,
				billingTier: users.billingTier,
				planExpiresAt: users.planExpiresAt,
				createdAt: users.createdAt,
				lastSeenAt: users.lastSeenAt,
				siteCount: int(sql`(select count(*) from ${sites} where ${sites.userId} = ${users.id})`),
				urlCount: int(sql`(select count(*) from ${urls} inner join ${sites} on ${urls.siteId} = ${sites.id} where ${sites.userId} = ${users.id})`),
			})
			.from(users)
			.orderBy(desc(users.createdAt))
			.limit(50),
		db
			.select({
				total: int(sql`count(*)`),
				verified: int(sql`count(*) filter (where ${userIntegrations.status} = 'verified')`),
			})
			.from(userIntegrations)
			.where(eq(userIntegrations.provider, "bing")),
	]);

	// MRR = monthly list price of every paid plan currently in force (active or grace).
	const planMix: Record<string, number> = {};
	let mrrUsd = 0;
	for (const row of userRows) {
		const entitlement = resolveEntitlement(row, now);
		if (entitlement.status === "active" || entitlement.status === "grace") {
			const tier = normalizeBillingTier(row.billingTier);
			planMix[tier] = (planMix[tier] ?? 0) + 1;
			mrrUsd += PLANS[tier].priceUsd;
		}
	}

	return {
		rangeDays,
		users: { ...userCounts, paying: Object.values(planMix).reduce((total, count) => total + count, 0), planMix },
		mrrUsd,
		revenue,
		sites: siteCounts,
		urls: urlCounts,
		submissions: submissionCounts,
		submissionsByEngine,
		recentSubmissions,
		queue,
		queueByEngine,
		bingIntegrations: bingIntegrations ?? { total: 0, verified: 0 },
		apiCalls7d: apiCount?.count ?? 0,
		apiUsageByRoute,
		recentPayments,
		traffic: { daily: fillDays(dailyViews, rangeDays, now), totals: viewTotals, topPages, topReferrers, countries, devices },
		dailySignups: fillCountDays(rawDailySignups, rangeDays, now),
		dailySubmissions: fillSubmissionDays(rawDailySubmissions, rangeDays, now),
		recentCron,
		failingSitemaps,
		topUsers,
	};
}

function topBy(
	column: typeof pageViews.path | typeof pageViews.referrer | typeof pageViews.country | typeof pageViews.device,
	since: Date,
	extra?: ReturnType<typeof isNotNull>,
) {
	return db
		.select({ label: sql<string>`${column}`, views: int(sql`count(*)`) })
		.from(pageViews)
		.where(and(gte(pageViews.createdAt, since), extra))
		.groupBy(column)
		.orderBy(desc(sql`count(*)`))
		.limit(10);
}

/** Zero-fill missing days so page view chart's x-axis is continuous. */
function fillDays(rows: Array<{ day: string; views: number; visitors: number }>, days: number, now: Date) {
	const byDay = new Map(rows.map((row) => [row.day, row]));
	const result = [];
	for (let offset = days - 1; offset >= 0; offset -= 1) {
		const day = new Date(now.getTime() - offset * DAY_MS).toISOString().slice(0, 10);
		result.push(byDay.get(day) ?? { day, views: 0, visitors: 0 });
	}
	return result;
}

/** Zero-fill missing days for single count series like daily user signups. */
function fillCountDays(rows: Array<{ day: string; count: number }>, days: number, now: Date) {
	const byDay = new Map(rows.map((row) => [row.day, row.count]));
	const result = [];
	for (let offset = days - 1; offset >= 0; offset -= 1) {
		const day = new Date(now.getTime() - offset * DAY_MS).toISOString().slice(0, 10);
		result.push({ day, value: byDay.get(day) ?? 0 });
	}
	return result;
}

/** Zero-fill missing days for daily submission series. */
function fillSubmissionDays(rows: Array<{ day: string; count: number; success: number }>, days: number, now: Date) {
	const byDay = new Map(rows.map((row) => [row.day, row]));
	const result = [];
	for (let offset = days - 1; offset >= 0; offset -= 1) {
		const day = new Date(now.getTime() - offset * DAY_MS).toISOString().slice(0, 10);
		const existing = byDay.get(day);
		result.push({ day, value: existing?.count ?? 0, success: existing?.success ?? 0 });
	}
	return result;
}

export type AdminOverview = Awaited<ReturnType<typeof getAdminOverview>>;
