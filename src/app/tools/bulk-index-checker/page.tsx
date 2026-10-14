import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";
import { ToolRunner } from "@/components/tools/ToolRunner";

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
	description:
		"Check Google index status for hundreds of URLs at once via bulk CSV-style input. Free, fast, and no signup required.",
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
			name: "How many URLs can I check at once?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "You can paste hundreds of URLs in a single bulk check. For higher volumes, use an IndexFast paid plan for extended batch processing.",
			},
		},
		{
			"@type": "Question",
			name: "Does this tool tell me why URLs are not indexed?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "The Bulk Index Checker shows live SERP presence. To diagnose why pages are not indexed — noindex tags, canonical issues, robots.txt blocks — use IndexFast's diagnostics dashboard.",
			},
		},
	],
};

export const metadata = {
	title: "Free Bulk Index Checker | Check Multiple URLs on Google at Once",
	description:
		"Check Google index status for hundreds of URLs at once with IndexFast's free bulk index checker. Paste URLs and get instant SERP results.",
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
};

export default function BulkIndexCheckerPage() {
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
							Bulk Index{" "}
							<span className="text-highlight">Checker</span>
						</h1>
						<p className="mt-5 max-w-2xl text-lg text-muted">
							Check whether dozens or hundreds of URLs appear in Google's index simultaneously.
							Free. No signup required.
						</p>

						<ToolRunner toolType="bulk-index-checker" buttonLabel="Run Bulk Index Check" />

						<div className="prose prose-muted mt-14 max-w-none space-y-6 text-sm leading-relaxed text-muted">
							<h2 className="text-base font-bold text-ink">How bulk index checking works</h2>
							<p>
								Bulk index checking lets you verify Google index presence for many URLs at once
								instead of running individual checks. It's especially useful after pSEO launches,
								migrations, or sitemap updates.
							</p>
							<h2 className="text-base font-bold text-ink">Best practices</h2>
							<ul className="list-disc space-y-2 pl-5">
								<li>Limit checks to your own properties whenever possible.</li>
								<li>Focus on recently published or updated pages.</li>
								<li>Follow up non-indexed URLs with diagnostics to find blockers.</li>
								<li>Use alongside sitemap monitoring for full coverage.</li>
							</ul>
							<h2 className="text-base font-bold text-ink">When to use this tool</h2>
							<p>
								Use it right after publishing a batch of pages, after submitting a new sitemap,
								or when reviewing a site migration to ensure important URLs were discovered by
								Google.
							</p>
						</div>
					</div>
				</section>
			</main>
			<Footer />
		</>
	);
}
