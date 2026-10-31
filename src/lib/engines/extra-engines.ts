/**
 * Optional submission engines beyond IndexNow and Bing: Google Indexing API (gated), Yandex
 * recrawl queue and Baidu push. This module gives the queue runner in service.ts three hooks
 * (engine state, a per-run quota budget, and the actual send) and gives the dashboard/API the
 * setup, toggle and status functions. IndexNow stays the default engine for every site.
 *
 * Rules: every engine here is paid-only (plans.ts), needs a verified site, and is opt-in per
 * site (a site_integrations row). Yandex and Baidu quotas are read from the engines; we never
 * send more URLs than the remaining quota allows.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { siteIntegrations, sites, userIntegrations } from "@/db/schema";
import { decryptSecret, encryptSecret, maskCredential } from "@/lib/automation/credentials";
import { ENGINE_LABELS, GOOGLE_LIMITS, type SubmissionEngine } from "@/lib/automation/constants";
import type { EngineSubmissionResult } from "@/lib/automation/search-engines";
import type { Entitlement, PlanLimits } from "@/lib/platform/plans";
import { getErrorMessage, getSiteHost } from "@/lib/url-utils";
import { BAIDU_TIME_ZONE, submitBaiduUrls } from "./baidu";
import { GOOGLE_SCOPES } from "./google-oauth";
import { getGoogleConnectionStatus, getInspectionUsageToday, matchGscPropertiesForUser, submitGoogleIndexingUrl, type GscConfig } from "./google-service";
import { isPropertyOwner } from "./gsc";
import { quotaDay, secondsUntilMidnight } from "./quota-windows";
import { assertPlanIncludes, readConfig, requireActiveSite, requireOwnedSite, truncateMessage, type SiteRow } from "./shared";
import { getYandexRecrawlQuota, getYandexUserId, listYandexHosts, matchYandexHost, submitYandexRecrawl, YANDEX_TIME_ZONE } from "./yandex";

export type ExtraEngine = "google_indexing_api" | "yandex" | "baidu";
export const EXTRA_ENGINES: ExtraEngine[] = ["google_indexing_api", "yandex", "baidu"];

const PLAN_FLAG: Record<ExtraEngine, "googleIndexingApi" | "yandex" | "baidu"> = {
	google_indexing_api: "googleIndexingApi",
	yandex: "yandex",
	baidu: "baidu",
};

export function isExtraEngine(value: string): value is ExtraEngine {
	return (EXTRA_ENGINES as string[]).includes(value);
}

type YandexSiteConfig = { hostId?: string; yandexUserId?: string };
type BaiduSiteConfig = { remain?: number; remainDay?: string };

// ---------------------------------------------------------------------------
// Queue hooks
// ---------------------------------------------------------------------------

/** ready = credentials and per-site setup are complete; automationEnabled = the site's toggle. */
export type ExtraEngineState = Partial<Record<ExtraEngine, { ready: boolean; automationEnabled: boolean }>>;

