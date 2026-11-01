import { GuideTopic, ToolPage } from "@/components/tools/ToolPage";
import { TOOL_LEADS, TOOL_NAMES } from "@/components/tools/tool-leads";
import { ToolRunner } from "@/components/tools/ToolRunner";
import type { Metadata } from "next";
import { withPageSeo } from "@/lib/seo";

const SITE_URL = "https://indexfast.co";

const breadcrumbs = [
	{ name: "Home", url: SITE_URL },
	{ name: "Free SEO Tools", url: `${SITE_URL}/tools` },
	{ name: "Noindex Tag Checker", url: `${SITE_URL}/tools/noindex-tag-checker` },
];

const toolJsonLd = {
	"@context": "https://schema.org",
	"@type": "WebApplication",
	name: "Noindex Tag Checker",
	applicationCategory: "BusinessApplication",
	operatingSystem: "Web",
	url: `${SITE_URL}/tools/noindex-tag-checker`,
	description: "Check one URL for noindex meta tags and X-Robots-Tag headers. Free noindex tag checker.",
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
			name: "What is a noindex tag?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "A noindex tag is a meta robots directive or HTTP header that tells search engines not to include a page in their index. It's commonly used for staging sites, thank-you pages, and admin areas.",
			},
		},
		{
			"@type": "Question",
			name: "Can a page be indexed if it has a noindex tag?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "No. Google and Bing drop a page with noindex once they recrawl it and see the directive. It can stay in results until that recrawl happens, and the directive only works if robots.txt lets crawlers fetch the page.",
			},
		},
	],
};

export const metadata: Metadata = withPageSeo("/tools/noindex-tag-checker", {
	title: "Free Noindex Tag Checker | Detect Noindex Meta Tags and X-Robots Headers",
	description: "Check if a URL uses noindex meta tags or X-Robots-Tag headers. Free noindex tag checker for diagnosing indexing blockers.",
	keywords: [
		"noindex tag checker",
		"noindex checker",
		"check noindex tag",
		"x-robots-tag checker",
		"meta robots checker",
		"noindex detector",
	],
	alternates: {
		canonical: `${SITE_URL}/tools/noindex-tag-checker`,
	},
});

export default function NoindexTagCheckerPage() {
	return (
		<ToolPage
			breadcrumbs={breadcrumbs}
			jsonLd={[toolJsonLd, faqJsonLd]}
			title={TOOL_NAMES["noindex-tag-checker"]}
			lead={TOOL_LEADS["noindex-tag-checker"]}
			tool={<ToolRunner toolType="noindex-tag-checker" buttonLabel="Check noindex tag" placeholder="https://example.com/page" />}
		>
			<GuideTopic title="What this tool detects">
				<ul>
					<li>
						<code>&lt;meta name=&quot;robots&quot; content=&quot;noindex&quot;&gt;</code> in the page head.
					</li>
					<li>
						The <code>X-Robots-Tag: noindex</code> HTTP response header.
					</li>
					<li>Conflicting directives such as index and nofollow combinations.</li>
				</ul>
			</GuideTopic>
			<GuideTopic title="How noindex affects indexing">
				<p>
					Pages with a noindex directive are typically excluded from Google&apos;s index. Accidental noindex tags are one of the most common
					causes of missing pages after a site launch or migration.
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
