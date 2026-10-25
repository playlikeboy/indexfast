export function Features() {
	const features = [
		{ title: "Direct Bing Console + IndexNow", desc: "Submit directly to Bing Webmaster Console using your API key, plus instant IndexNow broadcast to Yandex, Naver, and Seznam." },
		{ title: "Adaptive 429 Queue & Batching", desc: "Big sites with thousands of URLs are smoothly queued with jittered exponential backoff and search engine rate limit circuit breakers." },
		{ title: "Submission Transparency & Logs", desc: "See every URL submitted till now with engine confirmation badges, in-flight queue monitoring, and one-click manual batch draining." },
		{ title: "Agent-Native MCP & SKILL.md", desc: "Connect Claude Code, Cursor, Windsurf, or VS Code over JSON-RPC. Ask your AI to publish and submit in one step." },
		{ title: "Catch what blocks indexing", desc: "Check any URL for noindex tags, canonical mismatches, redirects, and HTTP errors before search engines flag them." },
		{ title: "Global Search Engine Specs & Tools", desc: "Built-in API guides for Google, Bing, Yandex, Naver, Baidu, and Seznam, plus 100+ curated launch submission directories." },
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
