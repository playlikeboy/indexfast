import { and, desc, eq, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
	alerts,
	siteIntegrations,
	siteSitemaps,
	sitemaps,
	sites,
	submissionJobs,
	submissions,
	urls,
	userIntegrations,
} from "@/db/schema";
import { getErrorMessage, getSiteHost, normalizeSitemapUrl, normalizeUrlForHost } from "@/lib/url-utils";
import { AUTOMATION_LIMITS } from "./constants";
import { encryptSecret, hasCredentialEncryptionKey, isEncryptedSecret, maskCredential, readStoredSecret } from "./credentials";
import {
	generateIndexNowKey,
	getBingSubmissionQuota,
	getIndexNowKeyLocation,
	submitBingBatch,
	submitIndexNowBatch,
	verifyIndexNowKey,
} from "./search-engines";
import { discoverSitemapUrls, fetchSitemapTree, type ParsedSitemapUrl } from "./sitemaps";

type SiteRow = typeof sites.$inferSelect;
type SiteSitemapRow = typeof siteSitemaps.$inferSelect;
type UrlQueueRow = { id: string; loc: string };

function truncateMessage(message: string) {
	return message.length > 1000 ? `${message.slice(0, 997)}...` : message;
}

function hasLastmodChanged(existing: { lastmod: Date | null }, next: ParsedSitemapUrl) {
	if (!next.lastmod) {
		return false;
	}

	return !existing.lastmod || existing.lastmod.getTime() !== next.lastmod.getTime();
}

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

function getConfiguredKeyLocation(publicConfig: unknown, host: string, key: string) {
	const config = readPublicConfig(publicConfig);
	return config.keyLocation || getIndexNowKeyLocation(host, key);
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
	if (!cleanLocation) {
		throw new Error("IndexNow file URL is required.");
	}

	let url: URL;
	try {
		url = new URL(cleanLocation);
	} catch {
		throw new Error("Enter a valid IndexNow file URL.");
	}

	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new Error("IndexNow file URL must use HTTP or HTTPS.");
	}

	if (url.hostname.toLowerCase() !== host) {
		throw new Error("IndexNow file URL must belong to the exact site host.");
	}

	return url.toString();
}

function getSiteUrl(site: SiteRow) {
	return `https://${getSiteHost(site)}`;
}

function describeBingValidationMessage(siteUrl: string, message: string) {
	if (/InvalidParameter/i.test(message)) {
		return `Bing returned InvalidParameter for ${siteUrl}. Make sure this exact site URL is added and verified in Bing Webmaster Tools.`;
	}

	return message;
}

export async function getSiteForUser(siteId: string, userId: string) {
	const [site] = await db
		.select()
		.from(sites)
		.where(and(eq(sites.id, siteId), eq(sites.userId, userId)))
		.limit(1);

	return site;
}

async function upgradeLegacySecret(value: string) {
	if (isEncryptedSecret(value) || !hasCredentialEncryptionKey()) return value;
	return encryptSecret(await readStoredSecret(value));
}

export async function ensureIndexNowIntegration(site: SiteRow) {
	const host = getSiteHost(site);
	const [existing] = await db
		.select()
		.from(siteIntegrations)
		.where(and(eq(siteIntegrations.siteId, site.id), eq(siteIntegrations.provider, "indexnow")))
		.limit(1);

	if (existing?.encryptedSecret) {
		const key = await readStoredSecret(existing.encryptedSecret);
		const encryptedSecret = await upgradeLegacySecret(existing.encryptedSecret);
		const keyLocation = getConfiguredKeyLocation(existing.publicConfig, host, key);
		await db
			.update(siteIntegrations)
			.set({
				encryptedSecret,
				publicConfig: { host, keyLocation },
				updatedAt: new Date(),
			})
			.where(eq(siteIntegrations.id, existing.id));

		return { ...existing, encryptedSecret, publicConfig: { host, keyLocation }, key, keyLocation };
	}

	const key = generateIndexNowKey();
	const keyLocation = getIndexNowKeyLocation(host, key);
	const storedSecret = await encryptSecret(key);

	const [integration] = await db
		.insert(siteIntegrations)
		.values({
			siteId: site.id,
			provider: "indexnow",
			status: "pending",
			encryptedSecret: storedSecret,
			publicConfig: { host, keyLocation },
			automationEnabled: false,
		})
		.onConflictDoUpdate({
			target: [siteIntegrations.siteId, siteIntegrations.provider],
			set: {
				encryptedSecret: storedSecret,
				publicConfig: { host, keyLocation },
				updatedAt: new Date(),
			},
		})
		.returning();

	return { ...integration, key, keyLocation };
}

