export function Features() {
	const features = [
		{ title: "Sitemap monitoring", desc: "Keep tabs on sitemap sources and URL changes." },
		{ title: "Indexability diagnostics", desc: "Spot noindex tags, canonical mismatches, redirects, and HTTP errors." },
		{ title: "IndexNow + Bing", desc: "Submit new and updated URLs through supported discovery workflows." },
		{ title: "Bulk URL workflows", desc: "Run checks and submissions across multiple URLs." },
		{ title: "Submission history", desc: "Review job status, responses, and recent failures." },
		{ title: "Developer access", desc: "Connect publishing workflows with the API, CLI, or MCP server." },
	];

	return (
		<section className="border-b border-border/40 py-16 sm:py-20" id="features" aria-labelledby="features-heading">
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<p className="label-mono">What you get</p>
						<h2 id="features-heading" className="display mt-3 max-w-2xl text-3xl sm:text-4xl">
							The essentials. Nothing extra to wade through.
						</h2>
					</div>
					<p className="max-w-xs text-sm leading-relaxed text-muted">Practical tools for keeping your URLs healthy and discoverable.</p>
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
