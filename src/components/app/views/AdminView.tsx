/**
 * Admin panel (Operate). Read top to bottom in the order an operator triages: money and users,
 * then pipeline totals, then what is broken right now (cron, engines, sitemaps), then trends,
 * live activity, traffic, payments and the user directory. Every figure is computed in
 * db/admin-queries.ts; the range runs from UTC midnight so totals match the daily bars.
 * Access is restricted to verified ADMIN_EMAILS by the admin layout and page.
 */
import Link from "next/link";
import { CronRunsPanel } from "@/app/admin/_components/CronRunsPanel";
import { EngineHealthPanel } from "@/app/admin/_components/EngineHealthPanel";
import { GrantPlanPanel } from "@/app/admin/_components/GrantPlanPanel";
import { TrafficPanel } from "@/app/admin/_components/TrafficPanel";
import { formatCount, formatUsd, percent, statusTone } from "@/app/admin/_components/format";
import { BarChart } from "@/components/app/BarChart";
import { formatDate, formatMoney, statusLabel, timeAgo } from "@/components/app/ui";
import { Badge, EmptyState, Panel, Stat, Status, Table, Td, Th, cn } from "@/components/ui";
import { ENGINE_LABELS, type AdminOverview } from "@/db/admin-queries";
import { PLANS, normalizeBillingTier, resolveEntitlement } from "@/lib/platform/plans";

export const RANGES = [7, 30, 90];

export function AdminView({ data }: { data: AdminOverview }) {
	const { rangeDays } = data;
	const acceptedRange = percent(data.submissions.successRange, data.submissions.totalRange);
	const planMix =
		Object.entries(data.users.planMix)
			.map(([tier, count]) => `${PLANS[normalizeBillingTier(tier)].name} ${formatCount(count)}`)
			.join(", ") || "No paying customers";
	const { granted, inGrace, lapsedLegacy } = data.users;
	const unpaidAccess =
		[
			granted ? `${formatCount(granted)} on admin grants` : null,
			inGrace ? `${formatCount(inGrace)} paid, in grace` : null,
			lapsedLegacy ? `${formatCount(lapsedLegacy)} legacy without a subscription` : null,
		]
			.filter(Boolean)
			.join(", ") || "No unpaid access";

	return (
		<div className="flex min-w-0 flex-col gap-10">
			<header className="flex flex-wrap items-end justify-between gap-4">
				<div className="min-w-0">
					<h1 className="font-display text-2xl font-semibold tracking-display">Admin</h1>
					<p className="mt-1 text-sm text-muted">
						Platform-wide, from <span className="num">{data.rangeStart}</span> (UTC) to now.
					</p>
				</div>
				<nav aria-label="Date range" className="ui-cut ui-cut-sm inline-flex max-w-full gap-1 self-start overflow-x-auto border-transparent bg-sunken p-1">
					{RANGES.map((days) => (
						<Link
							key={days}
							href={`/admin?range=${days}`}
							aria-current={days === rangeDays ? "page" : undefined}
							className={cn("ui-key ui-key--sm", days !== rangeDays && "ui-key--ghost")}
						>
							{days} days
						</Link>
					))}
				</nav>
			</header>

			<section aria-labelledby="admin-business" className="flex flex-col gap-4">
				<h2 id="admin-business" className="font-display text-lg font-semibold">
					Business
				</h2>
				<div className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
					<Stat label="MRR at list price" value={formatUsd(data.mrrUsd)} hint={planMix} />
					<Stat
						label="Paying customers"
						value={formatCount(data.users.paying)}
						hint={unpaidAccess}
					/>
					<Stat
						className="col-span-2 lg:col-span-1"
						label={`Revenue, ${rangeDays} days`}
						value={data.revenue.length ? data.revenue.map((row) => formatMoney(row.range, row.currency)).join(" + ") : formatUsd(0)}
						hint={data.revenue.length ? `All time ${data.revenue.map((row) => formatMoney(row.total, row.currency)).join(" + ")}` : "No paid orders yet"}
					/>
					<Stat
						label="Users"
						value={formatCount(data.users.total)}
						hint={`${formatCount(data.users.newRange)} new, ${formatCount(data.users.activeToday)} active today`}
					/>
				</div>
			</section>

			<section aria-labelledby="admin-pipeline" className="flex flex-col gap-4">
				<h2 id="admin-pipeline" className="font-display text-lg font-semibold">
					Pipeline
				</h2>
				<div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-3 lg:grid-cols-5">
					<Stat label="Websites" value={formatCount(data.sites.total)} hint={`${formatCount(data.sites.live)} live, ${formatCount(data.sites.verified)} verified`} />
					<Stat label="URLs tracked" value={formatCount(data.urls.total)} hint={`${formatCount(data.urls.pending)} never submitted`} />
					<Stat
						label={`Submissions, ${rangeDays} days`}
						value={formatCount(data.submissions.totalRange)}
						hint={acceptedRange === null ? "None yet" : `${acceptedRange}% accepted`}
					/>
					<Stat
						label="Queue backlog"
						value={formatCount(data.queue.queued)}
						hint={`${formatCount(data.queue.processing)} processing, ${formatCount(data.queue.failed7d)} failed in 7 days`}
					/>
					<Stat label={`API and MCP calls, ${rangeDays} days`} value={formatCount(data.apiCallsRange)} hint="Authenticated requests" />
				</div>
			</section>

			<section aria-labelledby="admin-health" className="flex flex-col gap-4">
				<h2 id="admin-health" className="font-display text-lg font-semibold">
					Health
				</h2>
				<CronRunsPanel runs={data.recentCron} overdue={data.cronOverdue} />
				<EngineHealthPanel engines={data.engines} errors={data.engineErrors} rangeDays={rangeDays} />
				<FailingSitemaps rows={data.failingSitemaps} />
			</section>

			<section aria-labelledby="admin-trends" className="flex flex-col gap-4">
				<h2 id="admin-trends" className="font-display text-lg font-semibold">
					Daily trends
				</h2>
				<div className="grid gap-4 lg:grid-cols-3">
					<Panel title="Signups" description={`${formatCount(data.users.newRange)} new accounts`}>
						<BarChart data={data.dailySignups} valueLabel="signups" />
					</Panel>
					<Panel title="Page views" description={`${formatCount(data.traffic.totals?.views ?? 0)} views, ${formatCount(data.traffic.totals?.visitors ?? 0)} visitors`}>
						<BarChart data={data.traffic.daily.map((row) => ({ day: row.day, value: row.views }))} valueLabel="views" />
					</Panel>
					<Panel title="URL submissions" description={`${formatCount(data.submissions.totalRange)} sent to engines`}>
						<BarChart data={data.dailySubmissions} valueLabel="submissions" />
					</Panel>
				</div>
			</section>

			<section aria-labelledby="admin-activity" className="flex flex-col gap-4">
				<h2 id="admin-activity" className="font-display text-lg font-semibold">
					Activity
				</h2>
				<div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
					<RecentSubmissions rows={data.recentSubmissions} />
					<ApiRoutes rows={data.apiUsageByRoute} rangeDays={rangeDays} />
				</div>
				<TrafficPanel traffic={data.traffic} rangeDays={rangeDays} />
			</section>

			<section aria-labelledby="admin-accounts" className="flex flex-col gap-4">
				<h2 id="admin-accounts" className="font-display text-lg font-semibold">
					Accounts
				</h2>
				<div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
					<RecentPayments rows={data.recentPayments} />
					<GrantPlanPanel />
				</div>
				<UserDirectory rows={data.topUsers} total={data.users.total} />
			</section>
		</div>
	);
}

