import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { AlertTriangle, Database, Globe, Send, Settings, Check, Activity, Clock } from "lucide-react";
import { checkUrlDiagnostics, submitToIndexNow, syncSitemap, verifySite } from "@/app/actions";
import { getSiteDashboard } from "@/db/dashboard";
import { stack } from "@/stack";
import { DeleteSiteButton } from "@/components/dashboard/DeleteSiteButton";

type SiteDetailPageProps = {
	params: Promise<{ siteId: string }>;
};

function formatDate(value: Date | null) {
	return value
		? new Intl.DateTimeFormat("en-US", {
				month: "short",
				day: "numeric",
				year: "numeric",
			}).format(value)
		: "Never";
}

export default async function SiteDetailPage({ params }: SiteDetailPageProps) {
	const user = await stack.getUser();
	if (!user) return null;

	const { siteId } = await params;
	const siteDashboard = await getSiteDashboard(user.id, siteId);

	if (!siteDashboard) {
		notFound();
	}

	const { site, stats, recentUrls, recentSitemaps, recentAlerts } = siteDashboard;

	async function verifyCurrentSite() {
		"use server";
		await verifySite(siteId);
		revalidatePath("/dashboard");
		revalidatePath(`/dashboard/sites/${siteId}`);
	}

	async function syncCurrentSitemap() {
		"use server";
		await syncSitemap(siteId);
		revalidatePath("/dashboard");
		revalidatePath(`/dashboard/sites/${siteId}`);
	}

	async function runDiagnosticsForUrl(urlId: string) {
		"use server";
		await checkUrlDiagnostics(urlId);
		revalidatePath("/dashboard");
		revalidatePath(`/dashboard/sites/${siteId}`);
	}

	async function submitUrlToIndexNow(urlLoc: string) {
		"use server";
		await submitToIndexNow(siteId, urlLoc);
		revalidatePath("/dashboard");
		revalidatePath("/dashboard/submissions");
		revalidatePath(`/dashboard/sites/${siteId}`);
	}

	return (
		<div className="space-y-6">
			{/* Site Header Card */}
			<div className="border border-border bg-card p-6">
				<div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
					<div className="min-w-0">
						<Link href="/dashboard" className="font-mono text-xs font-black uppercase text-muted transition-colors hover:text-ink">
							&larr; Back to overview
						</Link>
						<h2 className="mt-3 text-3xl font-extrabold uppercase tracking-tight font-mono">{site.name}</h2>
						<p className="mt-1 font-mono text-xs text-muted">{site.domain}</p>
						{site.sitemapUrl && (
							<p className="mt-3 truncate font-mono text-xs text-muted max-w-xl">
								Sitemap: <span className="text-ink font-semibold">{site.sitemapUrl}</span>
							</p>
						)}
					</div>
					
					{/* Action Buttons */}
					<div className="flex flex-wrap items-center gap-2 self-start shrink-0">
						<Link
							href={`/dashboard/sites/${siteId}/settings`}
							className="inline-flex items-center justify-center gap-1.5 border border-border bg-surface px-3 py-2 font-mono text-[10px] font-black uppercase text-ink transition-colors hover:border-ink"
						>
							<Settings className="h-3.5 w-3.5" />
							Settings
						</Link>
						
						<DeleteSiteButton siteId={siteId} siteName={site.name} />

						<form action={verifyCurrentSite}>
							<button
								type="submit"
								className="inline-flex items-center justify-center gap-1.5 border border-accent bg-accent px-4 py-2 font-mono text-[10px] font-black uppercase text-accent-foreground transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
								disabled={site.verified}
							>
								{site.verified ? (
									<>
										<Check className="h-3.5 w-3.5" />
										Verified
									</>
								) : (
									"Verify site"
								)}
							</button>
						</form>
						
						<form action={syncCurrentSitemap}>
							<button
								type="submit"
								className="inline-flex items-center justify-center gap-1.5 border border-border bg-ink px-4 py-2 font-mono text-[10px] font-black uppercase text-surface transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
								disabled={!site.sitemapUrl}
							>
								Sync sitemap
							</button>
						</form>
					</div>
				</div>
			</div>

			{!site.verified ? (
				<div className="border border-amber-500/40 bg-amber-500/5 p-5">
					<h3 className="font-mono text-sm font-black uppercase tracking-wide">Verify site ownership</h3>
					<p className="mt-2 text-sm text-muted">
						Create a plain-text file at this exact URL and paste the token below. Then click “Verify site”.
					</p>
					<p className="mt-4 font-mono text-xs font-bold uppercase text-muted">File URL</p>
					<code className="mt-1 block break-all rounded border border-border bg-card p-3 text-sm">
						https://{site.domain}/.well-known/indexfast-verification.txt
					</code>
					<p className="mt-4 font-mono text-xs font-bold uppercase text-muted">Exact file contents</p>
					<code className="mt-1 block break-all rounded border border-border bg-card p-3 text-sm">
						{site.verificationToken}
					</code>
					<p className="mt-3 text-xs text-muted">
						The file must be publicly readable over HTTPS and return the token as plain text.
					</p>
				</div>
			) : null}

			{/* Info Cards Grid */}
			<div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
				<div className="border border-border bg-card p-5">
					<Globe className="h-4 w-4 text-muted" />
					<p className="mt-3 font-mono text-[10px] font-bold uppercase text-muted">Status</p>
					<p className="mt-1 text-2xl font-black uppercase font-mono tracking-tight">{site.verified ? "Verified" : "Pending"}</p>
				</div>
				<div className="border border-border bg-card p-5 relative overflow-hidden">
					<div className="absolute top-0 left-0 w-full h-1 bg-accent" />
					<Database className="h-4 w-4 text-muted" />
					<p className="mt-3 font-mono text-[10px] font-bold uppercase text-muted">URLs</p>
					<p className="mt-1 text-2xl font-black font-mono tracking-tight">{stats.totalUrls}</p>
				</div>
				<div className="border border-border bg-card p-5">
					<AlertTriangle className={`h-4 w-4 ${stats.pendingAlerts > 0 ? "text-red-500" : "text-muted"}`} />
					<p className="mt-3 font-mono text-[10px] font-bold uppercase text-muted">Pending Alerts</p>
					<p className="mt-1 text-2xl font-black font-mono tracking-tight">{stats.pendingAlerts}</p>
				</div>
				<div className="border border-border bg-card p-5">
					<Send className="h-4 w-4 text-muted" />
					<p className="mt-3 font-mono text-[10px] font-bold uppercase text-muted">Submissions</p>
					<p className="mt-1 text-2xl font-black font-mono tracking-tight">{stats.totalSubmissions}</p>
				</div>
			</div>

			{/* Main Layout Grid */}
			<div className="grid gap-6 lg:grid-cols-3">
				{/* Recent URLs Section */}
				<section className="lg:col-span-2 border border-border bg-card p-6">
					<h3 className="text-lg font-black uppercase tracking-tight font-mono border-b border-border/40 pb-3">Recent URLs</h3>
					{recentUrls.length === 0 ? (
						<p className="mt-4 font-mono text-sm text-muted">No URLs synced yet.</p>
					) : (
						<div className="divide-y divide-border/40">
							{recentUrls.map((url) => (
								<div key={url.id} className="py-4 first:pt-2 last:pb-0 group">
									<div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
										<div className="min-w-0">
											<p className="truncate font-mono text-xs text-muted group-hover:text-ink transition-colors">{url.loc}</p>
											<p className="mt-1.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-muted">
												{url.indexingStatus} &bull; HTTP {url.httpStatus || "unchecked"} &bull; Last checked {formatDate(url.lastCheckedAt)}
											</p>
										</div>
										<div className="flex shrink-0 flex-wrap gap-2 self-end xl:self-center">
											<form action={runDiagnosticsForUrl.bind(null, url.id)}>
												<button
													type="submit"
													className="inline-flex items-center gap-1 border border-border bg-surface px-2.5 py-1.5 font-mono text-[9px] font-black uppercase text-ink transition-colors hover:border-ink"
												>
													<Activity className="h-3 w-3" />
													Check
												</button>
											</form>
											<form action={submitUrlToIndexNow.bind(null, url.loc)}>
												<button
													type="submit"
													className="inline-flex items-center gap-1 border border-accent bg-accent px-2.5 py-1.5 font-mono text-[9px] font-black uppercase text-accent-foreground transition-colors hover:bg-accent-dark"
												>
													<Send className="h-3 w-3" />
													Submit
												</button>
											</form>
										</div>
									</div>
								</div>
							))}
						</div>
					)}
				</section>

				{/* Sidebar Section */}
				<section className="space-y-6">
					{/* Sitemap Syncs */}
					<div className="border border-border bg-card p-6">
						<h3 className="text-lg font-black uppercase tracking-tight font-mono border-b border-border/40 pb-3">Sitemap Syncs</h3>
						{recentSitemaps.length === 0 ? (
							<p className="mt-4 font-mono text-sm text-muted">No sync history yet.</p>
						) : (
							<div className="mt-4 space-y-3 font-mono text-xs">
								{recentSitemaps.map((sitemap) => (
									<div key={sitemap.id} className="flex items-center justify-between border-b border-border/20 pb-2 last:border-0 last:pb-0">
										<div className="flex items-center gap-2">
											<Clock className="h-3.5 w-3.5 text-muted" />
											<span className={`font-bold uppercase ${sitemap.status === "success" ? "text-green-600" : "text-red-500"}`}>
												{sitemap.status}
											</span>
										</div>
										<span className="text-muted">{formatDate(sitemap.lastSyncTime || sitemap.createdAt)}</span>
									</div>
								))}
							</div>
						)}
					</div>
					
					{/* Latest Alerts */}
					<div className="border border-border bg-card p-6">
						<h3 className="text-lg font-black uppercase tracking-tight font-mono border-b border-border/40 pb-3">Latest Alerts</h3>
						{recentAlerts.length === 0 ? (
							<p className="mt-4 font-mono text-sm text-muted">No alerts for this site.</p>
						) : (
							<div className="mt-4 space-y-4">
								{recentAlerts.map((alert) => (
									<div key={alert.id} className="border-l-2 border-red-500 pl-3 py-1">
										<p className="text-xs font-bold font-sans">{alert.title}</p>
										<p className="mt-1 font-mono text-[9px] text-muted">{formatDate(alert.createdAt)}</p>
									</div>
								))}
							</div>
						)}
					</div>
				</section>
			</div>
		</div>
	);
}
