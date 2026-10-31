/**
 * Read-only aggregates for /admin. Platform-wide (not user-scoped), so these must only ever
 * be called after requireAdmin(). Kept to a fixed number of parallel queries so the panel
 * stays fast on Neon HTTP.
 *
 * Rules the numbers follow:
 * - The range starts at UTC midnight, so every header total equals the sum of its daily bars.
 * - MRR counts paying customers only: a Razorpay payment that is paid and still in its period,
 *   or a legacy Dodo tier backed by an active subscription. Paid access without one of those is
 *   split three ways (admin grant, paid customer in grace, lapsed legacy) so a grant count never
 *   includes someone who paid.
 * - A cron run still "running" after staleCronRunMinutes was killed by the Worker and reads
 *   as timed out, even before the next tick closes it.
 */
import { and, desc, eq, gt, gte, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	apiUsageEvents,
	cronRuns,
	pageViews,
	payments,
	siteIntegrations,
	siteSitemaps,
	sites,
	submissionJobs,
	submissions,
	subscriptions,
	urls,
	userIntegrations,
	users,
} from "@/db/schema";
import { AUTOMATION_LIMITS } from "@/lib/automation/constants";
import { PLANS, PLAN_GRACE_DAYS, normalizeBillingTier, resolveEntitlement, type BillingTier } from "@/lib/platform/plans";

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const int = (expression: ReturnType<typeof sql>) => sql<number>`cast(${expression} as int)`;

// Hidden paid tiers only Dodo subscribers can hold.
const LEGACY_TIERS = Object.values(PLANS)
	.filter((plan) => !plan.visible && plan.priceUsd > 0)
	.map((plan) => plan.id);

// The hourly cron is overdue once two ticks have passed without a run.
const CRON_OVERDUE_MS = 2 * 60 * MINUTE_MS;

type IntegrationSource = { table: "site" | "user"; provider: string };

/** Engines in the same order the dashboard and list_engines use. */
const ENGINE_CATALOG: Array<{ engine: string; label: string; note: string; kind: "submission" | "inspection"; setup: IntegrationSource }> = [
	{ engine: "indexnow", label: "IndexNow", note: "Bing, Yandex, Seznam, Naver, Yep", kind: "submission", setup: { table: "site", provider: "indexnow" } },
	{ engine: "bing", label: "Bing Webmaster API", note: "Per-user API key", kind: "submission", setup: { table: "user", provider: "bing" } },
	{
		engine: "google_search_console",
		label: "Google Search Console",
		note: "URL inspection and sitemap submit; sends no URLs",
		kind: "inspection",
		setup: { table: "site", provider: "gsc" },
	},
	{
		engine: "google_indexing_api",
		label: "Google Indexing API",
		note: "JobPosting and livestream pages only",
		kind: "submission",
		setup: { table: "site", provider: "google_indexing_api" },
	},
	{ engine: "yandex", label: "Yandex Webmaster", note: "Recrawl queue", kind: "submission", setup: { table: "site", provider: "yandex" } },
	{ engine: "baidu", label: "Baidu URL push", note: "Per-site push token", kind: "submission", setup: { table: "site", provider: "baidu" } },
];

/** Readable engine name by submissions.engine id, so every admin list names engines alike. */
export const ENGINE_LABELS: Record<string, string> = Object.fromEntries(ENGINE_CATALOG.map((entry) => [entry.engine, entry.label]));

const PROVIDER_LABELS: Record<string, string> = {
	indexnow: "IndexNow",
	bing: "Bing Webmaster API",
	gsc: "Google Search Console",
	google: "Google account",
	google_indexing_api: "Google Indexing API",
	yandex: "Yandex Webmaster",
	baidu: "Baidu URL push",
};

/** First instant of the range: UTC midnight, rangeDays - 1 days before today (today counts). */
export function utcRangeStart(now: Date, rangeDays: number) {
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (rangeDays - 1)));
}

export type CronRunState = "success" | "failed" | "timed_out" | "running";

