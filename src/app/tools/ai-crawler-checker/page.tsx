import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";
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
	description:
		"Detect which AI crawlers can access your pages and identify blocking rules. Free AI crawler checker.",
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
	title: "Free AI Crawler Checker | Detect Which AI Bots Can Access Your Pages",
	description:
		"Check which AI crawlers can access your URLs and identify blocking rules. Free AI crawler checker for modern SEO.",
	keywords: [
		"ai crawler checker",
		"ai bot checker",
		"gptbot checker",
		"google extended checker",
		"ai crawler access tool",
	],
	alternates: {
		canonical: `${SITE_URL}/tools/ai-crawler-checker`,
	},
};

export default function AiCrawlerCheckerPage() {
	return (
		<>
			<Navbar />
			<main>
				<BreadcrumbJsonLd items={breadcrumbs} />
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{ __html: JSON.stringify(toolJsonLd) }}
				/>
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
				/>
				<section className="py-20 sm:py-28" aria-labelledby="tool-heading">
					<div className="mx-auto max-w-3xl px-4 sm:px-6">
						<p className="label-mono">Free SEO Tool</p>
						<h1 id="tool-heading" className="display mt-3 text-4xl sm:text-5xl">
							AI Crawler{" "}
							<span className="text-highlight">Checker</span>
						</h1>
						<p className="mt-5 max-w-2xl text-lg text-muted">
							Detect which AI crawlers can access your pages and identify blocking rules in
							robots.txt or meta directives. Free. No signup required.
						</p>

						<ToolRunner toolType="ai-crawler-checker" buttonLabel="Check AI Crawlers" placeholder="example.com" />

						<div className="prose prose-muted mt-14 max-w-none space-y-6 text-sm leading-relaxed text-muted">
							<h2 className="text-base font-bold text-ink">Common AI crawlers</h2>
							<ul className="list-disc space-y-2 pl-5">
								<li><strong className="text-ink">GPTBot</strong> — OpenAI's web crawler for ChatGPT and model training.</li>
								<li><strong className="text-ink">Google-Extended</strong> — Google's crawler for Bard and Gemini model training.</li>
								<li><strong className="text-ink">ClaudeBot</strong> — Anthropic's web crawler for Claude.</li>
								<li><strong className="text-ink">CCBot</strong> — Common Crawl's bot used to train many LLMs.</li>
							</ul>
							<h2 className="text-base font-bold text-ink">Why AI crawler access matters</h2>
							<p>
								AI crawlers can be blocked via robots.txt or meta directives just like traditional
								crawlers. Use this tool to audit your AI crawler policy and ensure it matches your
								content strategy.
							</p>
						</div>
					</div>
				</section>
			</main>
			<Footer />
		</>
	);
}
