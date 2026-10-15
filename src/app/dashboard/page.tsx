/**
 * Websites home. Empty state is the onboarding (one input). With sites, it is a scannable
 * list: status, URL counts, and what is new, with every row linking to the site page.
 */
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AddSiteForm } from "@/components/app/AddSiteForm";
import { Badge, ButtonLink, Card, PageHeader, timeAgo } from "@/components/app/ui";
import { getDashboardHome, type SiteStatus } from "@/db/app-queries";
import { requireSessionUser } from "@/lib/auth";
import { formatLimit } from "@/lib/platform/plans";

const statusBadge: Record<SiteStatus, { tone: "ok" | "warn" | "bad" | "neutral"; label: string }> = {
	live: { tone: "ok", label: "Live" },
	setup: { tone: "warn", label: "Needs setup" },
	error: { tone: "bad", label: "Sitemap error" },
	paused: { tone: "neutral", label: "Paused" },
};

export default async function DashboardPage() {
	const user = await requireSessionUser();
	const { sites, entitlement } = await getDashboardHome(user.id);
	const atLimit = sites.length >= entitlement.limits.sites;

	if (sites.length === 0) {
		return (
			<div className="mx-auto max-w-xl py-10">
				<h1 className="text-3xl font-semibold tracking-tight">Get your pages found faster.</h1>
				<p className="mt-3 text-[var(--app-muted)]">
					Add your website. We find your sitemap, watch it for new pages, and notify search engines automatically.
				</p>
				<div className="mt-8">
					<AddSiteForm large />
				</div>
				<ol className="mt-10 space-y-4 text-sm">
					{[
						["Add your domain", "We discover your sitemap and import every URL."],
						["Drop one file in your site", "A tiny key file proves you own it. Your AI can add it for you."],
						["Done", "New and updated pages are submitted to Bing, Yandex, Naver and other IndexNow engines automatically."],
					].map(([title, body], index) => (
						<li key={title} className="flex gap-3">
							<span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--app-subtle)] text-xs font-semibold">{index + 1}</span>
							<div>
								<p className="font-medium">{title}</p>
								<p className="text-[var(--app-muted)]">{body}</p>
							</div>
						</li>
					))}
				</ol>
				<p className="mt-10 text-sm text-[var(--app-muted)]">
					Using Claude Code, Cursor or another AI editor?{" "}
					<Link href="/dashboard/connect" className="font-medium text-[var(--app-text)] underline underline-offset-2">
						Connect IndexFast to your AI
					</Link>{" "}
					and let it do the setup.
				</p>
			</div>
		);
	}

	return (
		<>
			<PageHeader
				title="Websites"
				description={`${sites.length} of ${formatLimit(entitlement.limits.sites)} on ${entitlement.plan.name}`}
				action={atLimit ? <ButtonLink href="/dashboard/billing" variant="primary">Upgrade to add more</ButtonLink> : null}
			/>

			<Card>
				<ul className="divide-y divide-[var(--app-border)]">
					{sites.map(({ site, status, stats, lastSyncAt, openIssues }) => (
						<li key={site.id}>
							<Link href={`/dashboard/sites/${site.id}`} className="flex items-center gap-4 px-5 py-4 transition hover:bg-[var(--app-subtle)]">
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-2">
										<span className="truncate font-medium">{site.indexingHost || site.domain}</span>
										<Badge tone={statusBadge[status].tone}>{statusBadge[status].label}</Badge>
										{openIssues > 0 ? <Badge tone="bad">{openIssues} issue{openIssues === 1 ? "" : "s"}</Badge> : null}
									</div>
									<p className="mt-1 text-sm text-[var(--app-muted)]">
										{stats.total.toLocaleString()} URLs · {stats.submitted.toLocaleString()} submitted
										{stats.new7d > 0 ? ` · ${stats.new7d.toLocaleString()} new this week` : ""} · checked {timeAgo(lastSyncAt)}
									</p>
								</div>
								<ChevronRight className="h-4 w-4 shrink-0 text-[var(--app-muted)]" aria-hidden />
							</Link>
						</li>
					))}
				</ul>
			</Card>

			{!atLimit ? (
				<Card className="mt-6" title="Add another website">
					<div className="p-5">
						<AddSiteForm />
					</div>
				</Card>
			) : null}
		</>
	);
}