export function cronRunState(run: { status: string; startedAt: Date; errorMessage: string | null }, now: Date): CronRunState {
	if (run.status === "success") return "success";
	if (run.status === "failed") return run.errorMessage?.startsWith("Timed out") ? "timed_out" : "failed";
	// The Worker can kill a run mid-way; its row stays 'running' until the next tick closes it.
	return now.getTime() - run.startedAt.getTime() > AUTOMATION_LIMITS.staleCronRunMinutes * MINUTE_MS ? "timed_out" : "running";
}

/**
 * Paying customers and list-price MRR. A Razorpay customer counts once, on the plan of the
 * paid period that ends last (stacked periods are one customer). Legacy rows must already be
 * filtered to an active Dodo subscription.
 */
export function computePayingCustomers(
	paidPeriods: Array<{ userId: string; plan: string; periodEnd: Date | null }>,
	legacySubscribers: Array<{ userId: string; billingTier: string }>,
	now: Date,
) {
	const latest = new Map<string, { plan: BillingTier; periodEnd: number }>();
	for (const row of paidPeriods) {
		const end = row.periodEnd?.getTime() ?? 0;
		if (end <= now.getTime()) continue;
		const current = latest.get(row.userId);
		if (!current || end > current.periodEnd) latest.set(row.userId, { plan: normalizeBillingTier(row.plan), periodEnd: end });
	}
	const tierByUser = new Map<string, BillingTier>([...latest].map(([userId, { plan }]) => [userId, plan]));
	for (const row of legacySubscribers) {
		if (!tierByUser.has(row.userId)) tierByUser.set(row.userId, normalizeBillingTier(row.billingTier));
	}
	const paying = [...tierByUser].filter(([, tier]) => PLANS[tier].priceUsd > 0);
	const planMix = paying.reduce<Record<string, number>>((mix, [, tier]) => ({ ...mix, [tier]: (mix[tier] ?? 0) + 1 }), {});
	return {
		payingUserIds: new Set(paying.map(([userId]) => userId)),
		planMix,
		mrrUsd: paying.reduce((total, [, tier]) => total + PLANS[tier].priceUsd, 0),
	};
}

/**
 * Users holding paid access that computePayingCustomers did not count. paidPeriods may include
 * periods that ended within the grace window: those users paid, so they are never grants.
 * A null expiry on a paid tier is a legacy Dodo account; reaching here means no active sub.
 */
export function classifyUnpaidAccess(
	userRows: Array<{ id: string; billingTier: string; planExpiresAt: Date | null }>,
	paidPeriods: Array<{ userId: string; periodEnd: Date | null }>,
	payingUserIds: Set<string>,
	now: Date,
) {
	const graceFloor = now.getTime() - PLAN_GRACE_DAYS * DAY_MS;
	const paidInGrace = new Set(paidPeriods.filter((row) => (row.periodEnd?.getTime() ?? 0) > graceFloor).map((row) => row.userId));
	const counts = { granted: 0, inGrace: 0, lapsedLegacy: 0 };
	for (const row of userRows) {
		if (payingUserIds.has(row.id)) continue;
		const status = resolveEntitlement(row, now).status;
		if (paidInGrace.has(row.id)) counts.inGrace += status === "active" || status === "grace" ? 1 : 0;
		else if (status === "active" && !row.planExpiresAt) counts.lapsedLegacy += 1;
		else if (status === "active") counts.granted += 1;
	}
	return counts;
}

