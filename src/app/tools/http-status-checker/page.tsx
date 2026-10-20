import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";
import { ToolRunner } from "@/components/tools/ToolRunner";

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
	description:
		"Check HTTP status codes, redirect chains, and response headers for any URL. Free HTTP status checker.",
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

export const metadata = {
	title: "Free HTTP Status Checker | Check Redirects, 404s, and Response Codes",
	description:
		"Check HTTP status codes, redirect chains, and response headers for any URL. Free HTTP status checker for SEO and technical diagnostics.",
	keywords: [
		"http status checker",
		"http status code checker",
		"redirect chain checker",
		"check http headers",
		"http response checker",
		"404 checker",
	],
	alternates: {
		canonical: `${SITE_URL}/tools/http-status-checker`,
	},
};

export default function HttpStatusCheckerPage() {
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
							HTTP Status{" "}
							<span className="text-highlight">Checker</span>
						</h1>
						<p className="mt-5 max-w-2xl text-lg text-muted">
							Verify HTTP status codes, redirect chains, and response headers for any URL.
							Free. No signup required.
						</p>

						<ToolRunner toolType="http-status-checker" buttonLabel="Check HTTP Status" placeholder="https://example.com/page" />

						<div className="prose prose-muted mt-14 max-w-none space-y-6 text-sm leading-relaxed text-muted">
							<h2 className="text-base font-bold text-ink">Common status codes and what they mean</h2>
							<ul className="list-disc space-y-2 pl-5">
								<li><strong className="text-ink">200 OK</strong> — The page is accessible and can be indexed.</li>
								<li><strong className="text-ink">301 Moved Permanently</strong> — A permanent redirect; typically passes indexing signals.</li>
								<li><strong className="text-ink">302 Found</strong> — A temporary redirect; may not pass full indexing signals.</li>
								<li><strong className="text-ink">404 Not Found</strong> — The page is missing; it will not be indexed.</li>
								<li><strong className="text-ink">410 Gone</strong> — The page is permanently removed; it should drop from the index.</li>
								<li><strong className="text-ink">5xx Server Error</strong> — Server issues prevent indexing during the error period.</li>
							</ul>
							<h2 className="text-base font-bold text-ink">Why this matters for indexing</h2>
							<p>
								A page returning an error, excessive redirect, or unexpected status code is a common
								reason pages do not appear in Google. Use the HTTP Status Checker alongside index
								lookups and canonical checks to catch all technical blockers.
							</p>
						</div>
					</div>
				</section>
			</main>
			<Footer />
		</>
	);
}
