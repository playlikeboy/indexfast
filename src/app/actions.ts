"use server";

import { db } from "@/db";
import { alerts, checks, sites, urls, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { stack } from "@/stack";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getErrorMessage, normalizeHost, normalizeSitemapUrl } from "@/lib/url-utils";
import {
	addSitemapSourceForUser,
	discoverSitemapsForUser,
	enqueueManualSubmissionForUser,
	ensureIndexNowIntegration,
	getSiteForUser,
	removeBingApiKeyForUser,
	removeSitemapSourceForUser,
	saveBingApiKeyForUser,
	setAutomationForUser,
	syncSitemapsForUser,
	verifyIndexNowForUser,
	saveIndexNowKeyForUser,
	updateEngineAutomationForUser,
	updateUrlSubmissionRulesForUser,
	deleteSiteForUser,
} from "@/lib/automation/service";
import { createApiKeyForUser, revokeApiKeyForUser } from "@/lib/platform/api-keys";
import { DEFAULT_API_SCOPES, normalizeApiScopes } from "@/lib/platform/plans";

async function getAuthUser() {
	const user = await stack.getUser();
	if (!user) {
		throw new Error("Unauthorized");
	}
	return user;
}

function revalidateSiteDashboard(siteId: string) {
	revalidatePath("/dashboard");
	revalidatePath("/dashboard/submissions");
	revalidatePath("/dashboard/alerts");
	revalidatePath(`/dashboard/sites/${siteId}`);
	revalidatePath(`/dashboard/sites/${siteId}/settings`);
}

function readFormString(formData: FormData, key: string) {
	const value = formData.get(key);
	return typeof value === "string" ? value : "";
}

export async function syncUser() {
	const stackUser = await getAuthUser();
	const existing = await db.select().from(users).where(eq(users.id, stackUser.id)).limit(1);

	if (existing.length === 0) {
		await db.insert(users).values({
			id: stackUser.id,
			email: stackUser.primaryEmail || "",
			billingTier: "free",
		});
	}
	return stackUser.id;
}

export async function addSite(domain: string, name: string, sitemapUrl?: string) {
	const userId = await syncUser();
	const cleanHost = normalizeHost(domain);
	const cleanName = name.trim();
	const cleanSitemapUrl = normalizeSitemapUrl(sitemapUrl, cleanHost);

	if (!cleanName) {
		throw new Error("Site label is required");
	}

	const existing = await db
		.select({ id: sites.id })
		.from(sites)
		.where(and(eq(sites.userId, userId), eq(sites.domain, cleanHost)))
		.limit(1);

	if (existing.length > 0) {
		throw new Error("This domain is already connected");
	}

	const verificationToken = `indexfast-verification-${crypto.randomUUID()}`;
	const [newSite] = await db
		.insert(sites)
		.values({
			userId,
			domain: cleanHost,
			indexingHost: cleanHost,
			name: cleanName,
			verified: false,
			verificationToken,
			sitemapUrl: cleanSitemapUrl,
		})
		.returning();

	await ensureIndexNowIntegration(newSite);
	if (cleanSitemapUrl) {
		await addSitemapSourceForUser(userId, newSite.id, cleanSitemapUrl, true);
	}

	revalidatePath("/dashboard");
	return newSite;
}

export async function verifySite(siteId: string) {
	const user = await getAuthUser();
	const site = await getSiteForUser(siteId, user.id);
	if (!site) throw new Error("Site not found");

	await db.update(sites).set({ verified: true, updatedAt: new Date() }).where(eq(sites.id, siteId));
	revalidateSiteDashboard(siteId);
	return { success: true, verified: true };
}

export async function syncSitemap(siteId: string) {
	const user = await getAuthUser();
	await syncSitemapsForUser(user.id, siteId);
	revalidateSiteDashboard(siteId);
}

export async function checkUrlDiagnostics(urlId: string) {
	const user = await getAuthUser();
	const [urlRow] = await db
		.select({
			id: urls.id,
			loc: urls.loc,
			siteId: urls.siteId,
		})
		.from(urls)
		.innerJoin(sites, eq(urls.siteId, sites.id))
		.where(and(eq(urls.id, urlId), eq(sites.userId, user.id)))
		.limit(1);
	if (!urlRow) throw new Error("URL not found");

	const { evaluateUrlDiagnostics } = await import("@/lib/automation/diagnostics");
	const result = await evaluateUrlDiagnostics(urlRow.loc);

	await db.insert(checks).values({
		urlId,
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
	});

	await db
		.update(urls)
		.set({
			httpStatus: result.httpStatus,
			indexingStatus: result.status === "fail" ? "blockers" : result.httpStatus === 200 ? "indexed" : "not_indexed",
			lastCheckedAt: new Date(),
		})
		.where(eq(urls.id, urlId));

	if (result.status === "fail" && result.blockers.length > 0) {
		const alertMessage = `Diagnostic issues for ${urlRow.loc}: ${result.blockers.join("; ")}`;
		const [existingAlert] = await db
			.select({ id: alerts.id })
			.from(alerts)
			.where(
				and(
					eq(alerts.siteId, urlRow.siteId),
					eq(alerts.title, "Diagnostics Failed"),
					eq(alerts.resolved, false),
				),
			)
			.limit(1);

		if (!existingAlert) {
			await db.insert(alerts).values({
				siteId: urlRow.siteId,
				title: "Diagnostics Failed",
				message: alertMessage,
				alertType: "error_detected",
				resolved: false,
			});
		}
	}

	revalidateSiteDashboard(urlRow.siteId);
	return { success: result.status !== "fail", ...result };
}