function FailingSitemaps({ rows }: { rows: AdminOverview["failingSitemaps"] }) {
	return (
		<Panel
			title="Failing sitemaps"
			description="Sources whose last sync hit an HTTP, host or XML error."
			action={rows.length ? <Status tone="danger">{`${formatCount(rows.length)} failing`}</Status> : <Status tone="success">All syncing</Status>}
			padded={false}
		>
			{rows.length === 0 ? (
				<p className="px-5 py-4 text-sm text-muted">Every active sitemap source synced on its last attempt.</p>
			) : (
				<Table caption="Failing sitemaps">
					<thead>
						<tr>
							<Th className="pl-5">Sitemap</Th>
							<Th>Owner</Th>
							<Th>Error</Th>
							<Th className="pr-5 text-right">Last error</Th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr key={row.url}>
								<Td className="max-w-80 pl-5">
									<span className="block truncate font-mono text-sm" title={row.url}>
										{row.url}
									</span>
								</Td>
								<Td className="max-w-56 truncate text-muted">{row.email}</Td>
								<Td className="max-w-96 text-danger">{row.error ?? "Unknown error"}</Td>
								<Td className="pr-5 text-right whitespace-nowrap text-muted">{timeAgo(row.at)}</Td>
							</tr>
						))}
					</tbody>
				</Table>
			)}
		</Panel>
	);
}

function RecentSubmissions({ rows }: { rows: AdminOverview["recentSubmissions"] }) {
	return (
		<Panel title="Latest submissions" description="The last 15 sends across every site, with each engine's answer." padded={false}>
			{rows.length === 0 ? (
				<EmptyState className="m-5" title="Nothing sent yet" description="Submissions appear once a verified site has URLs in the queue." />
			) : (
				<Table caption="Latest submissions">
					<thead>
						<tr>
							<Th className="pl-5">URL</Th>
							<Th>Engine</Th>
							<Th>Status</Th>
							<Th>Engine answer</Th>
							<Th className="pr-5 text-right">Sent</Th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr key={row.id}>
								<Td className="max-w-72 pl-5">
									<span className="block truncate font-mono text-sm" title={row.loc}>
										{row.loc}
									</span>
									<span className="text-sm text-muted">
										{row.domain}
										{row.attempt > 1 ? `, attempt ${row.attempt}` : ""}
									</span>
								</Td>
								<Td>
									<Badge>{ENGINE_LABELS[row.engine] ?? row.engine}</Badge>
								</Td>
								<Td>
									<Status tone={statusTone(row.status)}>{statusLabel(row.status)}</Status>
								</Td>
								<Td className="max-w-64">
									<span className="line-clamp-2 text-sm text-muted" title={row.responseMessage ?? undefined}>
										{row.responseMessage || "No message"}
									</span>
								</Td>
								<Td className="pr-5 text-right whitespace-nowrap text-muted">{timeAgo(row.createdAt)}</Td>
							</tr>
						))}
					</tbody>
				</Table>
			)}
		</Panel>
	);
}

