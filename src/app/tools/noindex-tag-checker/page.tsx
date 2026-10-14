import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";
import { ToolRunner } from "@/components/tools/ToolRunner";

const SITE_URL = "https://indexfast.co";

const breadcrumbs = [
	{ name: "Home", url: SITE_URL },
	{ name: "Free SEO Tools", url: `${SITE_URL}/tools` },
	{ name: "Noindex Tag Checker", url: `${SITE_URL}/tools/noindex-tag-checker` },
];

const toolJsonLd = {
	"@context": "https://schema.org",
	"@type": "WebApplication",
	name: "Noindex Tag Checker",
	applicationCategory: "BusinessApplication",
	operatingSystem: "Web",
	url: `${SITE_URL}/tools/noindex-tag-checker`,
	description:
		"Scan any URL or list of URLs for noindex meta tags and X-Robots-Tag headers. Free noindex tag checker.",
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
			name: "What is a noindex tag?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "A noindex tag is a meta robots directive or HTTP header that tells search engines not to include a page in their index. It's commonly used for staging sites, thank-you pages, and admin areas.",
			},
		},
		{
			"@type": "Question",
			name: "Can a page be indexed if it has a noindex tag?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "Search engines usually respect noindex and will not index the page. In rare cases, a page may still appear in results if Google believes the noindex was added accidentally or too recently.",
			},
		},
	],
};

export const metadata = {
	title: "Free Noindex Tag Checker | Detect Noindex Meta Tags and X-Robots Headers",
	description:
		"Check if a URL uses noindex meta tags or X-Robots-Tag headers. Free noindex tag checker for diagnosing indexing blockers.",
	keywords: [
		"noindex tag checker",
		"noindex checker",
		"check noindex tag",
		"x-robots-tag checker",
		"meta robots checker",
		"noindex detector",
	],
	alternates: {
		canonical: `${SITE_URL}/tools/noindex-tag-checker`,
	},
};

export default function NoindexTagCheckerPage() {
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
							Noindex Tag{" "}
							<span className="text-highlight">Checker</span>
						</h1>
						<p className="mt-5 max-w-2xl text-lg text-muted">
							Detect noindex meta tags and X-Robots-Tag headers on any URL. Free. No signup required.
						</p>

						<ToolRunner toolType="noindex-tag-checker" buttonLabel="Check Noindex Tag" placeholder="https://example.com/page" />

						<div className="prose prose-muted mt-14 max-w-none space-y-6 text-sm leading-relaxed text-muted">
							<h2 className="text-base font-bold text-ink">What this tool detects</h2>
							<ul className="list-disc space-y-2 pl-5">
								<li>&lt;meta name=&quot;robots&quot; content=&quot;noindex&quot;&gt; in the page head.</li>
								<li>X-Robots-Tag: noindex HTTP response header.</li>
								<li>Conflicting directives such as index, nofollow combinations.</li>
							</ul>
							<h2 className="text-base font-bold text-ink">How noindex affects indexing</h2>
							<p>
								Pages with a noindex directive are typically excluded from Google's index. Accidental
								noindex tags are one of the most common causes of missing pages after a site launch
								or migration.
							</p>
						</div>
					</div>
				</section>
			</main>
			<Footer />
		</>
	);
}
