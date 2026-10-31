import { GuideTopic, ToolPage } from "@/components/tools/ToolPage";
import { TOOL_LEADS } from "@/components/tools/tool-leads";
import { ToolRunner } from "@/components/tools/ToolRunner";

const SITE_URL = "https://indexfast.co";

const breadcrumbs = [
	{ name: "Home", url: SITE_URL },
	{ name: "Free SEO Tools", url: `${SITE_URL}/tools` },
	{ name: "Robots.txt Checker", url: `${SITE_URL}/tools/robots-txt-checker` },
];

const toolJsonLd = {
	"@context": "https://schema.org",
	"@type": "WebApplication",
	name: "Robots.txt Checker",
	applicationCategory: "BusinessApplication",
	operatingSystem: "Web",
	url: `${SITE_URL}/tools/robots-txt-checker`,
	description: "Analyze any site's robots.txt instantly. See crawl rules, Disallow paths, and sitemap references.",
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
			name: "What is robots.txt?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "Robots.txt is a plain-text file that tells search engine crawlers which paths on your site they are allowed or disallowed to crawl. It lives at the root of your domain.",
			},
		},
		{
			"@type": "Question",
			name: "Can robots.txt block indexing?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "Yes. If a URL is disallowed in robots.txt, crawlers may not fetch its content, which severely limits indexing. Even if a page has quality content, blocking it in robots.txt can keep it out of search results.",
			},
		},
	],
};

export const metadata = {
	title: "Free Robots.txt Checker | Analyze Crawl Rules and Sitemap Paths",
	description:
		"Instant robots.txt analysis showing crawl rules, sitemap references, and blocked paths. Free robots.txt checker for any domain.",
	keywords: [
		"robots.txt checker",
		"robots.txt analyzer",
		"check robots.txt",
		"robots.txt tester",
		"robots.txt validator",
		"crawl rules checker",
	],
	alternates: {
		canonical: `${SITE_URL}/tools/robots-txt-checker`,
	},
};

export default function RobotsTxtCheckerPage() {
	return (
		<ToolPage
			breadcrumbs={breadcrumbs}
			jsonLd={[toolJsonLd, faqJsonLd]}
			title="Robots.txt checker"
			lead={TOOL_LEADS["robots-txt-checker"]}
			tool={<ToolRunner toolType="robots-txt-checker" buttonLabel="Analyze robots.txt" placeholder="example.com" />}
		>
			<GuideTopic title="What to look for in robots.txt">
				<p>
					A well-configured robots.txt lets crawlers reach important pages while blocking system directories, admin areas and duplicate
					pages. Common mistakes include accidentally blocking entire sections of a site.
				</p>
			</GuideTopic>
			<GuideTopic title="Common robots.txt mistakes">
				<ul>
					<li>
						<code>Disallow: /</code> left in place after a site migration or redesign.
					</li>
					<li>Blocking CSS or JavaScript paths needed for rendering.</li>
					<li>A missing Sitemap directive.</li>
					<li>Case-sensitivity issues in path patterns.</li>
				</ul>
			</GuideTopic>
		</ToolPage>
	);
}
