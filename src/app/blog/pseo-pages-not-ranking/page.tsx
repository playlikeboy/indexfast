import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { BreadcrumbJsonLd } from "@/components/marketing/BreadcrumbJsonLd";
import { PostShell } from "../_components/PostShell";
import { PostFaq, type FaqItem } from "../_components/PostFaq";
import type { Metadata } from "next";
import { withPageSeo } from "@/lib/seo";

const SITE_URL = "https://indexfast.co";

const breadcrumbs = [
	{ name: "Home", url: SITE_URL },
	{ name: "Blog", url: `${SITE_URL}/blog` },
	{ name: "Why Your Programmatic SEO Pages Are Not Ranking", url: `${SITE_URL}/blog/pseo-pages-not-ranking` },
];

const articleJsonLd = {
	"@context": "https://schema.org",
	"@type": "Article",
	headline: "Why Your Programmatic SEO Pages Are Not Ranking (And How to Fix It)",
	description:
		"Common pSEO indexing failures and how to fix them before they tank your organic growth. A deep dive into why launched pages disappear from search results.",
	image: `${SITE_URL}/og-image.png`,
	datePublished: "2026-05-15",
	dateModified: "2026-05-15",
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
	mainEntityOfPage: `${SITE_URL}/blog/pseo-pages-not-ranking`,
};

// Rendered as the visible FAQ and its FAQPage markup by PostFaq, so the two never diverge.
const faqs: FaqItem[] = [
	{
		question: "Why do programmatic SEO pages often fail to rank?",
		answer:
			"pSEO pages often fail because they are thin, duplicate, or lack the internal links and authority signals that search engines need. Technical issues like noindex tags, canonical mismatches, and slow page speed also prevent indexing and ranking.",
	},
	{
		question: "How many pSEO pages should I launch at once?",
		answer:
			"There is no magic number, but quality matters more than quantity. Launch pages in batches, monitor their indexing status, and fix technical blockers before scaling. Use tools like IndexFast to track which pages were discovered and which were dropped.",
	},
	{
		question: "How long does it take for a new pSEO page to rank?",
		answer:
			"It depends on crawl frequency, competition, and content quality. With an existing authoritative domain, pages can start appearing in days. For newer domains, it may take weeks or months. Submit via IndexNow and GSC to speed up discovery.",
	},
];

export const metadata: Metadata = withPageSeo("/blog/pseo-pages-not-ranking", {
	title: "Why Your Programmatic SEO Pages Are Not Ranking (And How to Fix It)",
	description:
		"Common pSEO indexing failures and how to fix them before they tank your organic growth. A deep dive into why launched pages disappear from search results.",
	keywords: [
		"programmatic seo not ranking",
		"pSEO pages not indexing",
		"pSEO indexing issues",
		"why pSEO pages fail",
		"programmatic seo google not indexing",
		"pSEO launch failures",
		"fix pSEO indexing",
	],
	alternates: {
		canonical: `${SITE_URL}/blog/pseo-pages-not-ranking`,
	},
});

