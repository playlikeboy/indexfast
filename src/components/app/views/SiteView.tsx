/**
 * Site view: one website, split into sections so each job has one obvious place.
 * - Overview: setup (until verified), engine health, numbers, issues, quick submit, activity.
 * - URLs: every tracked URL with status filters and per-row actions.
 * - Queue: what is waiting to be sent, and why (cooldown, retry).
 * - Sitemaps: sources and their sync state.
 * - Settings: automation, engines (IndexNow key, Bing), danger zone.
 * The engine health panel is always visible because "why did nothing get submitted?" is the
 * question users ask most; the answer (key failing, rate limited) must never be hidden.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Check, ExternalLink } from "lucide-react";
import {
	addSitemapAction,
	adoptExistingKeyAction,
	checkUrlAction,
	deleteSiteAction,
	discoverSitemapsAction,
	dismissIssueAction,
	drainQueueAction,
	removeBingKeyAction,
	removeSitemapAction,
	resubmitUrlAction,
	retryFailedAction,
	saveBingKeyAction,
	saveCustomKeyAction,
	setAutomationAction,
	submitPendingAction,
	submitUrlsAction,
	syncNowAction,
	toggleBingAutoSubmitAction,
	updateRulesAction,
	verifySiteAction,
} from "@/app/actions";
import { ActionButton, ActionForm, CodeBlock, CopyButton } from "@/components/app/client";
import { Badge, ButtonLink, Card, Code, EmptyState, PageHeader, Progress, SiteAvatar, Stat, cn, inputClass, timeAgo } from "@/components/app/ui";
import { URL_PAGE_SIZE, type SitePageData, type UrlTab } from "@/db/app-queries";
import { formatLimit } from "@/lib/platform/plans";
import { getSiteHost } from "@/lib/url-utils";

export type SiteSection = "overview" | "urls" | "queue" | "sitemaps" | "settings";

export const SECTIONS: Array<{ id: SiteSection; label: string }> = [
	{ id: "overview", label: "Overview" },
	{ id: "urls", label: "URLs" },
	{ id: "queue", label: "Queue" },
	{ id: "sitemaps", label: "Sitemaps" },
	{ id: "settings", label: "Settings" },
];

/** URL status filters inside the URLs section. The queue has its own section. */
export const TABS: Array<{ id: Exclude<UrlTab, "queue">; label: string }> = [
	{ id: "all", label: "All" },
	{ id: "pending", label: "Not sent yet" },
	{ id: "submitted", label: "Submitted" },
	{ id: "failed", label: "Failed" },
	{ id: "new", label: "New (7d)" },
];

type Props = { data: SitePageData; section: SiteSection; tab: UrlTab; q: string; pageNumber: number };

