/**
 * Site page: everything for one website on one screen, ordered by what the user needs next.
 * 1. Setup (only until verified): the key file, with copy buttons and an AI prompt.
 * 2. Numbers, open issues, and the URL list with filters (new / pending / submitted / failed).
 * 3. Sitemaps and recent activity.
 * 4. Rarely used settings collapsed at the bottom.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ExternalLink } from "lucide-react";
import {
	addSitemapAction,
	checkUrlAction,
	deleteSiteAction,
	discoverSitemapsAction,
	dismissIssueAction,
	removeBingKeyAction,
	removeSitemapAction,
	resubmitUrlAction,
	saveBingKeyAction,
	saveCustomKeyAction,
	setAutomationAction,
	submitPendingAction,
	submitUrlsAction,
	syncNowAction,
	updateRulesAction,
	adoptExistingKeyAction,
	verifySiteAction,
} from "@/app/actions";
import { ActionButton, ActionForm, CodeBlock, CopyButton } from "@/components/app/client";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, Stat, cn, inputClass, timeAgo } from "@/components/app/ui";
import { URL_PAGE_SIZE, getSitePage, type UrlTab } from "@/db/app-queries";
import { requireSessionUser } from "@/lib/auth";
import { formatLimit } from "@/lib/platform/plans";
import { getSiteHost } from "@/lib/url-utils";

const TABS: Array<{ id: UrlTab; label: string }> = [
	{ id: "all", label: "All" },
	{ id: "new", label: "New (7d)" },
	{ id: "pending", label: "Pending" },
	{ id: "submitted", label: "Submitted" },
	{ id: "failed", label: "Failed" },
];

type PageProps = {
	params: Promise<{ siteId: string }>;
	searchParams: Promise<{ tab?: string; q?: string; page?: string }>;
};

export default async function SitePage({ params, searchParams }: PageProps) {
	const user = await requireSessionUser();
	const { siteId } = await params;
	const query = await searchParams;
	const tab = (TABS.find((item) => item.id === query.tab)?.id ?? "all") as UrlTab;
	const q = (query.q || "").slice(0, 200);
	const pageNumber = Math.max(1, Number(query.page) || 1);

	const data = await getSitePage(user.id, siteId, { tab, q, page: pageNumber });
	if (!data) notFound();

	const { site, setup, sources, stats, urlRows, filtered, activity, issues, bing, openJobs, paused, entitlement } = data;
	const host = getSiteHost(site);
	const live = site.verified && site.automationEnabled;
	const totalPages = Math.max(1, Math.ceil(filtered / URL_PAGE_SIZE));
	const hrefFor = (next: { tab?: UrlTab; page?: number }) => {
		const params = new URLSearchParams();
		const nextTab = next.tab ?? tab;
		if (nextTab !== "all") params.set("tab", nextTab);
		if (q) params.set("q", q);
		if (next.page && next.page > 1) params.set("page", String(next.page));
		const suffix = params.toString();
		return `/dashboard/sites/${site.id}${suffix ? `?${suffix}` : ""}`;
	};

	const aiPrompt = `Add a file at the web root of this project so it is served at ${setup.keyLocation}. File name: ${setup.fileName}. Content (exactly, nothing else): ${setup.fileContent}. For Next.js/Vite/Astro put it in public/, for SvelteKit in static/. Then commit and deploy.`;

	return (
		<>
			<div className="mb-2 text-sm">
				<Link href="/dashboard" className="text-[var(--app-muted)] hover:text-[var(--app-text)]">
					Websites
				</Link>
			</div>
			<PageHeader
				title={
					<span className="flex items-center gap-2">
						{host}
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
							<Badge tone="ok">Live</Badge>
							Checked {timeAgo(sources[0]?.lastSyncAt)}, then every {entitlement.limits.syncIntervalMinutes >= 1440 ? "24 hours" : "hour"}.
							{openJobs > 0 ? ` ${openJobs} in queue.` : ""}
						</span>
					) : (
						<Badge tone="warn">Needs setup</Badge>
					)
				}
				action={!paused ? <ActionButton action={syncNowAction.bind(null, site.id)} pendingLabel="Checking sitemaps..." variant="secondary">Sync now</ActionButton> : <ButtonLink href="/dashboard/billing" variant="primary">Upgrade</ButtonLink>}
			/>

			{!site.verified ? (
				<Card className="mb-6 border-accent/60" title="Finish setup: add one file to your site" description="This proves you own the site and lets search engines accept your submissions.">
					<div className="space-y-5 p-5">
						<ol className="space-y-5 text-sm">
							<li className="flex gap-3">
								<StepDot done={sources.length > 0 && stats.total > 0} n={1} />
								<div className="min-w-0 flex-1">
									<p className="font-medium">Sitemap found</p>
									<p className="text-[var(--app-muted)]">
										{stats.total > 0 ? `${stats.total.toLocaleString()} URLs imported from ${sources.length} sitemap(s).` : "No URLs yet. Add your sitemap below."}
									</p>
								</div>
							</li>
							<li className="flex gap-3">
								<StepDot n={2} />
								<div className="min-w-0 flex-1 space-y-3">
									<p className="font-medium">Create this file in your site&apos;s public folder and deploy</p>
									<div className="grid gap-3 sm:grid-cols-2">
										<CodeBlock label="File name" code={setup.fileName} />
										<CodeBlock label="File content" code={setup.fileContent} />
									</div>
									<p className="text-[var(--app-muted)]">
										Next.js, Vite, Astro: <code className="font-mono">public/{setup.fileName}</code> · SvelteKit: <code className="font-mono">static/</code> · WordPress: site root folder. It must load at{" "}
										<a className="underline underline-offset-2" href={setup.keyLocation} target="_blank" rel="noreferrer">
											{setup.keyLocation}
										</a>
										.
									</p>
									<div className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--app-subtle)] px-3 py-2">
										<span className="text-[var(--app-muted)]">Using an AI editor?</span>
										<CopyButton value={aiPrompt} label="Copy prompt for your AI" />
									</div>
									{/* Users migrating from another IndexNow tool (or an older IndexFast setup) already host a key file; let them reuse it instead of deploying a new one. */}
									<details className="rounded-lg border border-[var(--app-border)] px-3 py-2">
										<summary className="cursor-pointer text-[var(--app-muted)] hover:text-[var(--app-text)]">
											Already have an IndexNow key on this site? Use it instead
										</summary>
										<div className="mt-3 space-y-2">
											<p className="text-[var(--app-muted)]">
												Paste the key, or the full URL of your key file (e.g. <code className="font-mono">https://{host}/yourkey.txt</code>). We check it and verify in one step.
											</p>
											<ActionForm action={adoptExistingKeyAction.bind(null, site.id)} submitLabel="Use my key and verify" pendingLabel="Checking..." variant="secondary" inline>
												<input
													name="existingKey"
													required
													autoComplete="off"
													placeholder="Key or https://.../key.txt"
													className={`${inputClass} min-w-0 flex-1 font-mono text-xs`}
													aria-label="Existing IndexNow key or key file URL"
												/>
											</ActionForm>
										</div>
									</details>
								</div>
							</li>
							<li className="flex gap-3">
								<StepDot n={3} />
								<div className="min-w-0 flex-1 space-y-2">
									<p className="font-medium">Verify</p>
									{setup.lastErrorMessage ? <p className="text-[var(--app-bad)]">{setup.lastErrorMessage}</p> : null}
									<ActionButton action={verifySiteAction.bind(null, site.id)} variant="primary" pendingLabel="Checking file...">
										Verify and turn on auto-submit
									</ActionButton>
								</div>
							</li>
						</ol>
					</div>
				</Card>
			) : null}

			<div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
				<Stat label="Tracked URLs" value={stats.total.toLocaleString()} hint={`Limit ${formatLimit(entitlement.limits.urlsPerSite)}`} />
				<Stat label="Submitted" value={stats.submitted.toLocaleString()} />
				<Stat label="Pending" value={stats.pending.toLocaleString()} hint={stats.failed > 0 ? `${stats.failed} failed` : undefined} />
				<Stat label="New this week" value={stats.new7d.toLocaleString()} />
			</div>

			{issues.length > 0 ? (
				<Card className="mb-6" title="Issues">
					<ul className="divide-y divide-[var(--app-border)]">
						{issues.map((issue) => (
							<li key={issue.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3 text-sm">
								<div className="min-w-0 flex-1">
									<p className="font-medium text-[var(--app-bad)]">{issue.title}</p>
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

			<Card
				className="mb-6"
				title="URLs"
				action={
					site.verified && stats.pending > 0 && !paused ? (
						<ActionButton action={submitPendingAction.bind(null, site.id)} variant="primary" pendingLabel="Submitting...">
							Submit {stats.pending.toLocaleString()} pending
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
									"whitespace-nowrap rounded-md px-2.5 py-1 text-sm",
									item.id === tab ? "bg-[var(--app-subtle)] font-medium" : "text-[var(--app-muted)] hover:text-[var(--app-text)]",
								)}
							>
								{item.label}
							</Link>
						))}
					</div>
					<form className="w-full sm:w-64" action={`/dashboard/sites/${site.id}`}>
						{tab !== "all" ? <input type="hidden" name="tab" value={tab} /> : null}
						<input name="q" defaultValue={q} placeholder="Search URLs" className={inputClass} aria-label="Search URLs" />
					</form>
				</div>
				{urlRows.length === 0 ? (
					<EmptyState title={q || tab !== "all" ? "No matching URLs" : "No URLs yet"}>
						{q || tab !== "all" ? "Try another filter." : "Add a sitemap below, then click Sync now."}
					</EmptyState>
				) : (
					<ul className="divide-y divide-[var(--app-border)]">
						{urlRows.map((row) => (
							<li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-sm">
								<a href={row.loc} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-mono text-xs hover:underline" title={row.loc}>
									{row.loc.replace(`https://${host}`, "") || "/"}
								</a>
								<span className="text-xs text-[var(--app-muted)]">found {timeAgo(row.createdAt)}</span>
								<UrlStatus status={row.lastSubmissionStatus} at={row.lastSubmittedAt} blockers={row.indexingStatus === "blockers"} />
								{!paused ? (
									<span className="flex items-center">
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
				{totalPages > 1 ? (
					<div className="flex items-center justify-between border-t border-[var(--app-border)] px-5 py-3 text-sm text-[var(--app-muted)]">
						<span>
							Page {pageNumber} of {totalPages} · {filtered.toLocaleString()} URLs
						</span>
						<span className="flex gap-2">
							{pageNumber > 1 ? <ButtonLink href={hrefFor({ page: pageNumber - 1 })}>Previous</ButtonLink> : null}
							{pageNumber < totalPages ? <ButtonLink href={hrefFor({ page: pageNumber + 1 })}>Next</ButtonLink> : null}
						</span>
					</div>
				) : null}
			</Card>

			<div className="mb-6 grid gap-6 lg:grid-cols-2">
				<Card title="Sitemaps" action={<ActionButton action={discoverSitemapsAction.bind(null, site.id)} variant="ghost" pendingLabel="Searching...">Auto-detect</ActionButton>}>
					{sources.length === 0 ? (
						<EmptyState title="No sitemap yet">Add one below or use Auto-detect.</EmptyState>
					) : (
						<ul className="divide-y divide-[var(--app-border)]">
							{sources.map((source) => (
								<li key={source.id} className="px-5 py-3 text-sm">
									<div className="flex items-start justify-between gap-2">
										<a href={source.url} target="_blank" rel="noreferrer" className="min-w-0 truncate font-mono text-xs hover:underline">
											{source.url}
										</a>
										<ActionButton action={removeSitemapAction.bind(null, site.id, source.id)} variant="ghost" confirm="Remove this sitemap? URLs already imported are kept." showResult={false}>
											Remove
										</ActionButton>
									</div>
									<p className="mt-1 text-xs text-[var(--app-muted)]">
										{source.status === "failed" ? <span className="text-[var(--app-bad)]">Failed: {source.lastErrorMessage}</span> : `Checked ${timeAgo(source.lastSyncAt)}`}
									</p>
								</li>
							))}
						</ul>
					)}
					<div className="border-t border-[var(--app-border)] p-5">
						<ActionForm action={addSitemapAction.bind(null, site.id)} submitLabel="Add" variant="secondary" inline>
							<input name="sitemapUrl" required placeholder={`https://${host}/sitemap.xml`} className={`${inputClass} min-w-0 flex-1`} aria-label="Sitemap URL" />
						</ActionForm>
					</div>
				</Card>

				<Card title="Recent activity">
					{activity.length === 0 ? (
						<EmptyState title="Nothing submitted yet">{site.verified ? "New URLs will show up here." : "Finish setup to start submitting."}</EmptyState>
					) : (
						<ul className="divide-y divide-[var(--app-border)]">
							{activity.map((item, index) => (
								<li key={`${item.loc}-${index}`} className="flex items-center gap-3 px-5 py-2.5 text-sm">
									<Badge tone={item.status === "success" ? "ok" : "bad"}>{item.engine === "bing" ? "Bing" : "IndexNow"}</Badge>
									<span className="min-w-0 flex-1 truncate font-mono text-xs" title={item.responseMessage ?? undefined}>
										{item.loc.replace(`https://${host}`, "") || "/"}
									</span>
									<span className="text-xs text-[var(--app-muted)]">{timeAgo(item.createdAt)}</span>
								</li>
							))}
						</ul>
					)}
				</Card>
			</div>

			<details className="group rounded-xl border border-[var(--app-border)] bg-[var(--app-panel)]">
				<summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold">
					Settings <span className="font-normal text-[var(--app-muted)]">· automation, manual submit, Bing, advanced</span>
				</summary>
				<div className="space-y-8 border-t border-[var(--app-border)] p-5 text-sm">
					<section className="space-y-3">
						<h3 className="font-medium">Automation</h3>
						<p className="text-[var(--app-muted)]">
							{live ? "On: new and updated URLs are submitted automatically." : site.verified ? "Paused: sitemaps are still checked but nothing is submitted." : "Turns on automatically after verification."}
						</p>
						{site.verified ? (
							<ActionButton action={setAutomationAction.bind(null, site.id, !site.automationEnabled)} variant="secondary">
								{site.automationEnabled ? "Pause automation" : "Turn automation on"}
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
					</section>

					{site.verified ? (
						<section className="space-y-3">
							<h3 className="font-medium">Submit specific URLs</h3>
							<ActionForm action={submitUrlsAction.bind(null, site.id)} submitLabel="Submit" variant="secondary">
								<textarea name="urls" rows={4} required placeholder={`https://${host}/new-page\nhttps://${host}/updated-page`} className={`${inputClass} font-mono text-xs`} aria-label="URLs, one per line" />
							</ActionForm>
						</section>
					) : null}

					<section className="space-y-3">
						<h3 className="font-medium">Bing Webmaster API (optional)</h3>
						<p className="text-[var(--app-muted)]">
							IndexNow already reaches Bing. A Bing API key adds direct submissions using your Bing quota.
							{!entitlement.limits.bing ? " Included in Pro and Unlimited." : ""}
						</p>
						{bing ? (
							<div className="flex flex-wrap items-center gap-3">
								<Badge tone={bing.status === "verified" ? "ok" : "bad"}>{bing.status}</Badge>
								<span className="font-mono text-xs">{bing.maskedKey}</span>
								<ActionButton action={removeBingKeyAction.bind(null, site.id)} variant="ghost">
									Remove
								</ActionButton>
							</div>
						) : null}
						{entitlement.limits.bing ? (
							<ActionForm action={saveBingKeyAction.bind(null, site.id)} submitLabel="Save key" variant="secondary" inline>
								<input name="apiKey" type="password" required placeholder="Bing Webmaster API key" className={`${inputClass} min-w-0 flex-1`} aria-label="Bing API key" />
							</ActionForm>
						) : null}
					</section>

					<section className="space-y-3">
						<h3 className="font-medium">Use my own IndexNow key</h3>
						<p className="text-[var(--app-muted)]">Only if you already host an IndexNow key from another tool.</p>
						<ActionForm action={saveCustomKeyAction.bind(null, site.id)} submitLabel="Save key" variant="secondary">
							<input name="key" required placeholder="Key" defaultValue={setup.key} className={`${inputClass} font-mono text-xs`} aria-label="IndexNow key" />
							<input name="keyLocation" placeholder={`https://${host}/<key>.txt (optional)`} defaultValue={setup.keyLocation} className={`${inputClass} font-mono text-xs`} aria-label="Key file URL" />
						</ActionForm>
					</section>

					<section className="space-y-3 border-t border-[var(--app-border)] pt-6">
						<h3 className="font-medium text-[var(--app-bad)]">Delete website</h3>
						<p className="text-[var(--app-muted)]">Removes the site, its URLs and history from IndexFast. Your website itself is not touched.</p>
						<ActionButton action={deleteSiteAction.bind(null, site.id)} variant="danger" confirm={`Delete ${host} from IndexFast? This cannot be undone.`}>
							Delete {host}
						</ActionButton>
					</section>
				</div>
			</details>
		</>
	);
}

function StepDot({ n, done }: { n: number; done?: boolean }) {
	return (
		<span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold", done ? "bg-[var(--app-ok-bg)] text-[var(--app-ok)]" : "bg-[var(--app-subtle)]")}>
			{done ? <Check className="h-3.5 w-3.5" aria-hidden /> : n}
		</span>
	);
}

function UrlStatus({ status, at, blockers }: { status: string | null; at: Date | null; blockers: boolean }) {
	if (blockers) return <Badge tone="bad">Blocked</Badge>;
	if (status === "success") return <Badge tone="ok">Submitted {timeAgo(at)}</Badge>;
	if (status === "failed") return <Badge tone="bad">Failed</Badge>;
	return <Badge>Pending</Badge>;
}
