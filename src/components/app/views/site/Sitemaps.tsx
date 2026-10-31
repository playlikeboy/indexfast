/**
 * Sitemaps section: the sources we re-read on the plan's schedule, their last sync result, and
 * the controls to add, auto-detect, remove, and (when Search Console is matched to a property)
 * hand the same sitemaps to Google. Removing a source keeps the URLs already imported.
 */
import { addSitemapAction, discoverSitemapsAction, removeSitemapAction, submitSitemapsToGscAction } from "@/app/actions";
import { ActionButton, ActionForm } from "@/components/app/client";
import { timeAgo } from "@/components/app/ui";
import { Badge, EmptyState, Input, Panel, Status, Table, Td, Th } from "@/components/ui";
import type { SitePageData } from "@/db/app-queries";
import { getSiteHost } from "@/lib/url-utils";
import { pathOf } from "./shared";

export function SitemapsSection({ data }: { data: SitePageData }) {
	const { site, sources, engines, paused } = data;
	const host = getSiteHost(site);
	const gsc = engines.find((engine) => engine.engine === "google_search_console");
	const gscDetails = (gsc?.details ?? {}) as { property?: string | null; lastSitemapSubmitAt?: string | null };
	const canSendToGoogle = Boolean(gsc?.enabled && gscDetails.property) && sources.length > 0 && !paused;

	return (
		<Panel
			title="Sitemaps"
			description={
				canSendToGoogle && gscDetails.lastSitemapSubmitAt
					? `We re-read these on a schedule and queue new or updated pages. Last sent to Search Console ${timeAgo(gscDetails.lastSitemapSubmitAt)}.`
					: "We re-read these on a schedule and queue new or updated pages."
			}
			padded={false}
			action={
				<>
					{canSendToGoogle ? (
						<ActionButton action={submitSitemapsToGscAction.bind(null, site.id)} variant="ghost" pendingLabel="Sending...">
							Send to Search Console
						</ActionButton>
					) : null}
					<ActionButton action={discoverSitemapsAction.bind(null, site.id)} variant="secondary" pendingLabel="Searching...">
						Auto-detect
					</ActionButton>
				</>
			}
		>
			{sources.length === 0 ? (
				<EmptyState className="m-5" title="No sitemap yet" description="Without a sitemap we cannot find new pages. Add its URL below, or use Auto-detect to look in robots.txt and the usual locations." />
			) : (
				<Table caption="Sitemap sources">
					<thead>
						<tr>
							<Th className="w-full pl-5">Sitemap</Th>
							<Th>State</Th>
							<Th className="pr-5">
								<span className="visually-hidden">Actions</span>
							</Th>
						</tr>
					</thead>
					<tbody>
						{sources.map((source) => (
							<tr key={source.id}>
								<Td className="max-w-0 min-w-48 pl-5">
									<span className="flex min-w-0 items-center gap-2">
										<a href={source.url} target="_blank" rel="noreferrer" className="truncate font-mono text-sm hover:text-signal hover:underline" title={source.url}>
											{pathOf(source.url, host)}
										</a>
										{source.isPrimary ? <Badge>Primary</Badge> : null}
									</span>
									{source.status === "failed" && source.lastErrorMessage ? (
										<span className="mt-0.5 block text-sm break-words text-danger">{source.lastErrorMessage.replace(source.url, "").replace(/^[:\s]+/, "")}</span>
									) : null}
								</Td>
								<Td>
									{source.status === "failed" ? (
										<Status tone="danger">Failing</Status>
									) : source.lastSyncAt ? (
										<Status tone="success">Checked {timeAgo(source.lastSyncAt)}</Status>
									) : (
										<Status>Not checked yet</Status>
									)}
								</Td>
								<Td className="pr-5 text-right">
									<ActionButton action={removeSitemapAction.bind(null, site.id, source.id)} variant="ghost" confirm="Remove this sitemap? URLs already imported are kept." showResult={false}>
										Remove
									</ActionButton>
								</Td>
							</tr>
						))}
					</tbody>
				</Table>
			)}
			<div className="border-t border-border p-5">
				<ActionForm action={addSitemapAction.bind(null, site.id)} submitLabel="Add sitemap" variant="secondary" inline>
					<Input name="sitemapUrl" required spellCheck={false} placeholder={`https://${host}/sitemap.xml`} className="min-w-0 flex-1 font-mono text-sm" aria-label="Sitemap URL" />
				</ActionForm>
			</div>
		</Panel>
	);
}
