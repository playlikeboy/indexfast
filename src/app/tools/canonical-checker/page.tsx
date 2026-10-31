import { GuideTopic, ToolPage } from "@/components/tools/ToolPage";
import { TOOL_LEADS } from "@/components/tools/tool-leads";
import { ToolRunner } from "@/components/tools/ToolRunner";

const SITE_URL = "https://indexfast.co";

const breadcrumbs = [
	{ name: "Home", url: SITE_URL },
	{ name: "Free SEO Tools", url: `${SITE_URL}/tools` },
	{ name: "Canonical Checker", url: `${SITE_URL}/tools/canonical-checker` },
];

const toolJsonLd = {
	"@context": "https://schema.org",
	"@type": "WebApplication",
	name: "Canonical Checker",
	applicationCategory: "BusinessApplication",
	operatingSystem: "Web",
	url: `${SITE_URL}/tools/canonical-checker`,
	description: "Verify that a page's canonical tag matches the actual URL and detect canonical conflicts. Free canon checker tool.",
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
			name: "What is a canonical tag?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "A canonical tag is a link element in the HTML head or HTTP header that tells search engines which URL is the preferred version when duplicate or similar pages exist.",
			},
		},
		{
			"@type": "Question",
			name: "Why do canonical mismatches matter?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "If the canonical tag points to a different URL than the current page, search engines may index the wrong version or consolidate ranking signals away from the intended page.",
			},
		},
	],
};

export const metadata = {
	title: "Free Canonical Checker | Detect Canonical Tag Conflicts",
	description: "Verify a URL's canonical tag and detect mismatches with the actual page URL. Free canonical checker for SEO diagnostics.",
	keywords: ["canonical checker", "canonical tag checker", "canonical mismatch", "check canonical url", "canonical tag validator"],
	alternates: {
		canonical: `${SITE_URL}/tools/canonical-checker`,
	},
};

export default function CanonicalCheckerPage() {
	return (
		<ToolPage
			breadcrumbs={breadcrumbs}
			jsonLd={[toolJsonLd, faqJsonLd]}
			title="Canonical checker"
			lead={TOOL_LEADS["canonical-checker"]}
			tool={<ToolRunner toolType="canonical-checker" buttonLabel="Check canonical tag" placeholder="https://example.com/page" />}
		>
			<GuideTopic title="What this tool checks">
				<ul>
					<li>
						<code>rel=&quot;canonical&quot;</code> in the HTML head.
					</li>
					<li>
						The <code>Link: &lt;URL&gt;; rel=&quot;canonical&quot;</code> HTTP header.
					</li>
					<li>Whether the canonical URL matches the current URL or points elsewhere.</li>
				</ul>
			</GuideTopic>
			<GuideTopic title="Why canonical issues hurt indexing">
				<p>
					A canonical mismatch can split ranking signals, cause the wrong URL to rank, or lead search engines to treat the page as a
					duplicate. Use the canonical checker alongside index status tools for a full picture.
				</p>
			</GuideTopic>
		</ToolPage>
	);
}
