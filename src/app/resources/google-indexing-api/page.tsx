/*
 * /resources/google-indexing-api: states the policy IndexFast enforces. Google's Indexing API is
 * only for JobPosting and livestream BroadcastEvent pages; every other page goes through sitemaps,
 * diagnostics and Search Console. The page must never read as a promise of Google indexing,
 * and the Google connection is not shipped yet, so product behaviour is stated in the future tense.
 */
import Link from "next/link";
import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { Container, Panel, Status } from "@/components/ui";
import { ResourceHeader } from "../_components/ResourceHeader";

export const metadata = {
	title: "Google Indexing API Guardrails",
	description:
		"Learn when IndexFast can use Google's Indexing API and why most SEO workflows should rely on sitemap hygiene, diagnostics, GSC, and safe discovery signals.",
};

const rules = [
	{
		title: "Eligible content only",
		desc: "Google's Indexing API is restricted to JobPosting pages and livestream BroadcastEvent pages embedded in VideoObject structured data.",
	},
	{
		title: "Explicit opt-in",
		desc: "When the Google connection ships, IndexFast will ask you to choose the eligible content type before it queues URL_UPDATED or URL_DELETED notifications.",
	},
	{
		title: "Structured data check",
		desc: "The integration will inspect JSON-LD first. General blog posts, SaaS pages, directories, ecommerce pages, and pSEO pages will not be queued.",
	},
	{
		title: "General Google workflow",
		desc: "For normal SEO pages, IndexFast focuses on sitemap health, canonical checks, robots/noindex diagnostics, GSC visibility, and crawl-friendly resources.",
	},
];

export default function GoogleIndexingApiPage() {
	return (
		<>
			<Navbar />
			<main>
				<ResourceHeader
					title="Google's Indexing API: jobs and livestreams only"
					lede="When the Google connection ships, IndexFast will send only job and livestream pages. Every other page uses sitemaps."
					actions={
						<Link href="/resources" className="text-md text-ink underline decoration-border-strong underline-offset-4 hover:decoration-signal">
							Back to resources
						</Link>
					}
				/>
				<section aria-labelledby="rules-heading" className="pb-(--section-gap)">
					<Container>
						<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
							<h2 id="rules-heading" className="text-section">
								The rules IndexFast applies
							</h2>
							<Status tone="info">Being added</Status>
						</div>
						<ol className="mt-10 grid border-t border-border-strong md:grid-cols-2 md:gap-x-16">
							{rules.map((rule, index) => (
								<li key={rule.title} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2 border-b border-border py-8">
									<span className="num font-display text-title font-semibold text-muted">{index + 1}</span>
									<div className="min-w-0">
										<h3 className="text-title">{rule.title}</h3>
										<p className="mt-2 max-w-[35em] text-md text-ink-2">{rule.desc}</p>
									</div>
								</li>
							))}
						</ol>
						<Panel title="IndexFast guardrail" className="mt-16 max-w-3xl">
							<p className="text-md text-ink-2">
								The backend helper only marks a page eligible when JSON-LD contains JobPosting or BroadcastEvent with
								VideoObject. The notification payload is limited to URL_UPDATED and URL_DELETED, and metadata status
								checks use Google&apos;s documented metadata endpoint.
							</p>
						</Panel>
					</Container>
				</section>
			</main>
			<Footer />
		</>
	);
}