/** Pure view: renders from loaded data so it can also be rendered with fixtures. */
export function SiteView({ data, section, tab, q, pageNumber }: Props) {
	const { site, sources, stats, openJobs, paused, entitlement } = data;
	const host = getSiteHost(site);
	const live = site.verified && site.automationEnabled;
	const base = `/dashboard/sites/${site.id}`;
	const sectionCount: Partial<Record<SiteSection, number>> = { urls: stats.total, queue: openJobs, sitemaps: sources.length };

	return (
		<>
			<div className="mb-3 text-sm">
				<Link href="/dashboard" className="inline-flex items-center gap-1 text-[var(--app-muted)] hover:text-[var(--app-text)]">
					<ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All websites
				</Link>
			</div>
			<PageHeader
				title={
					<span className="flex items-center gap-3">
						<SiteAvatar host={host} size="lg" />
						<span className="truncate">{host}</span>
						<a href={`https://${host}`} target="_blank" rel="noreferrer" className="text-[var(--app-muted)] hover:text-[var(--app-text)]" aria-label={`Open ${host}`}>
							<ExternalLink className="h-4 w-4" />
						</a>
					</span>
				}
				description={
					paused ? (
						<Badge>Paused: over the {entitlement.plan.name} site limit</Badge>
					) : live ? (
						<span className="flex flex-wrap items-center gap-2">
							<Badge tone="ok">Auto-submit on</Badge>
							Sitemaps checked {timeAgo(sources[0]?.lastSyncAt)}, then every {entitlement.limits.syncIntervalMinutes >= 1440 ? "24 hours" : "hour"}.
						</span>
					) : site.verified ? (
						<Badge tone="warn">Auto-submit paused</Badge>
					) : (
						<Badge tone="warn">Needs setup</Badge>
					)
				}
				action={
					!paused ? (
						<ActionButton action={syncNowAction.bind(null, site.id)} pendingLabel="Checking sitemaps..." variant="secondary">
							Sync sitemaps
						</ActionButton>
					) : (
						<ButtonLink href="/dashboard/billing" variant="primary">
							Upgrade
						</ButtonLink>
					)
				}
			/>

			<nav aria-label="Site sections" className="-mx-1 mb-6 flex gap-1 overflow-x-auto border-b border-[var(--app-border)] px-1">
				{SECTIONS.map((item) => (
					<Link
						key={item.id}
						href={item.id === "overview" ? base : `${base}?view=${item.id}`}
						aria-current={item.id === section ? "page" : undefined}
						className={cn(
							"-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm",
							item.id === section ? "border-[var(--app-text)] font-medium text-[var(--app-text)]" : "border-transparent text-[var(--app-muted)] hover:text-[var(--app-text)]",
						)}
					>
						{item.label}
						{sectionCount[item.id] ? <span className="rounded-full bg-[var(--app-subtle)] px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--app-muted)]">{sectionCount[item.id]!.toLocaleString()}</span> : null}
					</Link>
				))}
			</nav>

			{section === "overview" ? <OverviewSection data={data} /> : null}
			{section === "urls" ? <UrlsSection data={data} tab={tab} q={q} pageNumber={pageNumber} /> : null}
			{section === "queue" ? <QueueSection data={data} q={q} pageNumber={pageNumber} /> : null}
			{section === "sitemaps" ? <SitemapsSection data={data} /> : null}
			{section === "settings" ? <SettingsSection data={data} /> : null}
		</>
	);
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

function OverviewSection({ data }: { data: SitePageData }) {
	const { site, stats, openJobs, issues, activity, paused, entitlement } = data;
	const host = getSiteHost(site);
	const base = `/dashboard/sites/${site.id}`;
	const canSubmit = site.verified && !paused;

	return (
		<div className="space-y-6">
			{!site.verified ? <SetupCard data={data} /> : null}
			{site.verified ? <EngineHealth data={data} /> : null}

			<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
				<Stat label="Tracked URLs" value={stats.total.toLocaleString()} hint={`Plan limit ${formatLimit(entitlement.limits.urlsPerSite)}`} />
				<Stat
					label="Submitted"
					value={stats.submitted.toLocaleString()}
					hint={
						stats.total > 0 ? (
							<span className="mt-1.5 block space-y-1">
								<Progress value={stats.submitted} max={stats.total} label="Share of URLs submitted" />
								<span className="block text-[11px]">{Math.round((stats.submitted / stats.total) * 100)}% of tracked URLs</span>
							</span>
						) : undefined
					}
				/>
				<Stat label="Waiting in queue" value={openJobs.toLocaleString()} hint={stats.pending > 0 ? `${stats.pending.toLocaleString()} never sent` : undefined} />
				<Stat label="Failed" value={stats.failed.toLocaleString()} hint={stats.new7d > 0 ? `${stats.new7d.toLocaleString()} new this week` : undefined} />
			</div>

			{canSubmit && (stats.pending > 0 || stats.failed > 0) ? (
				<div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)] px-5 py-3 text-sm">
					<span className="mr-auto text-[var(--app-muted)]">
						{stats.pending > 0 ? `${stats.pending.toLocaleString()} URLs have never been sent. ` : ""}
						{stats.failed > 0 ? `${stats.failed.toLocaleString()} failed last time.` : ""}
					</span>
					{stats.pending > 0 ? (
						<ActionButton action={submitPendingAction.bind(null, site.id)} variant="primary" pendingLabel="Submitting...">
							Submit {stats.pending.toLocaleString()} new
						</ActionButton>
					) : null}
					{stats.failed > 0 ? (
						<ActionButton action={retryFailedAction.bind(null, site.id)} variant="secondary" pendingLabel="Re-queuing...">
							Retry {stats.failed.toLocaleString()} failed
						</ActionButton>
					) : null}
				</div>
			) : null}

			{issues.length > 0 ? (
				<Card title="Needs your attention">
					<ul className="divide-y divide-[var(--app-border)]">
						{issues.map((issue) => (
							<li key={issue.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3 text-sm">
								<div className="min-w-0 flex-1">
									<p className={cn("font-medium", /rate limiting/i.test(issue.title) ? "text-[var(--app-warn)]" : "text-[var(--app-bad)]")}>{issue.title}</p>
									<p className="break-words text-[var(--app-muted)]">{issue.message}</p>
									<p className="text-xs text-[var(--app-muted)]">{timeAgo(issue.createdAt)}</p>
								</div>
								<ActionButton action={dismissIssueAction.bind(null, site.id, issue.id)} variant="ghost" showResult={false}>
									Dismiss
								</ActionButton>
							</li>
						))}
					</ul>
				</Card>
			) : null}

			<div className="grid gap-6 lg:grid-cols-2">
				<Card title="Submit URLs now" description="Paste pages you just published or updated. They skip the line.">
					<div className="p-5">
						{canSubmit ? (
							<ActionForm action={submitUrlsAction.bind(null, site.id)} submitLabel="Submit" pendingLabel="Submitting..." variant="primary">
								<textarea
									name="urls"
									rows={5}
									required
									placeholder={`https://${host}/new-page\nhttps://${host}/updated-page`}
									className={`${inputClass} font-mono text-xs`}
									aria-label="URLs, one per line"
								/>
							</ActionForm>
						) : (
							<p className="text-sm text-[var(--app-muted)]">{paused ? "This site is paused on your current plan." : "Finish setup above to start submitting."}</p>
						)}
					</div>
				</Card>

				<Card title="Recent activity" action={activity.length > 0 ? <ButtonLink href={`${base}?view=urls&tab=submitted`} variant="ghost">All submitted</ButtonLink> : null}>
					{activity.length === 0 ? (
						<EmptyState title="Nothing sent yet">{site.verified ? "Submissions show up here as they happen." : "Finish setup to start submitting."}</EmptyState>
					) : (
						<ul className="divide-y divide-[var(--app-border)]">
							{activity.map((item, index) => (
								<li key={`${item.loc}-${index}`} className="flex items-center gap-3 px-5 py-2.5 text-sm">
									<Badge tone={item.status === "success" ? "ok" : "bad"}>{engineName(item.engine)}</Badge>
									<span className="min-w-0 flex-1 truncate font-mono text-xs" title={item.status === "success" ? item.loc : `${item.loc}\n${item.responseMessage ?? ""}`}>
										{pathOf(item.loc, host)}
									</span>
									<span className="whitespace-nowrap text-xs text-[var(--app-muted)]">{timeAgo(item.createdAt)}</span>
								</li>
							))}
						</ul>
					)}
				</Card>
			</div>
		</div>
	);
}

