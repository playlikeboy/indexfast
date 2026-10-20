import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";
import { ToolRunner } from "@/components/tools/ToolRunner";

const SITE_URL = "https://indexfast.co";

const breadcrumbs = [
	{ name: "Home", url: SITE_URL },
	{ name: "Free SEO Tools", url: `${SITE_URL}/tools` },
	{ name: "Google Index Checker", url: `${SITE_URL}/tools/google-index-checker` },
];

const toolJsonLd = {
	"@context": "https://schema.org",
	"@type": "WebApplication",
	name: "Google Index Checker",
	applicationCategory: "BusinessApplication",
	operatingSystem: "Web",
	url: `${SITE_URL}/tools/google-index-checker`,
	description:
		"Check if a URL is indexed by Google using live SERP verification. Free, no signup required.",
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
			name: "How does the Google Index Checker work?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "The tool performs a live Google search using the site: operator and analyzes the first page of results to confirm whether the target URL is currently present in Google's index.",
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

export const metadata = {
	title: "Free Google Index Checker | Verify If Google Has Indexed Your URL",
	description:
		"Check if any URL is indexed in Google using live SERP verification. Fast, free, no signup required. Use the Google Index Checker to confirm indexing status instantly.",
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
};

export default function GoogleIndexCheckerPage() {
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
							Google Index{" "}
							<span className="text-highlight">Checker</span>
						</h1>
						<p className="mt-5 max-w-2xl text-lg text-muted">
							Verify whether Google has indexed a specific URL using live SERP checks.
							Free. No signup required.
						</p>

						<ToolRunner toolType="google-index-checker" buttonLabel="Analyze Google Indexability" placeholder="https://example.com/page" />

						<div className="prose prose-muted mt-14 max-w-none space-y-6 text-sm leading-relaxed text-muted">
							<h2 className="text-base font-bold text-ink">How to check if a URL is indexed</h2>
							<ol className="list-decimal space-y-2 pl-5">
								<li>Enter the full URL you want to verify.</li>
								<li>Submit the form.</li>
								<li>Review the live SERP result to confirm index status.</li>
							</ol>
							<h2 className="text-base font-bold text-ink">What does indexed mean?</h2>
							<p>
								A URL is indexed when Google has discovered, crawled, and stored it in its search
								index. Indexed pages can appear in Google Search results. Pages that are not
								indexed are invisible to most organic traffic.
							</p>
							<h2 className="text-base font-bold text-ink">Common reasons a URL is not indexed</h2>
							<ul className="list-disc space-y-2 pl-5">
								<li>The page is too new for Google to discover.</li>
								<li>Robots.txt or a noindex tag blocks indexing.</li>
								<li>The URL returns an error, redirect, or 4xx/5xx status.</li>
								<li>Duplicate or thin content is filtered by Google.</li>
								<li>The page has no or very few internal or external links.</li>
							</ul>
							<h2 className="text-base font-bold text-ink">When to use this tool</h2>
							<p>
								Use the Google Index Checker right after publishing a new page, after submitting
								a URL to Google Search Console, or after launching a programmatic SEO batch to
								confirm that important pages were actually discovered.
							</p>
						</div>
					</div>
				</section>
			</main>
			<Footer />
		</>
	);
}
