import { GuideTopic, ToolPage } from "@/components/tools/ToolPage";
import { TOOL_LEADS, TOOL_NAMES } from "@/components/tools/tool-leads";
import { ToolRunner } from "@/components/tools/ToolRunner";
import type { Metadata } from "next";
import { withPageSeo } from "@/lib/seo";

const SITE_URL = "https://indexfast.co";

const breadcrumbs = [
	{ name: "Home", url: SITE_URL },
	{ name: "Free SEO Tools", url: `${SITE_URL}/tools` },
	{
		name: "IndexNow Key Generator",
		url: `${SITE_URL}/tools/indexnow-key-generator`,
	},
];

const toolJsonLd = {
	"@context": "https://schema.org",
	"@type": "WebApplication",
	name: "IndexNow Key Generator",
	applicationCategory: "BusinessApplication",
	operatingSystem: "Web",
	url: `${SITE_URL}/tools/indexnow-key-generator`,
	description: "Generate a secure random IndexNow API key for Bing, Yandex, and other supported search engines.",
	offers: {
		"@type": "AggregateOffer",
		lowPrice: "0",
		highPrice: "0",
		priceCurrency: "USD",
	},
};

// The FAQ rows below are rendered from this same object: FAQPage markup must match visible text.
const faqJsonLd = {
	"@context": "https://schema.org",
	"@type": "FAQPage",
	mainEntity: [
		{
			"@type": "Question",
			name: "What is IndexNow?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "IndexNow is a protocol supported by Bing and other search engines that lets you notify them when URLs on your site are created, updated, or deleted, helping supported engines discover changes faster.",
			},
		},
		{
			"@type": "Question",
			name: "Where do I put the IndexNow key?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "Host the key as a plain text file at the root of your domain: https://yourdomain.com/{your-key}.txt. Search engines verify the key by fetching that URL.",
			},
		},
	],
};

export const metadata: Metadata = withPageSeo("/tools/indexnow-key-generator", {
	title: "Free IndexNow Key Generator | Generate Secure IndexNow API Keys",
	description:
		"Generate a secure random IndexNow API key for Bing, Yandex, and other supported search engines. Free key generator for indexing automation.",
	keywords: ["indexnow key generator", "generate indexnow key", "indexnow api key", "bing indexnow key", "indexnow key generator tool"],
	alternates: {
		canonical: `${SITE_URL}/tools/indexnow-key-generator`,
	},
});

export default function IndexNowKeyGeneratorPage() {
	return (
		<ToolPage
			breadcrumbs={breadcrumbs}
			jsonLd={[toolJsonLd, faqJsonLd]}
			title={TOOL_NAMES["indexnow-key-generator"]}
			lead={TOOL_LEADS["indexnow-key-generator"]}
			tool={<ToolRunner toolType="indexnow-key-generator" buttonLabel="Generate IndexNow key" placeholder="example.com" />}
		>
			<GuideTopic title="What is IndexNow?">
				<p>
					IndexNow is an open protocol that lets you notify supported search engines when URLs on your site are created, updated or deleted.
					It helps them discover changed content sooner than regular crawl cycles.
				</p>
			</GuideTopic>
			<GuideTopic title="How to set up IndexNow">
				<ol>
					<li>Generate an IndexNow key using this tool.</li>
					<li>
						Host the key as a plain text file at <code>https://yourdomain.com/{"{key}"}.txt</code>.
					</li>
					<li>Verify the key is publicly accessible.</li>
					<li>Submit URLs using the key through the IndexNow API.</li>
				</ol>
			</GuideTopic>
			<GuideTopic title="Supported search engines">
				<p>
					Bing is the primary supporter of IndexNow. Yandex and other engines have also adopted the protocol. Keeping a valid key means you
					can submit changes whenever you publish or update pages.
				</p>
			</GuideTopic>
			{faqJsonLd.mainEntity.map((item) => (
				<GuideTopic key={item.name} title={item.name}>
					<p>{item.acceptedAnswer.text}</p>
				</GuideTopic>
			))}
		</ToolPage>
	);
}
