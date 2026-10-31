import { GuideTopic, ToolPage } from "@/components/tools/ToolPage";
import { TOOL_LEADS, TOOL_NAMES } from "@/components/tools/tool-leads";
import { ToolRunner } from "@/components/tools/ToolRunner";

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
				text: "Search engines usually respect noindex and will not index the page. In rare cases, a page may still appear in results if Google believes the noindex was added accidentally or too recently.",
			},
		},
	],
};

export const metadata = {
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
};

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
		</ToolPage>
	);
}
