/*
 * /resources/search-engines: the developer reference for every engine's submission method,
 * rendered from src/lib/resources/search-engines.ts. A comparison table first, then one ruled
 * section per engine (anchored by engine id so the table links into it), then how Bing runs in
 * IndexFast. Status is text plus one icon, and "adding" methods are labelled as in progress so
 * nothing reads as a shipped feature or a promise of Google indexing.
 */
import Link from "next/link";
import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { CodeBlock, Container, Status, Table, Td, Th, buttonClass } from "@/components/ui";
import { getAllSearchEngines } from "@/lib/resources/search-engines";
import { EngineSection, supportStatus } from "../_components/EngineSection";
import { ResourceHeader } from "../_components/ResourceHeader";
import type { Metadata } from "next";
import { SITE_URL, withPageSeo } from "@/lib/seo";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";

export const metadata: Metadata = withPageSeo("/resources/search-engines", {
	title: "Search Engine URL Submission & Indexing APIs — Developer Guide",
	description:
		"Complete developer reference for automated search engine indexing: IndexNow, Microsoft Bing Webmaster API, Google Indexing API restrictions, Baidu Active Push, Yandex, and Naver.",
});

const bingCurl = `curl -X POST \\
  https://indexfast.co/api/v1/sites/example.com/bing \\
  -H "Authorization: Bearer $KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"apiKey": "BING_KEY", "autoSubmit": true}'`;

const bingMcp = `call_tool("set_bing_api_key", {
  site: "example.com",
  apiKey: "..."
})`;

export default function SearchEnginesGuidePage() {
	const searchEngines = getAllSearchEngines();

	return (
		<>
			<Navbar />
			<main>
				<BreadcrumbJsonLd items={[{ name: "Home", url: SITE_URL }, { name: "Resources", url: `${SITE_URL}/resources` }, { name: "Search engine APIs", url: `${SITE_URL}/resources/search-engines` }]} />
				<ResourceHeader
					title="Search engine submission APIs"
					lede="Protocols, rate limits, auth and content rules for every major engine."
					actions={
						<Link href="/resources" className="text-md text-ink underline decoration-border-strong underline-offset-4 hover:decoration-signal">
							All resources
						</Link>
					}
				/>

				<section aria-labelledby="matrix-heading" className="pb-(--section-gap-s)">
					<Container>
						<h2 id="matrix-heading" className="text-section">
							Submission methods matrix
						</h2>
						<p className="mt-4 max-w-[35em] text-md text-ink-2">
							Protocols, daily limits and IndexFast status, side by side.
						</p>
						<Table caption="Submission methods by search engine" className="mt-10">
							<thead>
								<tr>
									<Th className="sticky left-0 z-(--z-raised) bg-background">Search engine</Th>
									<Th>IndexFast status</Th>
									<Th>Primary method</Th>
									<Th numeric>Batch size</Th>
									<Th>Daily quota</Th>
									<Th>Crawl latency</Th>
								</tr>
							</thead>
							<tbody>
								{searchEngines.map((engine) => {
									const primary = engine.methods[0];
									const status = supportStatus[engine.supportLevel];
									return (
										<tr key={engine.id}>
											<Td className="sticky left-0 z-(--z-raised) min-w-44 bg-background">
												<Link href={`/resources/search-engines/${engine.id}`} className="font-display font-medium text-ink underline decoration-border-strong underline-offset-4 hover:decoration-signal">
													{engine.name}
												</Link>
												<span className="mt-0.5 block text-muted">{engine.company}</span>
											</Td>
											<Td>
												<Status tone={status.tone}>{status.label}</Status>
											</Td>
											<Td className="min-w-48 text-ink-2">{primary?.name || "Sitemap"}</Td>
											<Td numeric className="whitespace-nowrap text-ink-2">
												{primary ? `${primary.batchSize.toLocaleString("en-US")} URLs` : "None"}
											</Td>
											<Td className="min-w-48 text-ink-2">{primary?.dailyQuota || "None"}</Td>
											<Td className="min-w-48 text-ink-2">{primary?.latency || "None"}</Td>
										</tr>
									);
								})}
							</tbody>
						</Table>
					</Container>
				</section>

				<section aria-labelledby="specs-heading" className="pb-(--section-gap-s)">
					<Container>
						<h2 id="specs-heading" className="text-section">
							Search engine API specifications
						</h2>
						<p className="mt-4 max-w-[35em] text-md text-ink-2">
							Authentication, payloads and cURL snippets for each engine.
						</p>
						<div className="mt-16 space-y-20">
							{searchEngines.map((engine) => (
								<EngineSection key={engine.id} engine={engine} guideLink />
							))}
						</div>
					</Container>
				</section>

				<section aria-labelledby="bing-heading" className="border-t border-border bg-well py-(--section-gap-s)">
					<Container>
						<div className="max-w-[35em]">
							<h2 id="bing-heading" className="text-section">
								Automating Bing Webmaster with IndexFast
							</h2>
							<p className="mt-6 text-md text-ink-2">
								Every connected site uses IndexNow to push changes. Developers can also supply their own Bing Webmaster
								API key for direct, authenticated batch submissions within their site&apos;s Bing daily quota.
							</p>
						</div>
						{/* Two columns, not three: the curl and MCP snippets clip in a third-width column. */}
						<ol className="mt-16 grid gap-12 lg:grid-cols-2 lg:gap-x-16">
							<li className="min-w-0 lg:col-span-2 lg:max-w-[35em]">
								<span className="num font-display text-title font-semibold text-muted">1</span>
								<h3 className="mt-2 text-title">Dashboard, no code</h3>
								<p className="mt-3 text-md text-ink-2">
									Open your site in the IndexFast dashboard, then Settings, then Bing Webmaster API. Paste your key, choose
									Connect and verify, and enable auto-submit.
								</p>
							</li>
							<li className="min-w-0">
								<span className="num font-display text-title font-semibold text-muted">2</span>
								<h3 className="mt-2 text-title">REST API</h3>
								<p className="mt-3 text-md text-ink-2">
									POST your key to <code className="rounded-input bg-sunken px-1 py-0.5 text-[0.875em]">/api/v1/sites/:siteId/bing</code>.
									IndexFast encrypts and validates it.
								</p>
								<CodeBlock title="curl" code={bingCurl} className="mt-6" />
							</li>
							<li className="min-w-0">
								<span className="num font-display text-title font-semibold text-muted">3</span>
								<h3 className="mt-2 text-title">AI IDEs via MCP</h3>
								<p className="mt-3 text-md text-ink-2">Inside Cursor or Claude Desktop, your agent manages Bing automation with:</p>
								<CodeBlock title="MCP tool call" code={bingMcp} className="mt-6" />
							</li>
						</ol>
					</Container>
				</section>

				<section aria-labelledby="start-heading" className="py-(--section-gap-s)">
					<Container>
						<div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
							<div className="max-w-3xl">
								<h2 id="start-heading" className="text-section">
									Start automating search engine discovery
								</h2>
								<p className="mt-6 text-lead text-ink-2">
									Add your site, host one key file, and IndexFast runs IndexNow, the Bing Webmaster API and discovery monitoring.
								</p>
							</div>
							<div className="flex flex-wrap gap-3">
								<Link href="/dashboard" className={buttonClass({ variant: "primary", size: "lg" })}>
									Open dashboard
								</Link>
								<Link href="/resources" className={buttonClass({ variant: "secondary", size: "lg" })}>
									Explore all resources
								</Link>
							</div>
						</div>
					</Container>
				</section>
			</main>
			<Footer />
		</>
	);
}
