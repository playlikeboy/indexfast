/*
 * Single source for the visible FAQ and its FAQPage JSON-LD (rendered on the home page), so the
 * structured data can never claim an answer the page does not show. Keep answers honest: no
 * Google indexing guarantee.
 */
import { Plus } from "lucide-react";
import { Container } from "@/components/ui";

export const faqs = [
	{
		q: "How long does setup take?",
		a: "About two minutes. Add your domain, we find your sitemap, then you put one small key file in your site's public folder and click Verify. Your AI editor can do the file step for you.",
	},
	{
		q: "Which search engines get my pages?",
		a: "Every engine in the IndexNow network, including Bing, Yandex, Naver, Seznam and Yep, on every plan. On Pro and Unlimited you can also add your own keys for direct Bing Webmaster API, Yandex recrawl and Baidu URL push submissions.",
	},
	{
		q: "Does it work with Google?",
		a: "Google does not take IndexNow, and nobody can guarantee Google indexing. Connect Search Console and IndexFast inspects your URLs, resubmits your sitemap and flags noindex, canonical and HTTP problems. The Indexing API is used only for eligible job and livestream pages.",
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
		<section id="faq" aria-labelledby="faq-heading" className="py-(--section-gap)">
			<Container className="grid gap-y-12 lg:grid-cols-12 lg:gap-x-(--gap-columns)">
				<h2 id="faq-heading" className="max-w-[10ch] text-section lg:col-span-4">
					A few quick answers.
				</h2>
				<div className="border-t border-border lg:col-span-8">
					{faqs.map((faq) => (
						<details key={faq.q} className="group border-b border-border">
							<summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-6 py-6 font-display text-title font-medium transition-colors duration-(--dur-short) hover:text-signal [&::-webkit-details-marker]:hidden">
								<span>{faq.q}</span>
								<Plus aria-hidden="true" className="size-6 shrink-0 text-muted transition-transform duration-(--dur-short) group-open:rotate-45 motion-reduce:transition-none" />
							</summary>
							<p className="max-w-[62ch] pb-6 text-ink-2">{faq.a}</p>
						</details>
					))}
				</div>
			</Container>
		</section>
	);
}
