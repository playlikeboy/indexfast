/*
 * Search engine coverage as a ruled table: which channel each engine takes and what IndexFast
 * actually does there. Rows match the engine modules in src/lib/engines and the plan features in
 * src/lib/platform/plans.ts: IndexNow on every plan; direct Bing, Yandex and Baidu submissions and
 * the Google Indexing API on paid plans only. Google never implies guaranteed indexing: Search
 * Console is inspection and sitemap resubmission, the Indexing API is JobPosting and livestream
 * pages only. Queue facts below match src/lib/automation/constants.ts; update both together.
 */
import Link from "next/link";
import { Container, Table, Td, Th } from "@/components/ui";

const engines = [
	{ name: "Bing", protocol: "Webmaster API + IndexNow", does: "IndexNow auto-submit on every plan. Direct Webmaster API submissions with your key on Pro and Unlimited.", market: "Global" },
	{ name: "Yandex", protocol: "IndexNow + Webmaster API", does: "Receives every IndexNow submission. On Pro and Unlimited, also its recrawl queue with your Yandex token.", market: "Eastern Europe and Central Asia" },
	{ name: "Naver & Seznam", protocol: "IndexNow", does: "Receive IndexNow submissions. No portal uploads.", market: "South Korea and Czech Republic" },
	{ name: "Google", protocol: "Search Console + Indexing API", does: "Connect Search Console to inspect URLs and resubmit your sitemap. Indexing API only for eligible JobPosting and livestream pages, on Pro and Unlimited.", market: "Worldwide" },
	{ name: "Baidu", protocol: "URL push API", does: "On Pro and Unlimited, pushes new URLs with your Baidu token, within Baidu's daily quota.", market: "China and APAC" },
];

const queueFacts = [
	{ title: "1,000 URLs per batch", desc: "IndexNow takes batches of 1,000, Bing batches of 100." },
	{ title: "429 rate limit circuit breaker", desc: "A rate limit parks the site's jobs: 1 hour, doubling up to 24 hours. They never fail." },
	{ title: "Jittered exponential backoff", desc: "Retries carry ±20% jitter and honour Retry-After. Network errors get 3 attempts." },
	{ title: "Live submitted catalog & queue", desc: "See confirmed submissions, inspect queued jobs, and drain the queue on demand." },
];

export function SearchEnginesShowcase() {
	return (
		<section id="search-engines" aria-labelledby="engines-heading" className="py-(--section-gap)">
			<Container>
				<div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
					<h2 id="engines-heading" className="max-w-[16ch] text-section">
						Where your URLs go, engine by engine.
					</h2>
					<Link href="/resources/search-engines" className="text-md text-ink-2 underline decoration-border-strong underline-offset-4 hover:decoration-signal">
						Search engine API directory
					</Link>
				</div>

				<Table caption="Search engines and how IndexFast reaches each one" className="mt-16">
					<thead>
						<tr>
							<Th>Engine</Th>
							{/* Channel and Market hide on phones so the row reads as engine, then what we do. */}
							<Th className="hidden md:table-cell">Channel</Th>
							<Th>What IndexFast does</Th>
							<Th className="hidden md:table-cell">Market</Th>
						</tr>
					</thead>
					<tbody>
						{engines.map((engine) => (
							<tr key={engine.name}>
								<Td className="py-5 whitespace-nowrap">
									<h3 className="text-title">{engine.name}</h3>
								</Td>
								<Td className="hidden py-5 whitespace-nowrap text-ink-2 md:table-cell">{engine.protocol}</Td>
								<Td className="py-5 text-md text-ink-2 md:min-w-[28ch]">{engine.does}</Td>
								<Td className="hidden py-5 text-muted md:table-cell">{engine.market}</Td>
							</tr>
						))}
					</tbody>
				</Table>

				<div className="mt-24 grid gap-x-(--gap-columns) gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
					<h3 className="text-title sm:col-span-2 lg:col-span-4">High-volume batching & 429 adaptive retry engine</h3>
					{queueFacts.map((fact) => (
						<div key={fact.title} className="min-w-0 border-t border-border-strong pt-5">
							<h4 className="font-display text-title leading-[1.2] font-medium tracking-display text-balance">{fact.title}</h4>
							<p className="mt-2 text-ink-2">{fact.desc}</p>
						</div>
					))}
				</div>
			</Container>
		</section>
	);
}
