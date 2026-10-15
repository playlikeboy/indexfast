/**
 * Shared chrome for /dashboard and /admin: header, nav, account links, and the plan banner
 * that implements the visible half of the expiry policy (renew reminders, grace warning,
 * "you are on Free now").
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/marketing/ThemeToggle";
import type { Entitlement } from "@/lib/platform/plans";
import { stack } from "@/stack";
import { AppNav } from "./AppNav";
import { Badge, formatDate } from "./ui";

function PlanBanner({ entitlement, expiredPlanAt }: { entitlement: Entitlement; expiredPlanAt: Date | null }) {
	let message: ReactNode = null;
	let tone = "border-[var(--app-warn)]/30 bg-[var(--app-warn-bg)] text-[var(--app-warn)]";

	if (entitlement.status === "grace" && entitlement.graceEndsAt) {
		message = `Your ${entitlement.plan.name} plan expired on ${formatDate(entitlement.expiresAt)}. Renew before ${formatDate(entitlement.graceEndsAt)} to keep your limits.`;
		tone = "border-[var(--app-bad)]/30 bg-[var(--app-bad-bg)] text-[var(--app-bad)]";
	} else if (entitlement.status === "active" && entitlement.daysLeft !== null && entitlement.daysLeft <= 5) {
		message = `${entitlement.plan.name} ends in ${entitlement.daysLeft} day${entitlement.daysLeft === 1 ? "" : "s"}. Plans do not auto-charge, renew to keep going.`;
	} else if (entitlement.tier === "free" && expiredPlanAt) {
		message = `Your paid plan ended on ${formatDate(expiredPlanAt)}. You are on Free now; extra sites are paused and nothing was deleted.`;
	}

	if (!message) return null;
	return (
		<div className={`border-b px-4 py-2.5 text-sm ${tone}`}>
			<div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
				<span>{message}</span>
				<Link href="/dashboard/billing" className="font-semibold underline underline-offset-2">
					Renew
				</Link>
			</div>
		</div>
	);
}

export function AppShell({
	children,
	email,
	isAdmin,
	entitlement,
	expiredPlanAt,
}: {
	children: ReactNode;
	email: string;
	isAdmin: boolean;
	entitlement: Entitlement;
	expiredPlanAt: Date | null;
}) {
	return (
		<div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]">
			<header className="sticky top-0 z-20 border-b border-[var(--app-border)] bg-[var(--app-panel)]/90 backdrop-blur">
				<div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pt-3">
					<Link href="/dashboard" className="flex items-center gap-2 text-sm font-semibold">
						<span className="grid h-6 w-6 place-items-center rounded-md bg-accent text-[11px] font-black text-accent-foreground">IF</span>
						IndexFast
					</Link>
					<div className="flex items-center gap-3">
						<Link href="/dashboard/billing">
							<Badge tone={entitlement.tier === "free" ? "neutral" : "accent"}>{entitlement.plan.name}</Badge>
						</Link>
						<span className="hidden max-w-48 truncate text-sm text-[var(--app-muted)] sm:inline">{email}</span>
						<ThemeToggle />
						<a href={stack.urls.signOut} className="text-sm text-[var(--app-muted)] hover:text-[var(--app-text)]">
							Sign out
						</a>
					</div>
				</div>
				<div className="mx-auto max-w-6xl px-2">
					<AppNav isAdmin={isAdmin} />
				</div>
			</header>
			<PlanBanner entitlement={entitlement} expiredPlanAt={expiredPlanAt} />
			<main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
		</div>
	);
}
