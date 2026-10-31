/**
 * IndexFast automation engine: the only place that mutates sites, sitemap sources, URLs and
 * the submission queue. Dashboard server actions, the REST API, MCP tools and the hourly cron
 * all call into this module, so business rules live here exactly once.
 *
 * The product flow it implements (see docs/automation.md):
 *   1. Add a site by domain -> sitemaps are auto-discovered and synced immediately, so the
 *      user sees their URLs before doing any setup.
 *   2. Verify: the user hosts /<indexnow-key>.txt. A matching file proves ownership, flips the
 *      site to verified, turns automation on, and queues the backlog of unsubmitted URLs.
 *   3. From then on the cron re-crawls sitemaps on the plan's interval, detects new URLs and
 *      URLs whose <lastmod> moved, and submits only those (deduped, with retry/backoff).
 *
 * Every *ForUser function re-checks ownership with the userId it is given.
 */
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lt, lte, ne, or, sql, type SQL } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
	alerts,
	apiUsageEvents,
	cronRuns,
	siteIntegrations,
	siteSitemaps,
	sitemaps,
	sites,
	submissionJobs,
	submissions,
	urls,
	userIntegrations,
	users,
} from "@/db/schema";
import { getErrorMessage, getSiteHost, normalizeHost, normalizeSitemapUrl, normalizeUrlForHost, safeFetchText } from "@/lib/url-utils";
import { getPausedSiteIdsForUsers, getUserAccess } from "@/lib/platform/entitlements";
import { formatLimit, PLAN_GRACE_DAYS, PLANS, resolveEntitlement, VISIBLE_PLANS, type Entitlement } from "@/lib/platform/plans";
import { AUTOMATION_LIMITS, ENGINE_BATCH_SIZE, ENGINE_LABELS, GOOGLE_LIMITS, type SubmissionEngine } from "./constants";
import {
	getEngineRunBudget,
	type EngineRunBudget,
	isExtraEngine,
	loadExtraEngineState,
	quotaResetAt,
	resolveExtraEngines,
	submitExtraEngineBatch,
	type ExtraEngineState,
} from "@/lib/engines/extra-engines";
import { notifyGscAfterSync, runScheduledGscInspections } from "@/lib/engines/google-service";
import { pruneQuotaUsage } from "@/lib/engines/shared";
import { decryptSecret, encryptSecret, hasCredentialEncryptionKey, maskCredential, readSecret } from "./credentials";
import {
	generateIndexNowKey,
	getBingSubmissionQuota,
	getIndexNowKeyLocation,
	isRateLimited,
	submitBingBatch,
	submitIndexNowBatch,
	verifyBingApiKey,
	verifyIndexNowKey,
	type EngineSubmissionResult,
} from "./search-engines";
import { discoverSitemapUrls, fetchSitemapTree, mapWithConcurrency, validateSitemapUrl, type ParsedSitemapUrl } from "./sitemaps";

type SiteRow = typeof sites.$inferSelect;
type SiteSitemapRow = typeof siteSitemaps.$inferSelect;
// nextRunAt delays a job (e.g. an edit made inside the resubmit cooldown); omitted = due now.
type UrlQueueRow = { id: string; loc: string; nextRunAt?: Date };
type SubmissionReason = "new" | "changed" | "manual";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

function truncateMessage(message: string) {
	return message.length > 1000 ? `${message.slice(0, 997)}...` : message;
}

function chunk<T>(items: T[], size: number) {
	const chunks: T[][] = [];
	for (let index = 0; index < items.length; index += size) {
		chunks.push(items.slice(index, index + size));
	}
	return chunks;
}

