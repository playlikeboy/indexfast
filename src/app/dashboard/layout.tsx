/**
 * Dashboard layout: the auth guard for every /dashboard route, the users mirror row, and the
 * entitlement the shell needs for the plan badge and the expiry banner.
 */
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { AppShell } from "@/components/app/AppShell";
import { AttributionBeacon } from "@/components/app/AttributionBeacon";
import { ensureUserRow, isAdmin, requireSessionUser } from "@/lib/auth";
import { resolveEntitlement } from "@/lib/platform/plans";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: { children: ReactNode }) {
	const user = await requireSessionUser();
	const { created } = await ensureUserRow(user);
	const [row] = await db.select({ billingTier: users.billingTier, planExpiresAt: users.planExpiresAt }).from(users).where(eq(users.id, user.id)).limit(1);
	const entitlement = resolveEntitlement(row);
	const expiredPlanAt = entitlement.tier === "free" && row?.planExpiresAt ? row.planExpiresAt : null;

	return (
		<AppShell email={user.email} isAdmin={isAdmin(user)} entitlement={entitlement} expiredPlanAt={expiredPlanAt}>
			{created ? <AttributionBeacon userId={user.id} /> : null}
			{children}
		</AppShell>
	);
}
