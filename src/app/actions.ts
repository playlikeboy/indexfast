"use server";

/**
 * Dashboard server actions. Each action: authenticate -> delegate to the engine (which
 * re-checks ownership) -> revalidate the affected routes -> return an ActionResult the UI
 * renders inline. Errors are returned, not thrown, because Next.js hides thrown messages
 * in production and users need the real reason ("key file returned 404").
 *
 * Signature convention: (boundArgs..., prevState, formData) so actions plug straight into
 * useActionState via `.bind(null, ...)`.
 */
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { alerts, sites, users } from "@/db/schema";
import { ensureUserRow, isAdmin, requireActionUser, getSessionUser } from "@/lib/auth";
import {
	addSitemapSourceForUser,
	createSiteForUser,
	deleteSiteForUser,
	discoverSitemapsForUser,
	removeBingApiKeyForUser,
	removeSitemapSourceForUser,
	saveBingApiKeyForUser,
	saveIndexNowKeyForUser,
	setAutomationForUser,
	setBingAutomationForSite,
	submitPendingForUser,
	submitUrlsForUser,
	syncSitemapsForUser,
	updateUrlSubmissionRulesForUser,
	adoptExistingIndexNowKeyForUser,
	verifySiteForUser,
	drainSiteQueueForUser,
	retryFailedForUser,
} from "@/lib/automation/service";
import { removeEngineForUser, setBaiduTokenForUser, setEngineAutoSubmitForUser, setYandexTokenForUser } from "@/lib/engines/extra-engines";
import { disconnectGoogleForUser, inspectUrlForUser, matchGscPropertiesForUser, submitSitemapsToGscForUser } from "@/lib/engines/google-service";
import { createApiKeyForUser, revokeApiKeyForUser } from "@/lib/platform/api-keys";
import { DEFAULT_API_SCOPES, PLAN_PERIOD_DAYS, isPaidPlan } from "@/lib/platform/plans";
import { runDiagnosticsForUser } from "@/lib/platform/operations";
import { activatePaidOrder, createCheckoutOrder } from "@/lib/platform/razorpay-billing";
import { getRazorpayConfig, verifyCheckoutSignature } from "@/lib/platform/razorpay";
import { publicErrorMessage } from "@/lib/platform/http";

export type ActionResult = { ok: boolean; message?: string; error?: string; data?: Record<string, unknown> } | null;

function text(formData: FormData | undefined, key: string) {
	const value = formData?.get(key);
	return typeof value === "string" ? value.trim() : "";
}

function revalidateSite(siteId: string) {
	revalidatePath("/dashboard");
	revalidatePath(`/dashboard/sites/${siteId}`);
}

async function run(work: () => Promise<string | { message: string; data?: Record<string, unknown> }>): Promise<ActionResult> {
	try {
		const result = await work();
		return typeof result === "string" ? { ok: true, message: result } : { ok: true, ...result };
	} catch (error) {
		// DB/runtime errors carry SQL and internals; only deliberate domain errors reach the user.
		return { ok: false, error: publicErrorMessage(error) };
	}
}

async function sessionUserId() {
	const user = await requireActionUser();
	await ensureUserRow(user);
	return user.id;
}

// ---------------------------------------------------------------------------
// Sites
// ---------------------------------------------------------------------------

export async function addSiteAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
	let siteId: string | null = null;
	const result = await run(async () => {
		const userId = await sessionUserId();
		const created = await createSiteForUser({ userId, domain: text(formData, "domain"), sitemapUrl: text(formData, "sitemapUrl") || undefined });
		siteId = created.site.id;
		return created.warning ?? `Found ${created.sync?.urlCount ?? 0} URLs.`;
	});
	if (siteId) {
		revalidatePath("/dashboard");
		redirect(`/dashboard/sites/${siteId}`);
	}
	return result;
}

