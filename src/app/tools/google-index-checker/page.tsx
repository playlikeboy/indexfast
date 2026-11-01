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
		name: "Google Index Checker",
		url: `${SITE_URL}/tools/google-index-checker`,
	},
];

const toolJsonLd = {
	"@context": "https://schema.org",
	"@type": "WebApplication",
	name: "Google Index Checker",
	applicationCategory: "BusinessApplication",
	operatingSystem: "Web",
	url: `${SITE_URL}/tools/google-index-checker`,
	description:
		"Find the status, noindex and canonical problems that keep a URL out of Google, then confirm in Search Console. Free, no signup required.",
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
			name: "How does the Google Index Checker work?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "The tool fetches the URL and checks its HTTP status, noindex directives and canonical tag, then links straight to URL Inspection in Google Search Console, the only reliable source for a URL's index status.",
			},
		},
		{
			"@type": "Question",
			name: "Is the Google Index Checker free?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "Yes. The Google Index Checker is completely free and does not require any signup. Use it directly from the tools page.",
			},
		},
		{
			"@type": "Question",
			name: "Why is my URL not showing as indexed?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "Common reasons include: the page is too new, it's blocked by robots.txt or noindex, it has thin or duplicate content, or it lacks inbound links. Use IndexFast's full diagnostic suite to find the exact blocker.",
			},
		},
	],
};

export const metadata: Metadata = withPageSeo("/tools/google-index-checker", {
	title: "Free Google Index Checker | Find What Blocks Indexing",
	description:
		"Check whether Google can index a URL: HTTP status, noindex tags and canonical, with a direct link to URL Inspection in Search Console. Free, no signup required.",
	keywords: [
		"google index checker",
		"check if url is indexed",
		"google indexing checker",
		"is my page indexed",
		"google index status",
		"google index lookup tool",
		"free google index checker",
	],
	alternates: {
		canonical: `${SITE_URL}/tools/google-index-checker`,
	},
});

export default function GoogleIndexCheckerPage() {
	return (
		<ToolPage
			breadcrumbs={breadcrumbs}
			jsonLd={[toolJsonLd, faqJsonLd]}
			title={TOOL_NAMES["google-index-checker"]}
			lead={TOOL_LEADS["google-index-checker"]}
			tool={<ToolRunner toolType="google-index-checker" buttonLabel="Check indexability" placeholder="https://example.com/page" />}
		>
			<GuideTopic title="How to check if a URL is indexed">
				<ol>
					<li>Enter the full URL you want to verify.</li>
					<li>Submit the form and review the status, noindex and canonical results.</li>
					<li>Open the URL in Search Console URL Inspection to confirm index status.</li>
				</ol>
			</GuideTopic>
			<GuideTopic title="What does indexed mean?">
				<p>
					A URL is indexed when Google has discovered, crawled and stored it in its search index. Indexed pages can appear in Google Search
					results. Pages that are not indexed are invisible to most organic traffic.
				</p>
			</GuideTopic>
			<GuideTopic title="Common reasons a URL is not indexed">
				<ul>
					<li>The page is too new for Google to discover.</li>
					<li>Robots.txt or a noindex tag blocks indexing.</li>
					<li>The URL returns an error, a redirect, or a 4xx or 5xx status.</li>
					<li>Duplicate or thin content is filtered by Google.</li>
					<li>The page has few or no internal or external links.</li>
				</ul>
			</GuideTopic>
			<GuideTopic title="When to use this tool">
				<p>
					Right after publishing a new page, after submitting a URL in Google Search Console, or after launching a programmatic SEO batch,
					to confirm nothing technical stops important pages from being indexed.
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
