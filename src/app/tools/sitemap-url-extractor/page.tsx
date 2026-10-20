import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";
import { ToolRunner } from "@/components/tools/ToolRunner";

const SITE_URL = "https://indexfast.co";

const breadcrumbs = [
	{ name: "Home", url: SITE_URL },
	{ name: "Free SEO Tools", url: `${SITE_URL}/tools` },
	{ name: "Sitemap URL Extractor", url: `${SITE_URL}/tools/sitemap-url-extractor` },
];

const toolJsonLd = {
	"@context": "https://schema.org",
	"@type": "WebApplication",
	name: "Sitemap URL Extractor",
	applicationCategory: "BusinessApplication",
	operatingSystem: "Web",
	url: `${SITE_URL}/tools/sitemap-url-extractor`,
	description:
		"Parse any XML sitemap and extract every URL instantly. Free, no signup required.",
	offers: {
		"@type": "AggregateOffer",
		lowPrice: "0",
		highPrice: "0",
		priceCurrency: "USD",
	},
};

const faqJsonLd = {
	"@context": "https://schema.org",
	"@type": "FAQPage",
	mainEntity: [
		{
			"@type": "Question",
			name: "What formats does this tool support?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "The Sitemap URL Extractor works with standard XML sitemaps (sitemap.xml) and sitemap index files. Paste the sitemap URL to extract all contained URLs.",
			},
		},
		{
			"@type": "Question",
			name: "Why would I use a sitemap extractor instead of fetching manually?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "Fetching a sitemap manually gives you raw XML. This tool extracts and cleans the URL list so you can quickly review coverage, run index checks, or compare it with your known pages.",
			},
		},
	],
};

export const metadata = {
	title: "Free Sitemap URL Extractor | Parse Sitemap.xml and List All URLs",
	description:
		"Extract every URL from any sitemap.xml instantly with IndexFast's free sitemap URL extractor. Works with sitemap indexes and nested sitemaps.",
	keywords: [
		"sitemap url extractor",
		"parse sitemap",
		"sitemap xml parser",
		"extract urls from sitemap",
		"sitemap checker tool",
		"sitemap coverage tool",
	],
	alternates: {
		canonical: `${SITE_URL}/tools/sitemap-url-extractor`,
	},
};

export default function SitemapUrlExtractorPage() {
	return (
		<>
			<Navbar />
			<main>
				<BreadcrumbJsonLd items={breadcrumbs} />
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{ __html: JSON.stringify(toolJsonLd) }}
				/>
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
				/>
				<section className="py-20 sm:py-28" aria-labelledby="tool-heading">
					<div className="mx-auto max-w-3xl px-4 sm:px-6">
						<p className="label-mono">Free SEO Tool</p>
						<h1 id="tool-heading" className="display mt-3 text-4xl sm:text-5xl">
							Sitemap URL{" "}
							<span className="text-highlight">Extractor</span>
						</h1>
						<p className="mt-5 max-w-2xl text-lg text-muted">
							Paste a sitemap URL and instantly extract every page URL contained in it.
							Free. No signup required.
						</p>

						<ToolRunner toolType="sitemap-url-extractor" buttonLabel="Extract Sitemap URLs" placeholder="https://example.com/sitemap.xml" />

						<div className="prose prose-muted mt-14 max-w-none space-y-6 text-sm leading-relaxed text-muted">
							<h2 className="text-base font-bold text-ink">Why sitemap coverage matters</h2>
							<p>
								Sitemaps tell search engines which pages exist and should be crawled. Missing or
								outdated sitemap entries are one of the most common causes of orphaned, unindexed
								pages.
							</p>
							<h2 className="text-base font-bold text-ink">How to use this tool</h2>
							<ol className="list-decimal space-y-2 pl-5">
								<li>Find your sitemap URL (usually at /sitemap.xml).</li>
								<li>Paste it into the tool above.</li>
								<li>Review the extracted list of URLs.</li>
								<li>Compare it against your known pages and crawl data.</li>
							</ol>
							<h2 className="text-base font-bold text-ink">Common sitemap issues</h2>
							<ul className="list-disc space-y-2 pl-5">
								<li>Out-of-date sitemaps that omit new pages.</li>
								<li>Sitemap indexes pointing to removed sitemaps.</li>
								<li>Blocked sitemaps in robots.txt.</li>
								<li>Non-XML or malformed sitemaps rejected by search engines.</li>
							</ul>
						</div>
					</div>
				</section>
			</main>
			<Footer />
		</>
	);
}