export async function loadExtraEngineState(site: Pick<SiteRow, "id" | "userId">): Promise<ExtraEngineState> {
	const [siteRows, userRows] = await Promise.all([
		db
			.select({ provider: siteIntegrations.provider, status: siteIntegrations.status, automationEnabled: siteIntegrations.automationEnabled, publicConfig: siteIntegrations.publicConfig })
			.from(siteIntegrations)
			.where(and(eq(siteIntegrations.siteId, site.id), inArray(siteIntegrations.provider, ["gsc", ...EXTRA_ENGINES]))),
		db
			.select({ provider: userIntegrations.provider, status: userIntegrations.status, publicConfig: userIntegrations.publicConfig })
			.from(userIntegrations)
			.where(and(eq(userIntegrations.userId, site.userId), inArray(userIntegrations.provider, ["google", "yandex"]))),
	]);
	const siteBy = new Map(siteRows.map((row) => [row.provider, row]));
	const userBy = new Map(userRows.map((row) => [row.provider, row]));
	const google = userBy.get("google");
	const gsc = siteBy.get("gsc");
	const googleScopes = readConfig<{ scopes: string[] }>(google?.publicConfig).scopes ?? [];
	const state: ExtraEngineState = {};

	const indexing = siteBy.get("google_indexing_api");
	if (indexing) {
		state.google_indexing_api = {
			// The Indexing API only accepts URLs of properties the OAuth user verified as owner.
			ready:
				indexing.status === "verified" &&
				google?.status === "verified" &&
				googleScopes.includes(GOOGLE_SCOPES.indexing) &&
				gsc?.status === "verified" &&
				isPropertyOwner(readConfig<GscConfig>(gsc.publicConfig).permissionLevel ?? ""),
			automationEnabled: indexing.automationEnabled,
		};
	}
	const yandex = siteBy.get("yandex");
	if (yandex) {
		state.yandex = { ready: yandex.status === "verified" && userBy.get("yandex")?.status === "verified", automationEnabled: yandex.automationEnabled };
	}
	const baidu = siteBy.get("baidu");
	if (baidu) state.baidu = { ready: baidu.status === "verified", automationEnabled: baidu.automationEnabled };
	return state;
}

/**
 * Pure: which optional engines a site may use now. Manual submits ignore the Yandex/Baidu
 * toggles, never the plan. The Google Indexing API stays strictly opt-in: it is used only
 * while its toggle is on, so a manual submit of ordinary pages never reaches it.
 */
export function resolveExtraEngines(state: ExtraEngineState | undefined, limits: Partial<PlanLimits>, manual: boolean): SubmissionEngine[] {
	return EXTRA_ENGINES.filter((engine) => {
		const entry = state?.[engine];
		const toggleOk = entry?.automationEnabled || (manual && engine !== "google_indexing_api");
		return Boolean(limits[PLAN_FLAG[engine]]) && entry?.ready === true && Boolean(toggleOk);
	});
}

/** When an engine's daily quota resets (its own midnight). */
export function quotaResetAt(engine: ExtraEngine, now = new Date()) {
	const zone = engine === "yandex" ? YANDEX_TIME_ZONE : engine === "baidu" ? BAIDU_TIME_ZONE : GOOGLE_LIMITS.quotaTimeZone;
	return new Date(now.getTime() + secondsUntilMidnight(zone, now) * 1000);
}

/**
 * How many URLs this run may send to the engine for the site, or null for "no known limit"
 * (the engine's own 429 then parks the rest). Baidu has no quota endpoint: until today's
 * remain count is known, one URL is sent as a probe and its answer sets the budget.
 */
export async function getEngineRunBudget(site: SiteRow, engine: string): Promise<number | null> {
	if (engine === "yandex") {
		const setup = await loadYandexCredentials(site);
		if (!setup) return null;
		const quota = await getYandexRecrawlQuota(setup.token, setup.yandexUserId, setup.hostId).catch(() => null);
		return quota?.ok && typeof quota.remainder === "number" ? quota.remainder : null;
	}
	if (engine === "baidu") {
		const row = await getSiteRow(site.id, "baidu");
		const config = readConfig<BaiduSiteConfig>(row?.publicConfig);
		return config.remainDay === quotaDay(new Date(), BAIDU_TIME_ZONE) && typeof config.remain === "number" ? config.remain : 1;
	}
	return null;
}

