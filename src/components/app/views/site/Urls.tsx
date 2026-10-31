/**
 * URLs section: every tracked URL with linkable status filters, search, paging, and per-row
 * actions (submit, diagnostics check, Google inspection). The Google column appears only once
 * Search Console is connected for this site; until then it would be a column of "unknown".
 * Inspection reads Google's own coverage verdict; it never claims a page will be indexed.
 */
import Link from "next/link";
import { checkUrlAction, inspectUrlAction, resubmitUrlAction } from "@/app/actions";
import { ActionButton } from "@/components/app/client";
import { timeAgo } from "@/components/app/ui";
import { EmptyState, Panel, Status, Table, Td, Th, cn } from "@/components/ui";
import { URL_PAGE_SIZE, type SitePageData, type UrlTab } from "@/db/app-queries";
import { getSiteHost } from "@/lib/url-utils";
import { BacklogButtons } from "./BacklogButtons";
import { googleTone } from "./google-tone";
import { SearchForm } from "./SearchForm";
import { Pager, engineName, pathOf, siteHref, textLink } from "./shared";

/** URL status filters inside the URLs section. The queue has its own section. */
export const TABS: Array<{ id: Exclude<UrlTab, "queue">; label: string }> = [
	{ id: "all", label: "All" },
	{ id: "pending", label: "Not sent yet" },
	{ id: "submitted", label: "Submitted" },
	{ id: "failed", label: "Failed" },
	{ id: "new", label: "New (7d)" },
];

type UrlRow = SitePageData["urlRows"][number];