export async function verifySiteAction(siteId: string): Promise<ActionResult> {
	return run(async () => {
		const result = await verifySiteForUser(await sessionUserId(), siteId);
		revalidateSite(siteId);
		if (!result.ok) {
			throw new Error(result.message);
		}
		return result.queued > 0 ? `Verified. Submitting ${result.queued} URLs now.` : "Verified. Automation is on.";
	});
}

/** Setup shortcut: the user already hosts an IndexNow key (key or key file URL). */
export async function adoptExistingKeyAction(siteId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
	return run(async () => {
		const result = await adoptExistingIndexNowKeyForUser(await sessionUserId(), siteId, text(formData, "existingKey"));
		revalidateSite(siteId);
		if (!result.ok) {
			throw new Error(result.message);
		}
		return result.queued > 0 ? `Verified with your existing key. Submitting ${result.queued} URLs now.` : "Verified with your existing key. Automation is on.";
	});
}

export async function syncNowAction(siteId: string): Promise<ActionResult> {
	return run(async () => {
		const result = await syncSitemapsForUser(await sessionUserId(), siteId);
		revalidateSite(siteId);
		const summary = `Checked ${result.urlCount} URLs: ${result.newCount} new, ${result.changedCount} updated, ${result.submitted} submitted.`;
		if (result.failures.length > 0) {
			throw new Error(`${summary} Problems: ${result.failures.join("; ")}`);
		}
		return summary;
	});
}

/**
 * Engines rate-limit per site for hours. When that happens the user must hear that the URLs
 * are safely queued and when the retry is, not a bare "0 submitted".
 */
function throttleNote(until: Date | null | undefined) {
	if (!until) return "";
	const hours = Math.max(1, Math.round((new Date(until).getTime() - Date.now()) / 3_600_000));
	return ` The search engine is rate limiting this site, so the rest stays queued and retries automatically in about ${hours}h.`;
}

export async function submitPendingAction(siteId: string): Promise<ActionResult> {
	return run(async () => {
		const result = await submitPendingForUser(await sessionUserId(), siteId);
		revalidateSite(siteId);
		return result.queued === 0 ? "Nothing pending." : `Queued ${result.queued}, submitted ${result.submitted}.${throttleNote(result.throttledUntil)}`;
	});
}

export async function retryFailedAction(siteId: string): Promise<ActionResult> {
	return run(async () => {
		const result = await retryFailedForUser(await sessionUserId(), siteId);
		revalidateSite(siteId);
		return result.queued === 0 ? "No failed URLs to retry." : `Re-queued ${result.queued}, submitted ${result.submitted}.${throttleNote(result.throttledUntil)}`;
	});
}

export async function drainQueueAction(siteId: string): Promise<ActionResult> {
	return run(async () => {
		const userId = await sessionUserId();
		const result = await drainSiteQueueForUser(userId, siteId, 1000);
		revalidateSite(siteId);
		if (result.processedCount === 0) {
			return "Nothing is due right now. Queued URLs are waiting out a search engine cooldown and will retry automatically.";
		}
		const parts = [`${result.successCount} submitted`];
		if (result.retryCount > 0) parts.push(`${result.retryCount} scheduled for retry`);
		if (result.failedCount > 0) parts.push(`${result.failedCount} failed`);
		if (result.skippedCount > 0) parts.push(`${result.skippedCount} skipped (engine off or not on your plan)`);
		if (result.deferredCount > 0) parts.push(`${result.deferredCount} put back for later`);
		return `Processed ${result.processedCount}: ${parts.join(", ")}.${throttleNote(result.throttledUntil)}`;
	});
}

export async function submitUrlsAction(siteId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
	return run(async () => {
		const list = text(formData, "urls").split(/[\s,]+/).filter(Boolean);
		const result = await submitUrlsForUser(await sessionUserId(), siteId, list);
		revalidateSite(siteId);
		const rejected = result.rejected.length > 0 ? ` ${result.rejected.length} skipped (wrong host or invalid).` : "";
		return `Submitted ${result.successCount} of ${result.accepted}.${rejected}${throttleNote(result.throttledUntil)}`;
	});
}

