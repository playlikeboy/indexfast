import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";
import { ToolRunner } from "@/components/tools/ToolRunner";

const SITE_URL = "https://indexfast.co";

const breadcrumbs = [
	{ name: "Home", url: SITE_URL },
	{ name: "Free SEO Tools", url: `${SITE_URL}/tools` },
	{ name: "Bing IndexNow Submitter", url: `${SITE_URL}/tools/bing-indexnow-submitter` },
];

const toolJsonLd = {
	"@context": "https://schema.org",
	"@type": "WebApplication",
	name: "Bing IndexNow Submitter",
	applicationCategory: "BusinessApplication",
	operatingSystem: "Web",
	url: `${SITE_URL}/tools/bing-indexnow-submitter`,
	description:
		"Submit URLs to Bing and IndexNow-supported search engines via the IndexNow protocol. Free submitter tool.",
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
			name: "What is the IndexNow submitter?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "The Bing IndexNow Submitter sends an HTTP POST request to Bing's IndexNow endpoint with your URLs and API key, notifying supported search engines that the URLs have been created, updated, or deleted.",
			},
		},
		{
			"@type": "Question",
			name: "Does IndexNow guarantee indexing?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "No. IndexNow only notifies search engines that content has changed. Whether they index the page depends on the page's quality, relevance, and technical signals.",
			},
		},
	],
};

export const metadata = {
	title: "Free Bing IndexNow Submitter | Submit URLs to Bing IndexNow API",
	description:
		"Submit up to 10,000 URLs per request via the IndexNow protocol to Bing and Yandex. Free Bing IndexNow submitter for fast discovery.",
	keywords: [
		"bing indexnow submitter",
		"indexnow submitter",
		"submit urls to bing",
		"indexnow api submitter",
		"indexnow url submitter",
	],
	alternates: {
		canonical: `${SITE_URL}/tools/bing-indexnow-submitter`,
	},
};

export default function BingIndexNowSubmitterPage() {
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
							Bing IndexNow{" "}
							<span className="text-highlight">Submitter</span>
						</h1>
						<p className="mt-5 max-w-2xl text-lg text-muted">
							Submit URLs to Bing and IndexNow-supported search engines via the IndexNow protocol.
							Free. No signup required.
						</p>

						<ToolRunner toolType="bing-indexnow-submitter" buttonLabel="Submit URLs to IndexNow" />

						<div className="prose prose-muted mt-14 max-w-none space-y-6 text-sm leading-relaxed text-muted">
							<h2 className="text-base font-bold text-ink">How IndexNow submission works</h2>
							<p>
								IndexNow lets you push URL changes directly to Bing and supported engines rather
								than waiting for them to discover the changes through crawling. You send a list of
								URLs with the action type (urlAdded, urlUpdated, urlDeleted, urlExpired) along
								with your API key.
							</p>
							<h2 className="text-base font-bold text-ink">Best practices</h2>
							<ul className="list-disc space-y-2 pl-5">
								<li>Submit only your own verified domains.</li>
								<li>Batch submissions during low-traffic periods.</li>
									<li>Confirm your key file is reachable at https://yourdomain.com/{"{key}"}.txt.</li>
							</ul>
						</div>
					</div>
				</section>
			</main>
			<Footer />
		</>
	);
}
