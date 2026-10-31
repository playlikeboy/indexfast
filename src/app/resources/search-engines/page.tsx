/*
 * /resources/search-engines: the developer reference for every engine's submission method,
 * rendered from src/lib/resources/search-engines.ts. A comparison table first, then one ruled
 * section per engine (anchored by engine id so the table links into it), then how Bing runs in
 * IndexFast. Status is text plus one icon, and "adding" methods are labelled as in progress so
 * nothing reads as a shipped feature or a promise of Google indexing.
 */
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { Badge, CodeBlock, Container, Status, Table, Td, Th, buttonClass, type StatusTone } from "@/components/ui";
import { getAllSearchEngines, type SearchEngine, type SearchEngineMethod } from "@/lib/resources/search-engines";
import { ResourceHeader } from "../_components/ResourceHeader";

export const metadata = {
	title: "Search Engine URL Submission & Indexing APIs — Developer Guide",
	description:
		"Complete developer reference for automated search engine indexing: IndexNow, Microsoft Bing Webmaster API, Google Indexing API restrictions, Baidu Active Push, Yandex, and Naver.",
};

const supportStatus: Record<SearchEngine["supportLevel"], { tone: StatusTone; label: string }> = {
	native: { tone: "success", label: "Native" },
	indexnow: { tone: "info", label: "Via IndexNow" },
	restricted: { tone: "warning", label: "Gated (jobs and live)" },
	syndicated: { tone: "neutral", label: "Syndicated" },
	planned: { tone: "neutral", label: "Planned" },
};

const bingCurl = `curl -X POST \\
  https://indexfast.co/api/v1/sites/example.com/bing \\
  -H "Authorization: Bearer $KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"apiKey": "BING_KEY", "autoSubmit": true}'`;

const bingMcp = `call_tool("set_bing_api_key", { site: "example.com", apiKey: "..." })`;

function MethodBlock({ method }: { method: SearchEngineMethod }) {
	// Entries that start with "None" (e.g. "None (any valid page...)") carry no restriction to warn about.
	const restricted = Boolean(method.contentRestrictions) && !/^None\b/.test(method.contentRestrictions);
	return (
		<div className="min-w-0 border-t border-border pt-8">
			<div className="flex flex-wrap items-center gap-3">
				<h4 className="font-display text-lg font-medium tracking-display">{method.name}</h4>
				<Badge>{method.httpMethod}</Badge>
				{method.inIndexFast ? (
					<Status tone={method.inIndexFast.status === "live" ? "success" : "info"}>
						{method.inIndexFast.status === "live" ? "In IndexFast" : "Being added"}
					</Status>
				) : null}
			</div>
			{method.inIndexFast ? <p className="mt-2 max-w-[35em] text-md text-ink-2">{method.inIndexFast.note}</p> : null}
			<dl className="mt-6 grid gap-x-10 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
				<div className="min-w-0">
					<dt className="text-muted">Auth</dt>
					<dd className="mt-1 font-mono text-ink">{method.authMethod}</dd>
				</div>
				<div className="min-w-0">
					<dt className="text-muted">Batch</dt>
					<dd className="num mt-1 text-ink">{method.batchSize.toLocaleString("en-US")} URLs</dd>
				</div>
				<div className="min-w-0">
					<dt className="text-muted">Quota</dt>
					<dd className="mt-1 text-ink">{method.dailyQuota}</dd>
				</div>
				<div className="min-w-0">
					<dt className="text-muted">Latency</dt>
					<dd className="mt-1 text-ink">{method.latency}</dd>
				</div>
			</dl>
			{restricted ? (
				<p className="mt-6 max-w-3xl rounded-input bg-warning-wash px-4 py-3 text-sm text-ink">
					<Status tone="warning" className="mr-2 align-[-0.15em]">
						Restriction
					</Status>
					{method.contentRestrictions}
				</p>
			) : null}
			<p className="mt-6 text-sm text-muted">Endpoint</p>
			<code className="mt-1 block overflow-x-auto rounded-input bg-well px-3 py-2 font-mono text-sm text-ink">{method.endpoint}</code>
			<CodeBlock title="curl" code={method.curlExample} className="mt-6" />
			{method.notes ? <p className="mt-4 max-w-[35em] text-sm text-muted">{method.notes}</p> : null}
		</div>
	);
}

function EngineSection({ engine }: { engine: SearchEngine }) {
	const docs = engine.methods[0]?.documentationUrl;
	return (
		<article id={engine.id} className="scroll-mt-24 border-t border-border-strong pt-12">
			<div className="flex flex-wrap items-start justify-between gap-6">
				<div className="min-w-0 max-w-[35em]">
					<h3 className="text-2xl font-semibold">{engine.name}</h3>
					<p className="mt-2 text-sm text-muted">{engine.marketShare}</p>
					<p className="mt-4 text-md text-ink-2">{engine.summary}</p>
				</div>
				{docs ? (
					<a href={docs} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "secondary", size: "md" })}>
						Official docs
						<ExternalLink aria-hidden="true" className="size-4" />
					</a>
				) : null}
			</div>
			<h4 className="visually-hidden">Available submission methods</h4>
			<div className="mt-10 space-y-10">
				{engine.methods.map((method) => (
					<MethodBlock key={method.name} method={method} />
				))}
			</div>
			<div className="mt-10 grid gap-10 border-t border-border pt-8 md:grid-cols-2 md:gap-16">
				<div className="min-w-0">
					<h4 className="font-display text-md font-medium">{engine.setupGuide.title}</h4>
					<ol className="mt-4 list-decimal space-y-2 pl-5 text-md text-ink-2 marker:text-muted">
						{engine.setupGuide.steps.map((step) => (
							<li key={step} className="pl-1">
								{step}
							</li>
						))}
					</ol>
				</div>
				<div className="min-w-0">
					<h4 className="font-display text-md font-medium">Developer tips and gotchas</h4>
					<ul className="mt-4 list-disc space-y-2 pl-5 text-md text-ink-2 marker:text-muted">
						{engine.developerTips.map((tip) => (
							<li key={tip} className="pl-1">
								{tip}
							</li>
						))}
					</ul>
				</div>
			</div>
		</article>
	);
}

export default function SearchEnginesGuidePage() {
	const searchEngines = getAllSearchEngines();

	return (
		<>
			<Navbar />
			<main>
				<ResourceHeader
					title="Search engine submission APIs"
					lede="Protocols, rate limits, auth and content rules for every major engine."
					actions={
						<Link href="/resources" className={buttonClass({ variant: "ghost", size: "lg" })}>
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
												<a href={`#${engine.id}`} className="font-display font-medium text-ink underline decoration-border-strong underline-offset-4 hover:decoration-signal">
													{engine.name}
												</a>
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
								<EngineSection key={engine.id} engine={engine} />
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
						<ol className="mt-16 grid gap-12 lg:grid-cols-3 lg:gap-10">
							<li className="min-w-0">
								<span className="num font-display text-title font-semibold text-muted">1</span>
								<h3 className="mt-2 text-title">Dashboard, no code</h3>
								<p className="mt-3 text-md text-ink-2">
									Open your site in the IndexFast dashboard, then Settings, then Bing Webmaster API. Paste your key, choose
									Connect &amp; Verify, and enable auto-submit.
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