/** Send one batch for an optional engine; null means "not an optional engine". */
export async function submitExtraEngineBatch(site: SiteRow, engine: string, urlList: string[]): Promise<(EngineSubmissionResult & { skipped?: boolean }) | null> {
	if (engine === "google_indexing_api") {
		return submitGoogleIndexingUrl(site, urlList[0]);
	}
	if (engine === "yandex") {
		const setup = await loadYandexCredentials(site);
		if (!setup) return { ok: false, status: 403, message: "Yandex is not connected for this site." };
		return submitYandexRecrawl(setup.token, setup.yandexUserId, setup.hostId, urlList[0]);
	}
	if (engine === "baidu") {
		const row = await getSiteRow(site.id, "baidu");
		if (!row?.encryptedSecret || row.status !== "verified") return { ok: false, status: 403, message: "Baidu token is not set for this site." };
		const result = await submitBaiduUrls(getSiteHost(site), await decryptSecret(row.encryptedSecret), urlList);
		if (typeof result.remain === "number") {
			await db
				.update(siteIntegrations)
				.set({ publicConfig: { remain: result.remain, remainDay: quotaDay(new Date(), BAIDU_TIME_ZONE) } satisfies BaiduSiteConfig, updatedAt: new Date() })
				.where(eq(siteIntegrations.id, row.id));
		}
		return result;
	}
	return null;
}

// ---------------------------------------------------------------------------
// Setup (dashboard, REST, MCP)
// ---------------------------------------------------------------------------

async function getSiteRow(siteId: string, provider: string) {
	const [row] = await db
		.select()
		.from(siteIntegrations)
		.where(and(eq(siteIntegrations.siteId, siteId), eq(siteIntegrations.provider, provider)))
		.limit(1);
	return row;
}

async function getUserRow(userId: string, provider: string) {
	const [row] = await db
		.select()
		.from(userIntegrations)
		.where(and(eq(userIntegrations.userId, userId), eq(userIntegrations.provider, provider)))
		.limit(1);
	return row;
}

async function loadYandexCredentials(site: SiteRow) {
	const [user, siteRow] = await Promise.all([getUserRow(site.userId, "yandex"), getSiteRow(site.id, "yandex")]);
	const config = readConfig<YandexSiteConfig>(siteRow?.publicConfig);
	if (user?.status !== "verified" || siteRow?.status !== "verified" || !config.hostId || !config.yandexUserId) return null;
	return { token: await decryptSecret(user.encryptedSecret), yandexUserId: config.yandexUserId, hostId: config.hostId };
}

async function upsertSiteRow(siteId: string, provider: string, values: Partial<typeof siteIntegrations.$inferInsert>) {
	const now = new Date();
	await db
		.insert(siteIntegrations)
		.values({ siteId, provider, ...values })
		.onConflictDoUpdate({ target: [siteIntegrations.siteId, siteIntegrations.provider], set: { ...values, updatedAt: now } });
}

async function requireSetupContext(userId: string, siteId: string, engine: ExtraEngine) {
	const site = await requireOwnedSite(userId, siteId);
	const entitlement = await requireActiveSite(userId, siteId);
	assertPlanIncludes(entitlement, PLAN_FLAG[engine], ENGINE_LABELS[engine]);
	return { site, entitlement };
}

/** Save the user's Yandex OAuth token and resolve this site's Yandex host id. */
export async function setYandexTokenForUser(userId: string, siteId: string, token: string, autoSubmit = true) {
	const { site } = await requireSetupContext(userId, siteId, "yandex");
	const cleanToken = token.trim();
	if (!cleanToken) throw new Error("Yandex OAuth token is required.");

	const user = await getYandexUserId(cleanToken);
	if (!user.ok || !user.userId) throw new Error(`Yandex rejected the token: ${user.message}`);
	const now = new Date();
	const userValues = {
		status: "verified",
		encryptedSecret: await encryptSecret(cleanToken),
		publicConfig: { yandexUserId: user.userId },
		verifiedAt: now,
		lastCheckedAt: now,
		lastErrorAt: null,
		lastErrorMessage: null,
	};
	await db
		.insert(userIntegrations)
		.values({ userId, provider: "yandex", ...userValues })
		.onConflictDoUpdate({ target: [userIntegrations.userId, userIntegrations.provider], set: { ...userValues, updatedAt: now } });

	const hosts = await listYandexHosts(cleanToken, user.userId);
	const match = hosts.ok ? matchYandexHost(hosts.hosts, getSiteHost(site)) : null;
	const problem = !hosts.ok
		? `Yandex: ${hosts.message}`
		: !match
		? `${getSiteHost(site)} is not in your Yandex Webmaster account. Add and verify it there, then save the token again.`
		: !match.verified
		? `${getSiteHost(site)} is added in Yandex Webmaster but not verified yet. Verify it there, then save the token again.`
		: null;
	await upsertSiteRow(site.id, "yandex", {
		status: problem ? "failed" : "verified",
		automationEnabled: autoSubmit,
		publicConfig: { hostId: match?.hostId, yandexUserId: user.userId } satisfies YandexSiteConfig,
		verifiedAt: problem ? null : now,
		lastCheckedAt: now,
		lastErrorAt: problem ? now : null,
		lastErrorMessage: problem ? truncateMessage(problem) : null,
	});
	if (problem) throw new Error(problem);
	const quota = await getYandexRecrawlQuota(cleanToken, user.userId, match!.hostId).catch(() => null);
	return { hostId: match!.hostId, autoSubmit, dailyQuota: quota?.dailyQuota ?? null, quotaRemainder: quota?.remainder ?? null };
}