function hasLastmodAdvanced(existing: { lastmod: Date | null }, next: ParsedSitemapUrl) {
	if (!next.lastmod) {
		return false;
	}
	return !existing.lastmod || next.lastmod.getTime() > existing.lastmod.getTime();
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export async function getSiteForUser(siteId: string, userId: string) {
	if (!/^[0-9a-f-]{36}$/i.test(siteId)) {
		return undefined;
	}
	const [site] = await db
		.select()
		.from(sites)
		.where(and(eq(sites.id, siteId), eq(sites.userId, userId)))
		.limit(1);
	return site;
}

/**
 * Agents rarely remember UUIDs, so API/MCP callers may pass either a site id or a domain
 * ("example.com", "https://www.example.com/") wherever a site is expected.
 */
export async function resolveSiteForUser(userId: string, siteRef: string) {
	const ref = siteRef.trim();
	if (!ref) {
		throw new Error("A site id or domain is required.");
	}

	const byId = await getSiteForUser(ref, userId);
	if (byId) {
		return byId;
	}

	let host: string;
	try {
		host = normalizeHost(ref);
	} catch {
		throw new Error(`Site not found: ${ref}`);
	}
	const bare = host.replace(/^www\./, "");
	const candidates = await db
		.select()
		.from(sites)
		.where(and(eq(sites.userId, userId), or(eq(sites.domain, host), eq(sites.domain, bare), eq(sites.indexingHost, host))));
	const site = candidates.find((row) => getSiteHost(row) === host) ?? candidates[0];
	if (!site) {
		throw new Error(`Site not found: ${ref}. Add it first with add_site.`);
	}
	return site;
}

async function requireSite(userId: string, siteId: string) {
	const site = await getSiteForUser(siteId, userId);
	if (!site) {
		throw new Error("Site not found");
	}
	return site;
}

async function assertSiteActive(userId: string, siteId: string) {
	const { entitlement, pausedSiteIds } = await getUserAccess(userId);
	if (pausedSiteIds.has(siteId)) {
		throw new Error(
			`This site is paused: the ${entitlement.plan.name} plan includes ${formatLimit(entitlement.limits.sites)} site(s). Upgrade or delete another site to resume.`,
		);
	}
	return entitlement;
}

/** De-duplicated operator alert: one open alert per (site, title); repeats refresh it. */
async function raiseAlert(siteId: string, title: string, message: string, alertType: string) {
	const [existing] = await db
		.select({ id: alerts.id })
		.from(alerts)
		.where(and(eq(alerts.siteId, siteId), eq(alerts.title, title), eq(alerts.resolved, false)))
		.limit(1);

	if (existing) {
		await db.update(alerts).set({ message: truncateMessage(message), createdAt: new Date() }).where(eq(alerts.id, existing.id));
		return;
	}
	await db.insert(alerts).values({ siteId, title, message: truncateMessage(message), alertType, resolved: false });
}

async function resolveAlerts(siteId: string, title: string) {
	await db
		.update(alerts)
		.set({ resolved: true })
		.where(and(eq(alerts.siteId, siteId), eq(alerts.title, title), eq(alerts.resolved, false)));
}

/**
 * Secrets are stored AES-GCM encrypted (credentials.ts). Rows that are legacy plaintext, or
 * that only decrypt with the fallback secret, are re-encrypted with the primary secret the
 * next time they are read, so no bulk migration is needed.
 */
async function upgradeLegacySecret(value: string) {
	if (!hasCredentialEncryptionKey()) return value;
	const { plaintext, stale } = await readSecret(value);
	return stale ? encryptSecret(plaintext) : value;
}

// ---------------------------------------------------------------------------
// IndexNow key (doubles as ownership verification)
// ---------------------------------------------------------------------------

type IndexNowPublicConfig = {
	host?: string;
	keyLocation?: string;
	storage?: string;
	submitNewUrls?: boolean;
	submitChangedUrls?: boolean;
};

function readPublicConfig(value: unknown): IndexNowPublicConfig {
	return value && typeof value === "object" ? (value as IndexNowPublicConfig) : {};
}

function normalizeIndexNowKey(key: string) {
	const cleanKey = key.trim();
	if (!/^[a-zA-Z0-9-]{8,128}$/.test(cleanKey)) {
		throw new Error("IndexNow key must be 8-128 characters and contain only letters, numbers, or dashes.");
	}
	return cleanKey;
}

function normalizeIndexNowKeyLocation(keyLocation: string, host: string) {
	const cleanLocation = keyLocation.trim();
	let url: URL;
	try {
		url = new URL(cleanLocation);
	} catch {
		throw new Error("Enter a valid IndexNow key file URL.");
	}
	if (url.protocol !== "https:" && url.protocol !== "http:") {
		throw new Error("IndexNow key file URL must use HTTP or HTTPS.");
	}
	if (url.hostname.toLowerCase() !== host) {
		throw new Error("IndexNow key file URL must be on the exact site host.");
	}
	// The key file doubles as ownership proof, so it must live at the site root: upload
	// folders and user-content paths deeper in a site must not be able to "verify" a domain.
	if (!/^\/[A-Za-z0-9-]+\.txt$/.test(url.pathname) || url.search) {
		throw new Error("The key file must be at the site root, e.g. https://example.com/<key>.txt");
	}
	return url.toString();
}

/** Idempotently create the site's IndexNow key, preserving any existing config flags. */
export async function ensureIndexNowIntegration(site: SiteRow) {
	const host = getSiteHost(site);
	const [existing] = await db
		.select()
		.from(siteIntegrations)
		.where(and(eq(siteIntegrations.siteId, site.id), eq(siteIntegrations.provider, "indexnow")))
		.limit(1);

	if (existing?.encryptedSecret) {
		const key = await decryptSecret(existing.encryptedSecret);
		const { storage: _legacyStorage, ...config } = readPublicConfig(existing.publicConfig);
		void _legacyStorage;
		const encryptedSecret = await upgradeLegacySecret(existing.encryptedSecret);
		if (encryptedSecret !== existing.encryptedSecret) {
			await db
				.update(siteIntegrations)
				.set({ encryptedSecret, publicConfig: config, updatedAt: new Date() })
				.where(eq(siteIntegrations.id, existing.id));
		}
		return { ...existing, encryptedSecret, key, keyLocation: config.keyLocation || getIndexNowKeyLocation(host, key), config };
	}

	const key = generateIndexNowKey();
	const keyLocation = getIndexNowKeyLocation(host, key);
	const config: IndexNowPublicConfig = { host, keyLocation, submitNewUrls: true, submitChangedUrls: true };
	const encryptedSecret = await encryptSecret(key);
	const [integration] = await db
		.insert(siteIntegrations)
		.values({
			siteId: site.id,
			provider: "indexnow",
			status: "pending",
			encryptedSecret,
			publicConfig: config,
			automationEnabled: false,
		})
		.onConflictDoUpdate({
			target: [siteIntegrations.siteId, siteIntegrations.provider],
			set: { encryptedSecret, publicConfig: config, updatedAt: new Date() },
		})
		.returning();

	return { ...integration, key, keyLocation, config };
}

/** Everything the UI / an agent needs to install the key file. */
export async function getIndexNowSetup(site: SiteRow) {
	const integration = await ensureIndexNowIntegration(site);
	const fileName = new URL(integration.keyLocation).pathname.replace(/^\//, "");
	return {
		status: integration.status,
		key: integration.key,
		keyLocation: integration.keyLocation,
		fileName,
		fileContent: integration.key,
		verifiedAt: integration.verifiedAt,
		lastErrorMessage: integration.lastErrorMessage,
		submitNewUrls: integration.config.submitNewUrls ?? true,
		submitChangedUrls: integration.config.submitChangedUrls ?? true,
	};
}

/** Use a key the user already hosts (e.g. from another tool) instead of the generated one. */
export async function saveIndexNowKeyForUser(userId: string, siteId: string, keyLocation: string, key: string) {
	const site = await requireSite(userId, siteId);
	const host = getSiteHost(site);
	const cleanKey = normalizeIndexNowKey(key);
	const cleanKeyLocation = keyLocation.trim()
		? normalizeIndexNowKeyLocation(keyLocation, host)
		: getIndexNowKeyLocation(host, cleanKey);
	const existing = await ensureIndexNowIntegration(site);

	await db
		.update(siteIntegrations)
		.set({
			status: "pending",
			encryptedSecret: await encryptSecret(cleanKey),
			publicConfig: { ...existing.config, host, keyLocation: cleanKeyLocation },
			verifiedAt: null,
			lastErrorAt: null,
			lastErrorMessage: null,
			updatedAt: new Date(),
		})
		.where(eq(siteIntegrations.id, existing.id));
}

/**
 * "I already host an IndexNow key" path, for users coming from another tool or an older
 * IndexFast setup. Accepts the key itself or the URL of the key file (the key is read from
 * it). The candidate is checked *before* saving, so a typo never replaces the generated key
 * shown in the setup card. Same ownership rules as verifySiteForUser: root-level file,
 * exact content, no redirect.
 */
export async function adoptExistingIndexNowKeyForUser(userId: string, siteId: string, input: string) {
	const site = await requireSite(userId, siteId);
	await assertSiteActive(userId, siteId);
	const host = getSiteHost(site);
	const value = input.trim();
	if (!value) {
		throw new Error("Paste your IndexNow key or the URL of your key file.");
	}

	let key = value;
	let keyLocation = "";
	if (/^https?:\/\//i.test(value)) {
		keyLocation = normalizeIndexNowKeyLocation(value, host);
		const response = await safeFetchText(keyLocation, {
			userAgent: "IndexFast IndexNow Verifier/1.0",
			timeoutMs: 10_000,
			maxBytes: 1024,
		});
		if (response.status !== 200) {
			throw new Error(`${keyLocation} returned HTTP ${response.status}. Check the URL and that the file is deployed.`);
		}
		key = response.text.trim();
	}
	key = normalizeIndexNowKey(key);
	keyLocation = keyLocation || getIndexNowKeyLocation(host, key);
	normalizeIndexNowKeyLocation(keyLocation, host);

	const check = await verifyIndexNowKey(host, key, keyLocation);
	if (!check.ok) {
		throw new Error(
			check.status === 404
				? `No key file at ${keyLocation}. If your file has a different name, paste its full URL instead.`
				: check.message,
		);
	}

	await saveIndexNowKeyForUser(userId, siteId, keyLocation, key);
	return verifySiteForUser(userId, siteId);
}

/**
 * Verify the key file. Success = ownership proven: mark the site verified, switch automation
 * on, and immediately submit the URLs discovered so far.
 */
export async function verifySiteForUser(userId: string, siteId: string) {
	const site = await requireSite(userId, siteId);
	const entitlement = await assertSiteActive(userId, siteId);
	const integration = await ensureIndexNowIntegration(site);
	const keyUrl = new URL(integration.keyLocation);
	const result =
		keyUrl.hostname === getSiteHost(site) && /^\/[A-Za-z0-9-]+\.txt$/.test(keyUrl.pathname)
			? await verifyIndexNowKey(getSiteHost(site), integration.key, integration.keyLocation)
			: { ok: false, status: 0, message: "The key file must be at the site root. Reset it under Settings > Use my own IndexNow key.", keyLocation: integration.keyLocation };
	const now = new Date();

	await db
		.update(siteIntegrations)
		.set({
			status: result.ok ? "verified" : "failed",
			verifiedAt: result.ok ? now : integration.verifiedAt,
			automationEnabled: result.ok ? true : integration.automationEnabled,
			lastCheckedAt: now,
			lastErrorAt: result.ok ? null : now,
			lastErrorMessage: result.ok ? null : truncateMessage(result.message),
			updatedAt: now,
		})
		.where(eq(siteIntegrations.id, integration.id));

	if (!result.ok) {
		// A failed re-check withdraws the ownership proof: nothing is submitted for this host
		// until the file passes again. Queued jobs wait (only verified sites are claimed).
		if (site.verified) {
			await db.update(sites).set({ verified: false, updatedAt: now }).where(eq(sites.id, site.id));
		}
		return { ok: false, message: result.message, queued: 0, submitted: 0 };
	}

	await db.update(sites).set({ verified: true, automationEnabled: true, updatedAt: now }).where(eq(sites.id, site.id));
	const verifiedSite = { ...site, verified: true, automationEnabled: true };

	// First verification: push the backlog of URLs found before the key was live.
	const backlog = await db
		.select({ id: urls.id, loc: urls.loc })
		.from(urls)
		.where(and(eq(urls.siteId, site.id), isNull(urls.lastSubmittedAt)))
		.limit(Math.min(entitlement.limits.urlsPerSite, AUTOMATION_LIMITS.maxUrlsPerSitemap));
	const queued = await enqueueUrlRows(verifiedSite, backlog, "new", entitlement, true);
	const processed = queued > 0 ? await processSubmissionQueue({ siteId: site.id, maxJobs: AUTOMATION_LIMITS.maxManualJobsInline, deadline: Date.now() + AUTOMATION_LIMITS.inlineQueueTimeBudgetMs }) : null;

	return { ok: true, message: "Verified. Automation is on.", queued, submitted: processed?.successCount ?? 0 };
}

export async function setAutomationForUser(userId: string, siteId: string, enabled: boolean) {
	const site = await requireSite(userId, siteId);
	const [integration] = await db
		.select({ status: siteIntegrations.status })
		.from(siteIntegrations)
		.where(and(eq(siteIntegrations.siteId, siteId), eq(siteIntegrations.provider, "indexnow")))
		.limit(1);

	if (enabled && (!site.verified || integration?.status !== "verified")) {
		throw new Error("Verify the site's key file before turning automation on.");
	}

	const now = new Date();
	await Promise.all([
		db.update(sites).set({ automationEnabled: enabled, updatedAt: now }).where(eq(sites.id, siteId)),
		db
			.update(siteIntegrations)
			.set({ automationEnabled: enabled, updatedAt: now })
			.where(and(eq(siteIntegrations.siteId, siteId), eq(siteIntegrations.provider, "indexnow"))),
	]);
}

export async function updateUrlSubmissionRulesForUser(userId: string, siteId: string, submitNewUrls: boolean, submitChangedUrls: boolean) {
	const site = await requireSite(userId, siteId);
	const integration = await ensureIndexNowIntegration(site);
	await db
		.update(siteIntegrations)
		.set({ publicConfig: { ...integration.config, submitNewUrls, submitChangedUrls }, updatedAt: new Date() })
		.where(eq(siteIntegrations.id, integration.id));
}

// ---------------------------------------------------------------------------
// Bing (optional, per-user key)
// ---------------------------------------------------------------------------

function describeBingValidationMessage(siteUrl: string, message: string) {
	if (/InvalidParameter/i.test(message)) {
		return `Bing returned InvalidParameter for ${siteUrl}. Add and verify this exact site URL in Bing Webmaster Tools first.`;
	}
	if (isRateLimited(0, message)) {
		return `Bing API is temporarily rate-limiting requests from this IP (ThrottleIP / ErrorCode 17). Key is saved and automated retries will run once cooled down.`;
	}
	return message;
}

/** Bing is a paid feature (plans.ts `limits.bing`); an expired plan past grace loses it too. */
function assertBingIncluded(entitlement: Entitlement) {
	if (!entitlement.limits.bing) {
		const plans = VISIBLE_PLANS.filter((plan) => plan.limits.bing).map((plan) => plan.name);
		throw new Error(`Bing Webmaster API submissions are not included in the ${entitlement.plan.name} plan. Upgrade to ${plans.join(" or ")} to use Bing.`);
	}
}

export async function saveBingApiKeyForUser(userId: string, siteId: string, apiKey: string, autoSubmit = true) {
	const site = await requireSite(userId, siteId);
	assertBingIncluded(await assertSiteActive(userId, siteId));

	const cleanApiKey = apiKey.trim();
	if (!cleanApiKey) {
		throw new Error("Bing API key is required");
	}

	const siteUrl = `https://${getSiteHost(site)}`;
	let validation = await getBingSubmissionQuota(cleanApiKey, siteUrl);

	// If the quota endpoint hit ThrottleIP or failed, verify via GetUserSites
	if (!validation.ok) {
		const verifiedSites = await verifyBingApiKey(cleanApiKey).catch(() => null);
		if (verifiedSites?.ok) {
			const matchingSite = verifiedSites.sites?.find(
				(s) => s.url.replace(/\/+$/, "").toLowerCase() === siteUrl.replace(/\/+$/, "").toLowerCase(),
			);
			validation = {
				ok: true,
				status: 200,
				message: matchingSite
					? `Bing key verified. Site ${siteUrl} is active in Bing Webmaster Tools.`
					: `Bing key verified for ${verifiedSites.sites?.length ?? 0} site(s).`,
			};
		}
	}

	const now = new Date();
	const status = validation.ok ? "verified" : "failed";
	const message = validation.ok ? null : truncateMessage(describeBingValidationMessage(siteUrl, validation.message));

	let quota: { dailyQuota?: number; monthlyQuota?: number } | null = null;
	if (validation.ok && validation.message) {
		try {
			const parsed = JSON.parse(validation.message);
			const data = parsed?.d || parsed;
			if (typeof data?.DailyQuota === "number" || typeof data?.MonthlyQuota === "number") {
				quota = { dailyQuota: data.DailyQuota, monthlyQuota: data.MonthlyQuota };
			}
		} catch {
			// message might not be JSON, ignore
		}
	}

	const userValues = {
		status,
		encryptedSecret: await encryptSecret(cleanApiKey),
		publicConfig: { lastValidationStatus: validation.status, siteUrl, quota },
		verifiedAt: validation.ok ? now : null,
		lastCheckedAt: now,
		lastErrorAt: validation.ok ? null : now,
		lastErrorMessage: message,
	};

	await db
		.insert(userIntegrations)
		.values({ userId, provider: "bing", ...userValues })
		.onConflictDoUpdate({ target: [userIntegrations.userId, userIntegrations.provider], set: { ...userValues, updatedAt: now } });

	const siteValues = {
		status,
		automationEnabled: autoSubmit,
		publicConfig: { quota },
		verifiedAt: validation.ok ? now : null,
		lastCheckedAt: now,
		lastErrorAt: validation.ok ? null : now,
		lastErrorMessage: message,
	};

	await db
		.insert(siteIntegrations)
		.values({ siteId: site.id, provider: "bing", ...siteValues })
		.onConflictDoUpdate({ target: [siteIntegrations.siteId, siteIntegrations.provider], set: { ...siteValues, updatedAt: now } });

	if (!validation.ok) {
		throw new Error(message || "Bing rejected the API key.");
	}

	if (autoSubmit && site.verified) {
		await submitPendingForUser(userId, site.id).catch(() => {});
	}

	return { ...validation, quota, autoSubmit };
}

export async function setBingAutomationForSite(userId: string, siteId: string, enabled: boolean) {
	const site = await requireSite(userId, siteId);
	// Turning Bing off is always allowed; turning it on needs a plan that includes it.
	if (enabled) {
		assertBingIncluded(await assertSiteActive(userId, siteId));
	}
	const [userBing] = await db
		.select({ status: userIntegrations.status })
		.from(userIntegrations)
		.where(and(eq(userIntegrations.userId, userId), eq(userIntegrations.provider, "bing")))
		.limit(1);

	if (userBing?.status !== "verified") {
		throw new Error("Add and verify a Bing Webmaster API key before enabling auto-submission.");
	}

	const now = new Date();
	await db
		.insert(siteIntegrations)
		.values({
			siteId: site.id,
			provider: "bing",
			status: "verified",
			automationEnabled: enabled,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: [siteIntegrations.siteId, siteIntegrations.provider],
			set: { automationEnabled: enabled, updatedAt: now },
		});

	if (enabled && site.verified) {
		await submitPendingForUser(userId, site.id).catch(() => {});
	}

	return { ok: true, autoSubmit: enabled };
}

/**
 * Delete the user's Bing key. The key is per user, so this stops Bing for every site. There is
 * no per-site removal: deleting a site's bing row would fall back to auto-submit on (see
 * resolveEligibleEngines), so per-site control is setBingAutomationForSite instead.
 */
export async function removeBingApiKeyForUser(userId: string) {
	await db.delete(userIntegrations).where(and(eq(userIntegrations.userId, userId), eq(userIntegrations.provider, "bing")));
}

// ---------------------------------------------------------------------------
// Sites and sitemap sources
// ---------------------------------------------------------------------------

/**
 * One-call onboarding used by the dashboard, REST API and MCP: create the site, generate
 * its key, find sitemaps, and run the first sync so URLs are visible right away.
 * Discovery/sync failures are reported but never block site creation.
 */
export async function createSiteForUser(input: { userId: string; domain: string; name?: string; sitemapUrl?: string }) {
	const host = normalizeHost(input.domain);
	const cleanSitemapUrl = normalizeSitemapUrl(input.sitemapUrl, host);

	const { entitlement } = await getUserAccess(input.userId);
	const existingSites = await db.select({ id: sites.id, domain: sites.domain }).from(sites).where(eq(sites.userId, input.userId));
	if (existingSites.some((row) => row.domain === host)) {
		throw new Error(`${host} is already added.`);
	}
	if (existingSites.length >= entitlement.limits.sites) {
		throw new Error(
			`The ${entitlement.plan.name} plan includes ${formatLimit(entitlement.limits.sites)} site(s). Upgrade to add more.`,
		);
	}

	const [site] = await db
		.insert(sites)
		.values({
			userId: input.userId,
			domain: host,
			indexingHost: host,
			name: input.name?.trim() || host,
			verified: false,
			verificationToken: `indexfast-verification-${crypto.randomUUID()}`,
			sitemapUrl: cleanSitemapUrl,
		})
		.returning();

	const setup = await getIndexNowSetup(site);

	let discovered: string[] = [];
	let sync: Awaited<ReturnType<typeof syncActiveSitemaps>> | null = null;
	let warning: string | null = null;
	try {
		const sitemapProblem = cleanSitemapUrl ? await validateSitemapUrl(cleanSitemapUrl, host) : null;
		if (cleanSitemapUrl && !sitemapProblem) {
			await addSitemapSource(site, cleanSitemapUrl, true);
			discovered = [cleanSitemapUrl];
		} else {
			// A bad manual sitemap URL falls back to discovery rather than failing onboarding.
			if (sitemapProblem) warning = `${sitemapProblem} Searched for one automatically instead.`;
			discovered = await discoverAndSaveSitemaps(site);
		}
		if (discovered.length > 0) {
			sync = await syncActiveSitemaps(site, entitlement);
			if (!sync.success && sync.urlCount === 0) warning = sync.failures[0] ?? warning;
		} else {
			warning = `No sitemap found at ${host}/robots.txt or common paths. Add your sitemap URL manually.`;
		}
	} catch (error) {
		warning = getErrorMessage(error);
	}

	return { site, setup, discovered, sync, warning };
}

async function addSitemapSource(site: SiteRow, sitemapUrl: string, isPrimary?: boolean) {
	const cleanUrl = normalizeSitemapUrl(sitemapUrl, getSiteHost(site));
	if (!cleanUrl) {
		throw new Error("Sitemap URL is required");
	}

	const existingSources = await db.select({ id: siteSitemaps.id }).from(siteSitemaps).where(eq(siteSitemaps.siteId, site.id)).limit(1);
	const makePrimary = isPrimary ?? existingSources.length === 0;
	const now = new Date();

	if (makePrimary) {
		await db.update(siteSitemaps).set({ isPrimary: false, updatedAt: now }).where(eq(siteSitemaps.siteId, site.id));
	}

	const [source] = await db
		.insert(siteSitemaps)
		.values({ siteId: site.id, url: cleanUrl, isPrimary: makePrimary, status: "active", lastDiscoveredAt: now, updatedAt: now })
		.onConflictDoUpdate({
			target: [siteSitemaps.siteId, siteSitemaps.url],
			set: { isPrimary: makePrimary, status: "active", lastErrorAt: null, lastErrorMessage: null, updatedAt: now },
		})
		.returning();

	if (makePrimary) {
		await db.update(sites).set({ sitemapUrl: cleanUrl, updatedAt: now }).where(eq(sites.id, site.id));
	}
	return source;
}

async function discoverAndSaveSitemaps(site: SiteRow) {
	const discovered = await discoverSitemapUrls(getSiteHost(site));
	for (const [index, sitemapUrl] of discovered.entries()) {
		await addSitemapSource(site, sitemapUrl, index === 0);
	}
	return discovered;
}

export async function addSitemapSourceForUser(userId: string, siteId: string, sitemapUrl: string, isPrimary?: boolean) {
	const site = await requireSite(userId, siteId);
	const cleanUrl = normalizeSitemapUrl(sitemapUrl, getSiteHost(site));
	const problem = cleanUrl ? await validateSitemapUrl(cleanUrl, getSiteHost(site)) : "Sitemap URL is required";
	if (problem) {
		throw new Error(problem);
	}
	return addSitemapSource(site, sitemapUrl, isPrimary);
}

export async function discoverSitemapsForUser(userId: string, siteId: string) {
	return discoverAndSaveSitemaps(await requireSite(userId, siteId));
}

export async function removeSitemapSourceForUser(userId: string, sourceId: string) {
	const [source] = await db
		.select({ id: siteSitemaps.id, siteId: siteSitemaps.siteId, isPrimary: siteSitemaps.isPrimary })
		.from(siteSitemaps)
		.innerJoin(sites, eq(siteSitemaps.siteId, sites.id))
		.where(and(eq(siteSitemaps.id, sourceId), eq(sites.userId, userId)))
		.limit(1);

	if (!source) {
		throw new Error("Sitemap not found");
	}

	await db.delete(siteSitemaps).where(eq(siteSitemaps.id, sourceId));

	if (source.isPrimary) {
		const [next] = await db
			.select({ id: siteSitemaps.id, url: siteSitemaps.url })
			.from(siteSitemaps)
			.where(eq(siteSitemaps.siteId, source.siteId))
			.orderBy(desc(siteSitemaps.createdAt))
			.limit(1);
		const now = new Date();
		if (next) {
			await db.update(siteSitemaps).set({ isPrimary: true, updatedAt: now }).where(eq(siteSitemaps.id, next.id));
		}
		await db.update(sites).set({ sitemapUrl: next?.url ?? null, updatedAt: now }).where(eq(sites.id, source.siteId));
	}
	return source.siteId;
}

export async function deleteSiteForUser(userId: string, siteId: string) {
	await requireSite(userId, siteId);
	await db.delete(sites).where(eq(sites.id, siteId));
}

// ---------------------------------------------------------------------------
// Sync: sitemap -> urls (dedup + new/changed detection)
// ---------------------------------------------------------------------------

async function syncSitemapSource(site: SiteRow, source: SiteSitemapRow, entitlement: Entitlement, deadline?: number) {
	const now = new Date();
	const [syncRow] = await db.insert(sitemaps).values({ siteId: site.id, url: source.url, status: "syncing" }).returning();

	try {
		const maxUrls = Math.min(entitlement.limits.urlsPerSite, AUTOMATION_LIMITS.maxUrlsPerSitemap);
		const result = await fetchSitemapTree(source.url, getSiteHost(site), { maxUrls, deadline });
		if (result.urls.length === 0) {
			throw new Error(
				result.failures[0]
					? `Every child sitemap failed. ${result.failures[0]}`
					: result.foreignHosts[0]
					? `This sitemap lists URLs on ${result.foreignHosts[0]}, not ${getSiteHost(site)}. Add ${result.foreignHosts[0]} as the website instead.`
					: "The sitemap has no URLs yet.",
			);
		}

		// Look up what we already track. URLs are canonicalized during parsing, so this
		// lookup is the dedup step: same page from any sitemap or a manual submit = same row.
		const existingByLoc = new Map<string, { id: string; loc: string; lastmod: Date | null; lastSubmittedAt: Date | null }>();
		for (const locs of chunk(result.urls.map((entry) => entry.loc), 1000)) {
			const rows = await db
				.select({ id: urls.id, loc: urls.loc, lastmod: urls.lastmod, lastSubmittedAt: urls.lastSubmittedAt })
				.from(urls)
				.where(and(eq(urls.siteId, site.id), inArray(urls.loc, locs)));
			for (const row of rows) {
				existingByLoc.set(row.loc, row);
			}
		}

		// Respect the plan's total URL cap across all of the site's sitemaps.
		const [{ tracked }] = await db
			.select({ tracked: sql<number>`cast(count(*) as int)` })
			.from(urls)
			.where(eq(urls.siteId, site.id));
		const capacity = Math.max(0, maxUrls - tracked);

		const newEntries = result.urls.filter((entry) => !existingByLoc.has(entry.loc)).slice(0, capacity);
		const changedEntries = result.urls.filter((entry) => {
			const existing = existingByLoc.get(entry.loc);
			return existing ? hasLastmodAdvanced(existing, entry) : false;
		});
		const changedLocs = new Set(changedEntries.map((entry) => entry.loc));
		const unchangedIds = Array.from(existingByLoc.values())
			.filter((row) => !changedLocs.has(row.loc))
			.map((row) => row.id);

		// New + changed rows in one upsert per chunk; ON CONFLICT also covers a concurrent sync.
		const upserted: UrlQueueRow[] = [];
		for (const entries of chunk([...newEntries, ...changedEntries], AUTOMATION_LIMITS.upsertChunkSize)) {
			const rows = await db
				.insert(urls)
				.values(
					entries.map((entry) => ({
						siteId: site.id,
						loc: entry.loc,
						lastmod: entry.lastmod,
						changefreq: entry.changefreq,
						priority: entry.priority || "0.5",
						lastSeenInSitemapAt: now,
					})),
				)
				.onConflictDoUpdate({
					target: [urls.siteId, urls.loc],
					set: {
						lastmod: sql`coalesce(excluded.lastmod, "urls"."lastmod")`,
						changefreq: sql`coalesce(excluded.changefreq, "urls"."changefreq")`,
						priority: sql`excluded.priority`,
						lastSeenInSitemapAt: now,
					},
				})
				.returning({ id: urls.id, loc: urls.loc });
			upserted.push(...rows);
		}

		for (const ids of chunk(unchangedIds, 1000)) {
			await db.update(urls).set({ lastSeenInSitemapAt: now }).where(inArray(urls.id, ids));
		}

		const newLocs = new Set(newEntries.map((entry) => entry.loc));
		const cooldownMs = AUTOMATION_LIMITS.resubmitCooldownHours * 60 * MINUTE_MS;
		const newRows = upserted.filter((row) => newLocs.has(row.loc));
		// lastmod is already overwritten above, so an edit made inside the resubmit cooldown
		// would never be detected again: queue it for when the cooldown ends instead of dropping it.
		const changedRows: UrlQueueRow[] = upserted
			.filter((row) => existingByLoc.has(row.loc) && !newLocs.has(row.loc))
			.map((row) => {
				const lastSubmittedAt = existingByLoc.get(row.loc)?.lastSubmittedAt;
				return lastSubmittedAt && now.getTime() - lastSubmittedAt.getTime() < cooldownMs
					? { ...row, nextRunAt: new Date(lastSubmittedAt.getTime() + cooldownMs) }
					: row;
			});
		// Child sitemaps that failed do not fail the source; they are surfaced on it instead.
		const childFailure = result.failures.length > 0
			? truncateMessage(`${result.failures.length} child sitemap(s) failed. ${result.failures[0]}`)
			: null;

		const [indexNowInt] = await db
			.select({ publicConfig: siteIntegrations.publicConfig })
			.from(siteIntegrations)
			.where(and(eq(siteIntegrations.siteId, site.id), eq(siteIntegrations.provider, "indexnow")))
			.limit(1);
		const config = readPublicConfig(indexNowInt?.publicConfig);
		const queued =
			((config.submitNewUrls ?? true) ? await enqueueUrlRows(site, newRows, "new", entitlement) : 0) +
			((config.submitChangedUrls ?? true) ? await enqueueUrlRows(site, changedRows, "changed", entitlement) : 0);

		await Promise.all([
			db
				.update(siteSitemaps)
				.set({
					status: "active",
					lastSyncAt: now,
					lastErrorAt: childFailure ? now : null,
					lastErrorMessage: childFailure,
					updatedAt: now,
				})
				.where(eq(siteSitemaps.id, source.id)),
			db
				.update(sitemaps)
				.set({
					status: "success",
					errorMessage: childFailure,
					lastSyncTime: now,
					urlCount: result.urls.length,
					newCount: newRows.length,
					changedCount: changedRows.length,
				})
				.where(eq(sitemaps.id, syncRow.id)),
			resolveAlerts(site.id, "Sitemap sync failed"),
		]);
		// New URLs: ask Search Console to re-read this sitemap (no-op unless Google is connected).
		if (newRows.length > 0) {
			await notifyGscAfterSync(site, source.url).catch(() => undefined);
		}

		return {
			sourceId: source.id,
			url: source.url,
			urlCount: result.urls.length,
			newCount: newRows.length,
			changedCount: changedRows.length,
			queuedCount: queued,
			childFailures: result.failures.length,
			truncated: result.truncated || newEntries.length < result.urls.length - existingByLoc.size,
		};
	} catch (error) {
		const message = truncateMessage(getErrorMessage(error));
		await Promise.all([
			db
				.update(siteSitemaps)
				.set({ status: "failed", lastSyncAt: now, lastErrorAt: now, lastErrorMessage: message, updatedAt: now })
				.where(eq(siteSitemaps.id, source.id)),
			db.update(sitemaps).set({ status: "failed", errorMessage: message, lastSyncTime: now }).where(eq(sitemaps.id, syncRow.id)),
			raiseAlert(site.id, "Sitemap sync failed", message.includes(source.url) ? message : `${source.url}: ${message}`, "sitemap_failure"),
		]);
		throw error;
	}
}

/**
 * Sync a site's sources (primary first, at most maxSitemapSourcesPerSite). `deadline` (epoch
 * ms) is the cron's sync budget: no new source starts after it, and each crawl checks it per file.
 */
async function syncActiveSitemaps(site: SiteRow, entitlement: Entitlement, options: { sourceId?: string; deadline?: number } = {}) {
	const filters = [eq(siteSitemaps.siteId, site.id), ne(siteSitemaps.status, "disabled")];
	if (options.sourceId) {
		filters.push(eq(siteSitemaps.id, options.sourceId));
	}

	const sources = await db
		.select()
		.from(siteSitemaps)
		.where(and(...filters))
		.orderBy(desc(siteSitemaps.isPrimary), asc(siteSitemaps.createdAt))
		.limit(AUTOMATION_LIMITS.maxSitemapSourcesPerSite);

	if (sources.length === 0) {
		throw new Error("No sitemap added yet. Add your sitemap URL or run discovery.");
	}

	const results = [];
	const failures: string[] = [];
	for (const source of sources) {
		if (options.deadline && Date.now() > options.deadline) {
			break;
		}
		try {
			results.push(await syncSitemapSource(site, source, entitlement, options.deadline));
		} catch (error) {
			failures.push(`${source.url}: ${getErrorMessage(error)}`);
		}
	}

	return {
		success: failures.length === 0,
		results,
		failures,
		urlCount: results.reduce((total, result) => total + result.urlCount, 0),
		newCount: results.reduce((total, result) => total + result.newCount, 0),
		changedCount: results.reduce((total, result) => total + result.changedCount, 0),
		queuedCount: results.reduce((total, result) => total + result.queuedCount, 0),
	};
}

/** Manual "Sync now": crawl, then immediately submit what was queued for this site. */
export async function syncSitemapsForUser(userId: string, siteId: string, sourceId?: string) {
	const site = await requireSite(userId, siteId);
	const entitlement = await assertSiteActive(userId, siteId);
	const result = await syncActiveSitemaps(site, entitlement, { sourceId });
	const processed =
		result.queuedCount > 0 ? await processSubmissionQueue({ siteId, maxJobs: AUTOMATION_LIMITS.maxManualJobsInline, deadline: Date.now() + AUTOMATION_LIMITS.inlineQueueTimeBudgetMs }) : null;
	return { ...result, submitted: processed?.successCount ?? 0 };
}

// ---------------------------------------------------------------------------
// Submission queue
// ---------------------------------------------------------------------------

// Shown when a verified site has no engine to submit to: the IndexNow key check failed after
// verification (file removed or changed) and no Bing key is connected.
const NO_ENGINE_MESSAGE = "Your IndexNow key file is no longer passing the check. Open Settings and click \"Re-check key file\", or connect a Bing API key.";

type EngineState = {
	indexNow?: { status: string; automationEnabled: boolean };
	bingSite?: { automationEnabled: boolean };
	bingUser?: { status: string };
	extra?: ExtraEngineState; // Google Indexing API, Yandex, Baidu (src/lib/engines)
};

async function loadEngineState(site: SiteRow): Promise<EngineState> {
	const [[indexNow], [bingSite], [bingUser], extra] = await Promise.all([
		db
			.select({ status: siteIntegrations.status, automationEnabled: siteIntegrations.automationEnabled })
			.from(siteIntegrations)
			.where(and(eq(siteIntegrations.siteId, site.id), eq(siteIntegrations.provider, "indexnow")))
			.limit(1),
		db
			.select({ automationEnabled: siteIntegrations.automationEnabled })
			.from(siteIntegrations)
			.where(and(eq(siteIntegrations.siteId, site.id), eq(siteIntegrations.provider, "bing")))
			.limit(1),
		db
			.select({ status: userIntegrations.status })
			.from(userIntegrations)
			.where(and(eq(userIntegrations.userId, site.userId), eq(userIntegrations.provider, "bing")))
			.limit(1),
		loadExtraEngineState(site),
	]);
	return { indexNow, bingSite, bingUser, extra };
}

/**
 * Which engines a site may submit to right now. Manual submits ignore the automation
 * toggles, never the key checks or the plan: Bing needs a plan with `limits.bing`, so an
 * expired plan past grace stops Bing too.
 */
export function resolveEligibleEngines(
	state: EngineState,
	site: Pick<SiteRow, "verified" | "automationEnabled">,
	entitlement: Pick<Entitlement, "limits">,
	manual = false,
): SubmissionEngine[] {
	if (!manual && !(site.verified && site.automationEnabled)) {
		return [];
	}
	const engines: SubmissionEngine[] = [];
	if (state.indexNow?.status === "verified" && (manual || state.indexNow.automationEnabled)) {
		engines.push("indexnow");
	}
	if (entitlement.limits.bing && state.bingUser?.status === "verified" && (manual || (state.bingSite?.automationEnabled ?? true))) {
		engines.push("bing");
	}
	// Optional engines are paid-only and opt-in per site; see resolveExtraEngines.
	engines.push(...resolveExtraEngines(state.extra, entitlement.limits, manual));
	return engines;
}

async function getEligibleEngines(site: SiteRow, entitlement: Entitlement, manual = false): Promise<SubmissionEngine[]> {
	return resolveEligibleEngines(await loadEngineState(site), site, entitlement, manual);
}

/**
 * Bulk enqueue. Dedup is enforced by the partial unique index
 * submission_jobs_open_unique_idx (one open job per site+loc+engine), so a URL that is
 * already waiting is silently skipped instead of being submitted twice.
 */
async function enqueueUrlRows(site: SiteRow, rows: UrlQueueRow[], reason: SubmissionReason, entitlement: Entitlement, manual = false) {
	// Domain proof gates every submission path: we must never ping search engines about a
	// host the user has not proven they control.
	if (!site.verified) {
		if (manual) throw new Error("Verify the site's key file first, then submit.");
		return 0;
	}
	if (rows.length === 0) {
		return 0;
	}
	const engines = await getEligibleEngines(site, entitlement, manual);
	const priority = reason === "manual" ? 1 : reason === "new" ? 5 : 10;
	let queued = 0;
	for (const engine of engines) {
		for (const batch of chunk(rows, AUTOMATION_LIMITS.upsertChunkSize)) {
			const inserted = await db
				.insert(submissionJobs)
				.values(
					batch.map((row) => ({ siteId: site.id, urlId: row.id, loc: row.loc, engine, reason, status: "queued", priority, nextRunAt: row.nextRunAt })),
				)
				.onConflictDoNothing()
				.returning({ id: submissionJobs.id });
			queued += inserted.length;
		}
	}
	return queued;
}

/**
 * Manual submit for specific URLs (dashboard button, REST, MCP). URLs are canonicalized and
 * must be on the site's exact host; unknown URLs are added to tracking first.
 */
export async function submitUrlsForUser(userId: string, siteId: string, rawUrls: string[]) {
	const site = await requireSite(userId, siteId);
	const entitlement = await assertSiteActive(userId, siteId);
	const host = getSiteHost(site);

	const valid = new Set<string>();
	const rejected: Array<{ url: string; error: string }> = [];
	for (const raw of rawUrls.slice(0, 1000)) {
		try {
			valid.add(normalizeUrlForHost(raw, host));
		} catch (error) {
			rejected.push({ url: raw, error: getErrorMessage(error) });
		}
	}
	if (valid.size === 0) {
		throw new Error(rejected[0]?.error || "No URLs to submit.");
	}

	const rows: UrlQueueRow[] = [];
	for (const locs of chunk(Array.from(valid), AUTOMATION_LIMITS.upsertChunkSize)) {
		rows.push(
			...(await db
				.insert(urls)
				.values(locs.map((loc) => ({ siteId, loc })))
				.onConflictDoUpdate({ target: [urls.siteId, urls.loc], set: { loc: sql`excluded.loc` } })
				.returning({ id: urls.id, loc: urls.loc })),
		);
	}

	const queued = await enqueueUrlRows(site, rows, "manual", entitlement, true);
	if (queued === 0 && (await getEligibleEngines(site, entitlement, true)).length === 0) {
		throw new Error(NO_ENGINE_MESSAGE);
	}
	// A manual submit jumps the queue: URLs that were already waiting (e.g. new-URL jobs) are
	// promoted to manual priority instead of being skipped as duplicates.
	for (const locs of chunk(rows.map((row) => row.loc), AUTOMATION_LIMITS.upsertChunkSize)) {
		await db
			.update(submissionJobs)
			.set({ priority: 1, updatedAt: new Date() })
			.where(and(eq(submissionJobs.siteId, siteId), eq(submissionJobs.status, "queued"), inArray(submissionJobs.loc, locs)));
	}
	const processed = await processSubmissionQueue({ siteId, maxJobs: AUTOMATION_LIMITS.maxManualJobsInline, deadline: Date.now() + AUTOMATION_LIMITS.inlineQueueTimeBudgetMs });
	return { accepted: valid.size, rejected, queued, ...processed };
}

/**
 * Re-queue URLs whose last submission failed for good. Mostly needed for jobs that hit the
 * old 3-attempt cap during an IndexNow 429 spell, before rate limits stopped counting as failures.
 */
export async function retryFailedForUser(userId: string, siteId: string) {
	const site = await requireSite(userId, siteId);
	const entitlement = await assertSiteActive(userId, siteId);
	const failed = await db
		.select({ id: urls.id, loc: urls.loc })
		.from(urls)
		.where(and(eq(urls.siteId, siteId), eq(urls.lastSubmissionStatus, "failed")))
		.limit(Math.min(entitlement.limits.urlsPerSite, AUTOMATION_LIMITS.maxUrlsPerSitemap));
	if (failed.length === 0) {
		return { queued: 0, submitted: 0, throttledUntil: null };
	}
	const queued = await enqueueUrlRows(site, failed, "manual", entitlement, true);
	if (queued === 0 && (await getEligibleEngines(site, entitlement, true)).length === 0) {
		throw new Error(NO_ENGINE_MESSAGE);
	}
	const processed = await processSubmissionQueue({ siteId, maxJobs: AUTOMATION_LIMITS.maxManualJobsInline, deadline: Date.now() + AUTOMATION_LIMITS.inlineQueueTimeBudgetMs });
	return { queued, submitted: processed.successCount, throttledUntil: processed.throttledUntil };
}

/** Queue every tracked URL that has never been submitted (e.g. after re-enabling automation). */
export async function submitPendingForUser(userId: string, siteId: string) {
	const site = await requireSite(userId, siteId);
	const entitlement = await assertSiteActive(userId, siteId);
	const pending = await db
		.select({ id: urls.id, loc: urls.loc })
		.from(urls)
		.where(and(eq(urls.siteId, siteId), isNull(urls.lastSubmittedAt)))
		.limit(Math.min(entitlement.limits.urlsPerSite, AUTOMATION_LIMITS.maxUrlsPerSitemap));
	const queued = await enqueueUrlRows(site, pending, "manual", entitlement, true);
	if (queued === 0 && pending.length > 0 && (await getEligibleEngines(site, entitlement, true)).length === 0) {
		throw new Error(NO_ENGINE_MESSAGE);
	}
	const processed = queued > 0 ? await processSubmissionQueue({ siteId, maxJobs: AUTOMATION_LIMITS.maxManualJobsInline, deadline: Date.now() + AUTOMATION_LIMITS.inlineQueueTimeBudgetMs }) : null;
	return { queued, submitted: processed?.successCount ?? 0, throttledUntil: processed?.throttledUntil ?? null };
}

/**
 * Backoff for a retry. `attempt` is the exponent: the network/5xx attempt number, or for a
 * rate limit (status 429) the consecutive-throttle count. A rate limit waits at least as long
 * as the engine asked (Retry-After) and never less than the 1h..24h exponential backoff,
 * because a short wait just re-trips the ban.
 */
export function calculateBackoffMs(attempt: number, options: { status?: number; retryAfterSeconds?: number } = {}): number {
	const is429 = options.status === 429;
	// 0-5s of jitter on top of an exact Retry-After avoids lockstep retries.
	const retryAfterMs =
		options.retryAfterSeconds && options.retryAfterSeconds > 0 ? (options.retryAfterSeconds + Math.floor(Math.random() * 5)) * 1000 : 0;
	if (retryAfterMs && !is429) {
		return retryAfterMs;
	}

	const baseMs = is429 ? AUTOMATION_LIMITS.throttleCooldownMinutes * MINUTE_MS : 5 * MINUTE_MS;
	const maxMs = is429 ? AUTOMATION_LIMITS.maxThrottleBackoffHours * 60 * MINUTE_MS : 2 * 60 * MINUTE_MS;
	const expMs = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
	// Jitter between (1 - jitter) and (1 + jitter) to prevent thundering herds across thousands of URLs
	const jitter = AUTOMATION_LIMITS.retryJitterPercent;
	const factor = 1 - jitter + Math.random() * (2 * jitter);
	return Math.max(retryAfterMs, Math.round(expMs * factor));
}

export function isRetryable(result: EngineSubmissionResult) {
	return result.status === 0 || result.status >= 500 || isThrottled(result);
}

/** Engine rate limit: IndexNow 429 TooManyRequests, Bing ThrottleIP (ErrorCode 17). */
export function isThrottled(result: Pick<EngineSubmissionResult, "status" | "message">) {
	return isRateLimited(result.status, result.message);
}

type Throttle = { resumeAt: Date; error: string; status: number; throttleCount: number };

/**
 * An engine that answered 429 for a site stays throttled until its queued 429 jobs come due.
 * Checking this before every send stops "Process now", manual submits and the cron from
 * re-hitting an engine mid-cooldown, which is what extends the ban. Throttles detected from
 * the message (Bing ThrottleIP with HTTP 400) are stored as 429 too, so they count here.
 */
export async function getActiveThrottle(siteId: string, engine: string, now = new Date()): Promise<Throttle | null> {
	const [row] = await db
		.select({
			resumeAt: sql<Date | null>`max(${submissionJobs.nextRunAt})`,
			error: sql<string | null>`max(${submissionJobs.lastErrorMessage})`,
			throttleCount: sql<number>`cast(coalesce(max(${submissionJobs.throttleCount}), 0) as int)`,
		})
		.from(submissionJobs)
		.where(
			and(
				eq(submissionJobs.siteId, siteId),
				eq(submissionJobs.engine, engine),
				eq(submissionJobs.status, "queued"),
				eq(submissionJobs.httpStatus, 429),
				gt(submissionJobs.nextRunAt, now),
			),
		);
	return row?.resumeAt
		? { resumeAt: new Date(row.resumeAt), error: row.error ?? "Rate limited (HTTP 429).", status: 429, throttleCount: Number(row.throttleCount) || 0 }
		: null;
}

async function submitEngineBatch(site: SiteRow, engine: string, urlList: string[]): Promise<EngineSubmissionResult & { skipped?: boolean }> {
	if (engine === "indexnow") {
		const [integration] = await db
			.select()
			.from(siteIntegrations)
			.where(and(eq(siteIntegrations.siteId, site.id), eq(siteIntegrations.provider, "indexnow")))
			.limit(1);
		if (!integration?.encryptedSecret || integration.status !== "verified") {
			return { ok: false, status: 403, message: "IndexNow key is not verified." };
		}
		const key = await decryptSecret(integration.encryptedSecret);
		const upgraded = await upgradeLegacySecret(integration.encryptedSecret);
		if (upgraded !== integration.encryptedSecret) {
			await db.update(siteIntegrations).set({ encryptedSecret: upgraded, updatedAt: new Date() }).where(eq(siteIntegrations.id, integration.id));
		}
		const keyLocation = readPublicConfig(integration.publicConfig).keyLocation || getIndexNowKeyLocation(getSiteHost(site), key);
		return submitIndexNowBatch(getSiteHost(site), key, urlList, keyLocation);
	}

	if (engine === "bing") {
		const [integration] = await db
			.select()
			.from(userIntegrations)
			.where(and(eq(userIntegrations.userId, site.userId), eq(userIntegrations.provider, "bing")))
			.limit(1);
		if (!integration?.encryptedSecret || integration.status !== "verified") {
			return { ok: false, status: 403, message: "Bing API key is not verified." };
		}
		const apiKey = await decryptSecret(integration.encryptedSecret);
		const upgraded = await upgradeLegacySecret(integration.encryptedSecret);
		if (upgraded !== integration.encryptedSecret) {
			await db.update(userIntegrations).set({ encryptedSecret: upgraded, updatedAt: new Date() }).where(eq(userIntegrations.id, integration.id));
		}
		return submitBingBatch(apiKey, `https://${getSiteHost(site)}`, urlList);
	}

	const extra = await submitExtraEngineBatch(site, engine, urlList);
	return extra ?? { ok: false, status: 400, message: `Unsupported engine: ${engine}` };
}

/**
 * Group submission jobs for batch delivery to engines.
 *
 * CRITICAL RULE: Retry state (`attempts`) MUST be part of the batch identity key:
 * one search engine response is shared by every URL in its batch, so never mix jobs
 * at different retry attempts. Mixing jobs at different attempts causes either
 * premature terminal failure for fresh jobs (if grouped with a high-attempt job)
 * or incorrect retry decisions across URLs.
 */
export function groupSubmissionJobs<T extends { siteId: string; engine: string; attempts: number }>(jobs: T[]): Map<string, T[]> {
	const groups = new Map<string, T[]>();
	for (const job of jobs) {
		const key = `${job.siteId}:${job.engine}:${job.attempts}`;
		groups.set(key, [...(groups.get(key) ?? []), job]);
	}
	return groups;
}

type ClaimedJob = typeof submissionJobs.$inferSelect;

export type SiteQueueState = {
	paused: boolean;
	automatedEngines: SubmissionEngine[];
	manualEngines: SubmissionEngine[];
	indexNowAwaitingCheck: boolean; // IndexNow key saved or re-checked but not passing yet
};

export type JobDisposition = "send" | "paused" | "wait" | "skip";

/**
 * What to do with one claimed job. Paused sites (plan downgrade) and an IndexNow key waiting
 * for re-verification keep the job queued (retryable); an engine that is disabled for the
 * site, or not in the owner's plan, is skipped and never sent.
 */
export function classifyClaimedJob(job: Pick<ClaimedJob, "engine" | "reason">, state: SiteQueueState | undefined): JobDisposition {
	if (!state) return "skip";
	if (state.paused) return "paused";
	const engines = job.reason === "manual" ? state.manualEngines : state.automatedEngines;
	if (engines.includes(job.engine as SubmissionEngine)) return "send";
	if (job.engine === "indexnow" && state.indexNowAwaitingCheck) return "wait";
	return "skip";
}

async function loadSiteQueueStates(siteRows: SiteRow[], now: Date) {
	const userIds = Array.from(new Set(siteRows.map((site) => site.userId)));
	const owners = await db
		.select({ id: users.id, billingTier: users.billingTier, planExpiresAt: users.planExpiresAt })
		.from(users)
		.where(inArray(users.id, userIds));
	const entitlements = new Map(owners.map((owner) => [owner.id, resolveEntitlement(owner, now)]));
	const paused = await getPausedSiteIdsForUsers(entitlements);
	const states = await mapWithConcurrency(siteRows, 10, async (site) => {
		const entitlement = entitlements.get(site.userId) ?? resolveEntitlement(null, now);
		const engines = await loadEngineState(site);
		const state: SiteQueueState = {
			paused: paused.has(site.id),
			automatedEngines: resolveEligibleEngines(engines, site, entitlement, false),
			manualEngines: resolveEligibleEngines(engines, site, entitlement, true),
			indexNowAwaitingCheck: engines.indexNow?.status === "pending" || engines.indexNow?.status === "failed",
		};
		return [site.id, state] as const;
	});
	return new Map(states);
}

/**
 * Writes to a claimed job only land while this run still owns it: status 'processing' with
 * the exact lockedAt it was claimed with. If the run was slow enough for stale-lock recovery
 * to hand the job to another run, the later run's result wins and this one is dropped.
 */
function ownedBy(ids: string[], claimedAt: Date) {
	return and(inArray(submissionJobs.id, ids), eq(submissionJobs.status, "processing"), eq(submissionJobs.lockedAt, claimedAt));
}

function requeueClaimed(ids: string[], claimedAt: Date, values: PgUpdateSetSource<typeof submissionJobs> = {}) {
	return db
		.update(submissionJobs)
		.set({ ...values, status: "queued", lockedAt: null, updatedAt: new Date() })
		.where(ownedBy(ids, claimedAt));
}

type BatchOutcome = { kind: "success" | "failed" | "retry" | "throttled" | "skipped"; count: number; throttle?: Throttle };

/** Send one batch and record the result. A rate limit never uses up attempts or fails a job. */
async function sendClaimedBatch(site: SiteRow, engine: string, batch: ClaimedJob[], claimedAt: Date): Promise<BatchOutcome> {
	const urlList = batch.map((job) => job.loc);
	const result: EngineSubmissionResult & { skipped?: boolean } = await submitEngineBatch(site, engine, urlList).catch((error) => ({
		ok: false,
		status: 0,
		message: getErrorMessage(error),
	}));
	const completedAt = new Date();
	const responseMessage = truncateMessage(result.message || `HTTP ${result.status}`);
	const ids = batch.map((job) => job.id);
	const engineName = ENGINE_LABELS[engine as SubmissionEngine] ?? engine;
	const retryAfterAt = result.retryAfterSeconds ? new Date(completedAt.getTime() + result.retryAfterSeconds * 1000) : null;

	// The engine refused to take this URL on policy grounds before sending (Google Indexing API
	// guardrail): close the job as skipped, without a submission log row or an alert.
	if (result.skipped) {
		await db
			.update(submissionJobs)
			.set({ status: "skipped", lockedAt: null, httpStatus: result.status, lastErrorMessage: responseMessage, updatedAt: completedAt })
			.where(ownedBy(ids, claimedAt));
		return { kind: "skipped", count: batch.length };
	}

	if (!result.ok && isThrottled(result)) {
		const throttleCount = Math.max(...batch.map((job) => job.throttleCount)) + 1;
		const resumeAt = new Date(completedAt.getTime() + calculateBackoffMs(throttleCount, { status: 429, retryAfterSeconds: result.retryAfterSeconds }));
		const throttle = { resumeAt, error: responseMessage, status: 429, throttleCount };
		await Promise.all([
			// Stored as 429 even when detected from the message, so getActiveThrottle sees it.
			requeueClaimed(ids, claimedAt, { nextRunAt: resumeAt, httpStatus: 429, throttleCount, retryAfterAt, lastErrorMessage: responseMessage }),
			// The ban is per sending host: park every other queued job of this site+engine too,
			// sharing the exponent so the next 429 backs off further whichever jobs go first.
			db
				.update(submissionJobs)
				.set({
					nextRunAt: resumeAt,
					httpStatus: 429,
					throttleCount: sql`greatest(${submissionJobs.throttleCount}, ${throttleCount})`,
					lastErrorMessage: responseMessage,
					updatedAt: completedAt,
				})
				.where(
					and(
						eq(submissionJobs.siteId, site.id),
						eq(submissionJobs.engine, engine),
						eq(submissionJobs.status, "queued"),
						lt(submissionJobs.nextRunAt, resumeAt),
					),
				),
		]);
		// Throttled attempts are not logged per URL: one 429 for a 1000-URL batch every hour
		// would bury the real activity (it produced 57k rows before this rule).
		await raiseAlert(
			site.id,
			`${engineName} is rate limiting this site`,
			`${engineName} answered "too many requests". Your URLs stay queued and are retried automatically after ${resumeAt.toISOString()}. Nothing is lost.`,
			"error_detected",
		);
		return { kind: "throttled", count: batch.length, throttle };
	}

	const attempt = batch[0].attempts + 1;
	const retry = !result.ok && isRetryable(result) && attempt < AUTOMATION_LIMITS.maxSubmitAttempts;
	const status = result.ok ? "success" : "failed";
	const owned = retry
		? await requeueClaimed(ids, claimedAt, {
				attempts: attempt,
				nextRunAt: new Date(completedAt.getTime() + calculateBackoffMs(attempt, { status: result.status, retryAfterSeconds: result.retryAfterSeconds })),
				httpStatus: result.status,
				retryAfterAt,
				lastErrorMessage: responseMessage,
			}).returning({ loc: submissionJobs.loc })
		: await db
				.update(submissionJobs)
				.set({
					status,
					attempts: attempt,
					throttleCount: 0,
					lockedAt: null,
					httpStatus: result.status,
					lastErrorMessage: result.ok ? null : responseMessage,
					updatedAt: completedAt,
				})
				.where(ownedBy(ids, claimedAt))
				.returning({ loc: submissionJobs.loc });
	const ownedLocs = owned.map((row) => row.loc);

	await Promise.all([
		...chunk(ownedLocs, AUTOMATION_LIMITS.upsertChunkSize).map((locs) =>
			db.insert(submissions).values(
				locs.map((loc) => ({ siteId: site.id, loc, engine, status: retry ? "failed" : status, responseMessage, attempt })),
			),
		),
		...(retry
			? []
			: chunk(ownedLocs, 1000).map((locs) =>
					db
						.update(urls)
						.set({ lastSubmittedAt: completedAt, lastSubmissionStatus: status, lastSubmittedEngine: engine })
						.where(and(eq(urls.siteId, site.id), inArray(urls.loc, locs))),
				)),
		// The engine accepts again: the next 429 starts back at the 1h base.
		...(result.ok && batch.some((job) => job.throttleCount > 0)
			? [
					db
						.update(submissionJobs)
						.set({ throttleCount: 0 })
						.where(and(eq(submissionJobs.siteId, site.id), eq(submissionJobs.engine, engine), eq(submissionJobs.status, "queued"))),
				]
			: []),
	]);

	if (result.ok) {
		await Promise.all([resolveAlerts(site.id, `${engineName} submission failed`), resolveAlerts(site.id, `${engineName} is rate limiting this site`)]);
		return { kind: "success", count: batch.length };
	}
	if (!retry) {
		await raiseAlert(site.id, `${engineName} submission failed`, `${batch.length} URL(s): ${responseMessage}`, "error_detected");
		return { kind: "failed", count: batch.length };
	}
	return { kind: "retry", count: batch.length };
}

/**
 * Split a claimed group by the engine's run budget. Only a known remaining quota defers the
 * rest to the engine's midnight; behind a 1-URL probe the rest is released unchanged, so the
 * next run uses the remain count the probe just stored instead of 1 URL per day.
 */
export function splitByEngineBudget<T>(group: T[], budget: EngineRunBudget | null) {
	if (budget === null || budget.limit >= group.length) return { sendable: group, defer: [] as T[], release: [] as T[] };
	const sendable = group.slice(0, Math.max(0, budget.limit));
	const rest = group.slice(sendable.length);
	return budget.probe ? { sendable, defer: [] as T[], release: rest } : { sendable, defer: rest, release: [] as T[] };
}

/**
 * Drain the queue: recover orphaned locks, atomically claim due jobs (manual first), drop
 * what must not be sent (paused site, disabled engine, key awaiting re-check), then submit
 * per site+engine in engine-sized batches. Transient failures (network/5xx) retry with
 * exponential backoff; rate limits park the site+engine; others fail fast with one alert.
 * `deadline` (epoch ms): no batch starts after it and unsent claimed jobs go back to queued.
 */
export async function processSubmissionQueue(options: { siteId?: string; maxJobs?: number; deadline?: number } = {}) {
	const now = new Date();
	const maxJobs = options.maxJobs ?? AUTOMATION_LIMITS.maxSubmissionJobsPerRun;
	const counts = { successCount: 0, failedCount: 0, retryCount: 0, throttledCount: 0, skippedCount: 0, deferredCount: 0 };

	await db
		.update(submissionJobs)
		.set({ status: "queued", lockedAt: null, updatedAt: now })
		.where(
			and(
				eq(submissionJobs.status, "processing"),
				lte(submissionJobs.lockedAt, new Date(now.getTime() - AUTOMATION_LIMITS.staleLockMinutes * MINUTE_MS)),
			),
		);

	const dueFilter = and(
		eq(submissionJobs.status, "queued"),
		lte(submissionJobs.nextRunAt, now),
		options.siteId ? eq(submissionJobs.siteId, options.siteId) : undefined,
	);
	const verifiedSiteIds = db.select({ id: sites.id }).from(sites).where(eq(sites.verified, true));
	// New/changed jobs only run while the site's automation is on; manual ones need only proof.
	const automatedSiteIds = db
		.select({ id: sites.id })
		.from(sites)
		.where(and(eq(sites.verified, true), eq(sites.automationEnabled, true)));
	// Priority order: manual submissions first (priority 1), then new URLs (priority 5), then refreshes (priority 10).
	const candidateIds = db
		.select({ id: submissionJobs.id })
		.from(submissionJobs)
		.where(
			and(
				dueFilter,
				inArray(submissionJobs.siteId, verifiedSiteIds),
				or(eq(submissionJobs.reason, "manual"), inArray(submissionJobs.siteId, automatedSiteIds)),
			),
		)
		.orderBy(asc(submissionJobs.priority), asc(submissionJobs.nextRunAt), asc(submissionJobs.createdAt))
		.limit(maxJobs)
		.for("update", { skipLocked: true });
	// The outer status check makes the claim safe if two runs race for the same rows.
	const claimed = await db
		.update(submissionJobs)
		.set({ status: "processing", lockedAt: now, updatedAt: now })
		.where(and(inArray(submissionJobs.id, candidateIds), eq(submissionJobs.status, "queued")))
		.returning();

	if (claimed.length === 0) {
		return { processedCount: 0, ...counts, throttledUntil: null as Date | null };
	}

	// RETURNING has no order; restore the claim order so manual jobs are sent first.
	const jobs = [...claimed].sort(
		(a, b) => a.priority - b.priority || a.nextRunAt.getTime() - b.nextRunAt.getTime() || a.createdAt.getTime() - b.createdAt.getTime(),
	);
	const siteRows = await db
		.select()
		.from(sites)
		.where(inArray(sites.id, Array.from(new Set(jobs.map((job) => job.siteId)))));
	const siteById = new Map(siteRows.map((site) => [site.id, site]));
	const states = await loadSiteQueueStates(siteRows, now);

	const byDisposition = { send: [] as ClaimedJob[], paused: [] as string[], wait: [] as string[], skip: [] as ClaimedJob[] };
	for (const job of jobs) {
		const disposition = classifyClaimedJob(job, states.get(job.siteId));
		if (disposition === "send" || disposition === "skip") byDisposition[disposition].push(job);
		else byDisposition[disposition].push(job.id);
	}
	const pausedUntil = new Date(now.getTime() + AUTOMATION_LIMITS.pausedSiteRetryHours * 60 * MINUTE_MS);
	const waitUntil = new Date(now.getTime() + AUTOMATION_LIMITS.engineUnavailableRetryMinutes * MINUTE_MS);
	await Promise.all([
		...chunk(byDisposition.paused, 1000).map((ids) =>
			requeueClaimed(ids, now, { nextRunAt: pausedUntil, lastErrorMessage: "Site is paused by the plan's site limit. Upgrade or delete another site to resume." }),
		),
		...chunk(byDisposition.wait, 1000).map((ids) =>
			requeueClaimed(ids, now, { nextRunAt: waitUntil, lastErrorMessage: "Waiting for the IndexNow key file to pass its check again." }),
		),
		...chunk(byDisposition.skip, 1000).map((rows) =>
			db
				.update(submissionJobs)
				.set({ status: "skipped", lockedAt: null, lastErrorMessage: `${rows[0].engine} is not enabled for this site, so this URL was not sent.`, updatedAt: now })
				.where(ownedBy(rows.map((job) => job.id), now)),
		),
	]);
	counts.deferredCount += byDisposition.paused.length + byDisposition.wait.length;
	counts.skippedCount += byDisposition.skip.length;

	// Circuit breaker per (site, engine): once a batch is rate limited (in this run or a
	// persisted earlier one), nothing else is sent to that engine for that site this run.
	const throttledEngines = new Map<string, Throttle>();
	const requestsSent = new Map<string, number>();
	const releaseIds: string[] = [];

	for (const group of groupSubmissionJobs(byDisposition.send).values()) {
		const { siteId, engine } = group[0];
		const engineKey = `${siteId}:${engine}`;
		const site = siteById.get(siteId)!;
		if (!throttledEngines.has(engineKey)) {
			const persisted = await getActiveThrottle(siteId, engine, now);
			if (persisted) throttledEngines.set(engineKey, persisted);
		}

		// Yandex/Baidu: never send more than the engine's remaining daily quota; the rest waits
		// for the engine's midnight with its throttle state untouched.
		let sendable = group;
		if (isExtraEngine(engine) && !throttledEngines.has(engineKey)) {
			const budget = await getEngineRunBudget(site, engine).catch(() => null);
			const split = splitByEngineBudget(group, budget);
			sendable = split.sendable;
			releaseIds.push(...split.release.map((job) => job.id));
			if (split.defer.length > 0) {
				const resumeAt = quotaResetAt(engine);
				const overIds = split.defer.map((job) => job.id);
				await Promise.all(
					chunk(overIds, 1000).map((ids) =>
						requeueClaimed(ids, now, { nextRunAt: resumeAt, lastErrorMessage: `${ENGINE_LABELS[engine]} daily quota is used up; resumes after ${resumeAt.toISOString()}.` }),
					),
				);
				counts.deferredCount += overIds.length;
			}
		}

		for (const batch of chunk(sendable, ENGINE_BATCH_SIZE[engine as SubmissionEngine] ?? 100)) {
			const ids = batch.map((job) => job.id);
			const throttle = throttledEngines.get(engineKey);
			if (throttle) {
				await requeueClaimed(ids, now, {
					nextRunAt: throttle.resumeAt,
					httpStatus: 429,
					throttleCount: sql`greatest(${submissionJobs.throttleCount}, ${throttle.throttleCount})`,
					lastErrorMessage: throttle.error,
				});
				counts.throttledCount += batch.length;
				continue;
			}
			const sent = requestsSent.get(engineKey) ?? 0;
			const overDeadline = options.deadline !== undefined && Date.now() > options.deadline;
			const overPacing = engine === "indexnow" && sent >= AUTOMATION_LIMITS.indexNowRequestsPerSitePerRun;
			if (overDeadline || overPacing) {
				releaseIds.push(...ids);
				continue;
			}
			requestsSent.set(engineKey, sent + 1);

			const outcome = await sendClaimedBatch(site, engine, batch, now);
			if (outcome.throttle) throttledEngines.set(engineKey, outcome.throttle);
			if (outcome.kind === "success") counts.successCount += outcome.count;
			else if (outcome.kind === "failed") counts.failedCount += outcome.count;
			else if (outcome.kind === "retry") counts.retryCount += outcome.count;
			else if (outcome.kind === "skipped") counts.skippedCount += outcome.count;
			else counts.throttledCount += outcome.count;
		}
	}

	// Unsent claimed jobs go straight back with their nextRunAt untouched, so they lead the next run.
	await Promise.all(chunk(releaseIds, 1000).map((ids) => requeueClaimed(ids, now)));
	counts.deferredCount += releaseIds.length;

	const throttledUntil = Array.from(throttledEngines.values()).reduce<Date | null>(
		(latest, item) => (!latest || item.resumeAt > latest ? item.resumeAt : latest),
		null,
	);
	return { processedCount: jobs.length, ...counts, throttledUntil };
}

// ---------------------------------------------------------------------------
// Cron
// ---------------------------------------------------------------------------

/**
 * Effective sync interval (minutes) per user, in SQL so due-site selection matches
 * resolveEntitlement: a paid tier counts while its period plus PLAN_GRACE_DAYS has not ended
 * (or it has no expiry: legacy Dodo); everything else gets the Free interval.
 */
function syncIntervalMinutesSql(now: Date) {
	const graceCutoff = new Date(now.getTime() - PLAN_GRACE_DAYS * DAY_MS).toISOString();
	const freeMinutes = PLANS.free.limits.syncIntervalMinutes;
	const paidCases = Object.values(PLANS)
		.filter((plan) => plan.id !== "free")
		.map((plan) => sql`when ${plan.id} then cast(${plan.limits.syncIntervalMinutes} as int)`);
	return sql`case when ${users.planExpiresAt} is null or ${users.planExpiresAt} > cast(${graceCutoff} as timestamp)
		then (case ${users.billingTier} ${sql.join(paidCases, sql` `)} else cast(${freeMinutes} as int) end)
		else cast(${freeMinutes} as int) end`;
}

/**
 * Sites with a sitemap source due under the owner's plan interval (Free daily, paid hourly),
 * oldest first. The interval is applied in SQL so a backlog of not-yet-due Free sources can
 * no longer crowd paid sites out of the scan; how many actually sync is decided by the
 * cron's time budget. Paused sites (over the plan's site limit) are skipped.
 */
async function findDueSites(now: Date) {
	// 5 minutes of slack so an hourly cron does not skip a source synced 59 minutes ago.
	const dueBefore = sql`cast(${now.toISOString()} as timestamp) - (${syncIntervalMinutesSql(now)} - 5) * interval '1 minute'`;
	const rows = await db
		.select({
			siteId: sites.id,
			userId: sites.userId,
			billingTier: users.billingTier,
			planExpiresAt: users.planExpiresAt,
		})
		.from(siteSitemaps)
		.innerJoin(sites, eq(siteSitemaps.siteId, sites.id))
		.innerJoin(users, eq(sites.userId, users.id))
		.where(and(ne(siteSitemaps.status, "disabled"), or(isNull(siteSitemaps.lastSyncAt), sql`${siteSitemaps.lastSyncAt} <= ${dueBefore}`)))
		.groupBy(sites.id, sites.userId, users.billingTier, users.planExpiresAt)
		.orderBy(sql`bool_or(${siteSitemaps.lastSyncAt} is null) desc`, sql`min(${siteSitemaps.lastSyncAt}) asc`)
		.limit(AUTOMATION_LIMITS.maxDueSitesScanned);

	const entitlements = new Map<string, Entitlement>();
	for (const row of rows) {
		if (!entitlements.has(row.userId)) {
			entitlements.set(row.userId, resolveEntitlement(row, now));
		}
	}
	const paused = await getPausedSiteIdsForUsers(entitlements);
	return rows
		.filter((row) => !paused.has(row.siteId))
		.map((row) => ({ siteId: row.siteId, entitlement: entitlements.get(row.userId)! }));
}

/**
 * Hourly entry point (worker.ts `scheduled`). Order matters: expire plans first so the
 * sync step sees post-expiry limits, then crawl, then drain the queue, then housekeeping.
 * Each step is isolated: one failing step is recorded and the others still run, and the
 * cron_runs row is always finished (success, or failed with every step's error).
 */
export async function runScheduledAutomation() {
	const startedAt = Date.now();
	const now = new Date(startedAt);
	const errors: string[] = [];
	const step = async <T>(name: string, task: () => Promise<T>): Promise<T | null> => {
		try {
			return await task();
		} catch (error) {
			errors.push(`${name}: ${getErrorMessage(error)}`);
			return null;
		}
	};

	// A run the Worker killed never reaches its own bookkeeping, so the next run closes it.
	await step("close stale runs", () =>
		db
			.update(cronRuns)
			.set({ status: "failed", errorMessage: "Timed out: the run was stopped before it finished.", finishedAt: now })
			.where(
				and(eq(cronRuns.status, "running"), lt(cronRuns.startedAt, new Date(startedAt - AUTOMATION_LIMITS.staleCronRunMinutes * MINUTE_MS))),
			),
	);
	const [run] = await db.insert(cronRuns).values({ status: "running" }).returning({ id: cronRuns.id });

	const downgraded = await step("downgrade", async () => {
		const { downgradeExpiredPlans } = await import("@/lib/platform/razorpay-billing");
		return downgradeExpiredPlans(now);
	});

	const syncDeadline = startedAt + AUTOMATION_LIMITS.syncTimeBudgetMs;
	const sync = await step("sync", async () => {
		const due = await findDueSites(now);
		const results: Array<{ siteId: string; ok: boolean; newCount?: number; error?: string }> = [];
		for (const { siteId, entitlement } of due) {
			if (Date.now() > syncDeadline) {
				break;
			}
			const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
			if (!site) {
				continue;
			}
			try {
				const result = await syncActiveSitemaps(site, entitlement, { deadline: syncDeadline });
				results.push({ siteId, ok: result.success, newCount: result.newCount });
			} catch (error) {
				results.push({ siteId, ok: false, error: getErrorMessage(error) });
			}
		}
		return { due: due.length, results };
	});

	const queue = await step("queue", () => processSubmissionQueue({ deadline: startedAt + AUTOMATION_LIMITS.cronTimeBudgetMs }));

	// Search Console URL Inspection, bounded by count, per-property quota and its own budget.
	const gscInspection = await step("gsc inspection", () => runScheduledGscInspections(Date.now() + GOOGLE_LIMITS.inspectionTimeBudgetMs));

	const prunedUsageEvents = await step("prune usage events", async () => {
		const cutoff = new Date(startedAt - AUTOMATION_LIMITS.apiUsageRetentionDays * DAY_MS);
		const result = await db.delete(apiUsageEvents).where(lt(apiUsageEvents.createdAt, cutoff));
		return result.rowCount ?? 0;
	});
	const prunedQuotaRows = await step("prune quota rows", () => pruneQuotaUsage(new Date(startedAt - GOOGLE_LIMITS.quotaRetentionDays * DAY_MS)));

	const summary = {
		downgraded,
		sitesDue: sync?.due ?? 0,
		sitesSynced: sync?.results.length ?? 0,
		syncFailures: sync?.results.filter((result) => !result.ok).length ?? 0,
		newUrls: sync?.results.reduce((total, result) => total + (result.newCount ?? 0), 0) ?? 0,
		queue,
		gscInspection,
		prunedUsageEvents,
		prunedQuotaRows,
		durationMs: Date.now() - startedAt,
	};
	await db
		.update(cronRuns)
		.set({
			status: errors.length > 0 ? "failed" : "success",
			summary,
			errorMessage: errors.length > 0 ? truncateMessage(errors.join(" | ")) : null,
			finishedAt: new Date(),
		})
		.where(eq(cronRuns.id, run.id));
	if (errors.length > 0) {
		throw new Error(`Scheduled automation finished with errors: ${errors.join(" | ")}`);
	}
	return summary;
}

// ---------------------------------------------------------------------------
// Read helpers for settings UI
// ---------------------------------------------------------------------------

export async function getBingStatusForUser(userId: string, siteId?: string) {
	const [integration] = await db
		.select()
		.from(userIntegrations)
		.where(and(eq(userIntegrations.userId, userId), eq(userIntegrations.provider, "bing")))
		.limit(1);
	if (!integration) {
		return null;
	}

	let siteIntegration: { automationEnabled: boolean; lastErrorMessage: string | null } | undefined;
	if (siteId) {
		const [row] = await db
			.select({ automationEnabled: siteIntegrations.automationEnabled, lastErrorMessage: siteIntegrations.lastErrorMessage })
			.from(siteIntegrations)
			.where(and(eq(siteIntegrations.siteId, siteId), eq(siteIntegrations.provider, "bing")))
			.limit(1);
		siteIntegration = row;
	}

	const key = await decryptSecret(integration.encryptedSecret).catch(() => null);
	const publicCfg = readPublicConfig(integration.publicConfig);
	const quota = (publicCfg as Record<string, unknown>)?.quota as { dailyQuota?: number; monthlyQuota?: number } | undefined;

	return {
		status: integration.status,
		maskedKey: key ? maskCredential(key) : null,
		autoSubmit: siteIntegration ? siteIntegration.automationEnabled : true,
		quota: quota ?? null,
		verifiedAt: integration.verifiedAt,
		lastErrorMessage: siteIntegration?.lastErrorMessage || integration.lastErrorMessage,
	};
}

export async function getSiteQueueSummary(userId: string, siteId: string) {
	const site = await getSiteForUser(siteId, userId);
	if (!site) return null;

	const now = new Date();

	const [statusCounts, throttledRows, engineCounts, [earliestNextRun], throttles] = await Promise.all([
		db
			.select({
				status: submissionJobs.status,
				count: sql<number>`cast(count(*) as int)`,
			})
			.from(submissionJobs)
			.where(eq(submissionJobs.siteId, siteId))
			.groupBy(submissionJobs.status),
		db
			.select({
				count: sql<number>`cast(count(*) as int)`,
			})
			.from(submissionJobs)
			.where(
				and(
					eq(submissionJobs.siteId, siteId),
					eq(submissionJobs.status, "queued"),
					or(
						eq(submissionJobs.httpStatus, 429),
						isNotNull(submissionJobs.retryAfterAt),
						gt(submissionJobs.nextRunAt, now),
					),
				),
			),
		db
			.select({
				engine: submissionJobs.engine,
				count: sql<number>`cast(count(*) as int)`,
			})
			.from(submissionJobs)
			.where(and(eq(submissionJobs.siteId, siteId), inArray(submissionJobs.status, ["queued", "processing"])))
			.groupBy(submissionJobs.engine),
		db
			.select({
				nextRunAt: sql<Date | null>`min(${submissionJobs.nextRunAt})`,
			})
			.from(submissionJobs)
			.where(and(eq(submissionJobs.siteId, siteId), eq(submissionJobs.status, "queued"))),
		// Per-engine 429 cooldowns still in force, for the "rate limited until" banner.
		db
			.select({ engine: submissionJobs.engine, until: sql<Date | null>`max(${submissionJobs.nextRunAt})` })
			.from(submissionJobs)
			.where(
				and(
					eq(submissionJobs.siteId, siteId),
					eq(submissionJobs.status, "queued"),
					eq(submissionJobs.httpStatus, 429),
					gt(submissionJobs.nextRunAt, now),
				),
			)
			.groupBy(submissionJobs.engine),
	]);

	const summary = {
		queued: 0,
		processing: 0,
		success: 0,
		failed: 0,
		throttled: throttledRows[0]?.count ?? 0,
		openTotal: 0,
		byEngine: {
			indexnow: 0,
			bing: 0,
		} as Record<string, number>,
		nextRunAt: earliestNextRun?.nextRunAt ?? null,
		throttledUntil: Object.fromEntries(throttles.filter((row) => row.until).map((row) => [row.engine, new Date(row.until as Date)])) as Record<string, Date>,
	};

	for (const row of statusCounts) {
		if (row.status in summary) {
			(summary as Record<string, unknown>)[row.status] = row.count;
		}
	}
	summary.openTotal = summary.queued + summary.processing;

	for (const row of engineCounts) {
		summary.byEngine[row.engine] = row.count;
	}

	return summary;
}

export async function getSiteQueueJobs(
	userId: string,
	siteId: string,
	options: { page?: number; limit?: number; status?: string; engine?: string } = {},
) {
	const site = await getSiteForUser(siteId, userId);
	if (!site) return null;

	const page = Math.max(1, options.page ?? 1);
	const limit = Math.min(100, Math.max(1, options.limit ?? 50));
	const offset = (page - 1) * limit;

	const filters: SQL[] = [eq(submissionJobs.siteId, siteId)];
	if (options.status) {
		filters.push(eq(submissionJobs.status, options.status));
	}
	if (options.engine) {
		filters.push(eq(submissionJobs.engine, options.engine));
	}

	const [jobs, [countRow]] = await Promise.all([
		db
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
			.where(and(...filters))
			.orderBy(asc(submissionJobs.priority), asc(submissionJobs.nextRunAt), desc(submissionJobs.createdAt))
			.limit(limit)
			.offset(offset),
		db
			.select({ total: sql<number>`cast(count(*) as int)` })
			.from(submissionJobs)
			.where(and(...filters)),
	]);

	return {
		jobs,
		total: countRow?.total ?? 0,
		page,
		limit,
		totalPages: Math.ceil((countRow?.total ?? 0) / limit),
	};
}

/** "Process now": same rules as the cron, for one owned, active site, at most maxDrainJobsInline jobs. */
export async function drainSiteQueueForUser(userId: string, siteId: string, maxJobs: number = AUTOMATION_LIMITS.maxDrainJobsInline) {
	const site = await getSiteForUser(siteId, userId);
	if (!site) {
		throw new Error("Site not found or unauthorized");
	}
	await assertSiteActive(userId, siteId);
	const limit = Math.min(AUTOMATION_LIMITS.maxDrainJobsInline, Math.max(1, Math.floor(Number(maxJobs) || 1)));
	return processSubmissionQueue({ siteId, maxJobs: limit, deadline: Date.now() + AUTOMATION_LIMITS.inlineQueueTimeBudgetMs });
}
