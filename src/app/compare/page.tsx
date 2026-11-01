/*
 * /compare: hub for the "IndexFast vs <tool>" pages, rendered from `comparisons` in
 * marketing-data.ts. It exists so each comparison has a crawlable parent and people looking for
 * an alternative can scan the options in one list. Copy stays factual and links the source.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";
import { Container } from "@/components/ui";
import { comparisons } from "@/lib/marketing-data";
import { SITE_URL, withPageSeo } from "@/lib/seo";

export const metadata: Metadata = withPageSeo("/compare", {
	title: "IndexFast Alternatives and Comparisons",
	description:
		"How IndexFast compares with Rank Math Instant Indexing, Microsoft's IndexNow plugin, IndexMeNow, Omega Indexer and Google Search Console. Factual, sourced, no invented numbers.",
});

export default function CompareIndexPage() {
	return (
		<>
			<Navbar />
			<main>
				<BreadcrumbJsonLd
					items={[
						{ name: "Home", url: SITE_URL },
						{ name: "Compare", url: `${SITE_URL}/compare` },
					]}
				/>
				<header className="pt-16 pb-20">
					<Container>
						<div className="max-w-3xl">
							<h1 className="text-display-s">IndexFast compared</h1>
							<p className="mt-6 max-w-2xl text-lead text-ink-2">
								IndexFast is a hosted indexing service for your own sites: it reads your sitemaps and sends new and changed URLs
								through official engine APIs (IndexNow, Bing, Yandex, Baidu, Search Console), with an MCP server for AI agents.
								Here is how it differs from the tools people usually weigh it against.
							</p>
						</div>
					</Container>
				</header>
				<section aria-label="Comparisons" className="pb-(--section-gap)">
					<Container>
						<ol className="border-t border-border-strong">
							{comparisons.map((item) => (
								<li key={item.slug} className="border-b border-border">
									<Link href={`/compare/${item.slug}`} className="group grid gap-2 py-6 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-10">
										<span className="text-sm text-muted md:pt-1">{item.category}</span>
										<span className="min-w-0">
											<span className="block text-title font-medium text-ink underline decoration-transparent underline-offset-4 transition-colors duration-(--dur-short) group-hover:decoration-signal">
												IndexFast vs {item.competitor}
											</span>
											<span className="mt-2 block max-w-[40em] text-md text-ink-2">{item.summary}</span>
										</span>
									</Link>
								</li>
							))}
						</ol>
					</Container>
				</section>
			</main>
			<Footer />
		</>
	);
}