/**
 * Save the site's Baidu push token. Baidu has no read-only check, so the token is validated by
 * pushing the site's homepage once (allowed only for a verified site, like every submission).
 */
export async function setBaiduTokenForUser(userId: string, siteId: string, token: string, autoSubmit = true) {
	const { site } = await requireSetupContext(userId, siteId, "baidu");
	if (!site.verified) throw new Error("Verify the site's key file first, then add the Baidu token.");
	const cleanToken = token.trim();
	if (!/^[A-Za-z0-9]{8,64}$/.test(cleanToken)) throw new Error("Paste the token from Baidu Ziyuan > 普通收录 > API提交 (letters and digits).");

	const result = await submitBaiduUrls(getSiteHost(site), cleanToken, [`https://${getSiteHost(site)}/`]).catch((error) => ({
		ok: false,
		status: 0,
		message: getErrorMessage(error),
		remain: undefined,
	}));
	// "over quota" still proves the token is valid; any other error means it is not usable.
	if (!result.ok && result.status !== 429) throw new Error(`Baidu rejected the token: ${result.message}`);
	const now = new Date();
	await upsertSiteRow(site.id, "baidu", {
		status: "verified",
		encryptedSecret: await encryptSecret(cleanToken),
		automationEnabled: autoSubmit,
		publicConfig: { remain: result.remain ?? 0, remainDay: quotaDay(now, BAIDU_TIME_ZONE) } satisfies BaiduSiteConfig,
		verifiedAt: now,
		lastCheckedAt: now,
		lastErrorAt: null,
		lastErrorMessage: null,
	});
	return { autoSubmit, remainToday: result.remain ?? 0, message: result.message };
}

/** Turn the gated Google Indexing API on/off for a site. Enabling checks plan, scope and ownership. */
async function setGoogleIndexingForSite(userId: string, site: SiteRow, enabled: boolean) {
	if (!enabled) {
		await db
			.update(siteIntegrations)
			.set({ automationEnabled: false, updatedAt: new Date() })
			.where(and(eq(siteIntegrations.siteId, site.id), eq(siteIntegrations.provider, "google_indexing_api")));
		return;
	}
	if (!site.verified) throw new Error("Verify the site's key file first.");
	const google = await getGoogleConnectionStatus(userId);
	if (!google.canUseIndexingApi) throw new Error("Connect Google (with the Indexing API permission) from the Connect page first.");
	const match = await matchGscPropertiesForUser(userId, site.id);
	const owner = match.sites[0]?.permissionLevel === "siteOwner";
	if (!owner) throw new Error(`The Google Indexing API needs you to be a verified Owner of ${getSiteHost(site)} in Search Console.`);
	await upsertSiteRow(site.id, "google_indexing_api", { status: "verified", automationEnabled: true, verifiedAt: new Date(), lastErrorAt: null, lastErrorMessage: null });
}

