/**
 * First-party traffic breakdown (pages, referrers, countries, devices) in one panel split by
 * hairlines rather than four boxes. Each row's well-tinted bar is its share of the top row.
 */
import { Panel } from "@/components/ui";
import type { AdminOverview } from "@/db/admin-queries";
import { formatCount } from "./format";

type Rows = Array<{ label: string; views: number }>;

export function TrafficPanel({ traffic, rangeDays }: { traffic: AdminOverview["traffic"]; rangeDays: number }) {
	const lists: Array<{ title: string; rows: Rows; empty: string; mono: boolean }> = [
		{ title: "Top pages", rows: traffic.topPages, empty: "No page views yet", mono: true },
		{ title: "Referrers", rows: traffic.topReferrers, empty: "No external referrers yet", mono: true },
		{ title: "Countries", rows: traffic.countries, empty: "No country data yet", mono: false },
		{ title: "Devices", rows: traffic.devices, empty: "No device data yet", mono: false },
	];
	return (
		<Panel title="Traffic sources" description={`Cookie-less page views on the public site, last ${rangeDays} days.`} padded={false}>
			<div className="grid sm:grid-cols-2 xl:grid-cols-4">
				{lists.map((list) => (
					<RankList key={list.title} {...list} />
				))}
			</div>
		</Panel>
	);
}

function RankList({ title, rows, empty, mono }: { title: string; rows: Rows; empty: string; mono: boolean }) {
	const max = Math.max(1, ...rows.map((row) => row.views));
	return (
		<section className="flex min-w-0 flex-col gap-2 border-b border-border p-5 sm:border-r xl:border-b-0">
			<h3 className="font-display text-md font-medium">{title}</h3>
			{rows.length === 0 ? (
				<p className="text-sm text-muted">{empty}</p>
			) : (
				<ul className="flex flex-col gap-0.5">
					{rows.map((row) => (
						<li key={row.label} className="relative overflow-hidden rounded-(--radius-input) px-2 py-1">
							<span className="absolute inset-y-0 left-0 bg-well" style={{ width: `${(row.views / max) * 100}%` }} aria-hidden />
							<span className="relative flex justify-between gap-3 text-sm">
								<span className={`truncate text-ink ${mono ? "font-mono" : ""}`} title={row.label}>
									{row.label}
								</span>
								<span className="num text-muted">{formatCount(row.views)}</span>
							</span>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
