/**
 * Google Search Console + Indexing API integration (DB side). One OAuth connection per user
 * (user_integrations provider "google", refresh token encrypted); each site is matched to the
 * Search Console property that covers its host (site_integrations provider "gsc").
 *
 * What it does, and the limits it keeps:
 * - Sitemaps: resubmitted to Search Console after a sync finds new URLs (verified sites only).
 * - URL Inspection: fills urls.gscStatus / indexingStatus / lastCheckedAt. Every call reserves
 *   the property's daily (min(plan, 2000)) and per-minute (600) quota first; a 429 marks the
 *   window used up, so we stop instead of hammering Google.
 * - Indexing API: only for pages that pass the JobPosting / livestream guardrail, only for
 *   property owners, within the project-wide daily quota. Never for general pages.
 */
import { and, asc, eq, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { alerts, checks, siteIntegrations, siteSitemaps, sites, urls, userIntegrations, users } from "@/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/automation/credentials";
import { GOOGLE_LIMITS } from "@/lib/automation/constants";
import type { EngineSubmissionResult } from "@/lib/automation/search-engines";
import { getPausedSiteIdsForUsers } from "@/lib/platform/entitlements";
import { checkGoogleIndexingEligibility, submitGoogleIndexingNotification } from "@/lib/platform/google-indexing";
import { resolveEntitlement, type Entitlement } from "@/lib/platform/plans";
import { getErrorMessage, getSiteHost, normalizeSitemapUrl, normalizeUrlForHost, safeFetchText } from "@/lib/url-utils";
import { getGoogleClientCredentials, GOOGLE_SCOPES, refreshGoogleAccessToken, revokeGoogleToken, type GoogleTokens } from "./google-oauth";
import { canSubmitSitemaps, inspectGscUrl, isGoogleDailyQuotaMessage, listGscProperties, matchGscProperty, readGoogleError, submitGscSitemap, type InspectionSummary } from "./gsc";
import { quotaDay, quotaMinute, secondsUntilMidnight } from "./quota-windows";
import { exhaustQuota, readConfig, readQuotaUsed, requireActiveSite, requireOwnedSite, reserveQuota, truncateMessage, type SiteRow } from "./shared";

type GoogleConfig = { scopes: string[]; connectedAt: string };
export type GscConfig = { property: string; permissionLevel: string; matchedAt: string; lastSitemapSubmitAt?: string };

const PROJECT_INDEXING_KEY = "google_indexing_api:project";
const REVOKED_MESSAGE = "Google access was revoked or has expired. Reconnect Google Search Console from the Connect page.";

// Access tokens live ~1h. Cached per isolate so one cron run (or a burst of agent calls)
// refreshes each user's token once instead of once per URL.
const accessTokenCache = new Map<string, { token: string; expiresAt: number }>();

const inspectionDayKey = (property: string) => `gsc_inspection:${property}`;
const inspectionMinuteKey = (property: string) => `gsc_inspection_minute:${property}`;

async function getGoogleRow(userId: string) {
	const [row] = await db
		.select()
		.from(userIntegrations)
		.where(and(eq(userIntegrations.userId, userId), eq(userIntegrations.provider, "google")))
		.limit(1);
	return row;
}

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

/** Called by the OAuth callback. Maps the user's sites to properties right away (best effort). */
export async function saveGoogleConnection(userId: string, tokens: GoogleTokens) {
	const existing = await getGoogleRow(userId);
	const refreshToken = tokens.refreshToken;
	if (!refreshToken && !existing) {
		throw new Error("Google did not return a refresh token. Remove IndexFast under myaccount.google.com/permissions and connect again.");
	}
	const now = new Date();
	const values = {
		status: "verified",
		encryptedSecret: refreshToken ? await encryptSecret(refreshToken) : existing!.encryptedSecret,
		publicConfig: { scopes: tokens.scopes, connectedAt: now.toISOString() } satisfies GoogleConfig,
		verifiedAt: now,
		lastCheckedAt: now,
		lastErrorAt: null,
		lastErrorMessage: null,
	};
	await db
		.insert(userIntegrations)
		.values({ userId, provider: "google", ...values })
		.onConflictDoUpdate({ target: [userIntegrations.userId, userIntegrations.provider], set: { ...values, updatedAt: now } });
	accessTokenCache.set(userId, { token: tokens.accessToken, expiresAt: Date.now() + (tokens.expiresInSeconds - 60) * 1000 });
	await matchGscPropertiesForUser(userId).catch(() => null);
}

/** A usable access token for the user, refreshed when needed. Throws a user-facing message. */
export async function getGoogleAccessToken(userId: string) {
	const cached = accessTokenCache.get(userId);
	if (cached && cached.expiresAt > Date.now()) return cached.token;

	const row = await getGoogleRow(userId);
	if (!row) throw new Error("Google Search Console is not connected. Connect it from the Connect page first.");
	if (row.status !== "verified") throw new Error(row.lastErrorMessage || REVOKED_MESSAGE);
	const credentials = getGoogleClientCredentials();
	if (!credentials) throw new Error("Google integration is not configured on this server (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).");

	const result = await refreshGoogleAccessToken(credentials, await decryptSecret(row.encryptedSecret));
	if (!result.ok) {
		// invalid_grant = the user revoked access or the token expired: stop using it until they reconnect.
		if (result.error === "invalid_grant") {
			await db
				.update(userIntegrations)
				.set({ status: "failed", lastErrorAt: new Date(), lastErrorMessage: REVOKED_MESSAGE, updatedAt: new Date() })
				.where(eq(userIntegrations.id, row.id));
			throw new Error(REVOKED_MESSAGE);
		}
		throw new Error(`Google token refresh failed: ${result.message}`);
	}
	accessTokenCache.set(userId, { token: result.tokens.accessToken, expiresAt: Date.now() + (result.tokens.expiresInSeconds - 60) * 1000 });
	return result.tokens.accessToken;
}

/** Revoke at Google (best effort), then delete the token and every per-site Google row. */
export async function disconnectGoogleForUser(userId: string) {
	const row = await getGoogleRow(userId);
	if (row) {
		const refreshToken = await decryptSecret(row.encryptedSecret).catch(() => null);
		if (refreshToken) await revokeGoogleToken(refreshToken).catch(() => null);
	}
	accessTokenCache.delete(userId);
	const userSiteIds = db.select({ id: sites.id }).from(sites).where(eq(sites.userId, userId));
	await Promise.all([
		db.delete(userIntegrations).where(and(eq(userIntegrations.userId, userId), eq(userIntegrations.provider, "google"))),
		db
			.delete(siteIntegrations)
			.where(and(inArray(siteIntegrations.siteId, userSiteIds), inArray(siteIntegrations.provider, ["gsc", "google_indexing_api"]))),
	]);
}

export type GoogleConnectionStatus = {
	configured: boolean; // GOOGLE_CLIENT_ID/SECRET present on the server
	connected: boolean;
	status: string | null; // 'verified' | 'failed' | null
	scopes: string[];
	canInspect: boolean; // webmasters scope granted
	canUseIndexingApi: boolean; // indexing scope granted (still gated per page and plan)
	connectedAt: string | null;
	lastErrorMessage: string | null;
	connectUrl: string;
};

export async function getGoogleConnectionStatus(userId: string): Promise<GoogleConnectionStatus> {
	const row = await getGoogleRow(userId);
	const config = readConfig<GoogleConfig>(row?.publicConfig);
	const scopes = Array.isArray(config.scopes) ? config.scopes : [];
	return {
		configured: Boolean(getGoogleClientCredentials()),
		connected: row?.status === "verified",
		status: row?.status ?? null,
		scopes,
		canInspect: row?.status === "verified" && scopes.includes(GOOGLE_SCOPES.webmasters),
		canUseIndexingApi: row?.status === "verified" && scopes.includes(GOOGLE_SCOPES.indexing),
		connectedAt: config.connectedAt ?? null,
		lastErrorMessage: row?.lastErrorMessage ?? null,
		connectUrl: "/api/integrations/google/start",
	};
}

// ---------------------------------------------------------------------------
// Property matching
// ---------------------------------------------------------------------------

async function saveGscMatch(site: SiteRow, match: { siteUrl: string; permissionLevel: string } | null) {
	const now = new Date();
	const values = match
		? {
				status: "verified",
				publicConfig: { property: match.siteUrl, permissionLevel: match.permissionLevel, matchedAt: now.toISOString() } satisfies GscConfig,
				verifiedAt: now,
				lastCheckedAt: now,
				lastErrorAt: null,
				lastErrorMessage: null,
			}
		: {
				status: "failed",
				publicConfig: null,
				lastCheckedAt: now,
				lastErrorAt: now,
				lastErrorMessage: `No verified Search Console property covers ${getSiteHost(site)}. Add sc-domain:${site.domain.replace(/^www\./, "")} or https://${getSiteHost(site)}/ in Search Console, then refresh.`,
			};
	await db
		.insert(siteIntegrations)
		.values({ siteId: site.id, provider: "gsc", automationEnabled: true, ...values })
		.onConflictDoUpdate({ target: [siteIntegrations.siteId, siteIntegrations.provider], set: { ...values, updatedAt: now } });
}

/** List the user's properties once and (re)match every site, or just `siteId`. */
export async function matchGscPropertiesForUser(userId: string, siteId?: string) {
	const token = await getGoogleAccessToken(userId);
	const listed = await listGscProperties(token);
	if (!listed.ok) throw new Error(`Search Console: ${listed.message}`);
	const siteRows = siteId ? [await requireOwnedSite(userId, siteId)] : await db.select().from(sites).where(eq(sites.userId, userId));
	const matches = [];
	for (const site of siteRows) {
		const match = matchGscProperty(listed.properties, getSiteHost(site));
		await saveGscMatch(site, match);
		matches.push({ siteId: site.id, domain: site.domain, host: getSiteHost(site), property: match?.siteUrl ?? null, permissionLevel: match?.permissionLevel ?? null });
	}
	return { properties: listed.properties, sites: matches };
}

async function getGscRow(siteId: string) {
	const [row] = await db
		.select()
		.from(siteIntegrations)
		.where(and(eq(siteIntegrations.siteId, siteId), eq(siteIntegrations.provider, "gsc")))
		.limit(1);
	return row;
}

/** The site's matched property; matches lazily for sites added after Google was connected. */
async function requireGscProperty(site: SiteRow): Promise<GscConfig> {
	let row = await getGscRow(site.id);
	if (!row) {
		await matchGscPropertiesForUser(site.userId, site.id);
		row = await getGscRow(site.id);
	}
	const config = readConfig<GscConfig>(row?.publicConfig);
	if (row?.status !== "verified" || !config.property || !config.permissionLevel) {
		throw new Error(row?.lastErrorMessage || `No Search Console property matched for ${getSiteHost(site)}.`);
	}
	return config as GscConfig;
}

// ---------------------------------------------------------------------------
// Sitemaps
// ---------------------------------------------------------------------------

async function submitSitemaps(site: SiteRow, sitemapUrls: string[]) {
	// Same domain-proof rule as every other submission path.
	if (!site.verified) throw new Error("Verify the site's key file first, then submit sitemaps.");
	const token = await getGoogleAccessToken(site.userId);
	const config = await requireGscProperty(site);
	if (!canSubmitSitemaps(config.permissionLevel)) {
		throw new Error(`Your Search Console access to ${config.property} is ${config.permissionLevel}; submitting sitemaps needs Owner or Full user.`);
	}
	const results = [];
	for (const url of sitemapUrls) {
		const result = await submitGscSitemap(token, config.property, url).catch((error) => ({ ok: false, status: 0, message: getErrorMessage(error) }));
		results.push({ sitemapUrl: url, ok: result.ok, status: result.status, message: result.message });
	}
	const now = new Date();
	const failure = results.find((result) => !result.ok);
	await db
		.update(siteIntegrations)
		.set({
			publicConfig: { ...config, lastSitemapSubmitAt: results.some((result) => result.ok) ? now.toISOString() : config.lastSitemapSubmitAt },
			lastErrorAt: failure ? now : null,
			lastErrorMessage: failure ? truncateMessage(`${failure.sitemapUrl}: ${failure.message}`) : null,
			updatedAt: now,
		})
		.where(and(eq(siteIntegrations.siteId, site.id), eq(siteIntegrations.provider, "gsc")));
	return { property: config.property, results };
}

/** Manual "submit sitemaps to Search Console": one sitemap (must be on the host) or all active sources. */
export async function submitSitemapsToGscForUser(userId: string, siteId: string, sitemapUrl?: string) {
	const site = await requireOwnedSite(userId, siteId);
	await requireActiveSite(userId, siteId);
	const list = sitemapUrl
		? [normalizeSitemapUrl(sitemapUrl, getSiteHost(site)) as string]
		: (await db
				.select({ url: siteSitemaps.url })
				.from(siteSitemaps)
				.where(and(eq(siteSitemaps.siteId, site.id), ne(siteSitemaps.status, "disabled")))).map((row) => row.url);
	if (list.length === 0 || !list[0]) throw new Error("No sitemap to submit. Add or discover a sitemap first.");
	return submitSitemaps(site, list);
}

/**
 * After a sync found new URLs: resubmit that sitemap so Google re-reads it. Silent no-op when
 * Google is not connected; failures are recorded on the gsc row, never thrown into the sync.
 */
export async function notifyGscAfterSync(site: SiteRow, sitemapUrl: string) {
	const [gsc, google] = await Promise.all([getGscRow(site.id), getGoogleRow(site.userId)]);
	if (google?.status !== "verified" || (gsc && gsc.status !== "verified")) return;
	await submitSitemaps(site, [sitemapUrl]).catch(() => null);
}

// ---------------------------------------------------------------------------
// URL Inspection
// ---------------------------------------------------------------------------

type InspectOutcome =
	| { ok: true; inspection: InspectionSummary }
	| { ok: false; message: string; quotaStop?: "day" | "minute" };

const INDEXING_DROP_TITLE = "Pages dropped out of Google's index";

/**
 * One open alert per site (deduplicated by title, refreshed on repeats) so a large drop does not
 * flood the dashboard with one alert per URL. Not shared with service.ts's raiseAlert to avoid a
 * circular import between the engines and the automation service.
 */
async function raiseIndexingDropAlert(siteId: string, loc: string, gscStatus: string | null | undefined) {
	const message = truncateMessage(`${loc} was indexed and Search Console now reports: ${gscStatus || "not indexed"}.`);
	const [existing] = await db
		.select({ id: alerts.id })
		.from(alerts)
		.where(and(eq(alerts.siteId, siteId), eq(alerts.title, INDEXING_DROP_TITLE), eq(alerts.resolved, false)))
		.limit(1);
	if (existing) {
		await db.update(alerts).set({ message, createdAt: new Date() }).where(eq(alerts.id, existing.id));
		return;
	}
	await db.insert(alerts).values({ siteId, title: INDEXING_DROP_TITLE, message, alertType: "indexing_drop", resolved: false });
}

async function inspectAndStore(urlRow: { id: string; loc: string }, property: string, token: string, dailyLimit: number): Promise<InspectOutcome> {
	const now = new Date();
	const day = quotaDay(now, GOOGLE_LIMITS.quotaTimeZone);
	const minute = quotaMinute(now);
	const dayLimit = Math.min(dailyLimit, GOOGLE_LIMITS.inspectionsPerPropertyPerDay);
	if (!(await reserveQuota(inspectionMinuteKey(property), minute, 1, GOOGLE_LIMITS.inspectionsPerPropertyPerMinute))) {
		return { ok: false, message: "Search Console allows 600 inspections per minute per property. Try again in a minute.", quotaStop: "minute" };
	}
	if (!(await reserveQuota(inspectionDayKey(property), day, 1, dayLimit))) {
		return { ok: false, message: `Daily URL Inspection quota for ${property} is used up (${dayLimit}/day). It resets at midnight Pacific time.`, quotaStop: "day" };
	}

	const result = await inspectGscUrl(token, property, urlRow.loc).catch((error) => ({ ok: false, status: 0, message: getErrorMessage(error), inspection: undefined }));
	if (result.status === 429) {
		const daily = isGoogleDailyQuotaMessage(result.message);
		await (daily
			? exhaustQuota(inspectionDayKey(property), day, dayLimit)
			: exhaustQuota(inspectionMinuteKey(property), minute, GOOGLE_LIMITS.inspectionsPerPropertyPerMinute));
		return { ok: false, message: `Search Console rate limit: ${result.message}`, quotaStop: daily ? "day" : "minute" };
	}
	if (!result.ok || !result.inspection) return { ok: false, message: `Search Console: ${result.message}` };

	const inspection = result.inspection;
	// Read the previous verdict first: a page Google reported as indexed that now is not is the
	// deindexing signal the dashboard alerts on.
	const [previous] = await db
		.select({ siteId: urls.siteId, indexingStatus: urls.indexingStatus })
		.from(urls)
		.where(eq(urls.id, urlRow.id))
		.limit(1);
	const dropped = previous?.indexingStatus === "indexed" && inspection.indexingStatus !== "indexed";
	await Promise.all([
		dropped ? raiseIndexingDropAlert(previous.siteId, urlRow.loc, inspection.gscStatus) : Promise.resolve(),
		db
			.update(urls)
			.set({ gscStatus: inspection.gscStatus, indexingStatus: inspection.indexingStatus, lastCheckedAt: now })
			.where(eq(urls.id, urlRow.id)),
		db.insert(checks).values({
			urlId: urlRow.id,
			checkType: "gsc_inspection",
			status: inspection.indexingStatus === "indexed" ? "pass" : inspection.indexingStatus === "blockers" ? "fail" : "warn",
			details: { property, ...inspection },
			checkedAt: now,
		}),
	]);
	return { ok: true, inspection };
}

/** Manual inspect (dashboard button, REST, MCP). Pass a URL on the site's host, or a tracked urlId. */
export async function inspectUrlForUser(userId: string, siteId: string, input: { url?: string; urlId?: string }) {
	const site = await requireOwnedSite(userId, siteId);
	const entitlement = await requireActiveSite(userId, siteId);
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
	if (!urlRow) throw new Error("URL not found.");

	const token = await getGoogleAccessToken(userId);
	const { property } = await requireGscProperty(site);
	const outcome = await inspectAndStore(urlRow, property, token, entitlement.limits.gscInspectionsPerDay);
	if (!outcome.ok) throw new Error(outcome.message);
	return { urlId: urlRow.id, loc: urlRow.loc, property, ...outcome.inspection };
}

export async function getInspectionUsageToday(siteId: string) {
	const row = await getGscRow(siteId);
	const property = readConfig<GscConfig>(row?.publicConfig).property;
	return property ? readQuotaUsed(inspectionDayKey(property), quotaDay(new Date(), GOOGLE_LIMITS.quotaTimeZone)) : 0;
}

/**
 * Hourly cron step: inspect never-checked URLs first, then the stalest, in a bounded batch.
 * A property whose quota runs out stops for this run; the deadline stops everything.
 */
export async function runScheduledGscInspections(deadline: number) {
	const now = new Date();
	const candidates = await db
		.select({ site: sites, publicConfig: siteIntegrations.publicConfig, billingTier: users.billingTier, planExpiresAt: users.planExpiresAt })
		.from(siteIntegrations)
		.innerJoin(sites, eq(siteIntegrations.siteId, sites.id))
		.innerJoin(users, eq(sites.userId, users.id))
		.innerJoin(userIntegrations, and(eq(userIntegrations.userId, sites.userId), eq(userIntegrations.provider, "google"), eq(userIntegrations.status, "verified")))
		.where(and(eq(siteIntegrations.provider, "gsc"), eq(siteIntegrations.status, "verified")))
		// Random order so the same few large sites cannot use the whole per-run budget every hour.
		// shortcut: random rotation, not oldest-inspection-first; switch when fairness must be exact.
		.orderBy(sql`random()`)
		.limit(1000);

	const entitlements = new Map<string, Entitlement>();
	for (const row of candidates) {
		if (!entitlements.has(row.site.userId)) entitlements.set(row.site.userId, resolveEntitlement(row, now));
	}
	const paused = await getPausedSiteIdsForUsers(entitlements);
	const staleBefore = new Date(now.getTime() - GOOGLE_LIMITS.reinspectAfterDays * 24 * 3600 * 1000);
	const stoppedProperties = new Set<string>();
	const summary = { sites: 0, inspected: 0, failed: 0, quotaStops: 0, errors: [] as string[] };

	for (const row of candidates) {
		if (Date.now() > deadline || summary.inspected + summary.failed >= GOOGLE_LIMITS.maxInspectionsPerRun) break;
		const property = readConfig<GscConfig>(row.publicConfig).property;
		if (!property || paused.has(row.site.id) || stoppedProperties.has(property)) continue;
		const remaining = GOOGLE_LIMITS.maxInspectionsPerRun - summary.inspected - summary.failed;
		const due = await db
			.select({ id: urls.id, loc: urls.loc })
			.from(urls)
			.where(and(eq(urls.siteId, row.site.id), or(isNull(urls.lastCheckedAt), lt(urls.lastCheckedAt, staleBefore))))
			.orderBy(sql`${urls.lastCheckedAt} asc nulls first`, asc(urls.createdAt))
			.limit(Math.min(GOOGLE_LIMITS.maxInspectionsPerSitePerRun, remaining));
		if (due.length === 0) continue;

		let token: string;
		try {
			token = await getGoogleAccessToken(row.site.userId);
		} catch (error) {
			summary.errors.push(`${row.site.domain}: ${getErrorMessage(error)}`);
			continue;
		}
		summary.sites += 1;
		const dailyLimit = entitlements.get(row.site.userId)!.limits.gscInspectionsPerDay;
		for (const urlRow of due) {
			if (Date.now() > deadline) break;
			const outcome = await inspectAndStore(urlRow, property, token, dailyLimit);
			if (outcome.ok) {
				summary.inspected += 1;
				continue;
			}
			if (outcome.quotaStop) {
				summary.quotaStops += 1;
				stoppedProperties.add(property);
				break;
			}
			summary.failed += 1;
		}
	}
	return { ...summary, errors: summary.errors.slice(0, 10) };
}

// ---------------------------------------------------------------------------
// Indexing API (engine "google_indexing_api")
// ---------------------------------------------------------------------------

/**
 * Send one URL. The page's live JSON-LD must pass the guardrail first; ineligible pages are
 * returned as `skipped` (never sent, no quota used). Quota is reserved only after the
 * guardrail and the token pass, so a refused page never burns the shared project quota.
 */
export async function submitGoogleIndexingUrl(site: SiteRow, url: string): Promise<EngineSubmissionResult & { skipped?: boolean }> {
	let html = "";
	try {
		html = (await safeFetchText(url, { maxBytes: 2 * 1024 * 1024, truncate: true, timeoutMs: 15_000 })).text;
	} catch (error) {
		return { ok: false, status: 0, message: `Could not fetch the page to check eligibility: ${getErrorMessage(error)}` };
	}
	const eligibility = checkGoogleIndexingEligibility(html);
	if (!eligibility.eligible) {
		return { ok: false, status: 422, skipped: true, message: `Not sent to Google Indexing API: ${eligibility.reason}` };
	}

	let token: string;
	try {
		token = await getGoogleAccessToken(site.userId);
	} catch (error) {
		return { ok: false, status: 401, message: getErrorMessage(error) };
	}
	const day = quotaDay(new Date(), GOOGLE_LIMITS.quotaTimeZone);
	const untilReset = secondsUntilMidnight(GOOGLE_LIMITS.quotaTimeZone);
	if (!(await reserveQuota(PROJECT_INDEXING_KEY, day, 1, GOOGLE_LIMITS.indexingApiProjectPerDay))) {
		return { ok: false, status: 429, message: "Google Indexing API daily quota is used up. Retrying after midnight Pacific time.", retryAfterSeconds: untilReset };
	}
	const result = await submitGoogleIndexingNotification(token, url, "URL_UPDATED");
	if (result.ok) return { ok: true, status: result.status, message: "Google Indexing API accepted the URL_UPDATED notification." };
	const message = readGoogleError(result.status, result.message);
	if (result.status === 429) {
		if (isGoogleDailyQuotaMessage(message)) await exhaustQuota(PROJECT_INDEXING_KEY, day, GOOGLE_LIMITS.indexingApiProjectPerDay);
		return { ok: false, status: 429, message, retryAfterSeconds: isGoogleDailyQuotaMessage(message) ? untilReset : undefined };
	}
	return { ok: false, status: result.status, message };
}