function SetupCard({ data }: { data: SitePageData }) {
	const { site, setup, sources, stats } = data;
	const host = getSiteHost(site);
	const sitemapDone = sources.length > 0 && stats.total > 0;
	const aiPrompt = `Add a file at the web root of this project so it is served at ${setup.keyLocation}. File name: ${setup.fileName}. Content (exactly, nothing else): ${setup.fileContent}. For Next.js/Vite/Astro put it in public/, for SvelteKit in static/. Then commit and deploy.`;

	return (
		<Card
			className="border-[var(--app-text)]/25"
			title="Finish setup: add one file to your site"
			description="This proves you own the site. Once it checks out, every new page is submitted automatically."
			action={<span className="text-xs font-medium text-[var(--app-muted)]">{sitemapDone ? "Step 2 of 3" : "Step 1 of 3"}</span>}
		>
			<ol className="space-y-5 p-5 text-sm">
				<li className="flex gap-3">
					<StepDot done={sitemapDone} n={1} />
					<div className="min-w-0 flex-1">
						<p className="font-medium">Sitemap found</p>
						<p className="text-[var(--app-muted)]">
							{stats.total > 0 ? (
								`${stats.total.toLocaleString()} URLs imported from ${sources.length} sitemap(s).`
							) : (
								<>
									No URLs yet.{" "}
									<Link href={`/dashboard/sites/${site.id}?view=sitemaps`} className="text-[var(--app-text)] underline underline-offset-2">
										Add your sitemap
									</Link>
									.
								</>
							)}
						</p>
					</div>
				</li>
				<li className="flex gap-3">
					<StepDot n={2} />
					<div className="min-w-0 flex-1 space-y-3">
						<p className="font-medium">Create this file in your site&apos;s public folder and deploy</p>
						<div className="grid gap-3 sm:grid-cols-2">
							<CodeBlock wrap label="File name" code={setup.fileName} />
							<CodeBlock wrap label="File content" code={setup.fileContent} />
						</div>
						<p className="text-[var(--app-muted)]">
							Put it in <Code>public/</Code> (Next.js, Vite, Astro), <Code>static/</Code> (SvelteKit) or the site root folder (WordPress, plain HTML).{" "}
							<a className="break-all text-[var(--app-text)] underline underline-offset-2" href={setup.keyLocation} target="_blank" rel="noreferrer">
								Open the file URL
							</a>{" "}
							after deploying. It must show only the key, not a web page.
						</p>
						<div className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--app-subtle)] px-3 py-2">
							<span className="text-[var(--app-muted)]">Using an AI editor?</span>
							<CopyButton value={aiPrompt} label="Copy prompt for your AI" />
						</div>
						{/* Users migrating from another IndexNow tool already host a key file; let them reuse it instead of deploying a new one. */}
						<details className="rounded-lg border border-[var(--app-border)] px-3 py-2">
							<summary className="cursor-pointer select-none text-[var(--app-muted)] hover:text-[var(--app-text)]">Already have an IndexNow key on this site? Use it instead</summary>
							<div className="mt-3 space-y-2">
								<p className="text-[var(--app-muted)]">
									Paste the key, or the full URL of your key file (e.g. <code className="font-mono">https://{host}/yourkey.txt</code>). We check it and verify in one step.
								</p>
								<ActionForm action={adoptExistingKeyAction.bind(null, site.id)} submitLabel="Use my key and verify" pendingLabel="Checking..." variant="secondary" inline>
									<input name="existingKey" required autoComplete="off" placeholder="Key or https://.../key.txt" className={`${inputClass} min-w-0 flex-1 font-mono text-xs`} aria-label="Existing IndexNow key or key file URL" />
								</ActionForm>
							</div>
						</details>
					</div>
				</li>
				<li className="flex gap-3">
					<StepDot n={3} />
					<div className="min-w-0 flex-1 space-y-2">
						<p className="font-medium">Verify</p>
						{setup.lastErrorMessage ? <p className="rounded-lg bg-[var(--app-bad-bg)] px-3 py-2 text-[var(--app-bad)]">{setup.lastErrorMessage}</p> : null}
						<ActionButton action={verifySiteAction.bind(null, site.id)} variant="primary" pendingLabel="Checking file...">
							Verify and turn on auto-submit
						</ActionButton>
					</div>
				</li>
			</ol>
		</Card>
	);
}