export function UrlsSection({ data, tab, q, pageNumber }: { data: SitePageData; tab: UrlTab; q: string; pageNumber: number }) {
	const { site, stats, urlRows, filtered, paused, engines } = data;
	const host = getSiteHost(site);
	const totalPages = Math.max(1, Math.ceil(filtered / URL_PAGE_SIZE));
	const counts: Record<string, number> = { all: stats.total, pending: stats.pending, submitted: stats.submitted, failed: stats.failed, new: stats.new7d };
	const hrefFor = (next: { tab?: UrlTab; page?: number }) => siteHref(site.id, { view: "urls", tab: next.tab ?? tab, q, page: next.page });
	const canSubmit = site.verified && !paused;
	const gsc = engines.find((engine) => engine.engine === "google_search_console");
	const showGoogle = Boolean(gsc?.connected);
	const canInspect = Boolean(gsc?.enabled) && !paused;
	// A page past the end (an old link) must not claim the site has no URLs.
	const pastEnd = pageNumber > totalPages;
	const filteredView = Boolean(q) || tab !== "all" || pastEnd;

	return (
		<Panel
			title="URLs"
			description="Every page found in your sitemaps or submitted by hand."
			padded={false}
			action={
				// The failed tab offers retry; every other view offers sending what was never sent.
				<BacklogButtons siteId={site.id} canSubmit={canSubmit} pending={tab === "failed" ? 0 : stats.pending} failed={tab === "failed" ? stats.failed : 0} />
			}
		>
			<div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
				<nav aria-label="Filter URLs" className="-mx-1 flex gap-1 overflow-x-auto px-1">
					{TABS.map((item) => (
						<Link
							key={item.id}
							href={hrefFor({ tab: item.id, page: 1 })}
							aria-current={item.id === tab ? "page" : undefined}
							className={cn(
								"flex min-h-8 items-center gap-1.5 rounded-(--radius-input) px-2.5 text-sm whitespace-nowrap transition-colors duration-(--dur-micro)",
								item.id === tab ? "bg-sunken font-medium text-ink" : "text-muted hover:bg-well hover:text-ink",
							)}
						>
							{item.label}
							<span className="num text-muted">{(counts[item.id] ?? 0).toLocaleString()}</span>
						</Link>
					))}
				</nav>
				<SearchForm siteId={site.id} view="urls" tab={tab} q={q} label="Search URLs" />
			</div>

			{urlRows.length === 0 ? (
				<EmptyState
					className="m-5"
					title={pastEnd ? "No URLs on this page" : filteredView ? "No matching URLs" : "No URLs yet"}
					description={
						pastEnd ? (
							<Link href={hrefFor({ page: 1 })} className={textLink}>
								Go to the first page
							</Link>
						) : filteredView ? (
							"Try another filter or search term."
						) : (
							<>
								Pages appear here once a sitemap is read.{" "}
								<Link href={siteHref(site.id, { view: "sitemaps" })} className={textLink}>
									Add a sitemap to import your pages
								</Link>
							</>
						)
					}
				/>
			) : (
				<Table caption="Tracked URLs">
					<thead>
						<tr>
							<Th className="w-full pl-5">URL</Th>
							<Th className="hidden md:table-cell">Found</Th>
							<Th>Last submission</Th>
							{showGoogle ? <Th>Google</Th> : null}
							{!paused ? (
								<Th className="pr-5">
									<span className="visually-hidden">Actions</span>
								</Th>
							) : null}
						</tr>
					</thead>
					<tbody>
						{urlRows.map((row) => (
							<tr key={row.id}>
								<Td className="max-w-0 min-w-48 pl-5">
									<a href={row.loc} target="_blank" rel="noreferrer" className="block truncate font-mono text-sm hover:text-signal hover:underline" title={row.loc}>
										{pathOf(row.loc, host)}
									</a>
								</Td>
								<Td className="hidden whitespace-nowrap text-muted md:table-cell">{timeAgo(row.createdAt)}</Td>
								<Td>
									<UrlStatus row={row} />
								</Td>
								{showGoogle ? (
									<Td className="min-w-40">
										<GoogleStatus row={row} />
									</Td>
								) : null}
								{!paused ? (
									<Td className="pr-5">
										<span className="flex items-center justify-end gap-1">
											{site.verified ? (
												<ActionButton action={resubmitUrlAction.bind(null, site.id, row.loc)} variant="ghost" pendingLabel="Sending...">
													Submit
												</ActionButton>
											) : null}
											<ActionButton action={checkUrlAction.bind(null, site.id, row.id)} variant="ghost" pendingLabel="Checking...">
												Check
											</ActionButton>
											{canInspect ? (
												<ActionButton action={inspectUrlAction.bind(null, site.id, row.id)} variant="ghost" pendingLabel="Inspecting...">
													Inspect
												</ActionButton>
											) : null}
										</span>
									</Td>
								) : null}
							</tr>
						))}
					</tbody>
				</Table>
			)}
			<Pager pageNumber={pageNumber} totalPages={totalPages} total={filtered} unit="URLs" hrefFor={(page) => hrefFor({ page })} />
		</Panel>
	);
}

function UrlStatus({ row }: { row: UrlRow }) {
	if (row.indexingStatus === "blockers") return <Status tone="danger">Blocked</Status>;
	if (row.lastSubmissionStatus === "success") {
		return (
			<span className="flex flex-col">
				<Status tone="success">Sent {timeAgo(row.lastSubmittedAt)}</Status>
				{row.lastSubmittedEngine ? <span className="text-sm text-muted">{engineName(row.lastSubmittedEngine)}</span> : null}
			</span>
		);
	}
	if (row.lastSubmissionStatus === "failed") return <Status tone="danger">Failed</Status>;
	return <Status>Not sent yet</Status>;
}

/**
 * Google's own coverage text, verbatim, so the user sees exactly what Search Console said. No
 * "checked" time: lastCheckedAt is also written by our diagnostics, so it would date the wrong check.
 */
function GoogleStatus({ row }: { row: UrlRow }) {
	if (!row.gscStatus || row.gscStatus === "unknown") return <span className="text-sm text-muted">Not inspected</span>;
	return (
		<Status tone={googleTone(row.gscStatus)} className="whitespace-normal">
			{row.gscStatus}
		</Status>
	);
}
