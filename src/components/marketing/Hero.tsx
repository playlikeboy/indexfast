import Link from "next/link";

export function Hero() {
	return (
		<section className="relative overflow-hidden border-b border-border/40 bg-grid py-16 sm:py-20 lg:py-24">
			<div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:gap-16">
				<div>
					<p className="label-mono mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[10px] font-bold tracking-wider">
						<span className="h-1.5 w-1.5 rounded-full bg-accent" />
						SEO indexing operations
					</p>
					<h1 className="display max-w-2xl text-5xl sm:text-6xl lg:text-7xl">
						Find indexing issues.
						<span className="mt-3 block"><span className="text-highlight">Ship fixes faster.</span></span>
					</h1>
					<p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
						Monitor sitemaps, catch technical blockers, and submit URL updates through IndexNow and Bing—all in one place.
					</p>
					<div className="mt-8 flex flex-col gap-3 sm:flex-row">
						<Link
							href="/signup"
							className="inline-flex items-center justify-center gap-2 rounded-sm bg-accent px-6 py-3 text-xs font-mono font-bold uppercase tracking-wide text-accent-foreground transition hover:bg-accent-dark"
						>
							Start free <span aria-hidden="true">↗</span>
						</Link>
						<Link
							href="/tools"
							className="inline-flex items-center justify-center rounded-sm border border-border bg-card/50 px-6 py-3 text-xs font-mono font-bold uppercase tracking-wide text-ink transition hover:border-ink"
						>
							Explore free tools
						</Link>
					</div>
					<p className="mt-4 text-xs text-muted">Built for SEO teams, developers, and AI-powered workflows.</p>
				</div>

				<WorkflowPreview />
			</div>
		</section>
	);
}

function WorkflowPreview() {
	const steps = [
		{ number: "01", title: "Discover", detail: "Sitemaps and URL changes", tag: "MONITOR" },
		{ number: "02", title: "Diagnose", detail: "Noindex, canonicals, redirects", tag: "CHECK" },
		{ number: "03", title: "Submit", detail: "IndexNow and Bing workflows", tag: "NOTIFY" },
	];

	return (
		<div className="relative mx-auto w-full max-w-xl">
			<div className="absolute -inset-4 rounded-2xl bg-accent/10 blur-2xl" aria-hidden="true" />
			<div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
				<div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
					<div className="flex items-center gap-2">
						<span className="h-2 w-2 rounded-full bg-red-400" />
						<span className="h-2 w-2 rounded-full bg-yellow-400" />
						<span className="h-2 w-2 rounded-full bg-green-500" />
					</div>
					<span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">Platform overview</span>
					<span className="w-8" aria-hidden="true" />
				</div>
				<div className="p-5 sm:p-7">
					<div className="flex items-start justify-between gap-3">
						<div>
							<p className="text-xs font-semibold uppercase tracking-widest text-muted">IndexFast workflow</p>
							<p className="mt-1 text-xl font-bold tracking-tight text-ink">From sitemap to submission</p>
						</div>
						<span className="rounded-full border border-border px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-muted">Overview</span>
					</div>
					<div className="mt-6 space-y-3">
						{steps.map((step) => (
							<div key={step.number} className="flex items-center gap-4 rounded-lg border border-border/70 bg-surface/70 p-4">
								<span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-accent text-xs font-bold text-accent-foreground">{step.number}</span>
								<div className="min-w-0 flex-1">
									<p className="text-sm font-bold text-ink">{step.title}</p>
									<p className="mt-0.5 text-xs leading-relaxed text-muted">{step.detail}</p>
								</div>
								<span className="hidden rounded-sm bg-card px-2 py-1 font-mono text-[9px] font-bold tracking-wide text-muted sm:inline">{step.tag}</span>
							</div>
						))}
					</div>
					<div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/70 pt-4 text-xs text-muted">
						<span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-accent" /> Sitemap monitoring</span>
						<span>Indexability checks</span>
						<span>API · CLI · MCP</span>
					</div>
				</div>
			</div>
		</div>
	);
}
