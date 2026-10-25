import Link from "next/link";
import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { getAllSearchEngines } from "@/lib/resources/search-engines";
import { Check, AlertCircle, ExternalLink, ShieldAlert, Cpu } from "lucide-react";

export const metadata = {
	title: "Search Engine URL Submission & Indexing APIs — Developer Guide",
	description:
		"Complete developer reference for automated search engine indexing: IndexNow, Microsoft Bing Webmaster API, Google Indexing API restrictions, Baidu Active Push, Yandex, and Naver.",
};

export default function SearchEnginesGuidePage() {
	const searchEngines = getAllSearchEngines();

	return (
		<>
			<Navbar />
			<main className="bg-background text-foreground">
				{/* Hero Section */}
				<section className="border-b border-ink/10 py-16 sm:py-24">
					<div className="mx-auto max-w-6xl px-4 sm:px-6">
						<div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted">
							<Link href="/resources" className="hover:text-ink transition-colors">
								Resources
							</Link>
							<span>/</span>
							<span className="text-ink">Search Engines</span>
						</div>

						<h1 className="display mt-4 max-w-4xl text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight">
							Search Engine Indexing &amp; Submission APIs:{" "}
							<span className="text-highlight">The Complete Reference</span>
						</h1>
						<p className="mt-5 max-w-3xl text-lg sm:text-xl text-muted leading-relaxed">
							Everything developers and AI agents need to know about automated URL submission protocols,
							rate limits, authentication methods, and content restrictions across major search engines worldwide.
						</p>

						<div className="mt-8 flex flex-wrap gap-4 text-xs font-mono">
							<div className="flex items-center gap-1.5 rounded bg-surface px-3 py-1.5 border border-ink/10">
								<Check className="h-4 w-4 text-[var(--app-ok)]" />
								<span>Federated IndexNow</span>
							</div>
							<div className="flex items-center gap-1.5 rounded bg-surface px-3 py-1.5 border border-ink/10">
								<Cpu className="h-4 w-4 text-ink" />
								<span>Bing Webmaster API</span>
							</div>
							<div className="flex items-center gap-1.5 rounded bg-surface px-3 py-1.5 border border-ink/10">
								<ShieldAlert className="h-4 w-4 text-amber-500" />
								<span>Google Indexing API Policy</span>
							</div>
							<div className="flex items-center gap-1.5 rounded bg-surface px-3 py-1.5 border border-ink/10">
								<span>Baidu Active Push</span>
							</div>
						</div>
					</div>
				</section>

				{/* Quick Comparison Matrix */}
				<section className="py-12 sm:py-16 border-b border-ink/10">
					<div className="mx-auto max-w-6xl px-4 sm:px-6">
						<div className="mb-8">
							<h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Submission Methods Matrix</h2>
							<p className="mt-2 text-sm text-muted">
								Side-by-side comparison of protocols, daily throughput limits, and IndexFast automation status.
							</p>
						</div>

						<div className="overflow-x-auto rounded-lg border border-ink/10 bg-surface">
							<table className="w-full text-left text-sm">
								<thead className="border-b border-ink/10 bg-card/60 text-xs font-mono uppercase tracking-wider text-muted">
									<tr>
										<th className="px-4 py-3.5">Search Engine</th>
										<th className="px-4 py-3.5">Primary Method</th>
										<th className="px-4 py-3.5">Batch Size</th>
										<th className="px-4 py-3.5">Daily Quota</th>
										<th className="px-4 py-3.5">Crawl Latency</th>
										<th className="px-4 py-3.5">IndexFast Status</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-ink/10 font-mono text-xs">
									{searchEngines.map((engine) => {
										const primary = engine.methods[0];
										return (
											<tr key={engine.id} className="hover:bg-ink/[0.02] transition-colors">
												<td className="px-4 py-3.5 font-bold text-foreground">
													<a href={`#${engine.id}`} className="hover:underline">
														{engine.name}
													</a>
													<span className="block text-[11px] font-normal text-muted">{engine.company}</span>
												</td>
												<td className="px-4 py-3.5 text-muted">{primary?.name || "Sitemap"}</td>
												<td className="px-4 py-3.5 text-muted">
													{primary ? `${primary.batchSize.toLocaleString()} URLs` : "—"}
												</td>
												<td className="px-4 py-3.5 text-muted">{primary?.dailyQuota || "—"}</td>
												<td className="px-4 py-3.5 text-muted">{primary?.latency || "—"}</td>
												<td className="px-4 py-3.5">
													{engine.supportLevel === "native" ? (
														<span className="inline-flex items-center gap-1 rounded bg-[var(--app-ok-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--app-ok)]">
															<Check className="h-3 w-3" /> Native
														</span>
													) : engine.supportLevel === "indexnow" ? (
														<span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
															IndexNow
														</span>
													) : engine.supportLevel === "restricted" ? (
														<span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
															Gated (Jobs/Live)
														</span>
													) : engine.supportLevel === "syndicated" ? (
														<span className="inline-flex items-center gap-1 rounded bg-purple-500/10 px-2 py-0.5 text-[11px] font-semibold text-purple-600 dark:text-purple-400">
															Syndicated
														</span>
													) : (
														<span className="inline-flex items-center gap-1 rounded bg-ink/5 px-2 py-0.5 text-[11px] font-semibold text-muted">
															Planned
														</span>
													)}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</div>
				</section>

				{/* Detailed Engine Breakdowns */}
				<section className="py-12 sm:py-20">
					<div className="mx-auto max-w-6xl px-4 sm:px-6 space-y-16">
						<div>
							<h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Search Engine API Specifications</h2>
							<p className="mt-2 text-sm text-muted">
								Technical architecture, authentication methods, payload specifications, and cURL snippets.
							</p>
						</div>

						{searchEngines.map((engine) => (
							<article
								key={engine.id}
								id={engine.id}
								className="scroll-mt-24 rounded-xl border border-ink/10 bg-surface p-6 sm:p-8 space-y-6 shadow-sm"
							>
								{/* Header */}
								<div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink/10 pb-6">
									<div>
										<div className="flex items-center gap-3">
											<h3 className="text-2xl font-bold">{engine.name}</h3>
											<span className="text-xs font-mono rounded bg-card px-2.5 py-1 text-muted border border-ink/10">
												{engine.marketShare}
											</span>
										</div>
										<p className="mt-2 text-sm text-muted max-w-3xl leading-relaxed">{engine.summary}</p>
									</div>

									<div className="flex items-center gap-2">
										{engine.methods[0]?.documentationUrl ? (
											<a
												href={engine.methods[0].documentationUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="inline-flex items-center gap-1.5 rounded border border-ink/20 bg-card px-3 py-1.5 text-xs font-mono font-medium hover:bg-ink/5 transition-colors"
											>
												<span>Official Docs</span>
												<ExternalLink className="h-3 w-3" />
											</a>
										) : null}
									</div>
								</div>

								{/* Submission Methods */}
								<div className="space-y-6">
									<h4 className="text-sm font-mono uppercase tracking-wider font-semibold text-muted">
										Available Submission Methods
									</h4>

									<div className="grid gap-6">
										{engine.methods.map((method) => (
											<div
												key={method.name}
												className="rounded-lg border border-ink/10 bg-card/40 p-5 space-y-4 font-mono text-xs"
											>
												<div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 pb-3">
													<div className="flex items-center gap-2">
														<span className="font-bold text-sm font-sans">{method.name}</span>
														<span className="rounded bg-ink/10 px-2 py-0.5 text-[10px] uppercase font-bold text-ink">
															{method.httpMethod}
														</span>
														<span className="text-[11px] text-muted">Auth: {method.authMethod}</span>
													</div>

													<div className="flex items-center gap-3 text-[11px] text-muted">
														<span>Batch: {method.batchSize} URLs</span>
														<span>•</span>
														<span>Quota: {method.dailyQuota}</span>
													</div>
												</div>

												{method.contentRestrictions && method.contentRestrictions !== "None." ? (
													<div className="flex items-start gap-2 rounded bg-amber-500/10 p-3 text-amber-700 dark:text-amber-400 font-sans text-xs">
														<AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
														<p>{method.contentRestrictions}</p>
													</div>
												) : null}

												<div>
													<p className="text-[11px] text-muted mb-1 font-sans">Endpoint:</p>
													<code className="block rounded bg-background p-2.5 text-xs text-foreground select-all border border-ink/10 overflow-x-auto">
														{method.endpoint}
													</code>
												</div>

												<div>
													<p className="text-[11px] text-muted mb-1 font-sans">cURL Example:</p>
													<pre className="rounded bg-background p-3 text-[11px] text-foreground overflow-x-auto border border-ink/10 select-all leading-relaxed">
														{method.curlExample}
													</pre>
												</div>

												{method.notes ? (
													<p className="text-xs text-muted font-sans italic">{method.notes}</p>
												) : null}
											</div>
										))}
									</div>
								</div>

								{/* Setup Guide & Developer Tips */}
								<div className="grid gap-6 md:grid-cols-2 pt-2 border-t border-ink/10">
									<div>
										<h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-muted mb-3">
											{engine.setupGuide.title}
										</h4>
										<ol className="list-decimal list-inside space-y-2 text-xs text-muted leading-relaxed">
											{engine.setupGuide.steps.map((step, idx) => (
												<li key={idx} className="pl-1">
													<span className="font-sans text-foreground">{step}</span>
												</li>
											))}
										</ol>
									</div>

									<div>
										<h4 className="text-xs font-mono uppercase tracking-wider font-semibold text-muted mb-3">
											Developer Tips &amp; Gotchas
										</h4>
										<ul className="space-y-2 text-xs text-muted leading-relaxed">
											{engine.developerTips.map((tip, idx) => (
												<li key={idx} className="flex items-start gap-2">
													<span className="text-accent mt-0.5">&bull;</span>
													<span className="font-sans text-foreground">{tip}</span>
												</li>
											))}
										</ul>
									</div>
								</div>
							</article>
						))}
					</div>
				</section>

				{/* Bing Webmaster API in IndexFast Tutorial Section */}
				<section className="border-t border-ink/10 bg-card/30 py-16 sm:py-24">
					<div className="mx-auto max-w-6xl px-4 sm:px-6">
						<div className="max-w-3xl">
							<p className="label-mono">Deep Dive</p>
							<h2 className="display mt-3 text-3xl sm:text-4xl font-bold">
								Automating Bing Search Console with IndexFast
							</h2>
							<p className="mt-4 text-base text-muted leading-relaxed">
								IndexFast provides first-class support for Microsoft Bing. Every connected site automatically uses
								IndexNow to push changes. In addition, developers can supply their own Bing Webmaster API key to execute
								direct, authenticated batch submissions using their site&apos;s Bing daily quota.
							</p>
						</div>

						<div className="mt-10 grid gap-6 md:grid-cols-3">
							<div className="rounded-lg border border-ink/10 bg-surface p-6 space-y-3">
								<span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/10 text-xs font-bold font-mono">
									1
								</span>
								<h3 className="font-bold text-base">Dashboard (Zero Code)</h3>
								<p className="text-xs text-muted leading-relaxed">
									Navigate to your site in the IndexFast Dashboard &rarr; Settings &rarr; Bing Webmaster API. Paste your key and click
									&ldquo;Connect &amp; Verify&rdquo;. Enable the auto-submit checkbox.
								</p>
							</div>

							<div className="rounded-lg border border-ink/10 bg-surface p-6 space-y-3">
								<span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/10 text-xs font-bold font-mono">
									2
								</span>
								<h3 className="font-bold text-base">REST API</h3>
								<p className="text-xs text-muted leading-relaxed">
									Send a POST request to <code className="text-[11px] font-mono bg-card px-1 py-0.5 rounded">/api/v1/sites/:siteId/bing</code> with
									your API key. IndexFast encrypts and validates the credential instantly.
								</p>
								<pre className="rounded bg-background p-2.5 text-[10px] font-mono border border-ink/10 overflow-x-auto">
{`curl -X POST \\
  https://indexfast.co/api/v1/sites/example.com/bing \\
  -H "Authorization: Bearer $KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"apiKey": "BING_KEY", "autoSubmit": true}'`}
								</pre>
							</div>

							<div className="rounded-lg border border-ink/10 bg-surface p-6 space-y-3">
								<span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/10 text-xs font-bold font-mono">
									3
								</span>
								<h3 className="font-bold text-base">AI IDEs via MCP</h3>
								<p className="text-xs text-muted leading-relaxed">
									Inside Cursor or Claude Desktop, your AI agent can manage Bing automation directly using:
								</p>
								<code className="block rounded bg-background p-2 text-[10px] font-mono border border-ink/10 text-muted">
									call_tool(&quot;set_bing_api_key&quot;, &#123; site: &quot;example.com&quot;, apiKey: &quot;...&quot; &#125;)
								</code>
							</div>
						</div>
					</div>
				</section>

				{/* Call to Action */}
				<section className="border-t border-ink/10 py-16 sm:py-20 text-center">
					<div className="mx-auto max-w-4xl px-4 sm:px-6 space-y-6">
						<h2 className="display text-3xl sm:text-4xl font-bold">
							Start automating your search engine discovery today.
						</h2>
						<p className="mx-auto max-w-xl text-muted text-base leading-relaxed">
							Add your website, place one verification key file, and let IndexFast handle IndexNow, Bing Webmaster API, and discovery monitoring.
						</p>
						<div className="flex flex-wrap items-center justify-center gap-4 pt-2">
							<Link
								href="/dashboard"
								className="rounded-md bg-ink px-6 py-3 text-sm font-semibold text-surface transition-transform hover:scale-105"
							>
								Open Dashboard
							</Link>
							<Link
								href="/resources"
								className="rounded-md border border-ink/20 bg-surface px-6 py-3 text-sm font-semibold hover:bg-ink/5 transition-colors"
							>
								Explore All Resources
							</Link>
						</div>
					</div>
				</section>
			</main>
			<Footer />
		</>
	);
}