export async function submitToIndexNow(siteId: string, urlLoc: string) {
	const user = await getAuthUser();

	try {
		const result = await enqueueManualSubmissionForUser(user.id, siteId, urlLoc);
		revalidateSiteDashboard(siteId);
		return { success: true, ...result };
	} catch (error: unknown) {
		return { success: false, error: getErrorMessage(error) };
	}
}

export async function saveSitemapSource(siteId: string, formData: FormData) {
	const user = await getAuthUser();
	const sitemapUrl = readFormString(formData, "sitemapUrl");
	const makePrimary = formData.get("isPrimary") === "on";
	await addSitemapSourceForUser(user.id, siteId, sitemapUrl, makePrimary);
	revalidateSiteDashboard(siteId);
}

export async function deleteSitemapSource(siteId: string, sourceId: string) {
	const user = await getAuthUser();
	await removeSitemapSourceForUser(user.id, sourceId);
	revalidateSiteDashboard(siteId);
}

export async function discoverSitemapSources(siteId: string) {
	const user = await getAuthUser();
	await discoverSitemapsForUser(user.id, siteId);
	revalidateSiteDashboard(siteId);
}

export async function verifyIndexNowKey(siteId: string) {
	const user = await getAuthUser();
	await verifyIndexNowForUser(user.id, siteId);
	revalidateSiteDashboard(siteId);
}

export async function saveIndexNowKey(siteId: string, formData: FormData) {
	const user = await getAuthUser();
	const keyLocation = readFormString(formData, "keyLocation");
	const key = readFormString(formData, "key");
	await saveIndexNowKeyForUser(user.id, siteId, keyLocation, key);
	revalidateSiteDashboard(siteId);
}

export async function saveBingApiKey(siteId: string, formData: FormData) {
	const user = await getAuthUser();
	const apiKey = readFormString(formData, "apiKey");
	await saveBingApiKeyForUser(user.id, siteId, apiKey);
	revalidateSiteDashboard(siteId);
}

export async function removeBingApiKey(siteId: string) {
	const user = await getAuthUser();
	await removeBingApiKeyForUser(user.id);
	revalidateSiteDashboard(siteId);
}

export async function toggleSiteAutomation(siteId: string, formData: FormData) {
	const user = await getAuthUser();
	const enabled = readFormString(formData, "enabled") === "true";
	await setAutomationForUser(user.id, siteId, enabled);
	revalidateSiteDashboard(siteId);
}

export async function createDashboardApiKey(formData: FormData) {
	const userId = await syncUser();
	const name = readFormString(formData, "name") || "IndexFast API key";
	const requestedScopes = normalizeApiScopes(formData.getAll("scopes"));
	const apiKey = await createApiKeyForUser(userId, name, requestedScopes.length > 0 ? requestedScopes : DEFAULT_API_SCOPES);
	revalidatePath("/dashboard/api-keys");
	revalidatePath("/dashboard/mcp");
	return apiKey;
}

export async function revokeDashboardApiKey(apiKeyId: string) {
	const user = await getAuthUser();
	await revokeApiKeyForUser(user.id, apiKeyId);
	revalidatePath("/dashboard/api-keys");
	revalidatePath("/dashboard/mcp");
}

export async function setAlertResolved(alertId: string, resolved: boolean) {
	const user = await getAuthUser();
	const [alertRow] = await db
		.select({
			id: alerts.id,
			siteId: alerts.siteId,
		})
		.from(alerts)
		.innerJoin(sites, eq(alerts.siteId, sites.id))
		.where(and(eq(alerts.id, alertId), eq(sites.userId, user.id)))
		.limit(1);

	if (!alertRow) {
		throw new Error("Alert not found");
	}

	await db.update(alerts).set({ resolved }).where(eq(alerts.id, alertId));
	revalidateSiteDashboard(alertRow.siteId);
}

export async function toggleEngineAutomation(siteId: string, provider: string, enabled: boolean) {
	const user = await getAuthUser();
	await updateEngineAutomationForUser(user.id, siteId, provider, enabled);
	revalidateSiteDashboard(siteId);
}

export async function updateUrlRules(siteId: string, formData: FormData) {
	const user = await getAuthUser();
	const submitNewUrls = formData.get("submitNewUrls") === "on";
	const submitChangedUrls = formData.get("submitChangedUrls") === "on";
	await updateUrlSubmissionRulesForUser(user.id, siteId, submitNewUrls, submitChangedUrls);
	revalidateSiteDashboard(siteId);
}

export async function deleteSite(siteId: string) {
	const user = await getAuthUser();
	await deleteSiteForUser(user.id, siteId);
	revalidatePath("/dashboard");
	redirect("/dashboard");
}

export async function createMcpApiKey() {
	const userId = await syncUser();
	const apiKey = await createApiKeyForUser(userId, "IndexFast MCP Key", DEFAULT_API_SCOPES);
	revalidatePath("/dashboard/api-keys");
	revalidatePath("/dashboard/mcp");
	return apiKey;
}
