/**
 * Admin panel: business (users, revenue, MRR), daily user signup graphs, traffic analytics,
 * search engine telemetry, queue health, live submission activity, cron logs, and user management.
 * Access restricted exclusively to authorized administrators.
 */
import Link from "next/link";
import { adminGrantPlanAction } from "@/app/actions";
import { BarChart } from "@/components/app/BarChart";
import { ActionForm } from "@/components/app/client";
import {
	Badge,
	Card,
	EmptyState,
	PageHeader,
	Stat,
	cn,
	formatDate,
	formatMoney,
	inputClass,
	statusLabel,
	timeAgo,
} from "@/components/app/ui";
import type { AdminOverview } from "@/db/admin-queries";
import { PLANS, resolveEntitlement } from "@/lib/platform/plans";

export const RANGES = [7, 30, 90];

export function AdminView({ data }: { data: AdminOverview }) {
	const { rangeDays } = data;

	const successRate7d = data.submissions.total7d
		? Math.round((data.submissions.success7d / data.submissions.total7d) * 100)
		: null;
	const successRateRange = data.submissions.totalRange
		? Math.round((data.submissions.successRange / data.submissions.totalRange) * 100)
		: null;
	const lastCron = data.recentCron[0];

	// Engine stats breakdown
	const indexNowSent = data.submissionsByEngine
		.filter((e) => e.engine === "indexnow")
		.reduce((sum, e) => sum + e.count, 0);
	const indexNowSuccess = data.submissionsByEngine
		.filter((e) => e.engine === "indexnow" && e.status === "success")
		.reduce((sum, e) => sum + e.count, 0);

	const bingSent = data.submissionsByEngine
		.filter((e) => e.engine === "bing")
		.reduce((sum, e) => sum + e.count, 0);
	const bingSuccess = data.submissionsByEngine
		.filter((e) => e.engine === "bing" && e.status === "success")
		.reduce((sum, e) => sum + e.count, 0);

	const indexNowQueued = data.queueByEngine
		.filter((q) => q.engine === "indexnow" && q.status === "queued")
		.reduce((sum, q) => sum + q.count, 0);
	const bingQueued = data.queueByEngine
		.filter((q) => q.engine === "bing" && q.status === "queued")
		.reduce((sum, q) => sum + q.count, 0);

	return (
		<>
			<PageHeader
				title="Admin Operations"
				description="Executive metrics, daily user signups, search engine telemetry, queue health, and real-time platform audits."
				action={
					<div className="flex rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] p-0.5">
						{RANGES.map((days) => (
							<Link
								key={days}
								href={`/admin?range=${days}`}
								className={cn(
									"rounded-md px-3 py-1 text-sm transition",
									days === rangeDays ? "bg-[var(--app-subtle)] font-medium text-[var(--app-text)]" : "text-[var(--app-muted)] hover:text-[var(--app-text)]",
								)}
							>
								{days}d
							</Link>
						))}
					</div>
				}
			/>

			{/* 1. Executive Business & Platform Summary */}
			<h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--app-muted)]">Executive Overview</h2>
			<div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
				<Stat label="MRR (List)" value={`$${data.mrrUsd.toLocaleString()}`} hint={`${data.users.paying} paying`} />
				<Stat
					label={`Revenue (${rangeDays}d)`}
					value={data.revenue.length ? data.revenue.map((r) => formatMoney(r.range, r.currency)).join(" + ") : "$0.00"}
					hint={data.revenue.length ? `All time ${data.revenue.map((r) => formatMoney(r.total, r.currency)).join(" + ")}` : undefined}
				/>
				<Stat
					label="Total Users"
					value={data.users.total.toLocaleString()}
					hint={`+${data.users.newRange} in ${rangeDays}d · ${data.users.activeToday} active today`}
				/>
				<Stat
					label="Plan Mix"
					value={data.users.paying.toLocaleString()}
					hint={
						Object.entries(data.users.planMix)
							.map(([tier, count]) => `${PLANS[tier as keyof typeof PLANS]?.name ?? tier}: ${count}`)
							.join(" · ") || "No paid plans"
					}
				/>
				<Stat
					label="Websites"
					value={data.sites.total.toLocaleString()}
					hint={`${data.sites.live} live · ${data.sites.verified} verified · ${data.sites.bingConnected} Bing`}
				/>
				<Stat
					label="URLs Tracked"
					value={data.urls.total.toLocaleString()}
					hint={`+${data.urls.new7d.toLocaleString()} 7d · ${data.urls.pending.toLocaleString()} pending`}
				/>
				<Stat
					label={`Submissions (${rangeDays}d)`}
					value={data.submissions.totalRange.toLocaleString()}
					hint={
						successRateRange === null
							? successRate7d !== null
								? `${successRate7d}% (7d)`
								: "None yet"
							: `${successRateRange}% success (${data.submissions.successRange.toLocaleString()} ok)`
					}
				/>
				<Stat
					label="Queue Backlog"
					value={data.queue.queued.toLocaleString()}
					hint={`${data.queue.processing} active · ${data.queue.failed7d} failed (7d)`}
				/>
				<Stat
					label={`API / MCP (${rangeDays}d)`}
					value={data.apiCalls7d.toLocaleString()}
					hint="Calls in 7d"
				/>
			</div>

			{/* 2. Daily User & Traffic Telemetry (Graphs) */}
			<h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--app-muted)]">Activity &amp; Growth Graphs</h2>
			<div className="mb-6 grid gap-6 lg:grid-cols-3">
				{/* Daily User Signups Graph */}
				<Card
					title="Daily User Signups"
					description={`+${data.users.newRange} registered in the last ${rangeDays} days · ${data.users.active7d} active in 7 days`}
				>
					<div className="p-5">
						<BarChart data={data.dailySignups} valueLabel="new users" color="var(--chart-2)" />
					</div>
				</Card>

				{/* Daily Page Views Graph */}
				<Card
					title="Page Views &amp; Traffic"
					description={`${data.traffic.totals.views.toLocaleString()} views · ${data.traffic.totals.visitors.toLocaleString()} unique visitors`}
				>
					<div className="p-5">
						<BarChart data={data.traffic.daily.map((row) => ({ day: row.day, value: row.views }))} valueLabel="views" color="var(--chart-1)" />
					</div>
				</Card>

				{/* Daily Submissions Activity Graph */}
				<Card
					title="Daily URL Submissions"
					description={`${data.submissions.totalRange.toLocaleString()} URLs pushed to discovery pipelines (${rangeDays}d)`}
				>
					<div className="p-5">
						<BarChart data={data.dailySubmissions} valueLabel="submitted URLs" color="var(--chart-3)" />
					</div>
				</Card>
			</div>

			{/* 3. Search Engine Telemetry & Queue Architecture */}
			<h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--app-muted)]">Search Engine Telemetry &amp; Queue Status</h2>
			<div className="mb-6 grid gap-4 md:grid-cols-3">
				<Card title="IndexNow Protocol" description="Bing, Yandex, Naver, Seznam, Yep">
					<div className="space-y-3 p-5 text-sm">
						<div className="flex justify-between border-b border-[var(--app-border)] pb-2">
							<span className="text-[var(--app-muted)]">Submissions ({rangeDays}d):</span>
							<span className="font-semibold tabular-nums">{indexNowSent.toLocaleString()}</span>
						</div>
						<div className="flex justify-between border-b border-[var(--app-border)] pb-2">
							<span className="text-[var(--app-muted)]">Success Rate:</span>
							<span className="font-semibold tabular-nums text-[var(--app-ok)]">
								{indexNowSent > 0 ? `${Math.round((indexNowSuccess / indexNowSent) * 100)}%` : "N/A"}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="text-[var(--app-muted)]">Active Queue Backlog:</span>
							<span className="font-mono text-xs font-semibold tabular-nums">{indexNowQueued.toLocaleString()} jobs</span>
						</div>
					</div>
				</Card>

				<Card title="Bing Webmaster API" description="Direct Webmaster Console API submissions">
					<div className="space-y-3 p-5 text-sm">
						<div className="flex justify-between border-b border-[var(--app-border)] pb-2">
							<span className="text-[var(--app-muted)]">Submissions ({rangeDays}d):</span>
							<span className="font-semibold tabular-nums">{bingSent.toLocaleString()}</span>
						</div>
						<div className="flex justify-between border-b border-[var(--app-border)] pb-2">
							<span className="text-[var(--app-muted)]">Success Rate:</span>
							<span className="font-semibold tabular-nums text-[var(--app-ok)]">
								{bingSent > 0 ? `${Math.round((bingSuccess / bingSent) * 100)}%` : "N/A"}
							</span>
						</div>
						<div className="flex justify-between border-b border-[var(--app-border)] pb-2">
							<span className="text-[var(--app-muted)]">Active Queue Backlog:</span>
							<span className="font-mono text-xs font-semibold tabular-nums">{bingQueued.toLocaleString()} jobs</span>
						</div>
						<div className="flex justify-between">
							<span className="text-[var(--app-muted)]">Verified Bing Keys:</span>
							<span className="font-semibold tabular-nums">{data.bingIntegrations.verified} verified ({data.bingIntegrations.total} total)</span>
						</div>
					</div>
				</Card>

				<Card title="API &amp; MCP Invocations" description={`Top developer endpoints used in ${rangeDays}d`}>
					{data.apiUsageByRoute.length === 0 ? (
						<EmptyState title="No API calls recorded in range" />
					) : (
						<ul className="divide-y divide-[var(--app-border)] p-2 text-xs">
							{data.apiUsageByRoute.map((row) => (
								<li key={`${row.method}-${row.route}`} className="flex items-center justify-between px-3 py-1.5 font-mono">
									<div className="flex items-center gap-2 truncate">
										<Badge tone="neutral">{row.method}</Badge>
										<span className="truncate text-[var(--app-text)]">{row.route}</span>
									</div>
									<span className="ml-2 tabular-nums text-[var(--app-muted)]">{row.count.toLocaleString()}</span>
								</li>
							))}
						</ul>
					)}
				</Card>
			</div>

			{/* 4. Live Platform Submissions Feed */}
			<div className="mb-6">
				<Card title="Live Submissions Stream" description="Latest URL discovery payloads dispatched across search engines.">
					{data.recentSubmissions.length === 0 ? (
						<EmptyState title="No submissions dispatched yet" />
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-left text-xs">
								<thead className="border-b border-[var(--app-border)] bg-[var(--app-subtle)] text-[var(--app-muted)]">
									<tr>
										<th className="px-5 py-2 font-medium">Domain</th>
										<th className="px-5 py-2 font-medium">Engine</th>
										<th className="px-5 py-2 font-medium">Status</th>
										<th className="px-5 py-2 font-medium">Attempt</th>
										<th className="px-5 py-2 font-medium">Response Message</th>
										<th className="px-5 py-2 font-medium text-right">Dispatched</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-[var(--app-border)] font-mono">
									{data.recentSubmissions.map((sub) => (
										<tr key={sub.id} className="hover:bg-[var(--app-subtle)]/50">
											<td className="px-5 py-2 font-semibold text-[var(--app-text)]">{sub.domain}</td>
											<td className="px-5 py-2">
												<Badge tone="neutral">{sub.engine}</Badge>
											</td>
											<td className="px-5 py-2">
												<Badge tone={sub.status === "success" ? "ok" : sub.status === "failed" ? "bad" : "warn"}>
													{sub.status}
												</Badge>
											</td>
											<td className="px-5 py-2 text-[var(--app-muted)]">#{sub.attempt}</td>
											<td className="max-w-xs truncate px-5 py-2 text-[var(--app-muted)]" title={sub.responseMessage ?? undefined}>
												{sub.responseMessage || "—"}
											</td>
											<td className="px-5 py-2 text-right text-[var(--app-muted)]">{timeAgo(sub.createdAt)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</Card>
			</div>

			{/* 5. Audience & Traffic Breakdown */}
			<h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--app-muted)]">Visitor Demographics &amp; Traffic</h2>
			<div className="mb-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
				<RankList title="Top Pages" rows={data.traffic.topPages} />
				<RankList title="Top Referrers" rows={data.traffic.topReferrers} empty="No external referrers yet" />
				<RankList title="Geographic Distribution" rows={data.traffic.countries} />
				<RankList title="Device Types" rows={data.traffic.devices} />
			</div>

			{/* 6. Automation Worker Health & Reliability */}
			<h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--app-muted)]">Automation &amp; Cron Health</h2>
			<div className="mb-6 grid gap-6 lg:grid-cols-2">
				<Card
					title="Cron Runs (Hourly Automation)"
					description={lastCron ? `Last triggered ${timeAgo(lastCron.startedAt)}` : "No runs recorded yet"}
					action={lastCron ? <Badge tone={lastCron.status === "success" ? "ok" : lastCron.status === "failed" ? "bad" : "warn"}>{statusLabel(lastCron.status)}</Badge> : null}
				>
					{data.recentCron.length === 0 ? (
						<EmptyState title="Waiting for the first hourly run" />
					) : (
						<ul className="divide-y divide-[var(--app-border)] text-sm">
							{data.recentCron.map((run) => {
								const summary = (run.summary ?? {}) as {
									sitesSynced?: number;
									newUrls?: number;
									downgraded?: number;
									durationMs?: number;
									queue?: { successCount?: number; failedCount?: number };
								};
								return (
									<li key={run.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
										<Badge tone={run.status === "success" ? "ok" : run.status === "failed" ? "bad" : "warn"}>{statusLabel(run.status)}</Badge>
										<span className="font-mono text-xs text-[var(--app-muted)]">{timeAgo(run.startedAt)}</span>
										<span className="min-w-0 flex-1 truncate text-xs text-[var(--app-muted)]" title={run.errorMessage ?? undefined}>
											{run.errorMessage ??
												`${summary.sitesSynced ?? 0} sites synced · ${summary.newUrls ?? 0} new URLs · ${summary.queue?.successCount ?? 0} sent · ${summary.queue?.failedCount ?? 0} failed · ${summary.downgraded ?? 0} expired · ${Math.round((summary.durationMs ?? 0) / 1000)}s`}
										</span>
									</li>
								);
							})}
						</ul>
					)}
				</Card>

				<Card title="Failing Sitemaps" description="Sitemaps encountering HTTP or parsing blockers.">
					{data.failingSitemaps.length === 0 ? (
						<EmptyState title="All sitemaps healthy and syncing" />
					) : (
						<ul className="divide-y divide-[var(--app-border)] text-sm">
							{data.failingSitemaps.map((row) => (
								<li key={row.url} className="px-5 py-2.5">
									<p className="truncate font-mono text-xs font-semibold">{row.url}</p>
									<p className="truncate text-xs text-[var(--app-muted)]">
										{row.email} · {timeAgo(row.at)} · {row.error}
									</p>
								</li>
							))}
						</ul>
					)}
				</Card>
			</div>

			{/* 7. Financials, Billing & User Administration */}
			<h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--app-muted)]">Financials &amp; User Directory</h2>
			<div className="mb-6 grid gap-6 lg:grid-cols-3">
				<Card className="lg:col-span-2" title="Recent Payments" description="Prepaid 30-day transactions via Razorpay.">
					{data.recentPayments.length === 0 ? (
						<EmptyState title="No transactions recorded yet" />
					) : (
						<ul className="divide-y divide-[var(--app-border)] text-sm">
							{data.recentPayments.map((payment) => (
								<li key={payment.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
									<Badge tone={payment.status === "paid" ? "ok" : payment.status === "failed" ? "bad" : "neutral"}>
										{statusLabel(payment.status)}
									</Badge>
									<span className="min-w-0 flex-1 truncate font-medium">{payment.email}</span>
									<span className="capitalize text-[var(--app-muted)]">{payment.plan}</span>
									<span className="font-mono tabular-nums">{formatMoney(payment.amount, payment.currency)}</span>
									<span className="text-xs text-[var(--app-muted)]">{timeAgo(payment.createdAt)}</span>
								</li>
							))}
						</ul>
					)}
				</Card>

				<Card title="Grant Plan" description="Support tool: override plan and duration without requiring checkout.">
					<div className="p-5">
						<ActionForm action={adminGrantPlanAction} submitLabel="Apply Plan Grant" variant="secondary">
							<label className="space-y-1 text-xs font-medium text-[var(--app-muted)]">
								<span>User email</span>
								<input name="email" type="email" required placeholder="user@domain.com" className={inputClass} />
							</label>
							<div className="grid grid-cols-2 gap-2">
								<label className="space-y-1 text-xs font-medium text-[var(--app-muted)]">
									<span>Plan</span>
									<select name="plan" className={inputClass} defaultValue="pro">
										<option value="pro">Pro ($19)</option>
										<option value="unlimited">Unlimited ($99)</option>
										<option value="free">Free (Reset)</option>
									</select>
								</label>
								<label className="space-y-1 text-xs font-medium text-[var(--app-muted)]">
									<span>Days</span>
									<input name="days" type="number" min={1} max={3650} defaultValue={30} className={inputClass} />
								</label>
							</div>
						</ActionForm>
					</div>
				</Card>
			</div>

			{/* 8. User Accounts Directory */}
			<Card title="Registered User Accounts" description={`${data.users.total} total accounts · showing the 50 most recent registrations`}>
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead className="border-b border-[var(--app-border)] bg-[var(--app-subtle)] text-left text-xs font-medium text-[var(--app-muted)]">
							<tr>
								<th className="px-5 py-2.5">User Email</th>
								<th className="px-5 py-2.5">Plan &amp; Expiry</th>
								<th className="px-5 py-2.5 text-right">Sites</th>
								<th className="px-5 py-2.5 text-right">URLs</th>
								<th className="px-5 py-2.5">Joined</th>
								<th className="px-5 py-2.5">Last Seen</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-[var(--app-border)]">
							{data.topUsers.map((row) => {
								const entitlement = resolveEntitlement(row);
								return (
									<tr key={row.id} className="hover:bg-[var(--app-subtle)]/50">
										<td className="max-w-64 truncate px-5 py-2.5 font-medium">{row.email || row.id}</td>
										<td className="px-5 py-2.5">
											<Badge tone={entitlement.tier === "free" ? "neutral" : entitlement.status === "grace" ? "warn" : "ok"}>
												{entitlement.plan.name}
												{entitlement.expiresAt ? ` · ${formatDate(entitlement.expiresAt)}` : ""}
											</Badge>
										</td>
										<td className="px-5 py-2.5 text-right font-mono tabular-nums">{row.siteCount}</td>
										<td className="px-5 py-2.5 text-right font-mono tabular-nums">{row.urlCount.toLocaleString()}</td>
										<td className="px-5 py-2.5 text-[var(--app-muted)]">{formatDate(row.createdAt)}</td>
										<td className="px-5 py-2.5 text-[var(--app-muted)]">{timeAgo(row.lastSeenAt)}</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</Card>
		</>
	);
}

function RankList({
	title,
	rows,
	empty = "No data yet",
}: {
	title: string;
	rows: Array<{ label: string; views: number }>;
	empty?: string;
}) {
	const max = Math.max(1, ...rows.map((row) => row.views));
	return (
		<Card title={title}>
			{rows.length === 0 ? (
				<EmptyState title={empty} />
			) : (
				<ul className="space-y-1 p-3 text-sm">
					{rows.map((row) => (
						<li key={row.label} className="relative overflow-hidden rounded-md px-2 py-1">
							<span
								className="absolute inset-y-0 left-0 rounded-md bg-[var(--app-subtle)]"
								style={{ width: `${(row.views / max) * 100}%` }}
								aria-hidden
							/>
							<span className="relative flex justify-between gap-3">
								<span className="truncate text-xs font-mono">{row.label}</span>
								<span className="font-mono text-xs tabular-nums text-[var(--app-muted)]">{row.views.toLocaleString()}</span>
							</span>
						</li>
					))}
				</ul>
			)}
		</Card>
	);
}
