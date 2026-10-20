/**
 * Admin area. Access: verified Stack Auth email listed in ADMIN_EMAILS (see lib/auth.ts).
 * Everyone else gets a 404. Also covered by middleware for the signed-out redirect.
 */
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app/AppShell";
import { requireAdmin } from "@/lib/auth";
import { getUserEntitlement } from "@/lib/platform/entitlements";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
	const user = await requireAdmin();
	const entitlement = await getUserEntitlement(user.id);
	return (
		<AppShell email={user.email} isAdmin entitlement={entitlement} expiredPlanAt={null}>
			{children}
		</AppShell>
	);
}