async function getIndexNowSettings(site: SiteRow) {
	const host = getSiteHost(site);
	const [existing] = await db
		.select()
		.from(siteIntegrations)
		.where(and(eq(siteIntegrations.siteId, site.id), eq(siteIntegrations.provider, "indexnow")))
		.limit(1);

	if (existing?.encryptedSecret) {
		try {
			const key = await readStoredSecret(existing.encryptedSecret);
			const encryptedSecret = await upgradeLegacySecret(existing.encryptedSecret);
			if (encryptedSecret !== existing.encryptedSecret) {
				await db.update(siteIntegrations)
					.set({ encryptedSecret, updatedAt: new Date() })
					.where(eq(siteIntegrations.id, existing.id));
			}
			const keyLocation = getConfiguredKeyLocation(existing.publicConfig, host, key);
			const config = readPublicConfig(existing.publicConfig);
			return {
				status: existing.status,
				key,
				keyLocation,
				verifiedAt: existing.verifiedAt,
				lastCheckedAt: existing.lastCheckedAt,
				lastErrorMessage: existing.lastErrorMessage,
				automationEnabled: existing.automationEnabled,
				submitNewUrls: config.submitNewUrls ?? true,
				submitChangedUrls: config.submitChangedUrls ?? true,
			};
		} catch (error) {
			return {
				status: "failed",
				key: null,
				keyLocation: null,
				verifiedAt: existing.verifiedAt,
				lastCheckedAt: existing.lastCheckedAt,
				lastErrorMessage: `Unable to decrypt IndexNow key: ${getErrorMessage(error)}`,
				automationEnabled: false,
				submitNewUrls: true,
				submitChangedUrls: true,
			};
		}
	}

	const integration = await ensureIndexNowIntegration(site);
	const config = readPublicConfig(integration.publicConfig);
	return {
		status: integration.status,
		key: integration.key,
		keyLocation: integration.keyLocation,
		verifiedAt: integration.verifiedAt,
		lastCheckedAt: integration.lastCheckedAt,
		lastErrorMessage: integration.lastErrorMessage,
		automationEnabled: integration.automationEnabled,
		submitNewUrls: config.submitNewUrls ?? true,
		submitChangedUrls: config.submitChangedUrls ?? true,
	};
}

export async function saveIndexNowKeyForUser(userId: string, siteId: string, keyLocation: string, key: string) {
	const site = await getSiteForUser(siteId, userId);
	if (!site) {
		throw new Error("Site not found");
	}

	const host = getSiteHost(site);
	const cleanKey = normalizeIndexNowKey(key);
	const cleanKeyLocation = normalizeIndexNowKeyLocation(keyLocation, host);
	const now = new Date();

	await db
		.insert(siteIntegrations)
		.values({
			siteId,
			provider: "indexnow",
			status: "pending",
			encryptedSecret: await encryptSecret(cleanKey),
			publicConfig: { host, keyLocation: cleanKeyLocation },
			automationEnabled: false,
		})
		.onConflictDoUpdate({
			target: [siteIntegrations.siteId, siteIntegrations.provider],
			set: {
				status: "pending",
				encryptedSecret: await encryptSecret(cleanKey),
				publicConfig: { host, keyLocation: cleanKeyLocation },
				verifiedAt: null,
				lastCheckedAt: null,
				lastErrorAt: null,
				lastErrorMessage: null,
				automationEnabled: false,
				updatedAt: now,
			},
		});
}

export async function verifyIndexNowForUser(userId: string, siteId: string) {
	const site = await getSiteForUser(siteId, userId);
	if (!site) {
		throw new Error("Site not found");
	}

	const integration = await ensureIndexNowIntegration(site);
	const result = await verifyIndexNowKey(getSiteHost(site), integration.key, integration.keyLocation);
	const now = new Date();

	await db
		.update(siteIntegrations)
		.set({
			status: result.ok ? "verified" : "failed",
			verifiedAt: result.ok ? now : null,
			lastCheckedAt: now,
			lastErrorAt: result.ok ? null : now,
			lastErrorMessage: result.ok ? null : truncateMessage(result.message),
			publicConfig: { host: getSiteHost(site), keyLocation: result.keyLocation },
			updatedAt: now,
		})
		.where(eq(siteIntegrations.id, integration.id));

	return result;
}

