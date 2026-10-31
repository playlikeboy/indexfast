/**
 * Websites home. The empty state is the onboarding (one input). With sites, it is a table:
 * status, URL counts and the last sitemap check, with sites that need the user first.
 * "Auto-submit off" is a choice the user made on a verified site, so it is shown neutrally and
 * never counted as needing attention; only missing setup, sitemap errors and open issues are.
 */
import Link from "next/link";
import { AddSiteForm } from "@/components/app/AddSiteForm";
import { PageHeader, SiteAvatar, tableInPanel, timeAgo } from "@/components/app/ui";
import { Panel, Stat, Status, Table, Td, Th, buttonClass, type StatusTone } from "@/components/ui";
import type { DashboardHomeData, SiteStatus } from "@/db/app-queries";
import { formatLimit } from "@/lib/platform/plans";

type HomeSite = DashboardHomeData["sites"][number];

const siteStatus: Record<SiteStatus, { tone: StatusTone; label: string }> = {
	live: { tone: "success", label: "Live" },
	off: { tone: "neutral", label: "Auto-submit off" },
	setup: { tone: "warning", label: "Needs setup" },
	error: { tone: "danger", label: "Sitemap error" },
	paused: { tone: "neutral", label: "Paused" },
};

function needsAttention({ status, openIssues }: Pick<HomeSite, "status" | "openIssues">) {
	return status === "setup" || status === "error" || openIssues > 0;
}

function percent(part: number, whole: number) {
	return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

const ONBOARDING_STEPS: Array<[string, string]> = [
	["Add your domain", "We discover your sitemap and import every URL."],
	["Drop one file in your site", "A small key file proves you own it. Your AI can add it for you."],
	["Leave it running", "New and updated pages go to Bing, Yandex, Naver and the other IndexNow engines automatically."],
];

function Onboarding() {
	return (
		<div className="max-w-xl py-6">
			<h1 className="text-2xl font-semibold">Get your pages found faster</h1>
			<p className="mt-3 text-muted">Add your website. We find your sitemap, watch it for new pages, and notify search engines for you.</p>
			<div className="mt-8">
				<AddSiteForm large />
			</div>
			<ol className="mt-10 flex flex-col gap-4">
				{ONBOARDING_STEPS.map(([title, body], index) => (
					<li key={title} className="flex gap-3">
						<span className="num w-5 shrink-0 font-display font-semibold text-muted">{index + 1}.</span>
						<div className="min-w-0">
							<p className="font-medium">{title}</p>
							<p className="text-sm text-muted">{body}</p>
						</div>
					</li>
				))}
			</ol>
			<p className="mt-10 text-sm text-muted">
				Using Claude Code, Cursor or another AI editor?{" "}
				<Link href="/dashboard/connect" className="font-medium text-ink underline hover:text-signal">
					Connect IndexFast to your AI
				</Link>{" "}
				and let it do the setup.
			</p>
		</div>
	);
}

// The site Link's after: overlay covers the row, so the hover matches what a click does; the
// billing link inside it sits above the overlay (z-10).
function SiteRow({ site, status, stats, lastSyncAt, openIssues }: HomeSite) {
	const host = site.indexingHost || site.domain;
	const state = siteStatus[status];
	return (
		<tr className="relative transition-colors duration-(--dur-short) hover:bg-well">
			<Td>
				<Link href={`/dashboard/sites/${site.id}`} className="flex min-w-0 items-center gap-3 font-medium after:absolute after:inset-0 hover:text-signal">
					<SiteAvatar host={host} />
					<span className="truncate">{host}</span>
				</Link>
			</Td>
			<Td>
				<div className="flex flex-col gap-1">
					<Status tone={state.tone}>{state.label}</Status>
					{status === "paused" ? (
						// Sites only pause when the plan no longer covers this many; say why and where to fix it.
						<span className="relative z-10 text-sm text-muted">
							Over plan limit,{" "}
							<Link href="/dashboard/billing" className="underline hover:text-signal">
								renew
							</Link>
						</span>
					) : null}
					{openIssues > 0 ? (
						<Status tone="danger">
							{openIssues} open issue{openIssues === 1 ? "" : "s"}
						</Status>
					) : null}
				</div>
			</Td>
			<Td numeric>
				{stats.total.toLocaleString()}
				{stats.new7d > 0 ? <div className="text-sm text-muted">+{stats.new7d.toLocaleString()} this week</div> : null}
			</Td>
			<Td numeric>
				{stats.submitted.toLocaleString()}
				{stats.total > 0 ? <div className="text-sm text-muted">{percent(stats.submitted, stats.total)}%</div> : null}
			</Td>
			<Td numeric className={stats.failed > 0 ? "text-danger" : "text-muted"}>
				{stats.failed.toLocaleString()}
			</Td>
			<Td className="whitespace-nowrap text-muted">{lastSyncAt ? timeAgo(lastSyncAt) : "Not checked yet"}</Td>
		</tr>
	);
}

/** Pure view for the Websites screen (renders from loaded data). */
export function HomeView({ data }: { data: Pick<DashboardHomeData, "sites" | "entitlement"> }) {
	const { sites, entitlement } = data;
	if (sites.length === 0) return <Onboarding />;

	const atLimit = sites.length >= entitlement.limits.sites;
	const totals = sites.reduce(
		(sum, { stats }) => ({ total: sum.total + stats.total, submitted: sum.submitted + stats.submitted, pending: sum.pending + stats.pending }),
		{ total: 0, submitted: 0, pending: 0 },
	);
	const attention = sites.filter(needsAttention).length;
	// Sites that need the user float to the top; the rest keep their creation order (sort is stable).
	const ordered = [...sites].sort((a, b) => Number(needsAttention(b)) - Number(needsAttention(a)));

	return (
		<>
			<PageHeader
				title="Websites"
				description={`${sites.length} of ${formatLimit(entitlement.limits.sites)} on ${entitlement.plan.name}`}
				action={
					atLimit ? (
						<Link href="/dashboard/billing" className={buttonClass({ variant: "primary" })}>
							Upgrade to add more
						</Link>
					) : null
				}
			/>

			<div className="mb-8 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
				<Stat label="Tracked URLs" value={totals.total.toLocaleString()} />
				<Stat label="Submitted" value={totals.submitted.toLocaleString()} hint={totals.total > 0 ? `${percent(totals.submitted, totals.total)}% of tracked` : undefined} />
				<Stat label="Not sent yet" value={totals.pending.toLocaleString()} />
				<Stat label="Need attention" value={attention.toLocaleString()} hint={attention > 0 ? "Setup, sitemap errors or open issues" : "Nothing needs you"} />
			</div>

			<Panel padded={false} title="Your websites">
				<Table caption="Your websites" className={tableInPanel}>
					<thead>
						<tr>
							<Th>Site</Th>
							<Th>Status</Th>
							<Th numeric>URLs</Th>
							<Th numeric>Submitted</Th>
							<Th numeric>Failed</Th>
							<Th>Last sitemap check</Th>
						</tr>
					</thead>
					<tbody>
						{ordered.map((row) => (
							<SiteRow key={row.site.id} {...row} />
						))}
					</tbody>
				</Table>
			</Panel>

			{!atLimit ? (
				<Panel className="mt-6" title="Add another website" description="We find the sitemap and import its URLs. Verification comes next, on the site page.">
					<AddSiteForm />
				</Panel>
			) : null}
		</>
	);
}
