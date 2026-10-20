import Link from "next/link";

const tools = [
	{ slug: "google-index-checker", title: "Google Index Checker", desc: "Check whether a URL appears in Google." },
	{ slug: "bulk-index-checker", title: "Bulk Index Checker", desc: "Check URL visibility in batches." },
	{ slug: "sitemap-url-extractor", title: "Sitemap URL Extractor", desc: "Extract URLs from an XML sitemap." },
	{ slug: "indexnow-key-generator", title: "IndexNow Key Generator", desc: "Create an IndexNow key for your site." },
];

export function FreeTools() {
	return (
		<section className="border-b border-border/40 bg-card/40 py-16 sm:py-20" id="tools" aria-labelledby="tools-heading">
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<p className="label-mono">Free tools</p>
						<h2 id="tools-heading" className="display mt-3 max-w-xl text-3xl sm:text-4xl">
							Start with one URL.
						</h2>
						<p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">Quick SEO checks, free to use.</p>
					</div>
					<Link href="/tools" className="inline-flex items-center gap-2 self-start text-xs font-mono font-bold uppercase tracking-wide text-ink transition hover:text-muted sm:self-auto">
						View all tools <span aria-hidden="true">↗</span>
					</Link>
				</div>
				<div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{tools.map((tool) => (
						<Link key={tool.slug} href={"/tools/" + tool.slug} className="group flex min-h-32 flex-col justify-between rounded-lg border border-border/70 bg-surface/70 p-4 transition hover:-translate-y-0.5 hover:border-ink">
							<div>
								<h3 className="text-sm font-bold text-ink">{tool.title}</h3>
								<p className="mt-1.5 text-xs leading-relaxed text-muted">{tool.desc}</p>
							</div>
							<span className="mt-4 text-xs font-semibold text-ink">Open tool <span aria-hidden="true">↗</span></span>
						</Link>
					))}
				</div>
			</div>
		</section>
	);
}