export async function saveBingApiKeyForUser(userId: string, siteId: string, apiKey: string) {
	const site = await getSiteForUser(siteId, userId);
	if (!site) {
		throw new Error("Site not found");
	}

	const cleanApiKey = apiKey.trim();
	if (!cleanApiKey) {
		throw new Error("Bing API key is required");
	}

	const siteUrl = getSiteUrl(site);
	const validation = await getBingSubmissionQuota(cleanApiKey, siteUrl);
	const now = new Date();
	const storedSecret = await encryptSecret(cleanApiKey);
	const status = validation.ok ? "verified" : "failed";
	const validationMessage = describeBingValidationMessage(siteUrl, validation.message);

	await db
		.insert(userIntegrations)
		.values({
			userId,
			provider: "bing",
			status,
			encryptedSecret: storedSecret,
			publicConfig: { lastValidationStatus: validation.status, siteUrl },
			verifiedAt: validation.ok ? now : null,
			lastCheckedAt: now,
			lastErrorAt: validation.ok ? null : now,
			lastErrorMessage: validation.ok ? null : truncateMessage(validationMessage),
		})
		.onConflictDoUpdate({
			target: [userIntegrations.userId, userIntegrations.provider],
			set: {
				status,
				encryptedSecret: storedSecret,
				publicConfig: { lastValidationStatus: validation.status, siteUrl },
				verifiedAt: validation.ok ? now : null,
				lastCheckedAt: now,
				lastErrorAt: validation.ok ? null : now,
				lastErrorMessage: validation.ok ? null : truncateMessage(validationMessage),
				updatedAt: now,
			},
		});

	return validation;
}

export async function removeBingApiKeyForUser(userId: string) {
	await db
		.delete(userIntegrations)
		.where(and(eq(userIntegrations.userId, userId), eq(userIntegrations.provider, "bing")));
}

