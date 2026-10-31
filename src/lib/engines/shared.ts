/**
 * DB helpers shared by the engine integrations (Google, Yandex, Baidu). Kept apart from
 * src/lib/automation/service.ts so that module can import the engines without an import
 * cycle. Same rules as the automation engine: every *ForUser path re-checks ownership by
 * userId, and paused sites (over the plan's site limit) cannot start new work.
 */
import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { engineQuotaUsage, sites } from "@/db/schema";
import { getUserAccess } from "@/lib/platform/entitlements";
import { formatLimit, VISIBLE_PLANS, type Entitlement, type PlanLimits } from "@/lib/platform/plans";

export type SiteRow = typeof sites.$inferSelect;

export function truncateMessage(message: string) {
	return message.length > 1000 ? `${message.slice(0, 997)}...` : message;
}

export function readConfig<T extends Record<string, unknown>>(value: unknown): Partial<T> {
	return value && typeof value === "object" ? (value as Partial<T>) : {};
}

export async function requireOwnedSite(userId: string, siteId: string): Promise<SiteRow> {
	const [site] = /^[0-9a-f-]{36}$/i.test(siteId)
		? await db
				.select()
				.from(sites)
				.where(and(eq(sites.id, siteId), eq(sites.userId, userId)))
				.limit(1)
		: [];
	if (!site) throw new Error("Site not found");
	return site;
}

export async function requireActiveSite(userId: string, siteId: string): Promise<Entitlement> {
	const { entitlement, pausedSiteIds } = await getUserAccess(userId);
	if (pausedSiteIds.has(siteId)) {
		throw new Error(
			`This site is paused: the ${entitlement.plan.name} plan includes ${formatLimit(entitlement.limits.sites)} site(s). Upgrade or delete another site to resume.`,
		);
	}
	return entitlement;
}

type BooleanLimit = { [K in keyof PlanLimits]: PlanLimits[K] extends boolean ? K : never }[keyof PlanLimits];

/** Paid-only engines (plans.ts); an expired plan past grace loses them like Bing. */
export function assertPlanIncludes(entitlement: Entitlement, limit: BooleanLimit, label: string) {
	if (!entitlement.limits[limit]) {
		const plans = VISIBLE_PLANS.filter((plan) => plan.limits[limit]).map((plan) => plan.name);
		throw new Error(`${label} is not included in the ${entitlement.plan.name} plan. Upgrade to ${plans.join(" or ")} to use it.`);
	}
}

/**
 * Atomically add `amount` to a quota window, only while the total stays within `limit`.
 * Returns false (and changes nothing) when the reservation would exceed the limit.
 */
export async function reserveQuota(quotaKey: string, window: string, amount: number, limit: number) {
	if (!Number.isFinite(limit)) return true;
	if (amount > limit) return false;
	const now = new Date();
	const rows = await db
		.insert(engineQuotaUsage)
		.values({ quotaKey, window, used: amount, updatedAt: now })
		.onConflictDoUpdate({
			target: [engineQuotaUsage.quotaKey, engineQuotaUsage.window],
			set: { used: sql`${engineQuotaUsage.used} + ${amount}`, updatedAt: now },
			setWhere: sql`${engineQuotaUsage.used} + ${amount} <= ${limit}`,
		})
		.returning({ used: engineQuotaUsage.used });
	return rows.length > 0;
}

/** The engine said the quota is gone (429) before our counter did: trust the engine. */
export async function exhaustQuota(quotaKey: string, window: string, limit: number) {
	const now = new Date();
	await db
		.insert(engineQuotaUsage)
		.values({ quotaKey, window, used: limit, updatedAt: now })
		.onConflictDoUpdate({ target: [engineQuotaUsage.quotaKey, engineQuotaUsage.window], set: { used: sql`greatest(${engineQuotaUsage.used}, ${limit})`, updatedAt: now } });
}

export async function readQuotaUsed(quotaKey: string, window: string) {
	const [row] = await db
		.select({ used: engineQuotaUsage.used })
		.from(engineQuotaUsage)
		.where(and(eq(engineQuotaUsage.quotaKey, quotaKey), eq(engineQuotaUsage.window, window)))
		.limit(1);
	return row?.used ?? 0;
}

export async function pruneQuotaUsage(before: Date) {
	const result = await db.delete(engineQuotaUsage).where(lt(engineQuotaUsage.updatedAt, before));
	return result.rowCount ?? 0;
}
