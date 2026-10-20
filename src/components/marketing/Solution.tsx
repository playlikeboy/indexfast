export function Solution() {
	const steps = [
		{ number: "01", title: "Discover", desc: "Track sitemap URLs and spot new or changed pages." },
		{ number: "02", title: "Diagnose", desc: "Find noindex tags, canonical issues, redirects, and HTTP errors." },
		{ number: "03", title: "Submit", desc: "Notify supported search engines with IndexNow and Bing workflows." },
	];

	return (
		<section className="border-b border-border/40 py-14 sm:py-16" id="workflow" aria-labelledby="workflow-heading">
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<p className="label-mono">How it works</p>
						<h2 id="workflow-heading" className="display mt-3 max-w-xl text-3xl sm:text-4xl">
							A clearer path to search discovery.
						</h2>
					</div>
					<p className="max-w-sm text-sm leading-relaxed text-muted">One workflow for people, publishing pipelines, and AI agents.</p>
				</div>
				<div className="mt-8 grid gap-4 md:grid-cols-3">
					{steps.map((step) => (
						<article key={step.number} className="flex gap-4 rounded-lg border border-border/70 bg-card/40 p-5">
							<span className="font-mono text-xs font-bold text-muted">{step.number}</span>
							<div>
								<h3 className="text-base font-bold text-ink">{step.title}</h3>
								<p className="mt-1.5 text-sm leading-relaxed text-muted">{step.desc}</p>
							</div>
						</article>
					))}
				</div>
			</div>
		</section>
	);
}