export async function setEngineAutoSubmitForUser(userId: string, siteId: string, engine: string, enabled: boolean) {
	if (!isExtraEngine(engine)) throw new Error(`Unknown engine: ${engine}. Use google_indexing_api, yandex or baidu.`);
	const site = enabled ? (await requireSetupContext(userId, siteId, engine)).site : await requireOwnedSite(userId, siteId);
	if (engine === "google_indexing_api") {
		await setGoogleIndexingForSite(userId, site, enabled);
		return { engine, enabled };
	}
	const row = await getSiteRow(site.id, engine);
	if (!row) throw new Error(`${ENGINE_LABELS[engine]} is not set up for this site yet. Save its token first.`);
	await db.update(siteIntegrations).set({ automationEnabled: enabled, updatedAt: new Date() }).where(eq(siteIntegrations.id, row.id));
	return { engine, enabled };
}

/** Remove an engine from one site. The Yandex token is deleted once no site of the user uses it. */
export async function removeEngineForUser(userId: string, siteId: string, engine: string) {
	if (!isExtraEngine(engine)) throw new Error(`Unknown engine: ${engine}. Use google_indexing_api, yandex or baidu.`);
	const site = await requireOwnedSite(userId, siteId);
	await db.delete(siteIntegrations).where(and(eq(siteIntegrations.siteId, site.id), eq(siteIntegrations.provider, engine)));
	if (engine === "yandex") {
		const userSiteIds = db.select({ id: sites.id }).from(sites).where(eq(sites.userId, userId));
		const [stillUsed] = await db
			.select({ id: siteIntegrations.id })
			.from(siteIntegrations)
			.where(and(eq(siteIntegrations.provider, "yandex"), inArray(siteIntegrations.siteId, userSiteIds)))
			.limit(1);
		if (!stillUsed) await db.delete(userIntegrations).where(and(eq(userIntegrations.userId, userId), eq(userIntegrations.provider, "yandex")));
	}
	return { engine, removed: true };
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export type EngineStatus = {
	engine: "indexnow" | "bing" | "google_search_console" | ExtraEngine;
	label: string;
	kind: "submission" | "inspection";
	availableOnPlan: boolean;
	connected: boolean; // credentials / setup complete
	enabled: boolean; // used for automatic submissions (inspection: runs in the cron)
	status: string; // 'verified' | 'pending' | 'failed' | 'not_connected'
	lastError: string | null;
	details: Record<string, unknown>;
	setupHint: string;
};

/** Every engine for one site, for the dashboard and for agents (list_engines). */
export async function listEnginesForUser(userId: string, siteId: string, entitlement: Entitlement): Promise<EngineStatus[]> {
	const site = await requireOwnedSite(userId, siteId);
	const [siteRows, userRows, google, inspectionsToday] = await Promise.all([
		db.select().from(siteIntegrations).where(eq(siteIntegrations.siteId, site.id)),
		db
			.select()
			.from(userIntegrations)
			.where(and(eq(userIntegrations.userId, userId), inArray(userIntegrations.provider, ["bing", "yandex"]))),
		getGoogleConnectionStatus(userId),
		getInspectionUsageToday(site.id),
	]);
	const siteBy = new Map(siteRows.map((row) => [row.provider, row]));
	const userBy = new Map(userRows.map((row) => [row.provider, row]));
	const limits = entitlement.limits;
	const rowStatus = (row?: { status: string } | null) => row?.status ?? "not_connected";

	const indexNow = siteBy.get("indexnow");
	const bingUser = userBy.get("bing");
	const bingSite = siteBy.get("bing");
	const gsc = siteBy.get("gsc");
	const gscConfig = readConfig<GscConfig>(gsc?.publicConfig);
	const indexing = siteBy.get("google_indexing_api");
	const yandex = siteBy.get("yandex");
	const yandexUser = userBy.get("yandex");
	const baidu = siteBy.get("baidu");
	const baiduConfig = readConfig<BaiduSiteConfig>(baidu?.publicConfig);

	return [
		{
			engine: "indexnow",
			label: "IndexNow (Bing, Yandex, Seznam, Naver, Yep)",
			kind: "submission",
			availableOnPlan: true,
			connected: indexNow?.status === "verified",
			enabled: indexNow?.status === "verified" && indexNow.automationEnabled,
			status: rowStatus(indexNow),
			lastError: indexNow?.lastErrorMessage ?? null,
			details: {},
			setupHint: "Default engine. Host the key file and verify the site.",
		},
		{
			engine: "bing",
			label: "Bing Webmaster API",
			kind: "submission",
			availableOnPlan: limits.bing,
			connected: bingUser?.status === "verified",
			enabled: limits.bing && bingUser?.status === "verified" && (bingSite?.automationEnabled ?? true),
			status: rowStatus(bingUser),
			lastError: bingSite?.lastErrorMessage || bingUser?.lastErrorMessage || null,
			details: { maskedKey: bingUser ? await decryptSecret(bingUser.encryptedSecret).then(maskCredential).catch(() => null) : null },
			setupHint: "Paste a Bing Webmaster API key (Settings > API Access in Bing Webmaster Tools).",
		},
		{
			engine: "google_search_console",
			label: "Google Search Console",
			kind: "inspection",
			availableOnPlan: true,
			connected: google.connected && gsc?.status === "verified",
			enabled: google.canInspect && gsc?.status === "verified",
			status: google.connected ? rowStatus(gsc) : google.status ?? "not_connected",
			lastError: google.lastErrorMessage || gsc?.lastErrorMessage || null,
			details: {
				property: gscConfig.property ?? null,
				permissionLevel: gscConfig.permissionLevel ?? null,
				lastSitemapSubmitAt: gscConfig.lastSitemapSubmitAt ?? null,
				inspectionsToday,
				inspectionsPerDay: Math.min(limits.gscInspectionsPerDay, GOOGLE_LIMITS.inspectionsPerPropertyPerDay),
				connectUrl: google.connectUrl,
				configured: google.configured,
			},
			setupHint: "Connect Google on the Connect page; the site is matched to its sc-domain: or URL-prefix property.",
		},
		{
			engine: "google_indexing_api",
			label: "Google Indexing API (job postings and livestreams only)",
			kind: "submission",
			availableOnPlan: limits.googleIndexingApi,
			connected: indexing?.status === "verified",
			enabled: limits.googleIndexingApi && indexing?.status === "verified" && indexing.automationEnabled,
			status: rowStatus(indexing),
			lastError: indexing?.lastErrorMessage ?? null,
			details: { requiresOwner: true, eligiblePages: ["JobPosting", "BroadcastEvent inside VideoObject"] },
			setupHint: "Only for sites with JobPosting or livestream pages. Each page is checked before sending; other pages are skipped.",
		},
		{
			engine: "yandex",
			label: "Yandex Webmaster recrawl",
			kind: "submission",
			availableOnPlan: limits.yandex,
			connected: yandex?.status === "verified" && yandexUser?.status === "verified",
			enabled: limits.yandex && yandex?.status === "verified" && yandex.automationEnabled,
			status: rowStatus(yandex),
			lastError: yandex?.lastErrorMessage || yandexUser?.lastErrorMessage || null,
			details: { hostId: readConfig<YandexSiteConfig>(yandex?.publicConfig).hostId ?? null },
			setupHint: "Paste a Yandex OAuth token with Webmaster access; the site must be verified in Yandex Webmaster.",
		},
		{
			engine: "baidu",
			label: "Baidu URL push",
			kind: "submission",
			availableOnPlan: limits.baidu,
			connected: baidu?.status === "verified",
			enabled: limits.baidu && baidu?.status === "verified" && baidu.automationEnabled,
			status: rowStatus(baidu),
			lastError: baidu?.lastErrorMessage ?? null,
			details: { remainToday: baiduConfig.remainDay === quotaDay(new Date(), BAIDU_TIME_ZONE) ? (baiduConfig.remain ?? null) : null },
			setupHint: "Paste the push token from Baidu Ziyuan for this exact site. Saving it pushes the homepage once to validate it.",
		},
	];
}
