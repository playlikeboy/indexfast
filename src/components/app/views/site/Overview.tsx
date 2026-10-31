/**
 * Overview section: setup until the site is verified, then engine health; the four computed
 * figures; the backlog actions; open issues; a manual submit box; and recent submissions with
 * each engine's answer. Every figure here is counted from the database, never estimated.
 */
import Link from "next/link";
import { dismissIssueAction, submitUrlsAction } from "@/app/actions";
import { ActionButton, ActionForm } from "@/components/app/client";
import { timeAgo } from "@/components/app/ui";
import { Badge, EmptyState, Panel, Stat, Status, Table, Td, Textarea, Th, buttonClass } from "@/components/ui";
import type { SitePageData } from "@/db/app-queries";
import { formatLimit } from "@/lib/platform/plans";
import { getSiteHost } from "@/lib/url-utils";
import { BacklogButtons } from "./BacklogButtons";
import { EngineHealth } from "./EngineHealth";
import { SetupPanel } from "./SetupPanel";
import { engineName, pathOf, siteHref, textLink } from "./shared";

export function OverviewSection({ data }: { data: SitePageData }) {
	const { site, stats, openJobs, issues, paused, entitlement } = data;
	const canSubmit = site.verified && !paused;
	const share = stats.total > 0 ? Math.round((stats.submitted / stats.total) * 100) : null;

	return (
		<div className="flex flex-col gap-6">
			{site.verified ? <EngineHealth data={data} /> : <SetupPanel data={data} />}

			<div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
				<Stat
					label="Tracked URLs"
					value={stats.total.toLocaleString()}
					hint={`${stats.new7d > 0 ? `${stats.new7d.toLocaleString()} new this week. ` : ""}Plan limit ${formatLimit(entitlement.limits.urlsPerSite)}`}
				/>
				<Stat label="Submitted" value={stats.submitted.toLocaleString()} hint={share !== null ? `${share}% of tracked URLs` : undefined} />
				<Stat label="Waiting in queue" value={openJobs.toLocaleString()} hint={stats.pending > 0 ? `${stats.pending.toLocaleString()} never sent` : undefined} />
				<Stat
					label="Failed"
					value={stats.failed.toLocaleString()}
					hint={
						stats.failed > 0 ? (
							<Link href={siteHref(site.id, { view: "urls", tab: "failed" })} className={textLink}>
								See failed URLs
							</Link>
						) : undefined
					}
				/>
			</div>

			{canSubmit && (stats.pending > 0 || stats.failed > 0) ? (
				<div className="flex flex-wrap items-center gap-3 rounded-(--radius-card) bg-well px-5 py-3 text-sm">
					<p className="mr-auto text-ink-2">
						{stats.pending > 0 ? `${stats.pending.toLocaleString()} URLs have never been sent. ` : ""}
						{stats.failed > 0 ? `${stats.failed.toLocaleString()} failed last time.` : ""}
					</p>
					<BacklogButtons siteId={site.id} canSubmit={canSubmit} pending={stats.pending} failed={stats.failed} />
				</div>
			) : null}

			{issues.length > 0 ? <IssuesPanel data={data} /> : null}

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
				{/* The backlog key is the primary action when it shows; otherwise manual submit is. */}
				<SubmitPanel data={data} canSubmit={canSubmit} primary={!(stats.pending > 0 || stats.failed > 0)} />
				<ActivityPanel data={data} />
			</div>
		</div>
	);
}

function IssuesPanel({ data }: { data: SitePageData }) {
	const { site, issues } = data;
	return (
		<Panel title="Needs your attention" padded={false}>
			<ul className="divide-y divide-border">
				{issues.map((issue) => (
					<li key={issue.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3 text-sm">
						<div className="min-w-0 flex-1">
							{/* Rate limiting heals by itself (warning); everything else needs the user (danger). */}
							<Status tone={/rate limiting/i.test(issue.title) ? "warning" : "danger"}>{issue.title}</Status>
							<p className="mt-0.5 break-words text-ink-2">{issue.message}</p>
							<p className="mt-0.5 text-muted">{timeAgo(issue.createdAt)}</p>
						</div>
						<ActionButton action={dismissIssueAction.bind(null, site.id, issue.id)} variant="ghost" showResult={false}>
							Dismiss
						</ActionButton>
					</li>
				))}
			</ul>
		</Panel>
	);
}

function SubmitPanel({ data, canSubmit, primary }: { data: SitePageData; canSubmit: boolean; primary: boolean }) {
	const { site, paused } = data;
	const host = getSiteHost(site);
	return (
		<Panel title="Submit URLs now" description="Paste pages you just published or updated. They skip the line.">
			{canSubmit ? (
				<ActionForm action={submitUrlsAction.bind(null, site.id)} submitLabel="Submit" pendingLabel="Submitting..." variant={primary ? "primary" : "secondary"}>
					<Textarea
						name="urls"
						rows={5}
						required
						spellCheck={false}
						placeholder={`https://${host}/new-page\nhttps://${host}/updated-page`}
						className="py-2 font-mono text-sm"
						aria-label="URLs, one per line"
					/>
				</ActionForm>
			) : (
				<p className="text-sm text-muted">{paused ? "This site is paused on your current plan." : "Finish setup above to start submitting."}</p>
			)}
		</Panel>
	);
}

function ActivityPanel({ data }: { data: SitePageData }) {
	const { site, activity } = data;
	const host = getSiteHost(site);
	return (
		<Panel
			title="Recent activity"
			padded={false}
			action={
				activity.length > 0 ? (
					<Link href={siteHref(site.id, { view: "urls", tab: "submitted" })} className={buttonClass({ variant: "ghost", size: "sm" })}>
						All submitted
					</Link>
				) : null
			}
		>
			{activity.length === 0 ? (
				<EmptyState
					className="m-5"
					title="Nothing sent yet"
					description={site.verified ? "Submissions show up here with each engine's answer as they happen." : "Finish setup to start submitting."}
				/>
			) : (
				<Table caption="Recent submissions">
					<thead>
						<tr>
							<Th className="pl-5">Engine</Th>
							<Th className="w-full">URL</Th>
							<Th>Result</Th>
							<Th className="pr-5 text-right">When</Th>
						</tr>
					</thead>
					<tbody>
						{activity.map((item, index) => (
							<tr key={`${item.loc}-${index}`}>
								<Td className="pl-5">
									<Badge>{engineName(item.engine)}</Badge>
								</Td>
								<Td className="max-w-0">
									<span className="block truncate font-mono text-sm" title={item.loc}>
										{pathOf(item.loc, host)}
									</span>
									{item.status !== "success" && item.responseMessage ? (
										<span className="block truncate text-sm text-muted" title={item.responseMessage}>
											{item.responseMessage}
										</span>
									) : null}
								</Td>
								<Td>
									<Status tone={item.status === "success" ? "success" : item.status === "failed" ? "danger" : "neutral"}>{item.status === "success" ? "Accepted" : item.status === "failed" ? "Failed" : "Sent"}</Status>
								</Td>
								<Td className="pr-5 text-right whitespace-nowrap text-muted">{timeAgo(item.createdAt)}</Td>
							</tr>
						))}
					</tbody>
				</Table>
			)}
		</Panel>
	);
}
