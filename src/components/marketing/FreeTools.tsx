/*
 * Four free tools as a grid of links on the landing page; the full set lives on /tools.
 * Each cell is the whole link, so the target is large and the title names where it goes.
 */
import Link from "next/link";
import { Container } from "@/components/ui";

const tools = [
	{ slug: "google-index-checker", title: "Google Index Checker", desc: "Check whether a URL appears in Google." },
	{ slug: "bulk-index-checker", title: "Bulk Index Checker", desc: "Check URL visibility in batches." },
	{ slug: "sitemap-url-extractor", title: "Sitemap URL Extractor", desc: "Extract URLs from an XML sitemap." },
	{ slug: "indexnow-key-generator", title: "IndexNow Key Generator", desc: "Create an IndexNow key for your site." },
];

export function FreeTools() {
	return (
		<section id="tools" aria-labelledby="tools-heading" className="border-t border-border py-(--section-gap-s)">
			<Container>
				<div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<h2 id="tools-heading" className="text-section">
							Start with one URL.
						</h2>
						<p className="mt-4 text-lead text-ink-2">Quick SEO checks, free to use.</p>
					</div>
					<Link href="/tools" className="text-md text-ink-2 underline decoration-border-strong underline-offset-4 hover:decoration-signal">
						View all tools
					</Link>
				</div>
				<ul className="mt-16 grid gap-x-(--gap-columns) sm:grid-cols-2 lg:grid-cols-4">
					{tools.map((tool) => (
						<li key={tool.slug} className="min-w-0 border-t border-border-strong">
							<Link
								href={"/tools/" + tool.slug}
								className="group flex flex-col sm:min-h-40 gap-3 pt-5 pb-8 transition-colors duration-(--dur-short) hover:text-signal"
							>
								<h3 className="text-title">{tool.title}</h3>
								<p className="text-ink-2">{tool.desc}</p>
							</Link>
						</li>
					))}
				</ul>
			</Container>
		</section>
	);
}
