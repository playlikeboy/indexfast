/**
 * Shared chrome for /dashboard and /admin: header, nav, account links, and the plan banner
 * that implements the visible half of the expiry policy (renew reminders, grace warning,
 * "you are on Free now"). data-scope="app" switches the type scale to the fixed app ratio.
 */
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { LogOut, TriangleAlert } from "lucide-react";
import { Badge, Container, buttonClass, cn } from "@/components/ui";
import type { Entitlement } from "@/lib/platform/plans";
import { stack } from "@/stack";
import { AppNav } from "./AppNav";
import { AppThemeToggle } from "./AppThemeToggle";
import { Toaster } from "./toast";
import { RENEW_REMINDER_DAYS, formatDate } from "./ui";

function planNotice(entitlement: Entitlement, expiredPlanAt: Date | null): { text: string; urgent: boolean } | null {
	if (entitlement.status === "grace" && entitlement.graceEndsAt) {
		return {
			text: `Your ${entitlement.plan.name} plan expired on ${formatDate(entitlement.expiresAt)}. Renew before ${formatDate(entitlement.graceEndsAt)} to keep your limits.`,
			urgent: true,
		};
	}
	if (entitlement.status === "active" && entitlement.daysLeft !== null && entitlement.daysLeft <= RENEW_REMINDER_DAYS) {
		return {
			text: `${entitlement.plan.name} ends in ${entitlement.daysLeft} day${entitlement.daysLeft === 1 ? "" : "s"}. Plans do not auto-charge, so renew to keep going.`,
			urgent: false,
		};
	}
	if (entitlement.tier === "free" && expiredPlanAt) {
		return { text: `Your paid plan ended on ${formatDate(expiredPlanAt)}. You are on Free now; extra sites are paused and nothing was deleted.`, urgent: false };
	}
	return null;
}

function PlanBanner({ entitlement, expiredPlanAt }: { entitlement: Entitlement; expiredPlanAt: Date | null }) {
	const notice = planNotice(entitlement, expiredPlanAt);
	if (!notice) return null;
	return (
		<div role="status" className={cn("border-b border-border", notice.urgent ? "bg-danger-wash" : "bg-warning-wash")}>
			<Container width="app" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5 text-sm">
				<span className={cn("flex min-w-0 items-start gap-2", notice.urgent ? "text-danger" : "text-warning")}>
					<TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
					<span className="text-ink">{notice.text}</span>
				</span>
				<Link href="/dashboard/billing" className={buttonClass({ variant: "secondary", size: "sm" })}>
					Renew plan
				</Link>
			</Container>
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
		<div data-scope="app" className="min-h-screen bg-background text-foreground">
			<a href="#app-main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-(--z-toast) focus:rounded-(--radius-input) focus:bg-panel focus:px-3 focus:py-2 focus:text-sm">
				Skip to content
			</a>
			<header className="sticky top-0 z-(--z-sticky-nav) border-b border-border bg-background">
				<Container width="app" className="flex h-14 items-center justify-between gap-4">
					<Link href="/dashboard" className="flex items-center gap-2.5 rounded-(--radius-input) font-display text-md font-semibold">
						{/* logo-mark.png is a 128px crop of /logo.png (the full file is 1254px / 695 KB). */}
						<Image src="/logo-mark.png" alt="" width={28} height={28} className="size-7 rounded-(--radius-input)" priority unoptimized />
						IndexFast
					</Link>
					<div className="flex min-w-0 items-center gap-2">
						<Link href="/dashboard/billing" className="rounded-(--radius-input)" aria-label={`Plan: ${entitlement.plan.name}. Open billing`}>
							<Badge>{entitlement.plan.name}</Badge>
						</Link>
						<span className="hidden max-w-52 truncate px-1 text-sm text-muted md:inline" title={email}>
							{email}
						</span>
						<AppThemeToggle />
						<a href={stack.urls.signOut} className={buttonClass({ variant: "ghost", size: "sm", className: "w-8 px-0" })} aria-label="Sign out" title="Sign out">
							<LogOut className="size-4" aria-hidden="true" />
						</a>
					</div>
				</Container>
				<Container width="app">
					<AppNav isAdmin={isAdmin} />
				</Container>
			</header>
			<PlanBanner entitlement={entitlement} expiredPlanAt={expiredPlanAt} />
			<main id="app-main" className="py-8 sm:py-10">
				<Container width="app">{children}</Container>
			</main>
			<Toaster />
		</div>
	);
}
