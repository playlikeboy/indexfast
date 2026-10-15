/**
 * Shared chrome for /dashboard and /admin: header, nav, account links, and the plan banner
 * that implements the visible half of the expiry policy (renew reminders, grace warning,
 * "you are on Free now").
 */
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { AppThemeToggle } from "./AppThemeToggle";
import { Toaster } from "./toast";
import type { Entitlement } from "@/lib/platform/plans";
import { stack } from "@/stack";
import { AppNav } from "./AppNav";
import { Badge, buttonClass, cn, formatDate } from "./ui";

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
		<div role="status" className={`border-b px-4 py-2.5 text-sm ${tone}`}>
			<div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1">
				<span>{message}</span>
				<Link href="/dashboard/billing" className="shrink-0 font-semibold underline underline-offset-2">
					Renew now
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
			<header className="sticky top-0 z-20 border-b border-[var(--app-border)] bg-[var(--app-panel)]/85 backdrop-blur-md">
				<div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
					<Link href="/dashboard" className="flex items-center gap-2.5 rounded-md text-[15px] font-semibold tracking-tight">
						{/* logo-mark.png is a 128px crop of /logo.png (the full file is 1254px / 695 KB). */}
						<Image src="/logo-mark.png" alt="" width={28} height={28} className="h-7 w-7 rounded-md dark:ring-1 dark:ring-white/15" priority unoptimized />
						IndexFast
					</Link>
					<div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
						<Link href="/dashboard/billing" className="rounded-full" title="Your plan">
							<Badge tone={entitlement.tier === "free" ? "neutral" : "accent"}>{entitlement.plan.name}</Badge>
						</Link>
						<span className="hidden max-w-52 truncate px-1 text-sm text-[var(--app-muted)] md:inline" title={email}>
							{email}
						</span>
						<AppThemeToggle />
						<a href={stack.urls.signOut} className={cn(buttonClass.ghost, "h-8 w-8 px-0")} aria-label="Sign out" title="Sign out">
							<LogOut className="h-4 w-4" aria-hidden />
						</a>
					</div>
				</div>
				<div className="mx-auto max-w-6xl px-2">
					<AppNav isAdmin={isAdmin} />
				</div>
			</header>
			<PlanBanner entitlement={entitlement} expiredPlanAt={expiredPlanAt} />
			<main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">{children}</main>
			<Toaster />
		</div>
	);
}
