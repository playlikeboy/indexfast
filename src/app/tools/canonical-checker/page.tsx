import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";
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
	description:
		"Verify that a page's canonical tag matches the actual URL and detect canonical conflicts. Free canon checker tool.",
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
	description:
		"Verify a URL's canonical tag and detect mismatches with the actual page URL. Free canonical checker for SEO diagnostics.",
	keywords: [
		"canonical checker",
		"canonical tag checker",
		"canonical mismatch",
		"check canonical url",
		"canonical tag validator",
	],
	alternates: {
		canonical: `${SITE_URL}/tools/canonical-checker`,
	},
};

export default function CanonicalCheckerPage() {
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
							Canonical{" "}
							<span className="text-highlight">Checker</span>
						</h1>
						<p className="mt-5 max-w-2xl text-lg text-muted">
							Verify a page's canonical tag and detect mismatches with the current URL. Free.
							No signup required.
						</p>

						<ToolRunner toolType="canonical-checker" buttonLabel="Check Canonical Tag" placeholder="https://example.com/page" />

						<div className="prose prose-muted mt-14 max-w-none space-y-6 text-sm leading-relaxed text-muted">
							<h2 className="text-base font-bold text-ink">What this tool checks</h2>
							<ul className="list-disc space-y-2 pl-5">
								<li>rel=&quot;canonical&quot; in the HTML head.</li>
								<li>Link: &lt;URL&gt;; rel=&quot;canonical&quot; HTTP header.</li>
								<li>Whether the canonical URL matches the current URL or points elsewhere.</li>
							</ul>
							<h2 className="text-base font-bold text-ink">Why canonical issues hurt indexing</h2>
							<p>
								A canonical mismatch can split ranking signals, cause the wrong URL to rank, or
								lead search engines to believe the page is a duplicate. Use the canonical checker
								alongside index status tools for a full picture.
							</p>
						</div>
					</div>
				</section>
			</main>
			<Footer />
		</>
	);
}