export default function PseoNotRankingPost() {
	return (
		<>
			<Navbar />
			<main>
				<BreadcrumbJsonLd items={breadcrumbs} />
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
				/>
				<PostShell
					slug="pseo-pages-not-ranking"
					category="Programmatic SEO"
					title="Why your programmatic SEO pages are not ranking (and how to fix it)"
					lede="You launched 500 pSEO pages. Three months later, Google Search Console shows 40 indexed — and most of those are on page 10+. What is going wrong? Here is a comprehensive breakdown of the most common pSEO failures and how to fix them."
				>
					<h2>The pSEO indexing gap</h2>
					<p>
						Programmatic SEO promises scale: generate hundreds or thousands of pages optimized
						for long-tail keywords and let organic traffic compound. In theory, it works. In
						practice, most pSEO pipelines leak pages before they ever enter Google's index —
						or worse, they get indexed and then dropped.
					</p>
					<p>
						The reasons are almost always preventable. They fall into four categories:
						technical, content, authority, and monitoring. Fixing each category is a prerequisite
						before scaling your next launch.
					</p>

					<h2>1. Technical blockers are silently killing pages</h2>
					<p>
						Before you blame content quality or competition, rule out the most common technical
						reasons a pSEO page fails to index:
					</p>

					<h3>Accidental noindex tags</h3>
					<p>
						The number one cause of "missing" pSEO pages is an accidental noindex meta tag
						left over from staging or a template migration. Noindex tells Google to exclude the
						page from the index — period. Check every template, layout, and CMS field for
						noindex before publishing.
					</p>

					<h3>Robots.txt blocks</h3>
					<p>
						A single Disallow rule for a common path prefix (e.g. /category/, /location/) can
						block thousands of pages from being crawled. Verify robots.txt before every major
						launch, especially after migrations or CMS changes.
					</p>

					<h3>Canonical mismatches</h3>
					<p>
						If your pSEO template sets a canonical to a parent page or a filter URL, every
						generated page signals that it is a duplicate of something else. Google may choose
						to index the canonical and ignore the rest.
					</p>

					<h3>HTTP errors and redirect chains</h3>
					<p>
						Pages that return 404, 410, 5xx, or long redirect chains will not be indexed.
						Programmatically generated pages often live behind dynamic routing that introduces
						unexpected status codes. Run the HTTP Status Checker across a sample of your pSEO
						URLs to catch issues early.
					</p>

					<h2>2. Thin content triggers quality filters</h2>
					<p>
						Even if your pages are technically accessible, Google's quality algorithms are
						designed to filter out thin, repetitive, or low-value content. pSEO pages are
						particularly vulnerable because they often share:
					</p>
					<ul>
						<li>Nearly identical title tags and meta descriptions.</li>
						<li>Minimal unique body content beyond swapped variables.</li>
						<li>Duplicate or near-duplicate content across multiple templates.</li>
						<li>Thin sections with 200-300 words of generic filler text.</li>
					</ul>
					<p>
						Google's Panda-adjacent quality filters have historically targeted thin programmatic
						content. In 2026, the bar is higher. Each page needs enough unique, useful content
						to justify its own index entry.
					</p>

					<h2>3. Authority and internal linking gaps</h2>
					<p>
						New pages — especially large batches — are born with no authority. Without internal
						links from higher-authority pages, they rely entirely on sitemap discovery and
						submission signals. That is rarely enough for competitive keywords.
					</p>
					<p>
						Before launching a pSEO batch:
					</p>
					<ul>
						<li>Link from existing high-authority pages to new pages.</li>
						<li>Build topic clusters so related pages support each other.</li>
						<li>Use faceted navigation or related-content widgets to generate natural internal links.</li>
						<li>Submit new URLs via IndexNow for fast discovery.</li>
					</ul>

					<h2>4. No monitoring means no early warning</h2>
					<p>
						Most pSEO failures are invisible until traffic drops. By then, weeks or months of
						work have been wasted. The solution is monitoring from day one:
					</p>
					<ul>
						<li>Run a bulk index check 48-72 hours after launch.</li>
						<li>Monitor sitemap coverage in Google Search Console daily for the first week.</li>
						<li>Set up alerts for pages that drop from the index.</li>
						<li>Track crawl stats in GSC to confirm Google is actually fetching your pages.</li>
					</ul>

					<h2>The pSEO launch checklist</h2>
					<p>
						Use this checklist before every major pSEO launch:
					</p>
					<ol>
						<li>Verify noindex tags are absent from all templates.</li>
						<li>Confirm robots.txt allows access to the new URL paths.</li>
						<li>Check that canonical tags point to the correct URLs.</li>
						<li>Run HTTP status checks on a sample of generated URLs.</li>
						<li>Confirm internal linking structure is in place.</li>
						<li>Submit the sitemap to Google Search Console and Bing Webmaster.</li>
						<li>Send new URLs via IndexNow for fast discovery.</li>
						<li>Monitor indexing status 48 hours post-launch.</li>
					</ol>

					<h2>Final thoughts</h2>
					<p>
						Programmatic SEO works — but only when the underlying technical and content
						foundations are solid. The teams that win at pSEO are not the ones who launch the
						most pages. They are the ones who monitor indexing, fix blockers fast, and keep
						their generated content above the quality threshold.
					</p>
					<PostFaq items={faqs} />
				</PostShell>
			</main>
			<Footer />
		</>
	);
}