function ApiRoutes({ rows, rangeDays }: { rows: AdminOverview["apiUsageByRoute"]; rangeDays: number }) {
	return (
		<Panel title="Top API and MCP routes" description={`Most called in the last ${rangeDays} days.`} padded={false}>
			{rows.length === 0 ? (
				<EmptyState className="m-5" title="No API calls in range" description="Calls made with an idxf_ key over REST or MCP are counted here." />
			) : (
				<Table caption="Top API and MCP routes">
					<thead>
						<tr>
							<Th className="pl-5">Route</Th>
							<Th numeric className="pr-5">
								Calls
							</Th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr key={`${row.method}-${row.route}`}>
								<Td className="max-w-64 pl-5">
									<span className="flex min-w-0 items-center gap-2">
										<Badge>{row.method}</Badge>
										<span className="truncate font-mono text-sm" title={row.route}>
											{row.route}
										</span>
									</span>
								</Td>
								<Td numeric className="pr-5">
									{formatCount(row.count)}
								</Td>
							</tr>
						))}
					</tbody>
				</Table>
			)}
		</Panel>
	);
}

function RecentPayments({ rows }: { rows: AdminOverview["recentPayments"] }) {
	return (
		<Panel title="Payments" description="Latest Razorpay orders that reached a final state." padded={false}>
			{rows.length === 0 ? (
				<EmptyState className="m-5" title="No payments yet" description="Paid, failed and refunded orders appear here after the Razorpay webhook or checkout verify." />
			) : (
				<Table caption="Payments">
					<thead>
						<tr>
							<Th className="pl-5">Customer</Th>
							<Th>Plan</Th>
							<Th>Status</Th>
							<Th numeric>Amount</Th>
							<Th>Period ends</Th>
							<Th className="pr-5 text-right">Created</Th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr key={row.id}>
								<Td className="max-w-56 truncate pl-5 font-medium">{row.email}</Td>
								<Td>
									<Badge>{PLANS[normalizeBillingTier(row.plan)].name}</Badge>
								</Td>
								<Td>
									<Status tone={statusTone(row.status)}>{statusLabel(row.status)}</Status>
								</Td>
								<Td numeric>{formatMoney(row.amount, row.currency)}</Td>
								<Td className="whitespace-nowrap text-muted">{row.status === "paid" ? formatDate(row.periodEnd) : ""}</Td>
								<Td className="pr-5 text-right whitespace-nowrap text-muted">{timeAgo(row.createdAt)}</Td>
							</tr>
						))}
					</tbody>
				</Table>
			)}
		</Panel>
	);
}

function UserDirectory({ rows, total }: { rows: AdminOverview["topUsers"]; total: number }) {
	return (
		<Panel title="Users" description={`The ${formatCount(rows.length)} newest of ${formatCount(total)} accounts.`} padded={false}>
			{rows.length === 0 ? (
				<EmptyState className="m-5" title="No accounts yet" description="Users appear after their first sign-in." />
			) : (
				<Table caption="Users">
					<thead>
						<tr>
							<Th className="pl-5">Email</Th>
							<Th>Plan</Th>
							<Th>Expires</Th>
							<Th numeric>Sites</Th>
							<Th numeric>URLs</Th>
							<Th>Joined</Th>
							<Th className="pr-5 text-right">Last seen</Th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => {
							const entitlement = resolveEntitlement(row);
							return (
								<tr key={row.id}>
									<Td className="max-w-64 truncate pl-5 font-medium">{row.email || row.id}</Td>
									<Td>
										<Badge>{entitlement.plan.name}</Badge>
									</Td>
									<Td className="whitespace-nowrap">
										{entitlement.status === "grace" ? (
											<Status tone="warning">{`Grace, ended ${formatDate(entitlement.expiresAt)}`}</Status>
										) : entitlement.expiresAt ? (
											<span className="text-muted">{formatDate(entitlement.expiresAt)}</span>
										) : (
											<span className="text-muted">{entitlement.tier === "free" ? "" : "No expiry"}</span>
										)}
									</Td>
									<Td numeric>{formatCount(row.siteCount)}</Td>
									<Td numeric>{formatCount(row.urlCount)}</Td>
									<Td className="whitespace-nowrap text-muted">{formatDate(row.createdAt)}</Td>
									<Td className="pr-5 text-right whitespace-nowrap text-muted">{timeAgo(row.lastSeenAt)}</Td>
								</tr>
							);
						})}
					</tbody>
				</Table>
			)}
		</Panel>
	);
}
