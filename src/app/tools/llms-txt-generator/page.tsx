import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";
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
	description:
		"Generate an llms.txt file describing your site for AI crawlers and LLM indexing. Free generator.",
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
				text: "llms.txt is a plain-text file hosted at the root of a domain that provides structured information about a site's content, purpose, and AI-crawler policies. It helps AI crawlers and LLM indexers understand your site.",
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
	keywords: [
		"llms.txt generator",
		"llmstxt generator",
		"generate llms.txt",
		"llms.txt file",
		"ai crawler file",
	],
	alternates: {
		canonical: `${SITE_URL}/tools/llms-txt-generator`,
	},
};

export default function LlmsTxtGeneratorPage() {
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
							llms.txt{" "}
							<span className="text-highlight">Generator</span>
						</h1>
						<p className="mt-5 max-w-2xl text-lg text-muted">
							Generate an llms.txt file to describe your site structure, main sections, and
							AI-crawler access rules. Free. No signup required.
						</p>

						<ToolRunner toolType="llms-txt-generator" buttonLabel="Generate llms.txt" placeholder="example.com" />

						<div className="prose prose-muted mt-14 max-w-none space-y-6 text-sm leading-relaxed text-muted">
							<h2 className="text-base font-bold text-ink">What llms.txt includes</h2>
							<ul className="list-disc space-y-2 pl-5">
								<li>Site identity and purpose.</li>
								<li>Main sections and content categories.</li>
								<li>AI-crawler access rules and restrictions.</li>
								<li>Optional recommended entry points for AI indexing.</li>
							</ul>
							<h2 className="text-base font-bold text-ink">Who should use llms.txt?</h2>
							<p>
								Any site that wants AI crawlers and LLM platforms to accurately understand its
								content should consider adding llms.txt. It complements robots.txt by providing
								semantic guidance rather than just access rules.
							</p>
						</div>
					</div>
				</section>
			</main>
			<Footer />
		</>
	);
}