export async function resubmitUrlAction(siteId: string, loc: string): Promise<ActionResult> {
	return run(async () => {
		const result = await submitUrlsForUser(await sessionUserId(), siteId, [loc]);
		revalidateSite(siteId);
		if (result.successCount > 0) return "Submitted.";
		if (result.throttledUntil) return `Queued.${throttleNote(result.throttledUntil)}`;
		return result.failedCount > 0 ? "The search engine rejected it. See Activity for the reason." : "Queued.";
	});
}

export async function checkUrlAction(siteId: string, urlId: string): Promise<ActionResult> {
	return run(async () => {
		const result = await runDiagnosticsForUser({ userId: await sessionUserId(), siteId, urlId });
		revalidateSite(siteId);
		return result.blockers.length > 0 ? `HTTP ${result.httpStatus}. Issues: ${result.blockers.join("; ")}` : `HTTP ${result.httpStatus}. No blockers found.`;
	});
}

export async function addSitemapAction(siteId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
	return run(async () => {
		await addSitemapSourceForUser(await sessionUserId(), siteId, text(formData, "sitemapUrl"));
		revalidateSite(siteId);
		return "Sitemap added. Click Sync now to import it.";
	});
}

export async function discoverSitemapsAction(siteId: string): Promise<ActionResult> {
	return run(async () => {
		const found = await discoverSitemapsForUser(await sessionUserId(), siteId);
		revalidateSite(siteId);
		return found.length > 0 ? `Found ${found.length} sitemap(s).` : "No sitemap found. Add the URL manually.";
	});
}

export async function removeSitemapAction(siteId: string, sourceId: string): Promise<ActionResult> {
	return run(async () => {
		await removeSitemapSourceForUser(await sessionUserId(), sourceId);
		revalidateSite(siteId);
		return "Sitemap removed.";
	});
}

export async function setAutomationAction(siteId: string, enabled: boolean): Promise<ActionResult> {
	return run(async () => {
		await setAutomationForUser(await sessionUserId(), siteId, enabled);
		revalidateSite(siteId);
		return enabled ? "Automation on." : "Automation paused.";
	});
}

export async function updateRulesAction(siteId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
	return run(async () => {
		await updateUrlSubmissionRulesForUser(await sessionUserId(), siteId, formData.get("submitNewUrls") === "on", formData.get("submitChangedUrls") === "on");
		revalidateSite(siteId);
		return "Saved.";
	});
}

export async function saveCustomKeyAction(siteId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
	return run(async () => {
		await saveIndexNowKeyForUser(await sessionUserId(), siteId, text(formData, "keyLocation"), text(formData, "key"));
		revalidateSite(siteId);
		return "Key saved. Click Verify.";
	});
}

export async function saveBingKeyAction(siteId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
	return run(async () => {
		const apiKey = text(formData, "apiKey");
		const autoSubmit = formData.get("autoSubmit") === "on" || formData.get("autoSubmit") === "true";
		await saveBingApiKeyForUser(await sessionUserId(), siteId, apiKey, autoSubmit);
		revalidateSite(siteId);
		return "Bing key verified and auto-submission configured.";
	});
}

export async function toggleBingAutoSubmitAction(siteId: string, enabled: boolean): Promise<ActionResult> {
	return run(async () => {
		await setBingAutomationForSite(await sessionUserId(), siteId, enabled);
		revalidateSite(siteId);
		return enabled ? "Bing auto-submit enabled." : "Bing auto-submit disabled.";
	});
}

export async function removeBingKeyAction(siteId: string): Promise<ActionResult> {
	return run(async () => {
		await removeBingApiKeyForUser(await sessionUserId());
		revalidateSite(siteId);
		return "Bing key removed.";
	});
}