export async function getAdminOverview(rangeDays = 30) {
	const now = new Date();
	const since = utcRangeStart(now, rangeDays);
	const week = new Date(now.getTime() - 7 * DAY_MS);
	const today = new Date(now.getTime() - DAY_MS);
	// Paid periods that ended inside the grace window still mark a paying customer, not a grant.
	const paidFloor = new Date(now.getTime() - PLAN_GRACE_DAYS * DAY_MS);
	// submissionCounts needs both windows; scan only back to the older one.
	const submissionsFloor = new Date(Math.min(since.getTime(), week.getTime()));

	const [
		userRows,
		paidPeriods,
		legacySubscribers,
		[userCounts],
		[siteCounts],
		[urlCounts],
		[submissionCounts],
		[queue],
		queueByEngine,
		submissionsByEngine,
		siteIntegrationCounts,
		userIntegrationCounts,
		siteIntegrationErrors,
		userIntegrationErrors,
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
		cronRows,
		failingSitemaps,
		topUsers,
	] = await Promise.all([
		db
			.select({ id: users.id, billingTier: users.billingTier, planExpiresAt: users.planExpiresAt })
			.from(users)
			.where(ne(users.billingTier, "free")),
		db
			.select({ userId: payments.userId, plan: payments.plan, periodEnd: payments.periodEnd })
			.from(payments)
			.where(and(eq(payments.provider, "razorpay"), eq(payments.status, "paid"), gt(payments.periodEnd, paidFloor))),
		db
			.selectDistinct({ userId: users.id, billingTier: users.billingTier })
			.from(users)
			.innerJoin(subscriptions, eq(subscriptions.userId, users.id))
			.where(and(inArray(users.billingTier, LEGACY_TIERS), eq(subscriptions.status, "active"))),
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
			.from(submissions)
			.where(gte(submissions.createdAt, submissionsFloor)),
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
				queued: int(sql`count(*) filter (where ${submissionJobs.status} = 'queued')`),
				processing: int(sql`count(*) filter (where ${submissionJobs.status} = 'processing')`),
				failedRange: int(sql`count(*) filter (where ${submissionJobs.status} = 'failed' and ${submissionJobs.updatedAt} >= ${since})`),
			})
			.from(submissionJobs)
			.where(inArray(submissionJobs.status, ["queued", "processing", "failed"]))
			.groupBy(submissionJobs.engine),
		db
			.select({
				engine: submissions.engine,
				total: int(sql`count(*)`),
				success: int(sql`count(*) filter (where ${submissions.status} = 'success')`),
				failed: int(sql`count(*) filter (where ${submissions.status} = 'failed')`),
			})
			.from(submissions)
			.where(gte(submissions.createdAt, since))
			.groupBy(submissions.engine),
		db
			.select({ provider: siteIntegrations.provider, status: siteIntegrations.status, count: int(sql`count(*)`) })
			.from(siteIntegrations)
			.groupBy(siteIntegrations.provider, siteIntegrations.status),
		db
			.select({ provider: userIntegrations.provider, status: userIntegrations.status, count: int(sql`count(*)`) })
			.from(userIntegrations)
			.groupBy(userIntegrations.provider, userIntegrations.status),
		db
			.select({
				provider: siteIntegrations.provider,
				status: siteIntegrations.status,
				message: siteIntegrations.lastErrorMessage,
				at: siteIntegrations.lastErrorAt,
				owner: sites.domain,
			})
			.from(siteIntegrations)
			.innerJoin(sites, eq(siteIntegrations.siteId, sites.id))
			.where(and(isNotNull(siteIntegrations.lastErrorMessage), gte(siteIntegrations.lastErrorAt, since)))
			.orderBy(desc(siteIntegrations.lastErrorAt))
			.limit(8),
		db
			.select({
				provider: userIntegrations.provider,
				status: userIntegrations.status,
				message: userIntegrations.lastErrorMessage,
				at: userIntegrations.lastErrorAt,
				owner: users.email,
			})
			.from(userIntegrations)
			.innerJoin(users, eq(userIntegrations.userId, users.id))
			.where(and(isNotNull(userIntegrations.lastErrorMessage), gte(userIntegrations.lastErrorAt, since)))
			.orderBy(desc(userIntegrations.lastErrorAt))
			.limit(8),
		db
			.select({
				id: submissions.id,
				domain: sites.domain,
				loc: submissions.loc,
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
		db.select({ count: int(sql`count(*)`) }).from(apiUsageEvents).where(gte(apiUsageEvents.createdAt, since)),
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
				periodEnd: payments.periodEnd,
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
	]);

	const { payingUserIds, planMix, mrrUsd } = computePayingCustomers(paidPeriods, legacySubscribers, now);
	const unpaidAccess = classifyUnpaidAccess(userRows, paidPeriods, payingUserIds, now);

	const recentCron = cronRows.map((run) => ({ ...run, state: cronRunState(run, now) }));
	const lastCron = recentCron[0] ?? null;

	return {
		rangeDays,
		rangeStart: since.toISOString().slice(0, 10),
		users: { ...userCounts, paying: payingUserIds.size, ...unpaidAccess, planMix },
		mrrUsd,
		revenue,
		sites: siteCounts,
		urls: urlCounts,
		submissions: submissionCounts,
		recentSubmissions,
		queue,
		engines: buildEngineRows(submissionsByEngine, queueByEngine, siteIntegrationCounts, userIntegrationCounts),
		engineErrors: [...siteIntegrationErrors, ...userIntegrationErrors]
			.map((row) => ({ ...row, label: PROVIDER_LABELS[row.provider] ?? row.provider }))
			.sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0))
			.slice(0, 8),
		apiCallsRange: apiCount?.count ?? 0,
		apiUsageByRoute,
		recentPayments,
		traffic: { daily: fillDays(dailyViews, rangeDays, now), totals: viewTotals, topPages, topReferrers, countries, devices },
		dailySignups: fillCountDays(rawDailySignups, rangeDays, now),
		dailySubmissions: fillSubmissionDays(rawDailySubmissions, rangeDays, now),
		recentCron,
		cronOverdue: !lastCron || now.getTime() - lastCron.startedAt.getTime() > CRON_OVERDUE_MS,
		failingSitemaps,
		topUsers,
	};
}

