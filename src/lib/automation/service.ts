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
import { and, asc, desc, eq, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	alerts,
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
import { getPausedSiteIdsForUsers, getUserAccess, getUserEntitlement } from "@/lib/platform/entitlements";
import { formatLimit, resolveEntitlement, type Entitlement } from "@/lib/platform/plans";
import { AUTOMATION_LIMITS, ENGINE_BATCH_SIZE, type SubmissionEngine } from "./constants";
import { encryptSecret, hasCredentialEncryptionKey, isEncryptedSecret, maskCredential, readStoredSecret } from "./credentials";
import {
	generateIndexNowKey,
	getBingSubmissionQuota,
	getIndexNowKeyLocation,
	submitBingBatch,
	submitIndexNowBatch,
	verifyIndexNowKey,
	type EngineSubmissionResult,
} from "./search-engines";
import { discoverSitemapUrls, fetchSitemapTree, type ParsedSitemapUrl } from "./sitemaps";

type SiteRow = typeof sites.$inferSelect;
type SiteSitemapRow = typeof siteSitemaps.$inferSelect;
type UrlQueueRow = { id: string; loc: string };
type SubmissionReason = "new" | "changed" | "manual";

const MINUTE_MS = 60 * 1000;

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
 * Secrets are stored AES-GCM encrypted (credentials.ts). Rows written by older releases are
 * plaintext; they are re-encrypted the next time they are read so no bulk migration is needed.
 */
async function upgradeLegacySecret(value: string) {
	if (isEncryptedSecret(value) || !hasCredentialEncryptionKey()) return value;
	return encryptSecret(await readStoredSecret(value));
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
		const key = await readStoredSecret(existing.encryptedSecret);
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
		return { ok: false, message: result.message, queued: 0, submitted: 0 };
	}

	await db.update(sites).set({ verified: true, automationEnabled: true, updatedAt: now }).where(eq(sites.id, site.id));
	const verifiedSite = { ...site, verified: true, automationEnabled: true };

	// First verification: push the backlog of URLs found before the key was live.
	const entitlement = await getUserEntitlement(userId);
	const backlog = await db
		.select({ id: urls.id, loc: urls.loc })
		.from(urls)
		.where(and(eq(urls.siteId, site.id), isNull(urls.lastSubmittedAt)))
		.limit(Math.min(entitlement.limits.urlsPerSite, AUTOMATION_LIMITS.maxUrlsPerSitemap));
	const queued = await enqueueUrlRows(verifiedSite, backlog, "new", entitlement, true);
	const processed = queued > 0 ? await processSubmissionQueue({ siteId: site.id, maxJobs: AUTOMATION_LIMITS.maxManualJobsInline }) : null;

	return { ok: true, message: "Verified. Automation is on.", queued, submitted: processed?.successCount ?? 0 };
}

/** @deprecated name kept for older callers; verification is now the IndexNow key check. */
export const verifyIndexNowForUser = verifySiteForUser;

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
	return message;
}

