import type { Metadata } from "next";
import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";

const SITE_URL = "https://indexfast.co";

const breadcrumbs = [
	{ name: "Home", url: SITE_URL },
	{ name: "Blog", url: `${SITE_URL}/blog` },
	{ name: "How to Find Unindexed Pages in 2026", url: `${SITE_URL}/blog/find-unindexed-pages` },
];

const toolJsonLd = {
	"@context": "https://schema.org",
	"@type": "Article",
	headline: "How to Find Unindexed Pages in 2026: The Complete Guide",
	description:
		"A step-by-step guide to auditing your sitemap, running index checks, and recovering dropped pages in 2026.",
	image: `${SITE_URL}/og-image.png`,
	datePublished: "2026-06-01",
	dateModified: "2026-06-01",
	author: {
		"@type": "Organization",
		name: "IndexFast",
		url: SITE_URL,
	},
	publisher: {
		"@type": "Organization",
		name: "IndexFast",
		url: SITE_URL,
		logo: {
			"@type": "ImageObject",
			url: `${SITE_URL}/favicon.svg`,
		},
	},
	mainEntityOfPage: `${SITE_URL}/blog/find-unindexed-pages`,
};

const faqJsonLd = {
	"@context": "https://schema.org",
	"@type": "FAQPage",
	mainEntity: [
		{
			"@type": "Question",
			name: "How do I find unindexed pages on my site?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "Start by exporting your sitemap URLs, then run live SERP checks using the site: operator or a tool like Google Search Console. Compare the sitemap list against what's actually in Google's index to find gaps.",
			},
		},
		{
			"@type": "Question",
			name: "Why would pages be in my sitemap but not indexed?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "Common reasons include: the page is too new, it's blocked by robots.txt or noindex, it has low-quality or duplicate content, it lacks inbound links, or it returned an error during crawling.",
			},
		},
		{
			"@type": "Question",
			name: "Can accidentally noindex pages be recovered?",
			acceptedAnswer: {
				"@type": "Answer",
				text: "Yes. Remove the noindex directive, ensure the page is accessible, resubmit it in Google Search Console, and request indexing. Most pages recover within a few days to a few weeks depending on crawl frequency.",
			},
		},
	],
};

export const metadata: Metadata = {
	title: "How to Find Unindexed Pages in 2026: The Complete Guide",
	description:
		"Learn how to audit your sitemap, run index checks, and recover dropped pages in 2026. A step-by-step guide to fixing invisible pages and recovering lost organic traffic.",
	keywords: [
		"find unindexed pages",
		"how to find unindexed pages",
		"unindexed pages",
		"pages not indexed by google",
		"recover dropped pages",
		"indexing audit",
		"google index checker",
	],
	alternates: {
		canonical: `${SITE_URL}/blog/find-unindexed-pages`,
	},
	openGraph: {
		title: "How to Find Unindexed Pages in 2026: The Complete Guide",
		description:
			"Learn how to audit your sitemap, run index checks, and recover dropped pages in 2026.",
		images: [`${SITE_URL}/og-image.png`],
	},
	twitter: {
		card: "summary_large_image",
		title: "How to Find Unindexed Pages in 2026: The Complete Guide",
		description:
			"Learn how to audit your sitemap, run index checks, and recover dropped pages in 2026.",
	},
};

