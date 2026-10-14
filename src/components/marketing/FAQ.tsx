const faqs = [
	{
		q: "Can IndexFast guarantee Google indexing?",
		a: "No. Google decides what it indexes. IndexFast helps search engines discover URLs and helps you find technical blockers, but indexing is never guaranteed.",
	},
	{
		q: "Which search engines can I notify?",
		a: "IndexFast supports IndexNow workflows and direct Bing submissions. A successful submission is a discovery signal, not a promise that a page will be indexed.",
	},
	{
		q: "Can I connect AI agents and developer tools?",
		a: "Yes. Connect workflows through the API or remote MCP server, and use the CLI for terminal-based tasks.",
	},
	{
		q: "Do I need to verify my website?",
		a: "Yes, ownership verification is required for site-level automation and protected integrations.",
	},
];

export function FAQ() {
	return (
		<section className="py-16 sm:py-20" id="faq" aria-labelledby="faq-heading">
			<div className="mx-auto max-w-3xl px-4 sm:px-6">
				<p className="label-mono">FAQ</p>
				<h2 id="faq-heading" className="display mt-3 text-3xl sm:text-4xl">A few quick answers.</h2>
				<div className="mt-7 divide-y divide-border/60 border-y border-border/60">
					{faqs.map((faq) => (
						<details key={faq.q} className="group py-4">
							<summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-sm font-semibold text-ink transition hover:text-muted [&::-webkit-details-marker]:hidden">
								<span>{faq.q}</span>
								<svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-muted transition-transform group-open:rotate-45" aria-hidden="true">
									<path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
								</svg>
							</summary>
							<p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{faq.a}</p>
						</details>
					))}
				</div>
			</div>
		</section>
	);
}
