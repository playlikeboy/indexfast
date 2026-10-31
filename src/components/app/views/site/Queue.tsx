/**
 * Queue section: the signature object of the product. Every waiting URL, which engine it goes
 * to, why it is waiting (new, changed, retry, rate limited) and when it will be sent. A 429 is
 * shown as a cooldown, not as an error, because rate limits never fail a job: they only delay it.
 */
import Link from "next/link";
import { drainQueueAction } from "@/app/actions";
import { ActionButton } from "@/components/app/client";
import { timeAgo } from "@/components/app/ui";
import { Badge, EmptyState, Panel, Status, Table, Td, Th } from "@/components/ui";
import { URL_PAGE_SIZE, type SitePageData } from "@/db/app-queries";
import { getSiteHost } from "@/lib/url-utils";
import { SearchForm } from "./SearchForm";
import { Pager, engineName, pathOf, siteHref, textLink } from "./shared";

type Job = NonNullable<SitePageData["queueRows"]>[number];

export function QueueSection({ data, q, pageNumber }: { data: SitePageData; q: string; pageNumber: number }) {
	const { site, queueRows, queueSummary, filtered, openJobs, paused } = data;
	const host = getSiteHost(site);
	const totalPages = Math.max(1, Math.ceil(filtered / URL_PAGE_SIZE));
	const now = new Date();
	const nextRun = queueSummary?.nextRunAt ? new Date(queueSummary.nextRunAt) : null;
	const byEngine = Object.entries(queueSummary?.byEngine ?? {}).filter(([, count]) => count > 0);
	// A page past the end (an old link) must not claim the queue is empty.
	const pastEnd = pageNumber > totalPages;

	return (
		<Panel
			title="Submission queue"
			description="URLs waiting to be sent. The queue runs every hour on its own; engines that rate limit are retried later automatically."
			padded={false}
			action={
				openJobs > 0 && site.verified && !paused ? (
					<ActionButton action={drainQueueAction.bind(null, site.id)} variant="secondary" pendingLabel="Processing...">
						Process due jobs now
					</ActionButton>
				) : null
			}
		>
			{queueSummary && openJobs > 0 ? (
				<dl className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-border px-5 py-3 text-sm">
					<div className="flex items-baseline gap-1.5">
						<dt className="text-muted">Waiting</dt>
						<dd className="num font-medium text-ink">{queueSummary.openTotal.toLocaleString()}</dd>
					</div>
					{queueSummary.throttled > 0 ? (
						<div className="flex items-baseline gap-1.5">
							<dt className="visually-hidden">Cooling down</dt>
							<dd>
								<Status tone="warning">{queueSummary.throttled.toLocaleString()} cooling down</Status>
							</dd>
						</div>
					) : null}
					<div className="flex items-baseline gap-1.5">
						<dt className="text-muted">Next send</dt>
						<dd className="text-ink">{nextRun && nextRun > now ? timeAgo(nextRun) : "now"}</dd>
					</div>
					{byEngine.map(([engine, count]) => (
						<div key={engine} className="flex items-baseline gap-1.5">
							<dt className="text-muted">{engineName(engine)}</dt>
							<dd className="num text-ink">{count.toLocaleString()}</dd>
						</div>
					))}
				</dl>
			) : null}
			<div className="border-b border-border px-5 py-3">
				<SearchForm siteId={site.id} view="queue" q={q} label="Search queue" />
			</div>

			{!queueRows || queueRows.length === 0 ? (
				<EmptyState
					className="m-5"
					title={pastEnd ? "No jobs on this page" : q ? "No matching jobs" : "Queue is empty"}
					description={
						pastEnd ? (
							<Link href={siteHref(site.id, { view: "queue", q })} className={textLink}>
								Go to the first page
							</Link>
						) : q ? (
							"Try another search term."
						) : (
							"Everything discovered so far has been sent. New and changed pages land here after each sitemap sync."
						)
					}
				/>
			) : (
				<Table caption="Queued submissions">
					<thead>
						<tr>
							<Th className="w-full pl-5">URL</Th>
							<Th>Engine</Th>
							<Th>State</Th>
							<Th className="pr-5 text-right">Sends</Th>
						</tr>
					</thead>
					<tbody>
						{queueRows.map((job) => {
							const waitingUntil = job.nextRunAt && new Date(job.nextRunAt) > now ? job.nextRunAt : null;
							return (
								<tr key={job.id}>
									<Td className="max-w-0 min-w-48 pl-5">
										<a href={job.loc} target="_blank" rel="noreferrer" className="block truncate font-mono text-sm hover:text-signal hover:underline" title={job.loc}>
											{pathOf(job.loc, host)}
										</a>
										{job.lastErrorMessage && job.httpStatus !== 429 ? (
											<span className="block truncate text-sm text-danger" title={job.lastErrorMessage}>
												{job.httpStatus ? <span className="num font-mono">HTTP {job.httpStatus}: </span> : null}
												{job.lastErrorMessage}
											</span>
										) : null}
									</Td>
									<Td>
										<Badge>{engineName(job.engine)}</Badge>
									</Td>
									<Td>
										<JobState job={job} />
									</Td>
									<Td className="pr-5 text-right whitespace-nowrap text-muted">{waitingUntil ? timeAgo(waitingUntil) : "Due now"}</Td>
								</tr>
							);
						})}
					</tbody>
				</Table>
			)}
			<Pager pageNumber={pageNumber} totalPages={totalPages} total={filtered} unit="jobs" hrefFor={(page) => siteHref(site.id, { view: "queue", q, page })} />
		</Panel>
	);
}

function JobState({ job }: { job: Job }) {
	if (job.status === "success") return <Status tone="success">Sent</Status>;
	if (job.status === "failed") return <Status tone="danger">Failed</Status>;
	if (job.status === "processing") return <Status tone="info">Sending</Status>;
	// Never sent: the engine is off, not on the plan, or the Google guardrail refused the page (reason in lastErrorMessage).
	if (job.status === "skipped") return <Status>Skipped</Status>;
	if (job.httpStatus === 429) return <Status tone="warning">Rate limited</Status>;
	if (job.attempts > 0) return <Status tone="warning">Retry {job.attempts}</Status>;
	return <Status>{job.reason === "manual" ? "Manual" : job.reason === "changed" ? "Updated page" : "New page"}</Status>;
}