export async function dismissIssueAction(siteId: string, alertId: string): Promise<ActionResult> {
	return run(async () => {
		const userId = await sessionUserId();
		const [row] = await db
			.select({ id: alerts.id })
			.from(alerts)
			.innerJoin(sites, eq(alerts.siteId, sites.id))
			.where(and(eq(alerts.id, alertId), eq(sites.userId, userId)))
			.limit(1);
		if (!row) throw new Error("Issue not found");
		await db.update(alerts).set({ resolved: true }).where(eq(alerts.id, alertId));
		revalidateSite(siteId);
		return "Dismissed.";
	});
}

export async function deleteSiteAction(siteId: string): Promise<ActionResult> {
	const result = await run(async () => {
		await deleteSiteForUser(await sessionUserId(), siteId);
		return "Deleted.";
	});
	if (result?.ok) {
		revalidatePath("/dashboard");
		redirect("/dashboard");
	}
	return result;
}

// ---------------------------------------------------------------------------
// API keys / MCP
// ---------------------------------------------------------------------------

export async function createApiKeyAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
	return run(async () => {
		const key = await createApiKeyForUser(await sessionUserId(), text(formData, "name") || "MCP key", DEFAULT_API_SCOPES);
		revalidatePath("/dashboard/connect");
		return { message: "Key created. Copy it now, it will not be shown again.", data: { plainKey: key.plainKey } };
	});
}

export async function revokeApiKeyAction(apiKeyId: string): Promise<ActionResult> {
	return run(async () => {
		await revokeApiKeyForUser(await sessionUserId(), apiKeyId);
		revalidatePath("/dashboard/connect");
		return "Key revoked.";
	});
}

// ---------------------------------------------------------------------------
// Billing (Razorpay)
// ---------------------------------------------------------------------------

export async function createCheckoutAction(plan: string): Promise<ActionResult> {
	return run(async () => {
		if (!isPaidPlan(plan)) throw new Error("Unknown plan");
		const user = await requireActionUser();
		await ensureUserRow(user);
		const order = await createCheckoutOrder(user, plan);
		return { message: "Order created", data: order };
	});
}

/** Called by the Checkout success handler. The webhook does the same work as a backstop. */
export async function confirmPaymentAction(input: { orderId: string; paymentId: string; signature: string }): Promise<ActionResult> {
	return run(async () => {
		const user = await requireActionUser();
		const valid = await verifyCheckoutSignature({ ...input, keySecret: getRazorpayConfig().keySecret });
		if (!valid) throw new Error("Payment signature mismatch. If you were charged, it will activate automatically within minutes.");
		const result = await activatePaidOrder({ orderId: input.orderId, paymentId: input.paymentId, expectedUserId: user.id });
		if (!result.ok) throw new Error(result.reason === "unauthorized" ? "Not allowed" : "Order not found.");
		revalidatePath("/dashboard", "layout");
		return `Payment received. Your plan is active until ${result.periodEnd?.toDateString() ?? "the end of the period"}.`;
	});
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

/** Support tool: grant (or remove) a plan for N days without a payment. */
export async function adminGrantPlanAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
	return run(async () => {
		if (!isAdmin(await getSessionUser())) throw new Error("Not allowed");
		const email = text(formData, "email").toLowerCase();
		const rawPlan = text(formData, "plan");
		// Only the current plans can be granted; hidden legacy tiers stay reachable through billing history only.
		if (rawPlan !== "free" && !isPaidPlan(rawPlan)) throw new Error("Choose Free, Pro or Unlimited.");
		const days = Math.min(3650, Math.max(1, Math.floor(Number(text(formData, "days")) || PLAN_PERIOD_DAYS)));
		const matches = await db.select({ id: users.id, billingTier: users.billingTier, planExpiresAt: users.planExpiresAt }).from(users).where(eq(users.email, email)).limit(2);
		if (matches.length === 0) throw new Error(`No user with email ${email}`);
		if (matches.length > 1) throw new Error(`More than one user has ${email}; grant from the database by user id.`);
		const [target] = matches;
		const now = new Date();
		// Same plan with time left: extend it, so a grant never shortens a period the user paid for.
		const start = target.billingTier === rawPlan && target.planExpiresAt && target.planExpiresAt > now ? target.planExpiresAt : now;
		const expiresAt = rawPlan === "free" ? null : new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
		await db.update(users).set({ billingTier: rawPlan, planExpiresAt: expiresAt, updatedAt: now }).where(eq(users.id, target.id));
		revalidatePath("/admin");
		return rawPlan === "free" ? `${email} set to Free.` : `${email} on ${rawPlan} until ${expiresAt?.toDateString()}.`;
	});
}