export async function saveBingApiKeyForUser(userId: string, siteId: string, apiKey: string) {
	const site = await requireSite(userId, siteId);
	const entitlement = await getUserEntitlement(userId);
	if (!entitlement.limits.bing) {
		throw new Error("Direct Bing submissions are included in Pro and Unlimited.");
	}

	const cleanApiKey = apiKey.trim();
	if (!cleanApiKey) {
		throw new Error("Bing API key is required");
	}

	const siteUrl = `https://${getSiteHost(site)}`;
	const validation = await getBingSubmissionQuota(cleanApiKey, siteUrl);
	const now = new Date();
	const status = validation.ok ? "verified" : "failed";
	const message = validation.ok ? null : truncateMessage(describeBingValidationMessage(siteUrl, validation.message));
	const values = {
		status,
		encryptedSecret: await encryptSecret(cleanApiKey),
		publicConfig: { lastValidationStatus: validation.status, siteUrl },
		verifiedAt: validation.ok ? now : null,
		lastCheckedAt: now,
		lastErrorAt: validation.ok ? null : now,
		lastErrorMessage: message,
	};

	await db
		.insert(userIntegrations)
		.values({ userId, provider: "bing", ...values })
		.onConflictDoUpdate({ target: [userIntegrations.userId, userIntegrations.provider], set: { ...values, updatedAt: now } });

	if (!validation.ok) {
		throw new Error(message || "Bing rejected the API key.");
	}
	return validation;
}

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
		if (cleanSitemapUrl) {
			await addSitemapSource(site, cleanSitemapUrl, true);
			discovered = [cleanSitemapUrl];
		} else {
			discovered = await discoverAndSaveSitemaps(site);
		}
		if (discovered.length > 0) {
			sync = await syncActiveSitemaps(site, entitlement);
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
	return addSitemapSource(await requireSite(userId, siteId), sitemapUrl, isPrimary);
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

async function syncSitemapSource(site: SiteRow, source: SiteSitemapRow, entitlement: Entitlement) {
	const now = new Date();
	const [syncRow] = await db.insert(sitemaps).values({ siteId: site.id, url: source.url, status: "syncing" }).returning();

	try {
		const maxUrls = Math.min(entitlement.limits.urlsPerSite, AUTOMATION_LIMITS.maxUrlsPerSitemap);
		const result = await fetchSitemapTree(source.url, getSiteHost(site), maxUrls);
		if (result.urls.length === 0) {
			throw new Error("No URLs for this exact host were found in the sitemap.");
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
		const cooldownCutoff = now.getTime() - AUTOMATION_LIMITS.resubmitCooldownHours * 60 * MINUTE_MS;
		const newRows = upserted.filter((row) => newLocs.has(row.loc));
		const changedRows = upserted.filter((row) => {
			const existing = existingByLoc.get(row.loc);
			return existing && !newLocs.has(row.loc) && (!existing.lastSubmittedAt || existing.lastSubmittedAt.getTime() < cooldownCutoff);
		});

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
				.set({ status: "active", lastSyncAt: now, lastErrorAt: null, lastErrorMessage: null, updatedAt: now })
				.where(eq(siteSitemaps.id, source.id)),
			db
				.update(sitemaps)
				.set({
					status: "success",
					lastSyncTime: now,
					urlCount: result.urls.length,
					newCount: newRows.length,
					changedCount: changedRows.length,
				})
				.where(eq(sitemaps.id, syncRow.id)),
			resolveAlerts(site.id, "Sitemap sync failed"),
		]);

		return {
			sourceId: source.id,
			url: source.url,
			urlCount: result.urls.length,
			newCount: newRows.length,
			changedCount: changedRows.length,
			queuedCount: queued,
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
			raiseAlert(site.id, "Sitemap sync failed", `${source.url}: ${message}`, "sitemap_failure"),
		]);
		throw error;
	}
}

