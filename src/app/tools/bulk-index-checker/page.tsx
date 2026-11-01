import { GuideTopic, ToolPage } from "@/components/tools/ToolPage";
import { TOOL_LEADS, TOOL_NAMES } from "@/components/tools/tool-leads";
import { ToolRunner } from "@/components/tools/ToolRunner";
import type { Metadata } from "next";
import { withPageSeo } from "@/lib/seo";

const SITE_URL = "https://indexfast.co";

const breadcrumbs = [
	{ name: "Home", url: SITE_URL },
	{ name: "Free SEO Tools", url: `${SITE_URL}/tools` },
	{ name: "Bulk Index Checker", url: `${SITE_URL}/tools/bulk-index-checker` },
];

const toolJsonLd = {
	"@context": "https://schema.org",
	"@type": "WebApplication",
	name: "Bulk Index Checker",
	applicationCategory: "BusinessApplication",
	operatingSystem: "Web",
	url: `${SITE_URL}/tools/bulk-index-checker`,
	description: "Check up to 20 URLs at once for status codes, noindex tags and canonical mismatches. Free, no signup required.",
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
			name: "How many URLs can I check at once?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "The free bulk check takes up to 20 URLs at a time. Duplicate lines are checked once.",
			},
		},
		{
			"@type": "Question",
			name: "Does this tool tell me why URLs are not indexed?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "Yes. Each URL is checked for its HTTP status, noindex directives and canonical tag, and any blocker is listed. Confirm index status itself with URL Inspection in Google Search Console.",
			},
		},
	],
};

export const metadata: Metadata = withPageSeo("/tools/bulk-index-checker", {
	title: "Free Bulk Index Checker | Check 20 URLs for Indexing Blockers",
	description:
		"Check up to 20 URLs at once for the status, noindex and canonical problems that keep pages out of Google. Free bulk checker, no signup required.",
	keywords: [
		"bulk index checker",
		"bulk google index checker",
		"check multiple urls google",
		"bulk indexing tool",
		"check urls indexed google",
	],
	alternates: {
		canonical: `${SITE_URL}/tools/bulk-index-checker`,
	},
});

export default function BulkIndexCheckerPage() {
	return (
		<ToolPage
			breadcrumbs={breadcrumbs}
			jsonLd={[toolJsonLd, faqJsonLd]}
			title={TOOL_NAMES["bulk-index-checker"]}
			lead={TOOL_LEADS["bulk-index-checker"]}
			tool={<ToolRunner toolType="bulk-index-checker" buttonLabel="Run bulk check" />}
		>
			<GuideTopic title="How bulk checking works">
				<p>
					Bulk checking runs the same technical checks on many URLs at once instead of one at a time: the HTTP status, noindex directives
					and the canonical tag. It is especially useful after pSEO launches, migrations or sitemap updates. Confirm index status itself
					with URL Inspection in Google Search Console.
				</p>
			</GuideTopic>
			<GuideTopic title="Best practices">
				<ul>
					<li>Limit checks to your own properties whenever possible.</li>
					<li>Focus on recently published or updated pages.</li>
					<li>Follow up failing URLs with diagnostics to find the blocker.</li>
					<li>Use alongside sitemap monitoring for full coverage.</li>
				</ul>
			</GuideTopic>
			<GuideTopic title="When to use this tool">
				<p>
					Right after publishing a batch of pages, after submitting a new sitemap, or when reviewing a site migration, to make sure nothing
					technical keeps important URLs out of the index.
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