/**
 * One row per engine with a plain-language state. Order of precedence: broken setup beats
 * rate limit beats healthy, because a broken key will never recover on its own.
 */
function EngineHealth({ data }: { data: SitePageData }) {
	const { site, setup, bing, queueSummary } = data;
	const throttled = queueSummary?.throttledUntil ?? {};
	const recheck = (
		<ActionButton action={verifySiteAction.bind(null, site.id)} variant="secondary" pendingLabel="Checking...">
			Re-check key file
		</ActionButton>
	);

	const rows: Array<{ name: string; tone: "ok" | "warn" | "bad" | "neutral"; state: string; detail: string; action?: ReactNode }> = [];

	if (setup.status !== "verified") {
		rows.push({ name: "IndexNow", tone: "bad", state: "Key check failing", detail: setup.lastErrorMessage || "The key file could not be confirmed. Nothing is sent until it passes.", action: recheck });
	} else if (throttled.indexnow) {
		rows.push({
			name: "IndexNow",
			tone: "warn",
			state: `Rate limited, retrying ${timeAgo(throttled.indexnow)}`,
			detail: "IndexNow asked us to slow down for this site. URLs stay queued and are retried automatically. Submitting again now would only extend the wait.",
		});
	} else if (!site.automationEnabled) {
		rows.push({ name: "IndexNow", tone: "neutral", state: "Auto-submit paused", detail: "Manual submits still work. Turn auto-submit back on in Settings." });
	} else {
		rows.push({ name: "IndexNow", tone: "ok", state: "Sending", detail: "New and updated URLs go to Bing, Yandex, Naver, Seznam and other IndexNow engines." });
	}

	if (!bing) {
		rows.push({ name: "Bing API", tone: "neutral", state: "Not connected", detail: "Optional. Adds direct Bing Webmaster submissions on top of IndexNow.", action: <ButtonLink href={`/dashboard/sites/${site.id}?view=settings`} variant="ghost">Connect</ButtonLink> });
	} else if (bing.status !== "verified") {
		rows.push({ name: "Bing API", tone: "bad", state: "Key not working", detail: bing.lastErrorMessage || "Reconnect your Bing Webmaster API key in Settings." });
	} else if (throttled.bing) {
		rows.push({ name: "Bing API", tone: "warn", state: `Rate limited, retrying ${timeAgo(throttled.bing)}`, detail: "Bing is throttling requests. Queued URLs retry automatically." });
	} else {
		rows.push({ name: "Bing API", tone: bing.autoSubmit ? "ok" : "neutral", state: bing.autoSubmit ? "Sending" : "Auto-submit off", detail: "Direct submissions into your Bing Webmaster quota." });
	}

	return (
		<Card title="Search engines">
			<ul className="divide-y divide-[var(--app-border)]">
				{rows.map((row) => (
					<li key={row.name} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
						<span className="w-20 shrink-0 font-medium">{row.name}</span>
						<Badge tone={row.tone}>{row.state}</Badge>
						<span className="min-w-0 flex-1 basis-full text-[var(--app-muted)] sm:basis-auto">{row.detail}</span>
						{row.action}
					</li>
				))}
			</ul>
		</Card>
	);
}

// ---------------------------------------------------------------------------
// URLs
// ---------------------------------------------------------------------------

