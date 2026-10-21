/** Single source for the visible FAQ and its FAQPage JSON-LD (rendered on the home page). */
export const faqs = [
	{
		q: "How long does setup take?",
		a: "About two minutes. Add your domain, we find your sitemap, then you put one small key file in your site's public folder and click Verify. Your AI editor can do the file step for you.",
	},
	{
		q: "Which search engines get my pages?",
		a: "Every engine in the IndexNow network, including Bing, Yandex, Naver, Seznam and Yep. On Pro and Unlimited you can also add a Bing Webmaster API key for direct Bing submissions.",
	},
	{
		q: "Does it work with Google?",
		a: "Google does not take IndexNow submissions, and nobody can guarantee Google indexing. IndexFast still helps there: it keeps your sitemap monitored and flags noindex, canonical and HTTP problems that stop any engine from indexing a page.",
	},
	{
		q: "Do I need to write code?",
		a: "No. The dashboard covers everything. If you use Claude Code, Cursor, VS Code or Windsurf, connect our MCP server and just ask your AI to set it up or submit new pages.",
	},
	{
		q: "What happens if I stop paying?",
		a: "Plans are prepaid for 30 days and never auto-charge. After the end date you get 3 days of grace, then the account moves to Free: your first site keeps running, extra sites pause, and nothing is deleted.",
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
