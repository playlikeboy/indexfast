import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";
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
	description:
		"Analyze any site's robots.txt instantly. See crawl rules, Disallow paths, and sitemap references.",
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
							Robots.txt{" "}
							<span className="text-highlight">Checker</span>
						</h1>
						<p className="mt-5 max-w-2xl text-lg text-muted">
							Instant robots.txt analysis showing crawl rules, Disallow paths, sitemap references,
							and potential indexing blockers. Free. No signup required.
						</p>

						<ToolRunner toolType="robots-txt-checker" buttonLabel="Analyze robots.txt" placeholder="example.com" />

						<div className="prose prose-muted mt-14 max-w-none space-y-6 text-sm leading-relaxed text-muted">
							<h2 className="text-base font-bold text-ink">What to look for in robots.txt</h2>
							<p>
								A well-configured robots.txt should allow crawlers to access important pages and
								paths while blocking system directories, admin areas, and duplicate pages. Common
								mistakes include accidentally blocking entire sections of a site.
							</p>
							<h2 className="text-base font-bold text-ink">Common robots.txt mistakes</h2>
							<ul className="list-disc space-y-2 pl-5">
								<li>Disallow: / after a site migration or redesign.</li>
								<li>Blocking CSS or JavaScript paths needed for rendering.</li>
								<li>Missing Sitemap directive.</li>
								<li>Case-sensitivity issues in path patterns.</li>
							</ul>
						</div>
					</div>
				</section>
			</main>
			<Footer />
		</>
	);
}
