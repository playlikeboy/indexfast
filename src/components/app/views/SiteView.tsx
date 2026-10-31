/**
 * Site view: one website, split into sections so each job has one obvious place. This file is
 * the shell (header, state line, section links); each section lives in ./site/.
 * - Overview: setup (until verified), engine health, numbers, issues, quick submit, activity.
 * - URLs: every tracked URL with status filters and per-row actions.
 * - Queue: what is waiting to be sent, and why (cooldown, retry).
 * - Sitemaps: sources and their sync state.
 * - Settings: automation, engines (IndexNow key, Bing, Search Console, Yandex, Baidu), danger zone.
 * Sections are links (?view=) rather than client tabs, because the view must be linkable and
 * survive a reload; the current one carries aria-current="page".
 */
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { syncNowAction } from "@/app/actions";
import { ActionButton } from "@/components/app/client";
import { timeAgo } from "@/components/app/ui";
import { Status, buttonClass, cn } from "@/components/ui";
import type { SitePageData, UrlTab } from "@/db/app-queries";
import { getSiteHost } from "@/lib/url-utils";
import { OverviewSection } from "./site/Overview";
import { QueueSection } from "./site/Queue";
import { SettingsSection } from "./site/Settings";
import { SitemapsSection } from "./site/Sitemaps";
import { UrlsSection } from "./site/Urls";
import { siteHref, type SiteSection } from "./site/shared";

export type { SiteSection } from "./site/shared";
export { TABS } from "./site/Urls";

export const SECTIONS: Array<{ id: SiteSection; label: string }> = [
	{ id: "overview", label: "Overview" },
	{ id: "urls", label: "URLs" },
	{ id: "queue", label: "Queue" },
	{ id: "sitemaps", label: "Sitemaps" },
	{ id: "settings", label: "Settings" },
];

type Props = { data: SitePageData; section: SiteSection; tab: UrlTab; q: string; pageNumber: number };

/** Pure view: renders from loaded data so it can also be rendered with fixtures. */
export function SiteView({ data, section, tab, q, pageNumber }: Props) {
	const { site, sources, stats, openJobs } = data;
	const host = getSiteHost(site);
	const sectionCount: Partial<Record<SiteSection, number>> = { urls: stats.total, queue: openJobs, sitemaps: sources.length };

	return (
		<div className="flex flex-col">
			<Link href="/dashboard" className="mb-3 inline-flex min-h-8 items-center gap-1.5 self-start text-sm text-muted transition-colors duration-(--dur-micro) hover:text-ink">
				<ArrowLeft aria-hidden="true" className="size-4" />
				All websites
			</Link>

			<header className="mb-6 flex flex-wrap items-end justify-between gap-4">
				<div className="min-w-0">
					<h1 className="flex min-w-0 items-center gap-2 font-display text-2xl leading-tight font-semibold tracking-display">
						<span className="truncate">{host}</span>
						<a href={`https://${host}`} target="_blank" rel="noreferrer" className="grid size-8 shrink-0 place-items-center rounded-(--radius-input) text-muted transition-colors duration-(--dur-micro) hover:bg-well hover:text-ink" aria-label={`Open ${host} in a new tab`}>
							<ExternalLink aria-hidden="true" className="size-4" />
						</a>
					</h1>
					<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
						<SiteState data={data} />
					</div>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					{!data.paused ? (
						<ActionButton action={syncNowAction.bind(null, site.id)} pendingLabel="Checking sitemaps..." variant="secondary">
							Sync sitemaps
						</ActionButton>
					) : (
						<Link href="/dashboard/billing" className={buttonClass({ variant: "primary" })}>
							Upgrade
						</Link>
					)}
				</div>
			</header>

			<nav aria-label="Site sections" className="-mx-1 mb-6 flex gap-1 overflow-x-auto border-b border-border px-1">
				{SECTIONS.map((item) => {
					const current = item.id === section;
					const count = sectionCount[item.id];
					return (
						<Link
							key={item.id}
							href={siteHref(site.id, { view: item.id })}
							aria-current={current ? "page" : undefined}
							className={cn(
								"-mb-px flex min-h-10 items-center gap-1.5 border-b-2 px-3 text-sm whitespace-nowrap transition-colors duration-(--dur-micro)",
								current ? "border-signal font-medium text-ink" : "border-transparent text-muted hover:border-border-strong hover:text-ink",
							)}
						>
							{item.label}
							{count ? <span className="num text-muted">{count.toLocaleString()}</span> : null}
						</Link>
					);
				})}
			</nav>

			{section === "overview" ? <OverviewSection data={data} /> : null}
			{section === "urls" ? <UrlsSection data={data} tab={tab} q={q} pageNumber={pageNumber} /> : null}
			{section === "queue" ? <QueueSection data={data} q={q} pageNumber={pageNumber} /> : null}
			{section === "sitemaps" ? <SitemapsSection data={data} /> : null}
			{section === "settings" ? <SettingsSection data={data} /> : null}
		</div>
	);
}

/** The one-line answer to "is this site sending?", in order of what blocks sending. */
function SiteState({ data }: { data: SitePageData }) {
	const { site, sources, paused, entitlement } = data;
	if (paused) return <Status tone="warning">Paused: over the {entitlement.plan.name} site limit</Status>;
	if (!site.verified) return <Status tone="warning">Needs setup</Status>;
	if (!site.automationEnabled) return <Status>Auto-submit paused</Status>;
	return (
		<>
			<Status tone="success">Auto-submit on</Status>
			<span>
				Sitemaps checked {timeAgo(sources[0]?.lastSyncAt)}, then every {entitlement.limits.syncIntervalMinutes >= 1440 ? "24 hours" : "hour"}.
			</span>
		</>
	);
}
