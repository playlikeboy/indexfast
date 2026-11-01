import { GuideTerms, GuideTopic, ToolPage } from "@/components/tools/ToolPage";
import { TOOL_LEADS, TOOL_NAMES } from "@/components/tools/tool-leads";
import { ToolRunner } from "@/components/tools/ToolRunner";
import type { Metadata } from "next";
import { withPageSeo } from "@/lib/seo";

const SITE_URL = "https://indexfast.co";

const breadcrumbs = [
	{ name: "Home", url: SITE_URL },
	{ name: "Free SEO Tools", url: `${SITE_URL}/tools` },
	{ name: "HTTP Status Checker", url: `${SITE_URL}/tools/http-status-checker` },
];

const toolJsonLd = {
	"@context": "https://schema.org",
	"@type": "WebApplication",
	name: "HTTP Status Checker",
	applicationCategory: "BusinessApplication",
	operatingSystem: "Web",
	url: `${SITE_URL}/tools/http-status-checker`,
	description: "Check HTTP status codes, the final URL after redirects, and response headers for any URL. Free HTTP status checker.",
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
			name: "What HTTP status codes affect indexing?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "200 OK is required for indexing. 301/302 redirects may or may not pass indexing signals. 404, 410, and 5xx errors block or remove pages from the index. Use the HTTP Status Checker to confirm responses.",
			},
		},
		{
			"@type": "Question",
			name: "Why is redirect chain length important?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "Long redirect chains waste crawl budget and can confuse search engines. Keep redirects short and direct, ideally a single 301 redirect from the original URL to the final destination.",
			},
		},
	],
};

export const metadata: Metadata = withPageSeo("/tools/http-status-checker", {
	title: "Free HTTP Status Checker | Check Redirects, 404s, and Response Codes",
	description:
		"Check HTTP status codes, the final URL after redirects, and response headers for any URL. Free HTTP status checker for SEO and technical diagnostics.",
	keywords: [
		"http status checker",
		"http status code checker",
		"check http headers",
		"http response checker",
		"404 checker",
	],
	alternates: {
		canonical: `${SITE_URL}/tools/http-status-checker`,
	},
});

export default function HttpStatusCheckerPage() {
	return (
		<ToolPage
			breadcrumbs={breadcrumbs}
			jsonLd={[toolJsonLd, faqJsonLd]}
			title={TOOL_NAMES["http-status-checker"]}
			lead={TOOL_LEADS["http-status-checker"]}
			tool={<ToolRunner toolType="http-status-checker" buttonLabel="Check HTTP status" placeholder="https://example.com/page" />}
		>
			<GuideTopic title="Common status codes and what they mean">
				<GuideTerms
					items={[
						{
							term: <code>200 OK</code>,
							meaning: "The page is accessible and can be indexed.",
						},
						{
							term: <code>301 Moved Permanently</code>,
							meaning: "A permanent redirect; typically passes indexing signals.",
						},
						{
							term: <code>302 Found</code>,
							meaning: "A temporary redirect; may not pass full indexing signals.",
						},
						{
							term: <code>404 Not Found</code>,
							meaning: "The page is missing; it will not be indexed.",
						},
						{
							term: <code>410 Gone</code>,
							meaning: "The page is permanently removed; it should drop from the index.",
						},
						{
							term: <code>5xx Server Error</code>,
							meaning: "Server issues prevent indexing while the error lasts.",
						},
					]}
				/>
			</GuideTopic>
			<GuideTopic title="Why this matters for indexing">
				<p>
					A page returning an error, too many redirects or an unexpected status code is a common reason pages do not appear in Google. Use
					the HTTP status checker alongside the noindex and canonical checkers to catch technical blockers.
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
