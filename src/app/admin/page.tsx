/**
 * Admin panel: business (users, revenue, MRR), traffic (first-party page views), product
 * health (sites, URLs, submissions, queue, cron), and a support tool to grant plans.
 * Read-only except the grant form. Data: src/db/admin-queries.ts.
 */
import Link from "next/link";
import { adminGrantPlanAction } from "@/app/actions";
import { BarChart } from "@/components/app/BarChart";
import { ActionForm } from "@/components/app/client";
import { Badge, Card, EmptyState, PageHeader, Stat, cn, formatDate, formatMoney, inputClass, timeAgo } from "@/components/app/ui";
import { getAdminOverview } from "@/db/admin-queries";
import { requireAdmin } from "@/lib/auth";
import { PLANS, resolveEntitlement } from "@/lib/platform/plans";

const RANGES = [7, 30, 90];

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
	await requireAdmin();
	const { range } = await searchParams;
	const rangeDays = RANGES.includes(Number(range)) ? Number(range) : 30;
	const data = await getAdminOverview(rangeDays);
	const successRate = data.submissions.total7d ? Math.round((data.submissions.success7d / data.submissions.total7d) * 100) : null;
	const lastCron = data.recentCron[0];

	return (
		<>
			<PageHeader
				title="Admin"
				description="Everything happening on IndexFast."
				action={
					<div className="flex rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] p-0.5">
						{RANGES.map((days) => (
							<Link key={days} href={`/admin?range=${days}`} className={cn("rounded-md px-3 py-1 text-sm", days === rangeDays ? "bg-[var(--app-subtle)] font-medium" : "text-[var(--app-muted)]")}>
								{days}d
							</Link>
						))}
					</div>
				}
			/>

			<h2 className="mb-3 text-sm font-semibold text-[var(--app-muted)]">Business</h2>
			<div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
				<Stat label="MRR (list price)" value={`$${data.mrrUsd.toLocaleString()}`} hint={`${data.users.paying} paying`} />
				<Stat
					label={`Revenue (${rangeDays}d)`}
					value={data.revenue.length ? data.revenue.map((row) => formatMoney(row.range, row.currency)).join(" + ") : "$0.00"}
					hint={data.revenue.length ? `All time ${data.revenue.map((row) => formatMoney(row.total, row.currency)).join(" + ")}` : undefined}
				/>
				<Stat label="Users" value={data.users.total.toLocaleString()} hint={`+${data.users.new7d} this week · ${data.users.active7d} active`} />
				<Stat
					label="Plan mix"
					value={data.users.paying.toLocaleString()}
					hint={Object.entries(data.users.planMix).map(([tier, count]) => `${PLANS[tier as keyof typeof PLANS]?.name ?? tier}: ${count}`).join(" · ") || "No paid plans"}
				/>
			</div>

			<h2 className="mb-3 text-sm font-semibold text-[var(--app-muted)]">Traffic</h2>
			<div className="mb-6 grid gap-6 lg:grid-cols-3">
				<Card className="lg:col-span-2" title="Page views per day" description={`${data.traffic.totals.views.toLocaleString()} views · ${data.traffic.totals.visitors.toLocaleString()} unique visitors (daily)`}>
					<div className="p-5">
						<BarChart data={data.traffic.daily.map((row) => ({ day: row.day, value: row.views }))} valueLabel="views" />
					</div>
				</Card>
				<RankList title="Top pages" rows={data.traffic.topPages} />
				<RankList title="Referrers" rows={data.traffic.topReferrers} empty="No external referrers yet" />
				<RankList title="Countries" rows={data.traffic.countries} />
				<RankList title="Devices" rows={data.traffic.devices} />
			</div>

			<h2 className="mb-3 text-sm font-semibold text-[var(--app-muted)]">Product</h2>
			<div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
				<Stat label="Sites" value={data.sites.total.toLocaleString()} hint={`${data.sites.live} live · ${data.sites.verified} verified · +${data.sites.new7d} this week`} />
				<Stat label="URLs tracked" value={data.urls.total.toLocaleString()} hint={`+${data.urls.new7d.toLocaleString()} found this week`} />
				<Stat label="Submissions (7d)" value={data.submissions.total7d.toLocaleString()} hint={successRate === null ? "None yet" : `${successRate}% success`} />
				<Stat label="Queue" value={data.queue.queued.toLocaleString()} hint={`${data.queue.processing} processing · ${data.queue.failed7d} failed (7d) · ${data.apiCalls7d.toLocaleString()} API calls (7d)`} />
			</div>

			<div className="mb-6 grid gap-6 lg:grid-cols-2">
				<Card
					title="Cron runs"
					description={lastCron ? `Last run ${timeAgo(lastCron.startedAt)}` : "No runs recorded yet"}
					action={lastCron ? <Badge tone={lastCron.status === "success" ? "ok" : lastCron.status === "failed" ? "bad" : "warn"}>{lastCron.status}</Badge> : null}
				>
					{data.recentCron.length === 0 ? (
						<EmptyState title="Waiting for the first hourly run" />
					) : (
						<ul className="divide-y divide-[var(--app-border)] text-sm">
							{data.recentCron.map((run) => {
								const summary = (run.summary ?? {}) as { sitesSynced?: number; newUrls?: number; downgraded?: number; durationMs?: number; queue?: { successCount?: number; failedCount?: number } };
								return (
									<li key={run.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
										<Badge tone={run.status === "success" ? "ok" : run.status === "failed" ? "bad" : "warn"}>{run.status}</Badge>
										<span className="text-[var(--app-muted)]">{timeAgo(run.startedAt)}</span>
										<span className="min-w-0 flex-1 truncate text-xs text-[var(--app-muted)]" title={run.errorMessage ?? undefined}>
											{run.errorMessage ??
												`${summary.sitesSynced ?? 0} sites · ${summary.newUrls ?? 0} new URLs · ${summary.queue?.successCount ?? 0} sent · ${summary.queue?.failedCount ?? 0} failed · ${summary.downgraded ?? 0} expired · ${Math.round((summary.durationMs ?? 0) / 1000)}s`}
										</span>
									</li>
								);
							})}
						</ul>
					)}
				</Card>

				<Card title="Failing sitemaps">
					{data.failingSitemaps.length === 0 ? (
						<EmptyState title="All sitemaps healthy" />
					) : (
						<ul className="divide-y divide-[var(--app-border)] text-sm">
							{data.failingSitemaps.map((row) => (
								<li key={row.url} className="px-5 py-2.5">
									<p className="truncate font-mono text-xs">{row.url}</p>
									<p className="truncate text-xs text-[var(--app-muted)]">
										{row.email} · {timeAgo(row.at)} · {row.error}
									</p>
								</li>
							))}
						</ul>
					)}
				</Card>
			</div>

			<div className="mb-6 grid gap-6 lg:grid-cols-3">
				<Card className="lg:col-span-2" title="Recent payments">
					{data.recentPayments.length === 0 ? (
						<EmptyState title="No payments yet" />
					) : (
						<ul className="divide-y divide-[var(--app-border)] text-sm">
							{data.recentPayments.map((payment) => (
								<li key={payment.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
									<Badge tone={payment.status === "paid" ? "ok" : payment.status === "failed" ? "bad" : "neutral"}>{payment.status}</Badge>
									<span className="min-w-0 flex-1 truncate">{payment.email}</span>
									<span className="capitalize text-[var(--app-muted)]">{payment.plan}</span>
									<span className="tabular-nums">{formatMoney(payment.amount, payment.currency)}</span>
									<span className="text-xs text-[var(--app-muted)]">{timeAgo(payment.createdAt)}</span>
								</li>
							))}
						</ul>
					)}
				</Card>

				<Card title="Grant a plan" description="Support tool. Sets plan and expiry without a payment.">
					<div className="p-5">
						<ActionForm action={adminGrantPlanAction} submitLabel="Apply" variant="secondary">
							<input name="email" type="email" required placeholder="user@email.com" className={inputClass} aria-label="User email" />
							<select name="plan" className={inputClass} aria-label="Plan" defaultValue="pro">
								<option value="pro">Pro</option>
								<option value="unlimited">Unlimited</option>
								<option value="free">Free (remove plan)</option>
							</select>
							<input name="days" type="number" min={1} max={3650} defaultValue={30} className={inputClass} aria-label="Days" />
						</ActionForm>
					</div>
				</Card>
			</div>

			<Card title="Newest users" description={`${data.users.newRange} signed up in the last ${rangeDays} days`}>
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead className="text-left text-xs text-[var(--app-muted)]">
							<tr>
								<th className="px-5 py-2 font-medium">Email</th>
								<th className="px-5 py-2 font-medium">Plan</th>
								<th className="px-5 py-2 text-right font-medium">Sites</th>
								<th className="px-5 py-2 text-right font-medium">URLs</th>
								<th className="px-5 py-2 font-medium">Joined</th>
								<th className="px-5 py-2 font-medium">Last seen</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-[var(--app-border)]">
							{data.topUsers.map((row) => {
								const entitlement = resolveEntitlement(row);
								return (
									<tr key={row.id}>
										<td className="max-w-64 truncate px-5 py-2">{row.email || row.id}</td>
										<td className="px-5 py-2">
											<Badge tone={entitlement.tier === "free" ? "neutral" : entitlement.status === "grace" ? "warn" : "ok"}>
												{entitlement.plan.name}
												{entitlement.expiresAt ? ` · ${formatDate(entitlement.expiresAt)}` : ""}
											</Badge>
										</td>
										<td className="px-5 py-2 text-right tabular-nums">{row.siteCount}</td>
										<td className="px-5 py-2 text-right tabular-nums">{row.urlCount.toLocaleString()}</td>
										<td className="px-5 py-2 text-[var(--app-muted)]">{formatDate(row.createdAt)}</td>
										<td className="px-5 py-2 text-[var(--app-muted)]">{timeAgo(row.lastSeenAt)}</td>
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

function RankList({ title, rows, empty = "No data yet" }: { title: string; rows: Array<{ label: string; views: number }>; empty?: string }) {
	const max = Math.max(1, ...rows.map((row) => row.views));
	return (
		<Card title={title}>
			{rows.length === 0 ? (
				<EmptyState title={empty} />
			) : (
				<ul className="space-y-1 p-3 text-sm">
					{rows.map((row) => (
						<li key={row.label} className="relative overflow-hidden rounded-md px-2 py-1">
							<span className="absolute inset-y-0 left-0 rounded-md bg-[var(--app-subtle)]" style={{ width: `${(row.views / max) * 100}%` }} aria-hidden />
							<span className="relative flex justify-between gap-3">
								<span className="truncate">{row.label}</span>
								<span className="tabular-nums text-[var(--app-muted)]">{row.views.toLocaleString()}</span>
							</span>
						</li>
					))}
				</ul>
			)}
		</Card>
	);
}
