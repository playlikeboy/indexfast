import { GuideTopic, ToolPage } from "@/components/tools/ToolPage";
import { TOOL_LEADS } from "@/components/tools/tool-leads";
import { ToolRunner } from "@/components/tools/ToolRunner";

const SITE_URL = "https://indexfast.co";

const breadcrumbs = [
	{ name: "Home", url: SITE_URL },
	{ name: "Free SEO Tools", url: `${SITE_URL}/tools` },
	{
		name: "Sitemap URL Extractor",
		url: `${SITE_URL}/tools/sitemap-url-extractor`,
	},
];

const toolJsonLd = {
	"@context": "https://schema.org",
	"@type": "WebApplication",
	name: "Sitemap URL Extractor",
	applicationCategory: "BusinessApplication",
	operatingSystem: "Web",
	url: `${SITE_URL}/tools/sitemap-url-extractor`,
	description: "Parse any XML sitemap and extract every URL instantly. Free, no signup required.",
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
		<ToolPage
			breadcrumbs={breadcrumbs}
			jsonLd={[toolJsonLd, faqJsonLd]}
			title="Sitemap URL extractor"
			lead={TOOL_LEADS["sitemap-url-extractor"]}
			tool={
				<ToolRunner toolType="sitemap-url-extractor" buttonLabel="Extract sitemap URLs" placeholder="https://example.com/sitemap.xml" />
			}
		>
			<GuideTopic title="Why sitemap coverage matters">
				<p>
					Sitemaps tell search engines which pages exist and should be crawled. Missing or outdated sitemap entries are one of the most
					common causes of orphaned, unindexed pages.
				</p>
			</GuideTopic>
			<GuideTopic title="How to use this tool">
				<ol>
					<li>
						Find your sitemap URL (usually <code>/sitemap.xml</code>).
					</li>
					<li>Paste it into the tool above.</li>
					<li>Review the extracted URLs and any child sitemaps.</li>
					<li>Compare the list against your known pages and crawl data.</li>
				</ol>
			</GuideTopic>
			<GuideTopic title="Common sitemap issues">
				<ul>
					<li>Out-of-date sitemaps that omit new pages.</li>
					<li>Sitemap indexes pointing to removed sitemaps.</li>
					<li>Sitemaps blocked in robots.txt.</li>
					<li>Non-XML or malformed sitemaps rejected by search engines.</li>
				</ul>
			</GuideTopic>
		</ToolPage>
	);
}