function UrlsSection({ data, tab, q, pageNumber }: { data: SitePageData; tab: UrlTab; q: string; pageNumber: number }) {
	const { site, stats, urlRows, filtered, paused } = data;
	const host = getSiteHost(site);
	const base = `/dashboard/sites/${site.id}`;
	const totalPages = Math.max(1, Math.ceil(filtered / URL_PAGE_SIZE));
	const counts: Record<string, number> = { all: stats.total, pending: stats.pending, submitted: stats.submitted, failed: stats.failed, new: stats.new7d };
	const hrefFor = (next: { tab?: UrlTab; page?: number }) => {
		const params = new URLSearchParams({ view: "urls" });
		const nextTab = next.tab ?? tab;
		if (nextTab !== "all") params.set("tab", nextTab);
		if (q) params.set("q", q);
		if (next.page && next.page > 1) params.set("page", String(next.page));
		return `${base}?${params}`;
	};
	const canSubmit = site.verified && !paused;

	return (
		<Card
			title="URLs"
			description="Every page found in your sitemaps or submitted by hand."
			action={
				canSubmit && tab === "failed" && stats.failed > 0 ? (
					<ActionButton action={retryFailedAction.bind(null, site.id)} variant="primary" pendingLabel="Re-queuing...">
						Retry {stats.failed.toLocaleString()} failed
					</ActionButton>
				) : canSubmit && stats.pending > 0 ? (
					<ActionButton action={submitPendingAction.bind(null, site.id)} variant="primary" pendingLabel="Submitting...">
						Submit {stats.pending.toLocaleString()} not sent
					</ActionButton>
				) : null
			}
		>
			<div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--app-border)] px-5 py-2">
				<div className="flex gap-1 overflow-x-auto">
					{TABS.map((item) => (
						<Link
							key={item.id}
							href={hrefFor({ tab: item.id, page: 1 })}
							className={cn(
								"flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-sm",
								item.id === tab ? "bg-[var(--app-subtle)] font-medium text-[var(--app-text)]" : "text-[var(--app-muted)] hover:text-[var(--app-text)]",
							)}
						>
							{item.label}
							<span className="text-[11px] tabular-nums text-[var(--app-muted)]">{(counts[item.id] ?? 0).toLocaleString()}</span>
						</Link>
					))}
				</div>
				<form className="w-full sm:w-64" action={base}>
					<input type="hidden" name="view" value="urls" />
					{tab !== "all" ? <input type="hidden" name="tab" value={tab} /> : null}
					<input name="q" defaultValue={q} placeholder="Search URLs" className={inputClass} aria-label="Search URLs" />
				</form>
			</div>

			{urlRows.length === 0 ? (
				<EmptyState title={q || tab !== "all" ? "No matching URLs" : "No URLs yet"}>
					{q || tab !== "all" ? (
						"Try another filter."
					) : (
						<Link href={`${base}?view=sitemaps`} className="underline underline-offset-2">
							Add a sitemap to import your pages
						</Link>
					)}
				</EmptyState>
			) : (
				<ul className="divide-y divide-[var(--app-border)]">
					{urlRows.map((row) => (
						<li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-sm">
							<a href={row.loc} target="_blank" rel="noreferrer" className="min-w-0 basis-full truncate font-mono text-xs hover:underline sm:flex-1 sm:basis-auto" title={row.loc}>
								{pathOf(row.loc, host)}
							</a>
							<span className="hidden text-xs text-[var(--app-muted)] md:inline">found {timeAgo(row.createdAt)}</span>
							<UrlStatus status={row.lastSubmissionStatus} at={row.lastSubmittedAt} blockers={row.indexingStatus === "blockers"} engine={row.lastSubmittedEngine} />
							{!paused ? (
								<span className="ml-auto flex items-center sm:ml-0">
									{site.verified ? (
										<ActionButton action={resubmitUrlAction.bind(null, site.id, row.loc)} variant="ghost" pendingLabel="...">
											Submit
										</ActionButton>
									) : null}
									<ActionButton action={checkUrlAction.bind(null, site.id, row.id)} variant="ghost" pendingLabel="...">
										Check
									</ActionButton>
								</span>
							) : null}
						</li>
					))}
				</ul>
			)}
			<Pager pageNumber={pageNumber} totalPages={totalPages} total={filtered} unit="URLs" hrefFor={(page) => hrefFor({ page })} />
		</Card>
	);
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