export default function FindUnindexedPagesPost() {
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
				<article className="py-20 sm:py-28" aria-labelledby="post-heading">
					<div className="mx-auto max-w-3xl px-4 sm:px-6">
						<p className="label-mono">SEO Guide · June 1, 2026 · 12 min read</p>
						<h1 id="post-heading" className="display mt-3 text-4xl sm:text-5xl">
							How to Find Unindexed Pages in{" "}
							<span className="text-highlight">2026: The Complete Guide</span>
						</h1>
						<p className="mt-5 max-w-2xl text-lg text-muted">
							Your sitemap says you have 10,000 pages. Google Search Console shows only 6,200 indexed.
							Where did the other 3,800 pages go? Here is the exact workflow top SEO teams use to
							find, diagnose, and recover unindexed pages — and get them back into Google's index
							fast.
						</p>

						<div className="prose prose-muted mt-14 max-w-none space-y-8 text-sm leading-relaxed text-muted">
							<h2 className="text-base font-bold text-ink">Why finding unindexed pages matters more than ever</h2>
							<p>
								In 2026, Google's crawl budget and indexing algorithms are stricter than ever. With
								the rise of programmatic SEO, AI-generated content, and massive site migrations,
								search engines are more selective about what they index. A page that exists on your
								site is not the same as a page that exists in Google's index. If your pages are not
								indexed, they generate zero organic traffic — no matter how good the content is.
							</p>
							<p>
								Finding unindexed pages is the first step in fixing the problem. Without knowing
								which pages are missing, you are guessing. With data, you can prioritize the
								highest-impact recovery efforts and stop wasting crawl budget on pages that will
								never rank.
							</p>

							<h2 className="text-base font-bold text-ink">Step 1: Export your sitemap</h2>
							<p>
								Your XML sitemap is the authoritative list of pages you want search engines to
								discover. Start by fetching your sitemap — usually at /sitemap.xml or via a sitemap
								index. If you use a CMS or SEO tool, export the sitemap URL list directly.
							</p>
							<p>
								For large sites, use the Sitemap URL Extractor to pull every URL from complex
								sitemap indexes. This gives you a clean, deduplicated list of every page you have
								submitted for indexing.
							</p>

							<h2 className="text-base font-bold text-ink">Step 2: Check what Google actually has indexed</h2>
							<p>
								The fastest way to compare your sitemap against reality is with a live SERP check.
								Use the site: operator in Google Search (e.g. site:yourdomain.com) to see a rough
								count of indexed pages. For accurate, server-side data, connect Google Search
								Console and pull the Pages report.
							</p>
							<p>
								For a quick automated check, use the Bulk Index Checker. Paste your sitemap URLs
								and get live SERP verification for every URL in minutes.
							</p>

							<h2 className="text-base font-bold text-ink">Step 3: Diagnose why pages are missing</h2>
							<p>
								Once you have a list of URLs that are in your sitemap but not in Google's index,
								run diagnostics to find the blocker:
							</p>
							<ul className="list-disc space-y-2 pl-5">
								<li>
									<strong className="text-ink">HTTP status:</strong> Use the HTTP Status Checker to confirm the URL returns 200 OK. 404s, 410s, and 5xx errors block indexing.
								</li>
								<li>
									<strong className="text-ink">Robots.txt:</strong> Check if the URL path is disallowed in robots.txt. Blocked paths are not crawled and cannot be indexed.
								</li>
								<li>
									<strong className="text-ink">Noindex tags:</strong> Scan the page source and headers for noindex meta tags or X-Robots-Tag headers.
								</li>
								<li>
									<strong className="text-ink">Canonical tags:</strong> Verify the canonical tag points to the current URL and not to a different page.
								</li>
								<li>
									<strong className="text-ink">Content quality:</strong> Thin, duplicate, or auto-generated content may be filtered by Google.
								</li>
								<li>
									<strong className="text-ink">Crawl budget:</strong> Very large sites may have deep pages that Google simply has not reached yet.
								</li>
							</ul>

							<h2 className="text-base font-bold text-ink">Step 4: Fix and request re-indexing</h2>
							<p>
								After identifying the root cause, fix the issue:
							</p>
							<ul className="list-disc space-y-2 pl-5">
								<li>Remove accidental noindex tags or robots.txt blocks.</li>
								<li>Fix canonical mismatches and redirect chains.</li>
								<li>Improve content quality and add internal links to the page.</li>
								<li>Resubmit the sitemap in Google Search Console.</li>
								<li>Use the URL Inspection tool in GSC for individual re-indexing requests.</li>
								<li>Submit changed URLs via IndexNow to Bing and supported engines.</li>
							</ul>

							<h2 className="text-base font-bold text-ink">Step 5: Monitor ongoing indexing health</h2>
							<p>
								Indexing is not a one-time check. Set up periodic monitoring to catch new drops
								before they impact traffic. Tools like IndexFast automate sitemap sync, diagnostics,
								and deindexing alerts so you are notified the moment a page disappears — not weeks
								later when traffic drops.
							</p>

							<h2 className="text-base font-bold text-ink">Common mistakes when auditing indexing</h2>
							<ul className="list-disc space-y-2 pl-5">
								<li>Relying only on the site: operator, which gives rough estimates and varies by region.</li>
								<li>Ignoring new pages that have not been crawled yet — give them 1-2 weeks before panicking.</li>
								<li>Fixing one issue and assuming all others are resolved. Run a full diagnostic suite.</li>
								<li>Forgetting to remove noindex tags after moving from staging to production.</li>
							</ul>

							<h2 className="text-base font-bold text-ink">Final thoughts</h2>
							<p>
								Finding unindexed pages is one of the highest-ROI SEO tasks you can perform. Every
								recovered page is a new source of organic traffic. In 2026, with increasing
								competition and tighter search engine budgets, making sure your existing pages are
								actually visible is more important than publishing new ones.
							</p>
							<p>
								Start with a sitemap export, run a bulk index check, diagnose the blockers, fix
								them, and monitor continuously. That is the winning formula for indexing health.
							</p>
						</div>
					</div>
				</article>
			</main>
			<Footer />
		</>
	);
}
