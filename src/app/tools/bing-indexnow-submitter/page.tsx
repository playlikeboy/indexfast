import { GuideTopic, ToolPage } from "@/components/tools/ToolPage";
import { TOOL_LEADS } from "@/components/tools/tool-leads";
import { ToolRunner } from "@/components/tools/ToolRunner";

const SITE_URL = "https://indexfast.co";

const breadcrumbs = [
	{ name: "Home", url: SITE_URL },
	{ name: "Free SEO Tools", url: `${SITE_URL}/tools` },
	{
		name: "Bing IndexNow Submitter",
		url: `${SITE_URL}/tools/bing-indexnow-submitter`,
	},
];

const toolJsonLd = {
	"@context": "https://schema.org",
	"@type": "WebApplication",
	name: "Bing IndexNow Submitter",
	applicationCategory: "BusinessApplication",
	operatingSystem: "Web",
	url: `${SITE_URL}/tools/bing-indexnow-submitter`,
	description: "Submit URLs to Bing and IndexNow-supported search engines via the IndexNow protocol. Free submitter tool.",
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
	keywords: ["bing indexnow submitter", "indexnow submitter", "submit urls to bing", "indexnow api submitter", "indexnow url submitter"],
	alternates: {
		canonical: `${SITE_URL}/tools/bing-indexnow-submitter`,
	},
};

export default function BingIndexNowSubmitterPage() {
	return (
		<ToolPage
			breadcrumbs={breadcrumbs}
			jsonLd={[toolJsonLd, faqJsonLd]}
			title="Bing IndexNow submitter"
			lead={TOOL_LEADS["bing-indexnow-submitter"]}
			tool={<ToolRunner toolType="bing-indexnow-submitter" buttonLabel="Submit URLs to IndexNow" />}
		>
			<GuideTopic title="How IndexNow submission works">
				<p>
					IndexNow lets you push URL changes directly to Bing and supported engines rather than waiting for them to discover the changes
					through crawling. You send your host, your key, the URL of its key file and the list of changed URLs.
				</p>
			</GuideTopic>
			<GuideTopic title="Best practices">
				<ul>
					<li>Submit only your own verified domains.</li>
					<li>Batch submissions during low-traffic periods.</li>
					<li>
						Confirm your key file is reachable at <code>https://yourdomain.com/{"{key}"}.txt</code>.
					</li>
				</ul>
			</GuideTopic>
		</ToolPage>
	);
}