function QueueSection({ data, q, pageNumber }: { data: SitePageData; q: string; pageNumber: number }) {
	const { site, queueRows, queueSummary, filtered, openJobs, paused } = data;
	const host = getSiteHost(site);
	const base = `/dashboard/sites/${site.id}`;
	const totalPages = Math.max(1, Math.ceil(filtered / URL_PAGE_SIZE));
	const nextRun = queueSummary?.nextRunAt ? new Date(queueSummary.nextRunAt) : null;
	const hrefFor = (page: number) => {
		const params = new URLSearchParams({ view: "queue" });
		if (q) params.set("q", q);
		if (page > 1) params.set("page", String(page));
		return `${base}?${params}`;
	};

	return (
		<Card
			title="Submission queue"
			description="URLs waiting to be sent. The queue runs every hour on its own; engines that rate limit are retried later automatically."
			action={
				openJobs > 0 && site.verified && !paused ? (
					<ActionButton action={drainQueueAction.bind(null, site.id)} variant="secondary" pendingLabel="Processing...">
						Process due jobs now
					</ActionButton>
				) : null
			}
		>
			{queueSummary && openJobs > 0 ? (
				<div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[var(--app-border)] bg-[var(--app-subtle)]/40 px-5 py-2.5 text-xs text-[var(--app-muted)]">
					<span className="font-semibold text-[var(--app-text)]">{queueSummary.openTotal.toLocaleString()} waiting</span>
					{queueSummary.throttled > 0 ? <Badge tone="warn">{queueSummary.throttled.toLocaleString()} cooling down</Badge> : null}
					<span>Next send: {nextRun && nextRun > new Date() ? timeAgo(nextRun) : "now"}</span>
					<span>
						IndexNow {(queueSummary.byEngine.indexnow ?? 0).toLocaleString()} · Bing {(queueSummary.byEngine.bing ?? 0).toLocaleString()}
					</span>
				</div>
			) : null}
			<div className="border-b border-[var(--app-border)] px-5 py-2">
				<form className="w-full sm:w-64" action={base}>
					<input type="hidden" name="view" value="queue" />
					<input name="q" defaultValue={q} placeholder="Search queue" className={inputClass} aria-label="Search queue" />
				</form>
			</div>

			{!queueRows || queueRows.length === 0 ? (
				<EmptyState title={q ? "No matching jobs" : "Queue is empty"}>{q ? "Try another search term." : "Everything discovered so far has been sent."}</EmptyState>
			) : (
				<ul className="divide-y divide-[var(--app-border)]">
					{queueRows.map((job) => {
						const waitingUntil = job.nextRunAt && new Date(job.nextRunAt) > new Date() ? job.nextRunAt : null;
						return (
							<li key={job.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-2.5 text-sm">
								<a href={job.loc} target="_blank" rel="noreferrer" className="min-w-0 basis-full truncate font-mono text-xs hover:underline sm:flex-1 sm:basis-auto" title={job.loc}>
									{pathOf(job.loc, host)}
								</a>
								<Badge>{engineName(job.engine)}</Badge>
								<JobState job={job} />
								<span className="whitespace-nowrap text-xs text-[var(--app-muted)]">{waitingUntil ? `sends ${timeAgo(waitingUntil)}` : "due now"}</span>
								{job.lastErrorMessage && job.httpStatus !== 429 ? (
									<span className="w-full truncate text-xs text-[var(--app-bad)]" title={job.lastErrorMessage}>
										{job.lastErrorMessage}
									</span>
								) : null}
							</li>
						);
					})}
				</ul>
			)}
			<Pager pageNumber={pageNumber} totalPages={totalPages} total={filtered} unit="jobs" hrefFor={hrefFor} />
		</Card>
	);
}

function JobState({ job }: { job: NonNullable<SitePageData["queueRows"]>[number] }) {
	if (job.status === "success") return <Badge tone="ok">Sent</Badge>;
	if (job.status === "failed") return <Badge tone="bad">Failed</Badge>;
	if (job.status === "processing") return <Badge tone="warn">Sending</Badge>;
	if (job.httpStatus === 429) return <Badge tone="warn">Rate limited</Badge>;
	if (job.attempts > 0) return <Badge tone="warn">Retry {job.attempts}</Badge>;
	return <Badge>{job.reason === "manual" ? "Manual" : job.reason === "changed" ? "Updated page" : "New page"}</Badge>;
}

// ---------------------------------------------------------------------------
// Sitemaps
// ---------------------------------------------------------------------------

function SitemapsSection({ data }: { data: SitePageData }) {
	const { site, sources } = data;
	const host = getSiteHost(site);

	return (
		<Card
			title="Sitemaps"
			description="We re-read these on a schedule and queue new or updated pages."
			action={
				<ActionButton action={discoverSitemapsAction.bind(null, site.id)} variant="secondary" pendingLabel="Searching...">
					Auto-detect
				</ActionButton>
			}
		>
			{sources.length === 0 ? (
				<EmptyState title="No sitemap yet">Add one below or use Auto-detect.</EmptyState>
			) : (
				<ul className="divide-y divide-[var(--app-border)]">
					{sources.map((source) => (
						<li key={source.id} className="flex items-center gap-3 py-3 pl-5 pr-3 text-sm">
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<a href={source.url} target="_blank" rel="noreferrer" className="truncate font-mono text-xs hover:underline" title={source.url}>
										{pathOf(source.url, host)}
									</a>
									{source.isPrimary ? <Badge>Primary</Badge> : null}
									{source.status === "failed" ? <Badge tone="bad">Failing</Badge> : source.lastSyncAt ? <Badge tone="ok">OK</Badge> : null}
								</div>
								<p className="mt-0.5 break-words text-xs text-[var(--app-muted)]">
									{source.status === "failed" ? (
										<span className="text-[var(--app-bad)]">{source.lastErrorMessage?.replace(source.url, "").replace(/^[:\s]+/, "")}</span>
									) : source.lastSyncAt ? (
										`Checked ${timeAgo(source.lastSyncAt)}`
									) : (
										"Not checked yet"
									)}
								</p>
							</div>
							<ActionButton action={removeSitemapAction.bind(null, site.id, source.id)} variant="ghost" confirm="Remove this sitemap? URLs already imported are kept." showResult={false}>
								Remove
							</ActionButton>
						</li>
					))}
				</ul>
			)}
			<div className="border-t border-[var(--app-border)] p-5">
				<ActionForm action={addSitemapAction.bind(null, site.id)} submitLabel="Add sitemap" variant="secondary" inline>
					<input name="sitemapUrl" required placeholder={`https://${host}/sitemap.xml`} className={`${inputClass} min-w-0 flex-1`} aria-label="Sitemap URL" />
				</ActionForm>
			</div>
		</Card>
	);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function SettingsSection({ data }: { data: SitePageData }) {
	const { site, setup, bing } = data;
	const host = getSiteHost(site);
	const live = site.verified && site.automationEnabled;

	return (
		<div className="space-y-6">
			<Card title="Automation" description={live ? "On: new and updated URLs are submitted automatically." : site.verified ? "Paused: sitemaps are still checked but nothing is sent automatically." : "Turns on by itself after verification."}>
				<div className="space-y-4 p-5 text-sm">
					{site.verified ? (
						<ActionButton action={setAutomationAction.bind(null, site.id, !site.automationEnabled)} variant="secondary">
							{site.automationEnabled ? "Pause auto-submit" : "Turn auto-submit on"}
						</ActionButton>
					) : null}
					<ActionForm action={updateRulesAction.bind(null, site.id)} submitLabel="Save rules" variant="secondary">
						<label className="flex items-center gap-2">
							<input type="checkbox" name="submitNewUrls" defaultChecked={setup.submitNewUrls} /> Submit new URLs
						</label>
						<label className="flex items-center gap-2">
							<input type="checkbox" name="submitChangedUrls" defaultChecked={setup.submitChangedUrls} /> Resubmit URLs when their lastmod changes
						</label>
					</ActionForm>
				</div>
			</Card>

			<Card
				title="IndexNow key"
				description="The key file on your site proves ownership. Removing it stops submissions."
				action={<Badge tone={setup.status === "verified" ? "ok" : setup.status === "failed" ? "bad" : "warn"}>{setup.status === "verified" ? "Verified" : setup.status === "failed" ? "Failing" : "Not verified"}</Badge>}
			>
				<div className="space-y-4 p-5 text-sm">
					<div className="flex flex-wrap items-center gap-3">
						<a href={setup.keyLocation} target="_blank" rel="noreferrer" className="break-all font-mono text-xs underline underline-offset-2">
							{setup.keyLocation}
						</a>
						<ActionButton action={verifySiteAction.bind(null, site.id)} variant="secondary" pendingLabel="Checking...">
							Re-check key file
						</ActionButton>
					</div>
					{setup.lastErrorMessage ? <p className="rounded-lg bg-[var(--app-bad-bg)] px-3 py-2 text-[var(--app-bad)]">{setup.lastErrorMessage}</p> : null}
					<details className="rounded-lg border border-[var(--app-border)] px-3 py-2">
						<summary className="cursor-pointer select-none text-[var(--app-muted)] hover:text-[var(--app-text)]">Use my own IndexNow key</summary>
						<div className="mt-3 space-y-2">
							<p className="text-[var(--app-muted)]">Only if you already host a key from another tool. Re-check after saving.</p>
							<ActionForm action={saveCustomKeyAction.bind(null, site.id)} submitLabel="Save key" variant="secondary">
								<input name="key" required placeholder="Key" defaultValue={setup.key} className={`${inputClass} font-mono text-xs`} aria-label="IndexNow key" />
								<input name="keyLocation" placeholder={`https://${host}/<key>.txt (optional)`} defaultValue={setup.keyLocation} className={`${inputClass} font-mono text-xs`} aria-label="Key file URL" />
							</ActionForm>
						</div>
					</details>
				</div>
			</Card>

			<Card
				title="Bing Webmaster API"
				description="Optional. Direct batch submissions into your Bing Webmaster quota, on top of IndexNow."
				action={
					bing ? (
						<span className="flex items-center gap-2">
							<Badge tone={bing.status === "verified" ? "ok" : "bad"}>{bing.status === "verified" ? "Connected" : "Not working"}</Badge>
							{bing.status === "verified" ? <Badge tone={bing.autoSubmit ? "ok" : "neutral"}>{bing.autoSubmit ? "Auto-submit on" : "Auto-submit off"}</Badge> : null}
						</span>
					) : null
				}
			>
				<div className="space-y-3 p-5 text-sm">
					{bing ? (
						<>
							<div className="flex flex-wrap items-center justify-between gap-3">
								<span className="font-mono text-xs">
									{bing.maskedKey}
									{bing.quota?.dailyQuota ? <span className="ml-2 font-sans text-[var(--app-muted)]">Daily quota {bing.quota.dailyQuota.toLocaleString()} URLs</span> : null}
								</span>
								<span className="flex items-center gap-2">
									{bing.status === "verified" ? (
										<ActionButton action={toggleBingAutoSubmitAction.bind(null, site.id, !bing.autoSubmit)} variant="secondary">
											{bing.autoSubmit ? "Turn auto-submit off" : "Turn auto-submit on"}
										</ActionButton>
									) : null}
									<ActionButton action={removeBingKeyAction.bind(null, site.id)} variant="ghost" confirm="Disconnect the Bing API key?">
										Disconnect
									</ActionButton>
								</span>
							</div>
							{bing.lastErrorMessage ? <p className="text-xs text-[var(--app-bad)]">{bing.lastErrorMessage}</p> : null}
						</>
					) : (
						<>
							<ActionForm action={saveBingKeyAction.bind(null, site.id)} submitLabel="Connect and verify" variant="secondary">
								<input name="apiKey" type="password" required placeholder="Paste Bing Webmaster API key" className={`${inputClass} min-w-0 flex-1`} aria-label="Bing API key" />
								<label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--app-muted)]">
									<input type="checkbox" name="autoSubmit" defaultChecked />
									<span>Auto-submit new and updated URLs to Bing</span>
								</label>
							</ActionForm>
							<p className="text-xs text-[var(--app-muted)]">
								Get the key in{" "}
								<a href="https://www.bing.com/webmasters" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--app-text)]">
									Bing Webmaster Tools
								</a>{" "}
								&rarr; Settings &rarr; API Access. The site must already be added there.
							</p>
						</>
					)}
				</div>
			</Card>

			<Card title="Delete website" className="border-[var(--app-bad)]/30">
				<div className="space-y-3 p-5 text-sm">
					<p className="text-[var(--app-muted)]">Removes the site, its URLs and history from IndexFast. Your website itself is not touched.</p>
					<ActionButton action={deleteSiteAction.bind(null, site.id)} variant="danger" confirm={`Delete ${host} from IndexFast? This cannot be undone.`}>
						Delete {host}
					</ActionButton>
				</div>
			</Card>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