type IntegrationCount = { provider: string; status: string; count: number };

function buildEngineRows(
	sent: Array<{ engine: string; total: number; success: number; failed: number }>,
	jobs: Array<{ engine: string; queued: number; processing: number; failedRange: number }>,
	siteCounts: IntegrationCount[],
	userCounts: IntegrationCount[],
) {
	const tally = (rows: IntegrationCount[], provider: string) => {
		const of = (status: string) => rows.filter((row) => row.provider === provider && row.status === status).reduce((sum, row) => sum + row.count, 0);
		return { verified: of("verified"), pending: of("pending"), failed: of("failed") };
	};
	return ENGINE_CATALOG.map((entry) => {
		const setup = tally(entry.setup.table === "site" ? siteCounts : userCounts, entry.setup.provider);
		const sends = sent.find((row) => row.engine === entry.engine);
		const queue = jobs.find((row) => row.engine === entry.engine);
		return {
			...entry,
			...setup,
			// GSC is reached through a per-user Google account before any property matches.
			googleAccounts: entry.engine === "google_search_console" ? tally(userCounts, "google") : null,
			sent: sends?.total ?? 0,
			success: sends?.success ?? 0,
			failedSends: sends?.failed ?? 0,
			queued: (queue?.queued ?? 0) + (queue?.processing ?? 0),
			failedJobs: queue?.failedRange ?? 0,
		};
	});
}

export type EngineHealthRow = ReturnType<typeof buildEngineRows>[number];

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

/** UTC calendar days of the range, oldest first; matches date_trunc('day') on UTC timestamps. */
function rangeDaysList(days: number, now: Date) {
	return Array.from({ length: days }, (_, index) => new Date(now.getTime() - (days - 1 - index) * DAY_MS).toISOString().slice(0, 10));
}

/** Zero-fill missing days so page view chart's x-axis is continuous. */
function fillDays(rows: Array<{ day: string; views: number; visitors: number }>, days: number, now: Date) {
	const byDay = new Map(rows.map((row) => [row.day, row]));
	return rangeDaysList(days, now).map((day) => byDay.get(day) ?? { day, views: 0, visitors: 0 });
}

/** Zero-fill missing days for single count series like daily user signups. */
function fillCountDays(rows: Array<{ day: string; count: number }>, days: number, now: Date) {
	const byDay = new Map(rows.map((row) => [row.day, row.count]));
	return rangeDaysList(days, now).map((day) => ({ day, value: byDay.get(day) ?? 0 }));
}

/** Zero-fill missing days for daily submission series. */
function fillSubmissionDays(rows: Array<{ day: string; count: number; success: number }>, days: number, now: Date) {
	const byDay = new Map(rows.map((row) => [row.day, row]));
	return rangeDaysList(days, now).map((day) => ({ day, value: byDay.get(day)?.count ?? 0, success: byDay.get(day)?.success ?? 0 }));
}

export type AdminOverview = Awaited<ReturnType<typeof getAdminOverview>>;
export type AdminCronRun = AdminOverview["recentCron"][number];
