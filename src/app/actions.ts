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
	submitPendingForUser,
	submitUrlsForUser,
	syncSitemapsForUser,
	updateUrlSubmissionRulesForUser,
	adoptExistingIndexNowKeyForUser,
	verifySiteForUser,
} from "@/lib/automation/service";
import { createApiKeyForUser, revokeApiKeyForUser } from "@/lib/platform/api-keys";
import { DEFAULT_API_SCOPES, PLAN_PERIOD_DAYS, isPaidPlan, normalizeBillingTier } from "@/lib/platform/plans";
import { runDiagnosticsForUser } from "@/lib/platform/operations";
import { activatePaidOrder, createCheckoutOrder } from "@/lib/platform/razorpay-billing";
import { getRazorpayConfig, verifyCheckoutSignature } from "@/lib/platform/razorpay";
import { getErrorMessage } from "@/lib/url-utils";

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
		return { ok: false, error: getErrorMessage(error) };
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

export async function submitPendingAction(siteId: string): Promise<ActionResult> {
	return run(async () => {
		const result = await submitPendingForUser(await sessionUserId(), siteId);
		revalidateSite(siteId);
		return result.queued === 0 ? "Nothing pending." : `Queued ${result.queued}, submitted ${result.submitted}.`;
	});
}

export async function submitUrlsAction(siteId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
	return run(async () => {
		const list = text(formData, "urls").split(/[\s,]+/).filter(Boolean);
		const result = await submitUrlsForUser(await sessionUserId(), siteId, list);
		revalidateSite(siteId);
		const rejected = result.rejected.length > 0 ? ` ${result.rejected.length} skipped (wrong host or invalid).` : "";
		return `Submitted ${result.successCount} of ${result.accepted}.${rejected}`;
	});
}

export async function resubmitUrlAction(siteId: string, loc: string): Promise<ActionResult> {
	return run(async () => {
		const result = await submitUrlsForUser(await sessionUserId(), siteId, [loc]);
		revalidateSite(siteId);
		return result.successCount > 0 ? "Submitted." : result.failedCount > 0 ? "Engine rejected it, see activity." : "Queued.";
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
		await saveBingApiKeyForUser(await sessionUserId(), siteId, text(formData, "apiKey"));
		revalidateSite(siteId);
		return "Bing key verified.";
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
		await requireActionUser();
		const valid = await verifyCheckoutSignature({ ...input, keySecret: getRazorpayConfig().keySecret });
		if (!valid) throw new Error("Payment signature mismatch. If you were charged, it will activate automatically within minutes.");
		const result = await activatePaidOrder({ orderId: input.orderId, paymentId: input.paymentId });
		if (!result.ok) throw new Error("Order not found.");
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
		const plan = normalizeBillingTier(text(formData, "plan"));
		const days = Number(text(formData, "days")) || PLAN_PERIOD_DAYS;
		const expiresAt = plan === "free" ? null : new Date(Date.now() + days * 24 * 60 * 60 * 1000);
		const updated = await db
			.update(users)
			.set({ billingTier: plan, planExpiresAt: expiresAt, updatedAt: new Date() })
			.where(eq(users.email, email))
			.returning({ id: users.id });
		if (updated.length === 0) throw new Error(`No user with email ${email}`);
		revalidatePath("/admin");
		return plan === "free" ? `${email} set to Free.` : `${email} on ${plan} until ${expiresAt?.toDateString()}.`;
	});
}
