export function Features() {
	const features = [
		{ title: "Never miss a new page", desc: "Hourly sitemap checks catch every new URL and every page whose lastmod changed." },
		{ title: "No duplicate pings", desc: "URLs are deduped across sitemaps, and unchanged pages are never resubmitted." },
		{ title: "Works inside your AI editor", desc: "MCP for Claude Code, Cursor, VS Code and Windsurf: \"I just published a post, submit it\" works." },
		{ title: "Catch what blocks indexing", desc: "Check any URL for noindex tags, canonical mismatches, redirects and HTTP errors." },
		{ title: "IndexNow + Bing in one place", desc: "One key reaches every IndexNow engine. Add a Bing API key for direct submissions too." },
		{ title: "Know when something breaks", desc: "A failing sitemap or rejected submission shows up as an issue, with the exact reason." },
	];

	return (
		<section className="border-b border-border/40 py-16 sm:py-20" id="features" aria-labelledby="features-heading">
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<p className="label-mono">What you get</p>
						<h2 id="features-heading" className="display mt-3 max-w-2xl text-3xl sm:text-4xl">
							Everything between deployed and discovered.
						</h2>
					</div>
					<p className="max-w-xs text-sm leading-relaxed text-muted">Built for sites that publish often: blogs, docs, programmatic SEO and launch pages.</p>
				</div>

				<div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{features.map((feature) => (
						<article key={feature.title} className="group rounded-lg border border-border/70 bg-card/30 p-5 transition-colors hover:bg-card">
							<div className="mb-4 grid h-8 w-8 place-items-center rounded-md bg-accent/15 text-ink transition-colors group-hover:bg-accent">
								<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
									<path d="m3 8 3 3 7-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
								</svg>
							</div>
							<h3 className="text-sm font-bold text-ink">{feature.title}</h3>
							<p className="mt-2 text-sm leading-relaxed text-muted">{feature.desc}</p>
						</article>
					))}
				</div>
			</div>
		</section>
	);
}
