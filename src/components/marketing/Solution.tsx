export function Solution() {
	const steps = [
		{ number: "01", title: "Add your domain", desc: "We find your sitemap and import every URL. Nothing to configure." },
		{ number: "02", title: "Drop in one file", desc: "Put a tiny key file in public/, or ask your AI editor to do it over MCP." },
		{ number: "03", title: "Forget about it", desc: "Every hour, new and updated pages are submitted automatically, with retries." },
	];

	return (
		<section className="border-b border-border/40 py-14 sm:py-16" id="workflow" aria-labelledby="workflow-heading">
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<p className="label-mono">How it works</p>
						<h2 id="workflow-heading" className="display mt-3 max-w-xl text-3xl sm:text-4xl">
							Live in two minutes. Then it runs itself.
						</h2>
					</div>
					<p className="max-w-sm text-sm leading-relaxed text-muted">No crawl budget guessing, no copy-pasting URLs into webmaster tools after every deploy.</p>
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
