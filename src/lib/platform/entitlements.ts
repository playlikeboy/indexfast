/**
 * DB-aware wrappers around the pure plan logic in plans.ts. Anything that needs to know
 * "what is this user allowed to do right now" (dashboard, API/MCP gates, cron) goes through
 * here so the expiry/grace/pause rules are applied identically everywhere.
 */
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { sites, users } from "@/db/schema";
import { resolveEntitlement, type Entitlement } from "./plans";

export async function getUserEntitlement(userId: string): Promise<Entitlement> {
	const [user] = await db
		.select({ billingTier: users.billingTier, planExpiresAt: users.planExpiresAt })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);
	return resolveEntitlement(user);
}

/**
 * Sites beyond the plan's site limit are "paused": kept with all their data, but the cron
 * skips them and manual submissions are refused. The oldest sites stay active so a
 * downgrade never silently switches off the site the user set up first.
 */
export function computePausedSiteIds(orderedSiteIds: string[], siteLimit: number) {
	return new Set(Number.isFinite(siteLimit) ? orderedSiteIds.slice(siteLimit) : []);
}

export async function getPausedSiteIdsForUsers(userEntitlements: Map<string, Entitlement>) {
	const userIds = Array.from(userEntitlements.keys());
	if (userIds.length === 0) {
		return new Set<string>();
	}

	const rows = await db
		.select({ id: sites.id, userId: sites.userId })
		.from(sites)
		.where(inArray(sites.userId, userIds))
		.orderBy(asc(sites.createdAt));

	const byUser = new Map<string, string[]>();
	for (const row of rows) {
		byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), row.id]);
	}

	const paused = new Set<string>();
	for (const [userId, siteIds] of byUser) {
		const limit = userEntitlements.get(userId)?.limits.sites ?? 1;
		for (const id of computePausedSiteIds(siteIds, limit)) {
			paused.add(id);
		}
	}
	return paused;
}

export async function getUserAccess(userId: string) {
	const entitlement = await getUserEntitlement(userId);
	const pausedSiteIds = await getPausedSiteIdsForUsers(new Map([[userId, entitlement]]));
	return { entitlement, pausedSiteIds };
}
