/*
 * /resources/search-engines/<engine>: one guide per engine ("how to submit URLs to Yandex"),
 * generated from src/lib/resources/search-engines.ts so limits and setup steps match the hub
 * table exactly. Exists because people (and AI answer engines) search per engine, and the hub
 * page buries each engine under six others. Only ids in the catalog render (unknown ids return notFound()),
 * and the copy never promises that a submission leads to indexing.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";
import { Container, buttonClass } from "@/components/ui";
import { getAllSearchEngines, getSearchEngineById, type SearchEngine } from "@/lib/resources/search-engines";
import { SITE_URL, withPageSeo } from "@/lib/seo";
import { ResourceHeader } from "../../_components/ResourceHeader";
import { EngineSection } from "../../_components/EngineSection";

type Params = Promise<{ engine: string }>;

// dynamicParams stays on: without an OpenNext incremental cache the Worker cannot serve
// prerendered params, so with it off every page 404s in production. Unknown ids hit notFound().

export function generateStaticParams() {
	return getAllSearchEngines().map((engine) => ({ engine: engine.id }));
}

// "Microsoft Bing" reads oddly in "submit URLs to"; the short name is what people search for.
function shortName(engine: SearchEngine) {
	return engine.name.replace(/^Microsoft /, "");
}

function methodList(engine: SearchEngine) {
	const names = engine.methods.map((method) => method.name.replace(/\s*\(.*\)\s*$/, ""));
	return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0] ?? "its XML sitemap";
}

// Answer-first summary: what the engine accepts and what IndexFast does with it, in two sentences.
function shortAnswer(engine: SearchEngine) {
	const live = engine.methods.filter((method) => method.inIndexFast?.status === "live");
	const adding = engine.methods.filter((method) => method.inIndexFast?.status === "adding");
	const accepts = `${shortName(engine)} accepts URL submissions through ${methodList(engine)}.`;
	const inIndexFast = live.length
		? `IndexFast automates ${live.map((method) => method.name.replace(/\s*\(.*\)\s*$/, "")).join(" and ")} for verified sites; the engine still decides what to crawl and index.`
		: adding.length
			? `IndexFast support for ${adding.map((method) => method.name.replace(/\s*\(.*\)\s*$/, "")).join(" and ")} is being added; until then, keep a clean XML sitemap and use the official tools below.`
			: "Keep a clean XML sitemap and use the official tools below; the engine decides what to crawl and index.";
	return `${accepts} ${inIndexFast}`;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
	const { engine: id } = await params;
	const engine = getSearchEngineById(id);
	if (!engine) return {};
	const name = shortName(engine);
	return withPageSeo(`/resources/search-engines/${engine.id}`, {
		title: `How to Submit URLs to ${name}: APIs, Limits and Setup`,
		description: `Submit new and changed URLs to ${name}: ${methodList(engine)}, with batch sizes, daily quotas, auth, curl examples and setup steps.`.slice(0, 200),
	});
}

export default async function SearchEngineGuidePage({ params }: { params: Params }) {
	const { engine: id } = await params;
	const engine = getSearchEngineById(id);
	if (!engine) notFound();
	const others = getAllSearchEngines().filter((item) => item.id !== engine.id);
	const url = `${SITE_URL}/resources/search-engines/${engine.id}`;

	const techArticleJsonLd = {
		"@context": "https://schema.org",
		"@type": "TechArticle",
		headline: `How to submit URLs to ${shortName(engine)}`,
		description: shortAnswer(engine),
		url,
		mainEntityOfPage: url,
		about: { "@type": "Thing", name: engine.name },
		publisher: { "@type": "Organization", name: "IndexFast", url: SITE_URL, logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` } },
	};

	return (
		<>
			<Navbar />
			<main>
				<BreadcrumbJsonLd
					items={[
						{ name: "Home", url: SITE_URL },
						{ name: "Resources", url: `${SITE_URL}/resources` },
						{ name: "Search engine APIs", url: `${SITE_URL}/resources/search-engines` },
						{ name: engine.name, url },
					]}
				/>
				<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(techArticleJsonLd) }} />
				<ResourceHeader
					title={`How to submit URLs to ${shortName(engine)}`}
					lede={shortAnswer(engine)}
					actions={
						<Link href="/resources/search-engines" className="text-md text-ink underline decoration-border-strong underline-offset-4 hover:decoration-signal">
							All search engine APIs
						</Link>
					}
				/>

				<section aria-label={`${engine.name} submission reference`} className="pb-(--section-gap-s)">
					<Container>
						<EngineSection engine={engine} />
					</Container>
				</section>

				<section aria-labelledby="other-engines-heading" className="border-t border-border py-(--section-gap-s)">
					<Container>
						<h2 id="other-engines-heading" className="text-section">
							Other search engines
						</h2>
						<ul className="mt-8 grid gap-x-10 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
							{others.map((item) => (
								<li key={item.id}>
									<Link href={`/resources/search-engines/${item.id}`} className="text-md text-ink underline decoration-border-strong underline-offset-4 hover:decoration-signal">
										How to submit URLs to {shortName(item)}
									</Link>
								</li>
							))}
						</ul>
						<div className="mt-12 flex flex-wrap gap-3">
							<Link href="/dashboard" className={buttonClass({ variant: "primary", size: "lg" })}>
								Automate submissions
							</Link>
							<Link href="/tools/indexnow-key-generator" className={buttonClass({ variant: "secondary", size: "lg" })}>
								Generate an IndexNow key
							</Link>
						</div>
					</Container>
				</section>
			</main>
			<Footer />
		</>
	);
}