function Pager({ pageNumber, totalPages, total, unit, hrefFor }: { pageNumber: number; totalPages: number; total: number; unit: string; hrefFor: (page: number) => string }) {
	if (totalPages <= 1) return null;
	return (
		<div className="flex items-center justify-between border-t border-[var(--app-border)] px-5 py-3 text-sm text-[var(--app-muted)]">
			<span>
				Page {pageNumber} of {totalPages} · {total.toLocaleString()} {unit}
			</span>
			<span className="flex gap-2">
				{pageNumber > 1 ? <ButtonLink href={hrefFor(pageNumber - 1)}>Previous</ButtonLink> : null}
				{pageNumber < totalPages ? <ButtonLink href={hrefFor(pageNumber + 1)}>Next</ButtonLink> : null}
			</span>
		</div>
	);
}

function StepDot({ n, done }: { n: number; done?: boolean }) {
	return (
		<span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold", done ? "bg-[var(--app-ok-bg)] text-[var(--app-ok)]" : "bg-[var(--app-subtle)]")}>
			{done ? <Check className="h-3.5 w-3.5" aria-hidden /> : n}
		</span>
	);
}

function UrlStatus({ status, at, blockers, engine }: { status: string | null; at: Date | null; blockers: boolean; engine?: string | null }) {
	if (blockers) return <Badge tone="bad">Blocked</Badge>;
	if (status === "success") return <Badge tone="ok">Sent {timeAgo(at)}{engine ? ` · ${engineName(engine)}` : ""}</Badge>;
	if (status === "failed") return <Badge tone="bad">Failed</Badge>;
	return <Badge>Not sent yet</Badge>;
}

function engineName(engine: string) {
	return engine === "bing" ? "Bing" : engine === "google_indexing_api" ? "Google" : "IndexNow";
}

function pathOf(loc: string, host: string) {
	return loc.replace(`https://${host}`, "") || "/";
}