// ---------------------------------------------------------------------------
// Search engines: Google Search Console, Google Indexing API (gated), Yandex, Baidu
// ---------------------------------------------------------------------------

function checkbox(formData: FormData, key: string, fallback = true) {
	const value = formData.get(key);
	return value === null ? fallback : value === "on" || value === "true";
}

export async function disconnectGoogleAction(): Promise<ActionResult> {
	return run(async () => {
		await disconnectGoogleForUser(await sessionUserId());
		revalidatePath("/dashboard", "layout");
		return "Google Search Console disconnected.";
	});
}

/** Re-read the user's Search Console properties and match every site (or one) again. */
export async function refreshGscPropertiesAction(siteId?: string): Promise<ActionResult> {
	return run(async () => {
		const result = await matchGscPropertiesForUser(await sessionUserId(), siteId);
		revalidatePath("/dashboard", "layout");
		const matched = result.sites.filter((site) => site.property).length;
		return { message: `Matched ${matched} of ${result.sites.length} site(s) to a Search Console property.`, data: { sites: result.sites } };
	});
}

export async function inspectUrlAction(siteId: string, urlId: string): Promise<ActionResult> {
	return run(async () => {
		const result = await inspectUrlForUser(await sessionUserId(), siteId, { urlId });
		revalidateSite(siteId);
		return { message: `Google: ${result.gscStatus}.`, data: { inspection: result } };
	});
}

export async function submitSitemapsToGscAction(siteId: string): Promise<ActionResult> {
	return run(async () => {
		const result = await submitSitemapsToGscForUser(await sessionUserId(), siteId);
		revalidateSite(siteId);
		const failed = result.results.filter((item) => !item.ok);
		if (failed.length === result.results.length) throw new Error(failed[0]?.message ?? "Search Console rejected the sitemaps.");
		return `Submitted ${result.results.length - failed.length} sitemap(s) to ${result.property}.${failed.length > 0 ? ` ${failed.length} failed: ${failed[0].message}` : ""}`;
	});
}

export async function saveYandexTokenAction(siteId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
	return run(async () => {
		const result = await setYandexTokenForUser(await sessionUserId(), siteId, text(formData, "token"), checkbox(formData, "autoSubmit"));
		revalidateSite(siteId);
		const quota = result.quotaRemainder !== null ? ` ${result.quotaRemainder} recrawls left today.` : "";
		return `Yandex connected for this site.${quota}`;
	});
}

export async function saveBaiduTokenAction(siteId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
	return run(async () => {
		const result = await setBaiduTokenForUser(await sessionUserId(), siteId, text(formData, "token"), checkbox(formData, "autoSubmit"));
		revalidateSite(siteId);
		return `Baidu token saved. ${result.remainToday} pushes left today.`;
	});
}

/** engine: 'google_indexing_api' | 'yandex' | 'baidu'. */
export async function setEngineAutoSubmitAction(siteId: string, engine: string, enabled: boolean): Promise<ActionResult> {
	return run(async () => {
		await setEngineAutoSubmitForUser(await sessionUserId(), siteId, engine, enabled);
		revalidateSite(siteId);
		return enabled ? "Auto-submit on." : "Auto-submit off.";
	});
}

export async function removeEngineAction(siteId: string, engine: string): Promise<ActionResult> {
	return run(async () => {
		await removeEngineForUser(await sessionUserId(), siteId, engine);
		revalidateSite(siteId);
		return "Disconnected.";
	});
}