async function syncActiveSitemaps(site: SiteRow, entitlement: Entitlement, sourceId?: string) {
	const filters = [eq(siteSitemaps.siteId, site.id), ne(siteSitemaps.status, "disabled")];
	if (sourceId) {
		filters.push(eq(siteSitemaps.id, sourceId));
	}

	const sources = await db
		.select()
		.from(siteSitemaps)
		.where(and(...filters))
		.orderBy(desc(siteSitemaps.isPrimary), asc(siteSitemaps.createdAt));

	if (sources.length === 0) {
		throw new Error("No sitemap added yet. Add your sitemap URL or run discovery.");
	}

	const results = [];
	const failures: string[] = [];
	for (const source of sources) {
		try {
			results.push(await syncSitemapSource(site, source, entitlement));
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
	const result = await syncActiveSitemaps(site, entitlement, sourceId);
	const processed =
		result.queuedCount > 0 ? await processSubmissionQueue({ siteId, maxJobs: AUTOMATION_LIMITS.maxManualJobsInline }) : null;
	return { ...result, submitted: processed?.successCount ?? 0 };
}

// ---------------------------------------------------------------------------
// Submission queue
// ---------------------------------------------------------------------------

async function getEligibleEngines(site: SiteRow, entitlement: Entitlement, manual = false): Promise<SubmissionEngine[]> {
	if (!manual && !(site.verified && site.automationEnabled)) {
		return [];
	}

	const [[indexNow], [bingSite], [bingUser]] = await Promise.all([
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
	]);

	const engines: SubmissionEngine[] = [];
	if (indexNow?.status === "verified" && (manual || indexNow.automationEnabled)) {
		engines.push("indexnow");
	}
	if (entitlement.limits.bing && bingUser?.status === "verified" && (manual || (bingSite?.automationEnabled ?? true))) {
		engines.push("bing");
	}
	return engines;
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
	let queued = 0;
	for (const engine of engines) {
		for (const batch of chunk(rows, AUTOMATION_LIMITS.upsertChunkSize)) {
			const inserted = await db
				.insert(submissionJobs)
				.values(batch.map((row) => ({ siteId: site.id, urlId: row.id, loc: row.loc, engine, reason, status: "queued" })))
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
		throw new Error("Verify the site's key file first, then submit.");
	}
	const processed = await processSubmissionQueue({ siteId, maxJobs: AUTOMATION_LIMITS.maxManualJobsInline });
	return { accepted: valid.size, rejected, queued, ...processed };
}

/** Back-compat wrapper for single URL callers. */
export async function enqueueManualSubmissionForUser(userId: string, siteId: string, urlLoc: string) {
	return submitUrlsForUser(userId, siteId, [urlLoc]);
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
		throw new Error("Verify the site's key file first, then submit.");
	}
	const processed = queued > 0 ? await processSubmissionQueue({ siteId, maxJobs: AUTOMATION_LIMITS.maxManualJobsInline }) : null;
	return { queued, submitted: processed?.successCount ?? 0 };
}

function isRetryable(result: EngineSubmissionResult) {
	return result.status === 0 || result.status === 429 || result.status >= 500;
}

async function submitEngineBatch(site: SiteRow, engine: string, urlList: string[]): Promise<EngineSubmissionResult> {
	if (engine === "indexnow") {
		const [integration] = await db
			.select()
			.from(siteIntegrations)
			.where(and(eq(siteIntegrations.siteId, site.id), eq(siteIntegrations.provider, "indexnow")))
			.limit(1);
		if (!integration?.encryptedSecret || integration.status !== "verified") {
			return { ok: false, status: 403, message: "IndexNow key is not verified." };
		}
		const key = await readStoredSecret(integration.encryptedSecret);
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
		const apiKey = await readStoredSecret(integration.encryptedSecret);
		const upgraded = await upgradeLegacySecret(integration.encryptedSecret);
		if (upgraded !== integration.encryptedSecret) {
			await db.update(userIntegrations).set({ encryptedSecret: upgraded, updatedAt: new Date() }).where(eq(userIntegrations.id, integration.id));
		}
		return submitBingBatch(apiKey, `https://${getSiteHost(site)}`, urlList);
	}

	return { ok: false, status: 400, message: `Unsupported engine: ${engine}` };
}

/**
 * Drain the queue: recover orphaned locks, atomically claim due jobs (manual first), submit
 * per site+engine in engine-sized batches, then record results. Transient failures
 * (network/429/5xx) retry with exponential backoff; others fail fast and raise one alert.
 */
export async function processSubmissionQueue(options: { siteId?: string; maxJobs?: number } = {}) {
	const now = new Date();
	const maxJobs = options.maxJobs ?? AUTOMATION_LIMITS.maxSubmissionJobsPerRun;

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
	// SKIP LOCKED lets a concurrent run (cron + manual submit) claim disjoint rows. Works over
	// Neon HTTP because the whole claim is a single UPDATE statement.
	const candidateIds = db
		.select({ id: submissionJobs.id })
		.from(submissionJobs)
		.where(and(dueFilter, inArray(submissionJobs.siteId, verifiedSiteIds)))
		.orderBy(sql`case when ${submissionJobs.reason} = 'manual' then 0 else 1 end`, asc(submissionJobs.createdAt))
		.limit(maxJobs)
		.for("update", { skipLocked: true });
	// The outer status check makes the claim safe if two runs race for the same rows.
	const jobs = await db
		.update(submissionJobs)
		.set({ status: "processing", lockedAt: now, updatedAt: now })
		.where(and(inArray(submissionJobs.id, candidateIds), eq(submissionJobs.status, "queued")))
		.returning();

	if (jobs.length === 0) {
		return { processedCount: 0, successCount: 0, failedCount: 0, retryCount: 0 };
	}

	const groups = new Map<string, typeof jobs>();
	for (const job of jobs) {
		const key = `${job.siteId}:${job.engine}`;
		groups.set(key, [...(groups.get(key) ?? []), job]);
	}

	const siteRows = await db
		.select()
		.from(sites)
		.where(inArray(sites.id, Array.from(new Set(jobs.map((job) => job.siteId)))));
	const siteById = new Map(siteRows.map((site) => [site.id, site]));

	let successCount = 0;
	let failedCount = 0;
	let retryCount = 0;

	for (const group of groups.values()) {
		const { siteId, engine } = group[0];
		const site = siteById.get(siteId);
		const batchSize = ENGINE_BATCH_SIZE[engine as SubmissionEngine] ?? 100;

		for (const batch of chunk(group, batchSize)) {
			const urlList = batch.map((job) => job.loc);
			const result: EngineSubmissionResult = site
				? await submitEngineBatch(site, engine, urlList).catch((error) => ({ ok: false, status: 0, message: getErrorMessage(error) }))
				: { ok: false, status: 404, message: "Site no longer exists." };
			const completedAt = new Date();
			const responseMessage = truncateMessage(result.message || `HTTP ${result.status}`);
			const attempt = batch[0].attempts + 1;
			const retry = !result.ok && isRetryable(result) && attempt < AUTOMATION_LIMITS.maxSubmitAttempts;
			const jobIds = batch.map((job) => job.id);

			const writes: Promise<unknown>[] = [
				...chunk(batch, AUTOMATION_LIMITS.upsertChunkSize).map((rows) =>
					db.insert(submissions).values(
						rows.map((job) => ({
							siteId: job.siteId,
							loc: job.loc,
							engine: job.engine,
							status: result.ok ? "success" : "failed",
							responseMessage,
							attempt: job.attempts + 1,
						})),
					),
				),
			];

			if (retry) {
				// 10 min, 20 min, 40 min ... keeps a flaky engine from being hammered.
				const backoffMs = 10 * MINUTE_MS * 2 ** (attempt - 1);
				writes.push(
					db
						.update(submissionJobs)
						.set({
							status: "queued",
							attempts: attempt,
							lockedAt: null,
							nextRunAt: new Date(completedAt.getTime() + backoffMs),
							lastErrorMessage: responseMessage,
							updatedAt: completedAt,
						})
						.where(inArray(submissionJobs.id, jobIds)),
				);
				retryCount += batch.length;
			} else {
				const status = result.ok ? "success" : "failed";
				writes.push(
					db
						.update(submissionJobs)
						.set({
							status,
							attempts: attempt,
							lockedAt: null,
							lastErrorMessage: result.ok ? null : responseMessage,
							updatedAt: completedAt,
						})
						.where(inArray(submissionJobs.id, jobIds)),
					...chunk(urlList, 1000).map((locs) =>
						db
							.update(urls)
							.set({ lastSubmittedAt: completedAt, lastSubmissionStatus: status })
							.where(and(eq(urls.siteId, siteId), inArray(urls.loc, locs))),
					),
				);
				if (result.ok) {
					successCount += batch.length;
				} else {
					failedCount += batch.length;
				}
			}

			await Promise.all(writes);

			if (!result.ok && !retry && site) {
				await raiseAlert(siteId, `${engine === "bing" ? "Bing" : "IndexNow"} submission failed`, `${batch.length} URL(s): ${responseMessage}`, "error_detected");
			} else if (result.ok && site) {
				await resolveAlerts(siteId, `${engine === "bing" ? "Bing" : "IndexNow"} submission failed`);
			}
		}
	}

	return { processedCount: jobs.length, successCount, failedCount, retryCount };
}

// ---------------------------------------------------------------------------
// Cron
// ---------------------------------------------------------------------------

/**
 * Pick sitemap sources whose site is due for a re-crawl under its owner's plan interval
 * (Free daily, paid hourly). Paused sites (over the plan's site limit) are skipped.
 */
async function findDueSites(now: Date) {
	const hourAgo = new Date(now.getTime() - 55 * MINUTE_MS);
	const rows = await db
		.select({
			siteId: sites.id,
			userId: sites.userId,
			lastSyncAt: siteSitemaps.lastSyncAt,
			billingTier: users.billingTier,
			planExpiresAt: users.planExpiresAt,
		})
		.from(siteSitemaps)
		.innerJoin(sites, eq(siteSitemaps.siteId, sites.id))
		.innerJoin(users, eq(sites.userId, users.id))
		.where(and(ne(siteSitemaps.status, "disabled"), or(isNull(siteSitemaps.lastSyncAt), lte(siteSitemaps.lastSyncAt, hourAgo))))
		.orderBy(sql`${siteSitemaps.lastSyncAt} asc nulls first`)
		.limit(1000);

	const entitlements = new Map<string, Entitlement>();
	for (const row of rows) {
		if (!entitlements.has(row.userId)) {
			entitlements.set(row.userId, resolveEntitlement(row, now));
		}
	}
	const paused = await getPausedSiteIdsForUsers(entitlements);

	const due: Array<{ siteId: string; entitlement: Entitlement }> = [];
	const seen = new Set<string>();
	for (const row of rows) {
		const entitlement = entitlements.get(row.userId)!;
		// Small slack so an hourly cron does not skip a site synced 59m ago.
		const intervalMs = (entitlement.limits.syncIntervalMinutes - 5) * MINUTE_MS;
		const isDue = !row.lastSyncAt || now.getTime() - row.lastSyncAt.getTime() >= intervalMs;
		if (isDue && !paused.has(row.siteId) && !seen.has(row.siteId)) {
			seen.add(row.siteId);
			due.push({ siteId: row.siteId, entitlement });
		}
	}
	return due.slice(0, AUTOMATION_LIMITS.maxSitesPerRun);
}

/**
 * Hourly entry point (worker.ts `scheduled`). Order matters: expire plans first so the
 * sync step sees post-expiry limits, then crawl, then drain the queue. Each run is logged
 * to cron_runs for the admin panel.
 */
export async function runScheduledAutomation() {
	const startedAt = Date.now();
	const now = new Date(startedAt);
	const [run] = await db.insert(cronRuns).values({ status: "running" }).returning({ id: cronRuns.id });

	try {
		const { downgradeExpiredPlans } = await import("@/lib/platform/razorpay-billing");
		const downgraded = await downgradeExpiredPlans(now);

		const due = await findDueSites(now);
		const syncResults: Array<{ siteId: string; ok: boolean; newCount?: number; error?: string }> = [];
		for (const { siteId, entitlement } of due) {
			if (Date.now() - startedAt > AUTOMATION_LIMITS.cronTimeBudgetMs) {
				break;
			}
			const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
			if (!site) {
				continue;
			}
			try {
				const result = await syncActiveSitemaps(site, entitlement);
				syncResults.push({ siteId, ok: result.success, newCount: result.newCount });
			} catch (error) {
				syncResults.push({ siteId, ok: false, error: getErrorMessage(error) });
			}
		}

		const queue = await processSubmissionQueue();
		const summary = {
			downgraded,
			sitesSynced: syncResults.length,
			syncFailures: syncResults.filter((result) => !result.ok).length,
			newUrls: syncResults.reduce((total, result) => total + (result.newCount ?? 0), 0),
			queue,
			durationMs: Date.now() - startedAt,
		};
		await db.update(cronRuns).set({ status: "success", summary, finishedAt: new Date() }).where(eq(cronRuns.id, run.id));
		return summary;
	} catch (error) {
		await db
			.update(cronRuns)
			.set({ status: "failed", errorMessage: truncateMessage(getErrorMessage(error)), finishedAt: new Date() })
			.where(eq(cronRuns.id, run.id));
		throw error;
	}
}

// ---------------------------------------------------------------------------
// Read helpers for settings UI
// ---------------------------------------------------------------------------

export async function getBingStatusForUser(userId: string) {
	const [integration] = await db
		.select()
		.from(userIntegrations)
		.where(and(eq(userIntegrations.userId, userId), eq(userIntegrations.provider, "bing")))
		.limit(1);
	if (!integration) {
		return null;
	}
	const key = await readStoredSecret(integration.encryptedSecret).catch(() => null);
	return {
		status: integration.status,
		maskedKey: key ? maskCredential(key) : null,
		verifiedAt: integration.verifiedAt,
		lastErrorMessage: integration.lastErrorMessage,
	};
}

export async function countOpenJobs(siteId: string) {
	const [row] = await db
		.select({ count: sql<number>`cast(count(*) as int)` })
		.from(submissionJobs)
		.where(and(eq(submissionJobs.siteId, siteId), inArray(submissionJobs.status, ["queued", "processing"])));
	return row?.count ?? 0;
}
