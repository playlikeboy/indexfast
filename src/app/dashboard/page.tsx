import React from "react";
import { stack } from "@/stack";
import { AddSiteForm } from "@/components/dashboard/AddSiteForm";
import { syncUser } from "@/app/actions";
import Link from "next/link";
import { AlertTriangle, Check, CheckCircle, ChevronRight, Database, Globe, Settings } from "lucide-react";
import { getDashboardOverview } from "@/db/dashboard";

function StatCard({
	icon: Icon,
	label,
	value,
	footer,
	accent,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	value: number;
	footer: string;
	accent?: boolean;
}) {
	return (
		<div className={`p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-md border border-border bg-card text-ink relative overflow-hidden group`}>
			{accent && (
				<div className="absolute top-0 left-0 w-full h-1 bg-accent" />
			)}
			<div className="mb-3 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-wider text-muted group-hover:text-ink transition-colors">
				<Icon className="h-4 w-4" />
				{label}
			</div>
			<div className="text-4xl font-extrabold tracking-tight font-sans">{value}</div>
			<div className="mt-3 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted">{footer}</div>
		</div>
	);
}

export default async function DashboardOverview() {
	const user = await stack.getUser();
	if (!user) return null;

	let userSites: Awaited<ReturnType<typeof getDashboardOverview>>["sites"] = [];
	let stats: Awaited<ReturnType<typeof getDashboardOverview>>["stats"] = {
		totalSites: 0,
		verifiedSites: 0,
		pendingSites: 0,
		totalUrls: 0,
		pendingAlerts: 0,
		totalSubmissions: 0,
	};
	let fetchError: string | null = null;

	try {
		await syncUser();
		const data = await getDashboardOverview(user.id);
		userSites = data.sites;
		stats = data.stats;
	} catch (err: unknown) {
		console.error("Dashboard overview query failed:", err);
		fetchError = err instanceof Error ? err.message : "Database temporarily unavailable";
	}

	return (
		<div className="space-y-8">
			{fetchError && (
				<div className="rounded-sm border border-amber-500/40 bg-amber-500/10 p-4 text-xs font-mono text-amber-700 dark:text-amber-400">
					<div className="font-bold uppercase">Database Notice</div>
					<div>{fetchError}. Retrying on background connection.</div>
				</div>
			)}
			{/* Page Header */}
			<div className="flex flex-col gap-2">
				<h2 className="text-3xl font-extrabold uppercase tracking-tight font-mono">Overview</h2>
				<p className="font-mono text-xs text-muted">Monitor site indexing status, sitemaps, and indexing submission metrics.</p>
			</div>

			{/* Stats Grid */}
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
				<StatCard
					icon={Globe}
					label="Connected Sites"
					value={stats.totalSites}
					footer={`${stats.verifiedSites} verified / ${stats.pendingSites} pending`}
				/>
				<StatCard 
					icon={Database} 
					label="Monitored URLs" 
					value={stats.totalUrls} 
					footer="Sitemap catalog" 
					accent 
				/>
				<StatCard 
					icon={CheckCircle} 
					label="Submissions" 
					value={stats.totalSubmissions} 
					footer="IndexNow and Bing" 
				/>
				<StatCard
					icon={AlertTriangle}
					label="Pending Alerts"
					value={stats.pendingAlerts}
					footer={stats.pendingAlerts > 0 ? "Needs review" : "No open alerts"}
				/>
			</div>

			{/* Main Layout Grid */}
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				{/* Domains List */}
				<section className="lg:col-span-2 border border-border bg-card p-6">
					<div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-4">
						<div>
							<h3 className="text-lg font-black uppercase tracking-tight font-mono">Connected Domains</h3>
							<p className="font-mono text-[10px] text-muted mt-1">Manage sitemaps and direct indexing integrations.</p>
						</div>
						<span className="w-fit rounded-sm border border-border bg-surface px-2.5 py-1 font-mono text-[10px] font-bold uppercase text-muted">
							{stats.totalSites} active
						</span>
					</div>

					{userSites.length === 0 ? (
						<div className="rounded-md border border-dashed border-border bg-surface p-12 text-center">
							<Globe className="mx-auto h-8 w-8 text-muted/60" />
							<p className="mt-4 font-mono text-sm text-muted">No domains connected yet.</p>
							<p className="mt-2 font-mono text-xs text-muted">Add a property to start tracking.</p>
						</div>
					) : (
						<div className="divide-y divide-border/40">
							{userSites.map((site) => (
								<div key={site.id} className="flex flex-col gap-4 py-5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between group">
									<div className="min-w-0">
										<div className="flex flex-wrap items-center gap-3">
											<h4 className="truncate text-lg font-black uppercase tracking-tight font-mono group-hover:text-accent-dark transition-colors">{site.name}</h4>
											{site.verified ? (
												<span className="inline-flex items-center gap-1 rounded-sm border border-green-300 bg-green-50 px-2 py-0.5 font-mono text-[9px] font-bold uppercase text-green-700 dark:border-green-900/50 dark:bg-green-950/20">
													<Check className="h-2.5 w-2.5" />
													Verified
												</span>
											) : (
												<span className="rounded-sm border border-yellow-300 bg-yellow-50 px-2 py-0.5 font-mono text-[9px] font-bold uppercase text-yellow-700 dark:border-yellow-900/50 dark:bg-yellow-950/20">
													Pending
												</span>
											)}
										</div>
										<p className="mt-1.5 truncate font-mono text-xs text-muted">{site.domain}</p>
										
										<div className="mt-4 flex flex-wrap gap-2 font-mono text-[9px] font-bold uppercase text-muted">
											<span className="rounded-sm border border-border/60 bg-surface px-2 py-0.5">{site.urlCount} URLs</span>
											<span className="rounded-sm border border-border/60 bg-surface px-2 py-0.5">{site.pendingAlertCount} alerts</span>
											<span className="rounded-sm border border-border/60 bg-surface px-2 py-0.5">{site.submissionCount} submissions</span>
										</div>
									</div>

									<div className="flex flex-wrap gap-2 self-end sm:self-center shrink-0">
										<Link
											href={`/dashboard/sites/${site.id}/settings`}
											className="inline-flex items-center gap-1.5 border border-border bg-surface px-3 py-2 font-mono text-[10px] font-black uppercase text-ink transition-colors hover:border-ink"
										>
											<Settings className="h-3.5 w-3.5" />
											Settings
										</Link>
										<Link
											href={`/dashboard/sites/${site.id}`}
											className="inline-flex items-center gap-1.5 border border-accent bg-accent px-3 py-2 font-mono text-[10px] font-black uppercase text-accent-foreground transition-colors hover:bg-accent-dark"
										>
											Inspect
											<ChevronRight className="h-3.5 w-3.5" />
										</Link>
									</div>
								</div>
							))}
						</div>
					)}
				</section>

				{/* Add Domain Form */}
				<AddSiteForm />
			</div>
		</div>
	);
}