export async function setAutomationForUser(userId: string, siteId: string, enabled: boolean) {
	const site = await getSiteForUser(siteId, userId);
	if (!site) {
		throw new Error("Site not found");
	}

	const [integration] = await db
		.select()
		.from(siteIntegrations)
		.where(and(eq(siteIntegrations.siteId, siteId), eq(siteIntegrations.provider, "indexnow")))
		.limit(1);

	if (enabled && (!site.verified || integration?.status !== "verified")) {
		throw new Error("Verify the site and IndexNow key before enabling automation.");
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

export async function addSitemapSourceForUser(userId: string, siteId: string, sitemapUrl: string, isPrimary?: boolean) {
	const site = await getSiteForUser(siteId, userId);
	if (!site) {
		throw new Error("Site not found");
	}

	const host = getSiteHost(site);
	const cleanUrl = normalizeSitemapUrl(sitemapUrl, host);
	if (!cleanUrl) {
		throw new Error("Sitemap URL is required");
	}

	const existingSources = await db
		.select({ id: siteSitemaps.id })
		.from(siteSitemaps)
		.where(eq(siteSitemaps.siteId, siteId))
		.limit(1);
	const makePrimary = isPrimary ?? existingSources.length === 0;
	const now = new Date();

	if (makePrimary) {
		await db.update(siteSitemaps).set({ isPrimary: false, updatedAt: now }).where(eq(siteSitemaps.siteId, siteId));
	}

	const [source] = await db
		.insert(siteSitemaps)
		.values({
			siteId,
			url: cleanUrl,
			isPrimary: makePrimary,
			status: "active",
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: [siteSitemaps.siteId, siteSitemaps.url],
			set: {
				isPrimary: makePrimary,
				status: "active",
				lastErrorAt: null,
				lastErrorMessage: null,
				updatedAt: now,
			},
		})
		.returning();

	if (makePrimary) {
		await db.update(sites).set({ sitemapUrl: cleanUrl, updatedAt: now }).where(eq(sites.id, siteId));
	}

	return source;
}

export async function removeSitemapSourceForUser(userId: string, sourceId: string) {
	const [source] = await db
		.select({
			id: siteSitemaps.id,
			siteId: siteSitemaps.siteId,
			isPrimary: siteSitemaps.isPrimary,
		})
		.from(siteSitemaps)
		.innerJoin(sites, eq(siteSitemaps.siteId, sites.id))
		.where(and(eq(siteSitemaps.id, sourceId), eq(sites.userId, userId)))
		.limit(1);

	if (!source) {
		throw new Error("Sitemap source not found");
	}

	await db.delete(siteSitemaps).where(eq(siteSitemaps.id, sourceId));

	if (source.isPrimary) {
		const [nextSource] = await db
			.select({ id: siteSitemaps.id, url: siteSitemaps.url })
			.from(siteSitemaps)
			.where(eq(siteSitemaps.siteId, source.siteId))
			.orderBy(desc(siteSitemaps.createdAt))
			.limit(1);

		if (nextSource) {
			await db.update(siteSitemaps).set({ isPrimary: true, updatedAt: new Date() }).where(eq(siteSitemaps.id, nextSource.id));
			await db.update(sites).set({ sitemapUrl: nextSource.url, updatedAt: new Date() }).where(eq(sites.id, source.siteId));
		} else {
			await db.update(sites).set({ sitemapUrl: null, updatedAt: new Date() }).where(eq(sites.id, source.siteId));
		}
	}
}

export async function discoverSitemapsForUser(userId: string, siteId: string) {
	const site = await getSiteForUser(siteId, userId);
	if (!site) {
		throw new Error("Site not found");
	}

	const discovered = await discoverSitemapUrls(getSiteHost(site));
	for (const [index, sitemapUrl] of discovered.entries()) {
		await addSitemapSourceForUser(userId, siteId, sitemapUrl, index === 0);
	}

	return discovered;
}

async function getEligibleEngines(site: SiteRow, allowManual = false) {
	const engines: Array<"indexnow" | "bing"> = [];

	if (!allowManual && !site.automationEnabled) {
		return engines;
	}

	const [indexNowInt, bingInt] = await Promise.all([
		db
			.select({ status: siteIntegrations.status, automationEnabled: siteIntegrations.automationEnabled })
			.from(siteIntegrations)
			.where(and(eq(siteIntegrations.siteId, site.id), eq(siteIntegrations.provider, "indexnow")))
			.limit(1)
			.then(([row]) => row || null),
		db
			.select({ status: siteIntegrations.status, automationEnabled: siteIntegrations.automationEnabled })
			.from(siteIntegrations)
			.where(and(eq(siteIntegrations.siteId, site.id), eq(siteIntegrations.provider, "bing")))
			.limit(1)
			.then(([row]) => row || null),
	]);

	if (indexNowInt?.status === "verified" && (allowManual || indexNowInt.automationEnabled)) {
		engines.push("indexnow");
	}

	const [bingUserInt] = await db
		.select({ status: userIntegrations.status })
		.from(userIntegrations)
		.where(and(eq(userIntegrations.userId, site.userId), eq(userIntegrations.provider, "bing")))
		.limit(1);

	if (bingUserInt?.status === "verified") {
		const bingEnabled = bingInt ? bingInt.automationEnabled : true;
		if (allowManual || bingEnabled) {
			engines.push("bing");
		}
	}

	return engines;
}

async function enqueueSubmissionJob(siteId: string, url: UrlQueueRow, engine: "indexnow" | "bing", reason: string) {
	const [existing] = await db
		.select({ id: submissionJobs.id })
		.from(submissionJobs)
		.where(
			and(
				eq(submissionJobs.siteId, siteId),
				eq(submissionJobs.loc, url.loc),
				eq(submissionJobs.engine, engine),
				or(eq(submissionJobs.status, "queued"), eq(submissionJobs.status, "processing")),
			),
		)
		.limit(1);

	if (existing) {
		return false;
	}

	await db.insert(submissionJobs).values({
		siteId,
		urlId: url.id,
		loc: url.loc,
		engine,
		reason,
		status: "queued",
	});

	return true;
}

async function enqueueUrlRows(site: SiteRow, urlRows: UrlQueueRow[], reason: string, allowManual = false) {
	if (!site.verified) {
		if (allowManual) throw new Error("Verify site ownership before submitting URLs.");
		return 0;
	}
	const engines = await getEligibleEngines(site, allowManual);
	let queued = 0;

	for (const engine of engines) {
		for (const urlRow of urlRows) {
			if (await enqueueSubmissionJob(site.id, urlRow, engine, reason)) {
				queued += 1;
			}
		}
	}

	return queued;
}

async function syncSitemapSource(site: SiteRow, source: SiteSitemapRow) {
	const host = getSiteHost(site);
	const now = new Date();
	const [syncRow] = await db
		.insert(sitemaps)
		.values({
			siteId: site.id,
			url: source.url,
			status: "syncing",
		})
		.returning();

	try {
		const result = await fetchSitemapTree(source.url, host, AUTOMATION_LIMITS.maxUrlsPerSitemap);
		if (result.urls.length === 0) {
			throw new Error("No matching URL entries found in the sitemap.");
		}

		const locs = result.urls.map((entry) => entry.loc);
		const existingRows = await db
			.select({
				id: urls.id,
				loc: urls.loc,
				lastmod: urls.lastmod,
			})
			.from(urls)
			.where(and(eq(urls.siteId, site.id), inArray(urls.loc, locs)));
		const existingByLoc = new Map(existingRows.map((row) => [row.loc, row]));

		const newEntries = result.urls.filter((entry) => !existingByLoc.has(entry.loc));
		const insertedRows =
			newEntries.length > 0
				? await db
						.insert(urls)
						.values(
							newEntries.map((entry) => ({
								siteId: site.id,
								loc: entry.loc,
								lastmod: entry.lastmod,
								changefreq: entry.changefreq,
								priority: entry.priority || "0.5",
								indexingStatus: "unknown",
								gscStatus: "unknown",
								lastSeenInSitemapAt: now,
							})),
						)
						.onConflictDoNothing({ target: [urls.siteId, urls.loc] })
						.returning({ id: urls.id, loc: urls.loc })
				: [];

		const changedRows: UrlQueueRow[] = [];
		for (const entry of result.urls) {
			const existing = existingByLoc.get(entry.loc);
			if (!existing || !hasLastmodChanged(existing, entry)) {
				continue;
			}

			await db
				.update(urls)
				.set({
					lastmod: entry.lastmod,
					changefreq: entry.changefreq,
					priority: entry.priority || "0.5",
					lastSeenInSitemapAt: now,
				})
				.where(eq(urls.id, existing.id));
			changedRows.push({ id: existing.id, loc: existing.loc });
		}

		const [indexNowInt] = await db
			.select({ publicConfig: siteIntegrations.publicConfig })
			.from(siteIntegrations)
			.where(and(eq(siteIntegrations.siteId, site.id), eq(siteIntegrations.provider, "indexnow")))
			.limit(1);
		const config = indexNowInt ? readPublicConfig(indexNowInt.publicConfig) : {};
		const submitNew = config.submitNewUrls ?? true;
		const submitChanged = config.submitChangedUrls ?? true;

		let queuedNew = 0;
		if (submitNew && insertedRows.length > 0) {
			queuedNew = await enqueueUrlRows(site, insertedRows, "new");
		}

		let queuedChanged = 0;
		if (submitChanged && changedRows.length > 0) {
			queuedChanged = await enqueueUrlRows(site, changedRows, "changed");
		}

		await Promise.all([
			db
				.update(siteSitemaps)
				.set({
					status: "active",
					lastSyncAt: now,
					lastErrorAt: null,
					lastErrorMessage: null,
					updatedAt: now,
				})
				.where(eq(siteSitemaps.id, source.id)),
			db
				.update(sitemaps)
				.set({
					status: "success",
					lastSyncTime: now,
				})
				.where(eq(sitemaps.id, syncRow.id)),
		]);

		return {
			success: true,
			sourceId: source.id,
			urlCount: result.urls.length,
			insertedCount: insertedRows.length,
			changedCount: changedRows.length,
			queuedCount: queuedNew + queuedChanged,
			truncated: result.truncated,
		};
	} catch (error: unknown) {
		const message = truncateMessage(getErrorMessage(error));

		await Promise.all([
			db
				.update(siteSitemaps)
				.set({
					status: "failed",
					lastErrorAt: now,
					lastErrorMessage: message,
					updatedAt: now,
				})
				.where(eq(siteSitemaps.id, source.id)),
			db
				.update(sitemaps)
				.set({
					status: "failed",
					errorMessage: message,
					lastSyncTime: now,
				})
				.where(eq(sitemaps.id, syncRow.id)),
			db.insert(alerts).values({
				siteId: site.id,
				title: "Sitemap Sync Failed",
				message: `Unable to sync ${source.url}: ${message}`,
				alertType: "sitemap_failure",
				resolved: false,
			}),
		]);

		throw error;
	}
}

async function syncActiveSitemaps(site: SiteRow, sourceId?: string) {
	const filters = [eq(siteSitemaps.siteId, site.id), ne(siteSitemaps.status, "disabled")];
	if (sourceId) {
		filters.push(eq(siteSitemaps.id, sourceId));
	}

	const sources = await db
		.select()
		.from(siteSitemaps)
		.where(and(...filters))
		.orderBy(desc(siteSitemaps.isPrimary), desc(siteSitemaps.createdAt));

	if (sources.length === 0) {
		throw new Error("No active sitemap sources configured.");
	}

	const failures: string[] = [];
	const results = [];

	for (const source of sources) {
		try {
			results.push(await syncSitemapSource(site, source));
		} catch (error) {
			failures.push(getErrorMessage(error));
		}
	}

	return {
		success: failures.length === 0,
		results,
		failures,
		insertedCount: results.reduce((total, result) => total + result.insertedCount, 0),
		changedCount: results.reduce((total, result) => total + result.changedCount, 0),
		queuedCount: results.reduce((total, result) => total + result.queuedCount, 0),
	};
}

export async function syncSitemapsForUser(userId: string, siteId: string, sourceId?: string) {
	const site = await getSiteForUser(siteId, userId);
	if (!site) {
		throw new Error("Site not found");
	}

	return syncActiveSitemaps(site, sourceId);
}

export async function enqueueManualSubmissionForUser(userId: string, siteId: string, urlLoc: string) {
	const site = await getSiteForUser(siteId, userId);
	if (!site) {
		throw new Error("Site not found");
	}

	const loc = normalizeUrlForHost(urlLoc, getSiteHost(site));
	const [existingUrl] = await db
		.select({ id: urls.id, loc: urls.loc })
		.from(urls)
		.where(and(eq(urls.siteId, siteId), eq(urls.loc, loc)))
		.limit(1);
	const [urlRow] = existingUrl
		? [existingUrl]
		: await db
				.insert(urls)
				.values({
					siteId,
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

	const queuedCount = await enqueueUrlRows(site, [urlRow], "manual", true);
	if (queuedCount === 0) {
		throw new Error("No verified submission engine is available for this site.");
	}

	const processed = await processSubmissionQueue({ siteId, maxJobs: Math.min(queuedCount, 10) });
	return { queuedCount, processed };
}

async function submitEngineBatch(siteId: string, engine: string, urlList: string[]) {
	const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
	if (!site) {
		return { ok: false, status: 0, message: "Site not found." };
	}

	if (engine === "indexnow") {
		const [integration] = await db
			.select()
			.from(siteIntegrations)
			.where(and(eq(siteIntegrations.siteId, siteId), eq(siteIntegrations.provider, "indexnow")))
			.limit(1);

		if (!integration?.encryptedSecret || integration.status !== "verified") {
			return { ok: false, status: 0, message: "IndexNow key is not verified." };
		}

		const key = await readStoredSecret(integration.encryptedSecret);
		const encryptedSecret = await upgradeLegacySecret(integration.encryptedSecret);
		if (encryptedSecret !== integration.encryptedSecret) {
			await db.update(siteIntegrations).set({ encryptedSecret, updatedAt: new Date() })
				.where(eq(siteIntegrations.id, integration.id));
		}
		const keyLocation = getConfiguredKeyLocation(integration.publicConfig, getSiteHost(site), key);
		return submitIndexNowBatch(getSiteHost(site), key, urlList, keyLocation);
	}

	if (engine === "bing") {
		const [integration] = await db
			.select()
			.from(userIntegrations)
			.where(and(eq(userIntegrations.userId, site.userId), eq(userIntegrations.provider, "bing")))
			.limit(1);

		if (!integration?.encryptedSecret || integration.status !== "verified") {
			return { ok: false, status: 0, message: "Bing API key is not verified." };
		}

		const apiKey = await readStoredSecret(integration.encryptedSecret);
		const encryptedSecret = await upgradeLegacySecret(integration.encryptedSecret);
		if (encryptedSecret !== integration.encryptedSecret) {
			await db.update(userIntegrations).set({ encryptedSecret, updatedAt: new Date() })
				.where(and(eq(userIntegrations.userId, site.userId), eq(userIntegrations.provider, "bing")));
		}
		return submitBingBatch(apiKey, getSiteUrl(site), urlList);
	}

	return { ok: false, status: 0, message: `Unsupported submission engine: ${engine}.` };
}

export async function processSubmissionQueue(options: { siteId?: string; maxJobs?: number } = {}) {
	const now = new Date();
	const requestedMax = options.maxJobs ?? AUTOMATION_LIMITS.maxSubmissionJobsPerRun;
	const maxJobs = Number.isFinite(requestedMax) ? Math.min(Math.max(Math.floor(requestedMax), 0), 500) : 0;
	if (maxJobs === 0) return { processedCount: 0, successCount: 0, failedCount: 0 };

	const staleBefore = new Date(now.getTime() - AUTOMATION_LIMITS.staleProcessingLockMs);
	const eligibleFilter = or(
		and(eq(submissionJobs.status, "queued"), lte(submissionJobs.nextRunAt, now)),
		and(
			eq(submissionJobs.status, "processing"),
			or(isNull(submissionJobs.lockedAt), lte(submissionJobs.lockedAt, staleBefore)),
		),
	);
	const queueFilter = options.siteId
		? and(eq(submissionJobs.siteId, options.siteId), eligibleFilter)
		: eligibleFilter;

	// Claim rows with one atomic UPDATE. This works with Neon HTTP (which does not
	// support interactive transactions), while the subquery skips rows locked by
	// a concurrent cron invocation.
	const verifiedSiteIds = db
		.select({ id: sites.id })
		.from(sites)
		.where(eq(sites.verified, true));
	const candidateJobs = db
		.select({ id: submissionJobs.id })
		.from(submissionJobs)
		.where(and(queueFilter, inArray(submissionJobs.siteId, verifiedSiteIds)))
		.orderBy(submissionJobs.nextRunAt, submissionJobs.createdAt)
		.limit(maxJobs)
		.for("update", { skipLocked: true });
	const jobs = await db
		.update(submissionJobs)
		.set({
			status: "processing",
			attempts: sql.raw("attempts + 1"),
			lockedAt: now,
			updatedAt: now,
		})
		.where(inArray(submissionJobs.id, candidateJobs))
		.returning();

	if (jobs.length === 0) return { processedCount: 0, successCount: 0, failedCount: 0 };

	const groups = new Map<string, typeof jobs>();
	for (const job of jobs) {
		const groupKey = job.siteId + ":" + job.engine;
		const group = groups.get(groupKey) ?? [];
		group.push(job);
		groups.set(groupKey, group);
	}

	let successCount = 0;
	let failedCount = 0;
	for (const group of groups.values()) {
		for (let index = 0; index < group.length; index += AUTOMATION_LIMITS.engineBatchSize) {
			const batch = group.slice(index, index + AUTOMATION_LIMITS.engineBatchSize);
			const batchUrlList = batch.map((job) => job.loc);
			const result = await submitEngineBatch(batch[0].siteId, batch[0].engine, batchUrlList).catch((error) => ({
				ok: false,
				status: 0,
				message: getErrorMessage(error),
			}));
			const status = result.ok ? "success" : "failed";
			const responseMessage = truncateMessage(result.message);
			const completedAt = new Date();

			await Promise.all([
				db.insert(submissions).values(
					batch.map((job) => ({
						siteId: job.siteId,
						loc: job.loc,
						engine: job.engine,
						status,
						responseMessage,
						attempt: job.attempts,
					})),
				),
				...batch.map((job) => {
					const attemptNumber = job.attempts;
					const retrying = !result.ok && attemptNumber < AUTOMATION_LIMITS.maxSubmissionAttempts;
					const retryDelayMinutes = Math.min(5 * Math.pow(2, attemptNumber - 1), 60);
					const nextRunAt = retrying
						? new Date(completedAt.getTime() + retryDelayMinutes * 60 * 1000)
						: completedAt;
					return db
						.update(submissionJobs)
						.set({
							status: result.ok ? "success" : retrying ? "queued" : "failed",
							nextRunAt,
							lockedAt: null,
							lastErrorMessage: result.ok ? null : responseMessage,
							updatedAt: completedAt,
						})
						.where(
							and(
								eq(submissionJobs.id, job.id),
								eq(submissionJobs.status, "processing"),
								eq(submissionJobs.lockedAt, now),
							),
						);
				}),
				db
					.update(urls)
					.set({ lastSubmittedAt: completedAt, lastSubmissionStatus: status })
					.where(and(eq(urls.siteId, batch[0].siteId), inArray(urls.loc, batchUrlList))),
			]);

			if (result.ok) {
				successCount += batch.length;
			} else {
				failedCount += batch.length;
				const exhaustedRetries = batch.filter((job) => job.attempts >= AUTOMATION_LIMITS.maxSubmissionAttempts);
				if (exhaustedRetries.length > 0) {
					await db.insert(alerts).values({
						siteId: batch[0].siteId,
						title: "Submission Failed",
						message: batch[0].engine + " submission failed for " + exhaustedRetries.length + " URL(s) after retries: " + responseMessage,
						alertType: "error_detected",
						resolved: false,
					});
				}
			}
		}
	}
	return { processedCount: jobs.length, successCount, failedCount };
}

export async function runScheduledAutomation() {
	const cutoff = new Date(Date.now() - 60 * 60 * 1000);
	const dueRows = await db
		.select({ siteId: sites.id })
		.from(siteSitemaps)
		.innerJoin(sites, eq(siteSitemaps.siteId, sites.id))
		.where(
			and(
				eq(sites.automationEnabled, true),
				eq(sites.verified, true),
				ne(siteSitemaps.status, "disabled"),
				or(isNull(siteSitemaps.lastSyncAt), lte(siteSitemaps.lastSyncAt, cutoff)),
			),
		)
		.orderBy(siteSitemaps.lastSyncAt)
		.limit(AUTOMATION_LIMITS.maxSitesPerRun);
	const siteIds = Array.from(new Set(dueRows.map((row) => row.siteId)));
	const syncResults = [];

	for (const siteId of siteIds) {
		const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
		if (!site) {
			continue;
		}

		syncResults.push(await syncActiveSitemaps(site).catch((error) => ({ success: false, failures: [getErrorMessage(error)] })));
	}

	const submissionsResult = await processSubmissionQueue();
	return {
		syncedSites: siteIds.length,
		syncResults,
		submissions: submissionsResult,
	};
}

export async function getSiteSettings(userId: string, siteId: string) {
	const site = await getSiteForUser(siteId, userId);
	if (!site) {
		return null;
	}

	const [sitemapSources, indexNow, bing, bingSiteInt, googleSiteInt] = await Promise.all([
		db
			.select()
			.from(siteSitemaps)
			.where(eq(siteSitemaps.siteId, siteId))
			.orderBy(desc(siteSitemaps.isPrimary), desc(siteSitemaps.createdAt)),
		getIndexNowSettings(site),
		db
			.select()
			.from(userIntegrations)
			.where(and(eq(userIntegrations.userId, userId), eq(userIntegrations.provider, "bing")))
			.limit(1),
		db
			.select()
			.from(siteIntegrations)
			.where(and(eq(siteIntegrations.siteId, siteId), eq(siteIntegrations.provider, "bing")))
			.limit(1)
			.then(([row]) => row || null),
		db
			.select()
			.from(siteIntegrations)
			.where(and(eq(siteIntegrations.siteId, siteId), eq(siteIntegrations.provider, "google")))
			.limit(1)
			.then(([row]) => row || null),
	]);
	const [bingIntegration] = bing;
	let bingKey: string | null = null;
	let bingErrorMessage = bingIntegration?.lastErrorMessage ?? null;
	if (bingIntegration) {
		try {
			const encryptedSecret = await upgradeLegacySecret(bingIntegration.encryptedSecret);
			if (encryptedSecret !== bingIntegration.encryptedSecret) {
				await db.update(userIntegrations).set({ encryptedSecret, updatedAt: new Date() })
					.where(and(eq(userIntegrations.userId, userId), eq(userIntegrations.provider, "bing")));
			}
			bingKey = await readStoredSecret(encryptedSecret);
		} catch (error) {
			bingErrorMessage = `Unable to decrypt Bing key: ${getErrorMessage(error)}`;
		}
	}

	return {
		site,
		sitemapSources,
		indexNow,
		bing: bingIntegration
			? {
					status: bingIntegration.status,
					maskedKey: bingKey ? maskCredential(bingKey) : null,
					verifiedAt: bingIntegration.verifiedAt,
					lastCheckedAt: bingIntegration.lastCheckedAt,
					lastErrorMessage: bingErrorMessage,
					automationEnabled: bingSiteInt ? bingSiteInt.automationEnabled : true,
				}
			: null,
		google: {
			automationEnabled: googleSiteInt ? googleSiteInt.automationEnabled : false,
		},
	};
}

export async function updateEngineAutomationForUser(userId: string, siteId: string, provider: string, enabled: boolean) {
	const site = await getSiteForUser(siteId, userId);
	if (!site) {
		throw new Error("Site not found");
	}

	if (provider === "indexnow" && enabled) {
		const [indexNow] = await db
			.select()
			.from(siteIntegrations)
			.where(and(eq(siteIntegrations.siteId, siteId), eq(siteIntegrations.provider, "indexnow")))
			.limit(1);
		if (!indexNow || indexNow.status !== "verified") {
			throw new Error("Verify the IndexNow key before enabling automation.");
		}
	}

	if (provider === "bing" && enabled) {
		const [bingUserInt] = await db
			.select()
			.from(userIntegrations)
			.where(and(eq(userIntegrations.userId, userId), eq(userIntegrations.provider, "bing")))
			.limit(1);
		if (!bingUserInt || bingUserInt.status !== "verified") {
			throw new Error("Verify the Bing Webmaster API key in user settings first.");
		}
	}

	const now = new Date();
	await db
		.insert(siteIntegrations)
		.values({
			siteId,
			provider,
			status: provider === "indexnow" ? "pending" : "verified",
			automationEnabled: enabled,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: [siteIntegrations.siteId, siteIntegrations.provider],
			set: {
				automationEnabled: enabled,
				updatedAt: now,
			},
		});
}

export async function updateUrlSubmissionRulesForUser(
	userId: string,
	siteId: string,
	submitNewUrls: boolean,
	submitChangedUrls: boolean
) {
	const site = await getSiteForUser(siteId, userId);
	if (!site) {
		throw new Error("Site not found");
	}

	const integration = await ensureIndexNowIntegration(site);
	const config = readPublicConfig(integration.publicConfig);
	const updatedConfig = {
		...config,
		submitNewUrls,
		submitChangedUrls,
	};

	await db
		.update(siteIntegrations)
		.set({
			publicConfig: updatedConfig,
			updatedAt: new Date(),
		})
		.where(eq(siteIntegrations.id, integration.id));
}

export async function deleteSiteForUser(userId: string, siteId: string) {
	const site = await getSiteForUser(siteId, userId);
	if (!site) {
		throw new Error("Site not found");
	}

	await db.delete(sites).where(eq(sites.id, siteId));
}
