import { GuideTerms, GuideTopic, ToolPage } from "@/components/tools/ToolPage";
import { TOOL_LEADS, TOOL_NAMES } from "@/components/tools/tool-leads";
import { ToolRunner } from "@/components/tools/ToolRunner";

const SITE_URL = "https://indexfast.co";

const breadcrumbs = [
	{ name: "Home", url: SITE_URL },
	{ name: "Free SEO Tools", url: `${SITE_URL}/tools` },
	{ name: "AI Crawler Checker", url: `${SITE_URL}/tools/ai-crawler-checker` },
];

const toolJsonLd = {
	"@context": "https://schema.org",
	"@type": "WebApplication",
	name: "AI Crawler Checker",
	applicationCategory: "BusinessApplication",
	operatingSystem: "Web",
	url: `${SITE_URL}/tools/ai-crawler-checker`,
	description: "See which AI crawlers your robots.txt allows at the site root, and which group decides. Free AI crawler checker.",
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
			name: "Which AI crawlers does this tool check?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "The AI Crawler Checker tests accessibility for major AI crawlers including GPTBot, Google-Extended, ClaudeBot, and other common LLM crawler user agents.",
			},
		},
		{
			"@type": "Question",
			name: "Should I block AI crawlers?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "That depends on your strategy. Blocking AI crawlers prevents your content from being used to train or cited by LLMs. Allowing them can increase brand visibility in AI-generated answers. Review your content policy before deciding.",
			},
		},
	],
};

export const metadata = {
	title: "Free AI Crawler Checker | See Which AI Bots Your robots.txt Allows",
	description: "See which AI crawlers your robots.txt allows at the site root, and which group decides. Free AI crawler checker.",
	keywords: ["ai crawler checker", "ai bot checker", "gptbot checker", "google extended checker", "ai crawler access tool"],
	alternates: {
		canonical: `${SITE_URL}/tools/ai-crawler-checker`,
	},
};

export default function AiCrawlerCheckerPage() {
	return (
		<ToolPage
			breadcrumbs={breadcrumbs}
			jsonLd={[toolJsonLd, faqJsonLd]}
			title={TOOL_NAMES["ai-crawler-checker"]}
			lead={TOOL_LEADS["ai-crawler-checker"]}
			tool={<ToolRunner toolType="ai-crawler-checker" buttonLabel="Check AI crawlers" placeholder="example.com" />}
		>
			<GuideTopic title="Common AI crawlers">
				<GuideTerms
					items={[
						{
							term: "GPTBot",
							meaning: "OpenAI's web crawler for ChatGPT and model training.",
						},
						{
							term: "Google-Extended",
							meaning: "Google's robots.txt token that controls Gemini and Vertex AI training access.",
						},
						{
							term: "ClaudeBot",
							meaning: "Anthropic's web crawler for Claude.",
						},
						{
							term: "CCBot",
							meaning: "Common Crawl's bot, whose data is used to train many LLMs.",
						},
					]}
				/>
			</GuideTopic>
			<GuideTopic title="Why AI crawler access matters">
				<p>
					Well-behaved AI crawlers read robots.txt. A crawler follows only the most specific group that names it, and
					falls back to the <code>*</code> group when none does. Use this tool to audit your AI crawler policy and make sure it matches your
					content strategy.
				</p>
			</GuideTopic>
		</ToolPage>
	);
}
