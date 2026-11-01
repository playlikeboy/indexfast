import type { Metadata } from "next";
import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";
import { PostShell } from "../_components/PostShell";
import { PostFaq, type FaqItem } from "../_components/PostFaq";
import { withPageSeo } from "@/lib/seo";

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
			url: `${SITE_URL}/logo.png`,
		},
	},
	mainEntityOfPage: `${SITE_URL}/blog/find-unindexed-pages`,
};

// Rendered as the visible FAQ and its FAQPage markup by PostFaq, so the two never diverge.
const faqs: FaqItem[] = [
	{
		question: "How do I find unindexed pages on my site?",
		answer:
			"Start by exporting your sitemap URLs, then check index status with Search Console URL Inspection or the Pages report (the site: operator gives only a rough count). Compare the sitemap list against what's actually in Google's index to find gaps.",
	},
	{
		question: "Why would pages be in my sitemap but not indexed?",
		answer:
			"Common reasons include: the page is too new, it's blocked by robots.txt or noindex, it has low-quality or duplicate content, it lacks inbound links, or it returned an error during crawling.",
	},
	{
		question: "Can accidentally noindex pages be recovered?",
		answer:
			"Yes. Remove the noindex directive, ensure the page is accessible, resubmit it in Google Search Console, and request indexing. Most pages recover within a few days to a few weeks depending on crawl frequency.",
	},
];

export const metadata: Metadata = withPageSeo("/blog/find-unindexed-pages", {
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
});

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
				<PostShell
					slug="find-unindexed-pages"
					category="SEO Guide"
					title="How to find unindexed pages in 2026: the complete guide"
					lede="Your sitemap says you have 10,000 pages. Google Search Console shows only 6,200 indexed. Where did the other 3,800 pages go? Here is the exact workflow top SEO teams use to find, diagnose, and recover unindexed pages — and give them the best chance of getting back into Google's index."
				>
					<h2>Why finding unindexed pages matters more than ever</h2>
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

					<h2>Step 1: Export your sitemap</h2>
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

					<h2>Step 2: Check what Google actually has indexed</h2>
					<p>
						Google Search Console is the authoritative source for what Google has indexed.
						For a rough first look, use the site: operator in Google Search (e.g. site:yourdomain.com) to see a rough
						count of indexed pages. For accurate, server-side data, connect Google Search
						Console and pull the Pages report.
					</p>
					<p>
						For a quick automated check, use the Bulk Index Checker. Paste up to 20 URLs and it
						checks whether each one can be indexed (HTTP status, redirects, noindex and
						canonical), with a link to URL Inspection in Search Console to confirm the status.
					</p>

					<h2>Step 3: Diagnose why pages are missing</h2>
					<p>
						Once you have a list of URLs that are in your sitemap but not in Google's index,
						run diagnostics to find the blocker:
					</p>
					<ul>
						<li>
							<strong>HTTP status:</strong> Use the HTTP Status Checker to confirm the URL returns 200 OK. 404s, 410s, and 5xx errors block indexing.
						</li>
						<li>
							<strong>Robots.txt:</strong> Check if the URL path is disallowed in robots.txt. Blocked paths are not crawled and cannot be indexed.
						</li>
						<li>
							<strong>Noindex tags:</strong> Scan the page source and headers for noindex meta tags or X-Robots-Tag headers.
						</li>
						<li>
							<strong>Canonical tags:</strong> Verify the canonical tag points to the current URL and not to a different page.
						</li>
						<li>
							<strong>Content quality:</strong> Thin, duplicate, or auto-generated content may be filtered by Google.
						</li>
						<li>
							<strong>Crawl budget:</strong> Very large sites may have deep pages that Google simply has not reached yet.
						</li>
					</ul>

					<h2>Step 4: Fix and request re-indexing</h2>
					<p>
						After identifying the root cause, fix the issue:
					</p>
					<ul>
						<li>Remove accidental noindex tags or robots.txt blocks.</li>
						<li>Fix canonical mismatches and redirect chains.</li>
						<li>Improve content quality and add internal links to the page.</li>
						<li>Resubmit the sitemap in Google Search Console.</li>
						<li>Use the URL Inspection tool in GSC for individual re-indexing requests.</li>
						<li>Submit changed URLs via IndexNow to Bing and supported engines.</li>
					</ul>

					<h2>Step 5: Monitor ongoing indexing health</h2>
					<p>
						Indexing is not a one-time check. Set up periodic monitoring to catch new drops
						before they impact traffic. Tools like IndexFast automate sitemap sync, indexability
						diagnostics and Search Console URL inspection, so blockers show up on the next sync
						instead of weeks later when traffic drops.
					</p>

					<h2>Common mistakes when auditing indexing</h2>
					<ul>
						<li>Relying only on the site: operator, which gives rough estimates and varies by region.</li>
						<li>Ignoring new pages that have not been crawled yet — give them 1-2 weeks before panicking.</li>
						<li>Fixing one issue and assuming all others are resolved. Run a full diagnostic suite.</li>
						<li>Forgetting to remove noindex tags after moving from staging to production.</li>
					</ul>

					<h2>Final thoughts</h2>
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
					<PostFaq items={faqs} />
				</PostShell>
			</main>
			<Footer />
		</>
	);
}
