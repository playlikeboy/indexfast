import Link from "next/link";

export function SearchEnginesShowcase() {
	const engines = [
		{
			name: "Bing",
			protocol: "Webmaster API + IndexNow",
			coverage: "Global / Microsoft Copilot & Yahoo",
			status: "Direct API Key & Auto-Submit",
			badgeTone: "ok",
			details: "Instant discovery via IndexNow plus direct submission into Bing Search Console using your Bing Webmaster API key.",
		},
		{
			name: "Yandex",
			protocol: "IndexNow Protocol",
			coverage: "Eastern Europe & Central Asia",
			status: "Automated Broadcast",
			badgeTone: "ok",
			details: "Every IndexNow ping is automatically received and indexed by Yandex crawlers without additional credentials.",
		},
		{
			name: "Naver & Seznam",
			protocol: "IndexNow Protocol",
			coverage: "South Korea & Czech Republic",
			status: "Automated Broadcast",
			badgeTone: "ok",
			details: "Direct participation in IndexNow ensures regional market leaders index your pages without custom portal uploads.",
		},
		{
			name: "Google",
			protocol: "Indexing API + Sitemap Pings",
			coverage: "Worldwide",
			status: "Eligible Schema Guardrails",
			badgeTone: "neutral",
			details: "Structured specs and guardrails for Google's official Indexing API (JobPosting/BroadcastEvent) and fast discovery.",
		},
		{
			name: "Baidu",
			protocol: "Sitemap & Resource API",
			coverage: "China & APAC",
			status: "Documentation & Specs",
			badgeTone: "neutral",
			details: "Complete developer specifications for Baidu Resource Submission API, push tokens, and sitemap crawling.",
		},
	];

	const queueFeatures = [
		{
			title: "1,000 URLs per Batch",
			desc: "IndexNow batches up to 1,000 URLs and Bing batches up to 100 URLs simultaneously, making large site ingestion fast and clean.",
		},
		{
			title: "429 Rate Limit Circuit Breaker",
			desc: "If a search engine flags rate limits or IP throttling (ThrottleIP / ErrorCode 17), the circuit breaker trips instantly to postpone batches cleanly without dropping jobs.",
		},
		{
			title: "Jittered Exponential Backoff",
			desc: "Randomized ±20% jitter prevents thundering-herd spikes on retries, strictly honoring server Retry-After headers with a 15-minute cooling base for 429s.",
		},
		{
			title: "Live Submitted Catalog & Queue",
			desc: "Monitor which URLs have been confirmed submitted with engine badges, inspect in-flight queued jobs, and trigger instant manual batch draining anytime.",
		},
	];

	return (
		<section className="border-b border-border/40 py-16 sm:py-20 bg-surface/30" id="search-engines" aria-labelledby="engines-heading">
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<p className="label-mono">Search Engine Coverage</p>
						<h2 id="engines-heading" className="display mt-3 max-w-2xl text-3xl sm:text-4xl">
							Built for every major search engine.
						</h2>
					</div>
					<Link
						href="/resources/search-engines"
						className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wide text-ink hover:underline"
					>
						View search engine API directory ↗
					</Link>
				</div>

				<div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{engines.map((engine) => (
						<article key={engine.name} className="flex flex-col justify-between rounded-lg border border-border/70 bg-card p-5">
							<div>
								<div className="flex items-center justify-between gap-2">
									<h3 className="text-base font-bold text-ink">{engine.name}</h3>
									<span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-mono font-semibold text-muted">
										{engine.protocol}
									</span>
								</div>
								<p className="mt-1 text-xs font-medium text-accent">{engine.status}</p>
								<p className="mt-2 text-xs leading-relaxed text-muted">{engine.details}</p>
							</div>
							<p className="mt-4 border-t border-border/40 pt-3 text-[11px] font-mono text-muted">
								Market: <span className="text-ink">{engine.coverage}</span>
							</p>
						</article>
					))}

					<article className="flex flex-col justify-between rounded-lg border border-accent/40 bg-accent/5 p-5">
						<div>
							<span className="label-mono text-[10px] text-accent">Developer Specs</span>
							<h3 className="mt-2 text-base font-bold text-ink">API Specs & Guardrails</h3>
							<p className="mt-2 text-xs leading-relaxed text-muted">
								Explore authenticated REST endpoints, quotas, rate limit behavior, and authentication requirements for search engine APIs worldwide.
							</p>
						</div>
						<div className="mt-4 pt-3 border-t border-border/40">
							<Link
								href="/resources/search-engines"
								className="inline-flex items-center gap-1 text-xs font-mono font-bold uppercase tracking-wide text-ink hover:underline"
							>
								Explore API Specs ↗
							</Link>
						</div>
					</article>
				</div>

				{/* High-volume queueing & 429 adaptive retry architecture */}
				<div className="mt-14 rounded-xl border border-border bg-card p-6 sm:p-8">
					<div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
						<div>
							<p className="label-mono text-[10px] text-accent">Architecture for Scale</p>
							<h3 className="mt-1 text-xl sm:text-2xl font-bold text-ink">
								High-volume batching & 429 adaptive retry engine
							</h3>
						</div>
						<span className="font-mono text-xs text-muted">Built for sites with thousands of URLs</span>
					</div>
					<p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
						When programmatic SEO or large catalogs publish thousands of pages, search engine endpoints reject naive bursts.
						IndexFast batches jobs intelligently, monitors IP rate-limiting, and automatically backs off with randomized jitter.
					</p>

					<div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{queueFeatures.map((item) => (
							<div key={item.title} className="rounded-md border border-border/60 bg-surface/50 p-4">
								<h4 className="text-xs font-bold text-ink">{item.title}</h4>
								<p className="mt-1.5 text-xs leading-relaxed text-muted">{item.desc}</p>
							</div>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
