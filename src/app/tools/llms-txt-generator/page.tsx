import { GuideTopic, ToolPage } from "@/components/tools/ToolPage";
import { TOOL_LEADS, TOOL_NAMES } from "@/components/tools/tool-leads";
import { ToolRunner } from "@/components/tools/ToolRunner";

const SITE_URL = "https://indexfast.co";

const breadcrumbs = [
	{ name: "Home", url: SITE_URL },
	{ name: "Free SEO Tools", url: `${SITE_URL}/tools` },
	{ name: "llms.txt Generator", url: `${SITE_URL}/tools/llms-txt-generator` },
];

const toolJsonLd = {
	"@context": "https://schema.org",
	"@type": "WebApplication",
	name: "llms.txt Generator",
	applicationCategory: "BusinessApplication",
	operatingSystem: "Web",
	url: `${SITE_URL}/tools/llms-txt-generator`,
	description: "Generate an llms.txt file describing your site for AI crawlers and LLM indexing. Free generator.",
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
			name: "What is llms.txt?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "llms.txt is a plain-text file hosted at the root of a domain that provides structured information about a site's content and purpose. It helps AI crawlers and LLM indexers understand your site.",
			},
		},
		{
			"@type": "Question",
			name: "Does llms.txt affect Google indexing?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "llms.txt is not a direct Google ranking or indexing signal. It is primarily intended for AI crawlers and LLM platforms. Still, it can improve how AI systems summarize and cite your content.",
			},
		},
	],
};

export const metadata = {
	title: "Free llms.txt Generator | Create llms.txt for AI Crawlers",
	description:
		"Generate an llms.txt file for your domain to help AI crawlers and LLM indexers understand your site content. Free generator.",
	keywords: ["llms.txt generator", "llmstxt generator", "generate llms.txt", "llms.txt file", "ai crawler file"],
	alternates: {
		canonical: `${SITE_URL}/tools/llms-txt-generator`,
	},
};

export default function LlmsTxtGeneratorPage() {
	return (
		<ToolPage
			breadcrumbs={breadcrumbs}
			jsonLd={[toolJsonLd, faqJsonLd]}
			title={TOOL_NAMES["llms-txt-generator"]}
			lead={TOOL_LEADS["llms-txt-generator"]}
			tool={<ToolRunner toolType="llms-txt-generator" buttonLabel="Generate llms.txt" placeholder="example.com" />}
		>
			<GuideTopic title="What llms.txt includes">
				<ul>
					<li>Your site name as the title.</li>
					<li>A one-line summary of what the site does.</li>
					<li>A link to your home page.</li>
				</ul>
			</GuideTopic>
			<GuideTopic title="Who should use llms.txt?">
				<p>
					Any site that wants AI crawlers and LLM platforms to understand its content accurately. It complements robots.txt by giving
					semantic guidance rather than access rules.
				</p>
			</GuideTopic>
		</ToolPage>
	);
}
